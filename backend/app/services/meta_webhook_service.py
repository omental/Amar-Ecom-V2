from __future__ import annotations

import hashlib
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.tenant import tenant_scope
from app.models.messaging import ConversationMessage, MessagingChannel, MessagingProviderEvent
from app.services.messaging_provider import InboundMessage
from app.services.messaging_service import ingest_inbound
from app.services.ai_agent import CommerceAIAgent


def _timestamp(value) -> datetime:
    try:
        return datetime.fromtimestamp(int(value), tz=timezone.utc)
    except (TypeError, ValueError, OSError):
        return datetime.now(timezone.utc)


def _event_key(provider: str, event_type: str, asset: str, ref: str | None, payload: dict) -> str:
    if ref:
        return f"{event_type}:{asset}:{ref}"
    digest = hashlib.sha256(repr(sorted(payload.items())).encode()).hexdigest()[:32]
    return f"{event_type}:{asset}:{digest}"


async def _inbox_event(db: AsyncSession, *, provider: str, event_type: str, asset_ref: str, ref: str | None, payload: dict, channel_type: str) -> tuple[MessagingProviderEvent, bool]:
    key = _event_key(provider, event_type, asset_ref, ref, payload)
    existing = await db.scalar(select(MessagingProviderEvent).where(MessagingProviderEvent.provider == provider, MessagingProviderEvent.provider_event_key == key).execution_options(include_all_stores=True))
    if existing:
        return existing, False
    channel = await db.scalar(select(MessagingChannel).where(MessagingChannel.provider == provider, MessagingChannel.external_account_ref == asset_ref).execution_options(include_all_stores=True))
    event = MessagingProviderEvent(store_id=channel.store_id if channel else None, channel_id=channel.id if channel else None, provider=provider, provider_event_key=key, channel_type=channel_type, external_asset_ref=asset_ref, event_type=event_type, payload=payload, signature_valid=True, processing_status="received")
    db.add(event); await db.flush()
    if channel is None:
        event.processing_status = "ignored"; event.processed_at = datetime.now(timezone.utc)
    return event, True


async def process_meta_payload(db: AsyncSession, body: dict) -> tuple[int, list]:
    processed = 0
    queued_ai: list = []
    for entry in body.get("entry", []) if isinstance(body.get("entry"), list) else []:
        if not isinstance(entry, dict): continue
        page_id = str(entry.get("id") or "")
        for item in entry.get("messaging", []) if isinstance(entry.get("messaging"), list) else []:
            message = item.get("message") if isinstance(item, dict) else None
            if not isinstance(message, dict) or message.get("is_echo"): continue
            sender = str((item.get("sender") or {}).get("id") or "")
            mid = str(message.get("mid") or "")
            asset = f"facebook:{page_id}"
            safe = {"message_id": mid, "sender_ref": sender, "timestamp": item.get("timestamp"), "message_type": "text" if isinstance(message.get("text"), str) else "file", "text": str(message.get("text") or "Unsupported message type")[:4000]}
            event, fresh = await _inbox_event(db, provider="meta_facebook", event_type="message", asset_ref=asset, ref=mid, payload=safe, channel_type="facebook_messenger")
            if not fresh or event.channel_id is None: continue
            channel = await db.scalar(select(MessagingChannel).where(MessagingChannel.id == event.channel_id).execution_options(include_all_stores=True))
            try:
                with tenant_scope(store_id=channel.store_id, organization_id=channel.organization_id):
                    attachment = (message.get("attachments") or [{}])[0] if isinstance(message.get("attachments"), list) else {}
                    inbound = InboundMessage(external_account_ref=asset, external_conversation_ref=sender, external_user_ref=sender, provider_message_ref=mid, text=str(message.get("text") or "Unsupported message type"), sent_at=_timestamp(item.get("timestamp") / 1000 if isinstance(item.get("timestamp"), (int, float)) else item.get("timestamp")), message_type="text" if message.get("text") is not None else "file", metadata={"attachment_type": attachment.get("type"), "reply_to": (message.get("reply_to") or {}).get("mid")})
                    conversation, inbound_row, created = await ingest_inbound(db, channel=channel, value=inbound)
                    queued = await CommerceAIAgent(db).queue_for_inbound(conversation=conversation, message=inbound_row, newly_created=created)
                    if queued is not None: queued_ai.append(queued.id)
                event.processing_status = "processed"; event.processed_at = datetime.now(timezone.utc); processed += 1
            except Exception as exc:
                event.processing_status = "failed"; event.failure_reason = exc.__class__.__name__; event.retry_count += 1
        for change in entry.get("changes", []) if isinstance(entry.get("changes"), list) else []:
            value = change.get("value") if isinstance(change, dict) else None
            if not isinstance(value, dict): continue
            phone_id = str((value.get("metadata") or {}).get("phone_number_id") or "")
            if not phone_id: continue
            asset = f"whatsapp:{phone_id}"
            contacts = {str(c.get("wa_id")): str((c.get("profile") or {}).get("name") or "") for c in value.get("contacts", []) if isinstance(c, dict)}
            for message in value.get("messages", []) if isinstance(value.get("messages"), list) else []:
                if not isinstance(message, dict): continue
                mid, sender = str(message.get("id") or ""), str(message.get("from") or "")
                kind = str(message.get("type") or "unknown")
                text = str((message.get("text") or {}).get("body") or (message.get("button") or {}).get("text") or (message.get("interactive") or {}).get("button_reply", {}).get("title") or ("Unsupported message type" if kind not in {"image", "document"} else f"{kind.title()} attachment"))
                safe = {"message_id": mid, "sender_ref": sender, "timestamp": message.get("timestamp"), "message_type": kind, "text": text[:4000], "display_name": contacts.get(sender), "phone": sender}
                event, fresh = await _inbox_event(db, provider="meta_whatsapp", event_type="message", asset_ref=asset, ref=mid, payload=safe, channel_type="whatsapp")
                if not fresh or event.channel_id is None: continue
                channel = await db.scalar(select(MessagingChannel).where(MessagingChannel.id == event.channel_id).execution_options(include_all_stores=True))
                try:
                    with tenant_scope(store_id=channel.store_id, organization_id=channel.organization_id):
                        inbound = InboundMessage(external_account_ref=asset, external_conversation_ref=sender, external_user_ref=sender, provider_message_ref=mid, text=text, sent_at=_timestamp(message.get("timestamp")), display_name=contacts.get(sender), phone=sender, phone_verified=True, message_type=kind if kind in {"text", "image", "file"} else "system", metadata={"provider_type": kind, "media_id": str((message.get(kind) or {}).get("id") or "") or None, "context_message_id": (message.get("context") or {}).get("id")})
                        conversation, inbound_row, created = await ingest_inbound(db, channel=channel, value=inbound)
                        queued = await CommerceAIAgent(db).queue_for_inbound(conversation=conversation, message=inbound_row, newly_created=created)
                        if queued is not None: queued_ai.append(queued.id)
                    event.processing_status = "processed"; event.processed_at = datetime.now(timezone.utc); processed += 1
                except Exception as exc:
                    event.processing_status = "failed"; event.failure_reason = exc.__class__.__name__; event.retry_count += 1
            for receipt in value.get("statuses", []) if isinstance(value.get("statuses"), list) else []:
                if not isinstance(receipt, dict): continue
                ref, new_status = str(receipt.get("id") or ""), str(receipt.get("status") or "")
                safe = {"message_id": ref, "status": new_status, "timestamp": receipt.get("timestamp")}
                event, fresh = await _inbox_event(db, provider="meta_whatsapp", event_type="status", asset_ref=asset, ref=f"{ref}:{new_status}:{receipt.get('timestamp')}", payload=safe, channel_type="whatsapp")
                if not fresh or event.channel_id is None: continue
                channel = await db.scalar(select(MessagingChannel).where(MessagingChannel.id == event.channel_id).execution_options(include_all_stores=True))
                with tenant_scope(store_id=channel.store_id, organization_id=channel.organization_id):
                    row = await db.scalar(select(ConversationMessage).where(ConversationMessage.channel_id == channel.id, ConversationMessage.provider_message_ref == ref))
                    if row:
                        rank = {"queued": 0, "sent": 1, "delivered": 2, "read": 3}
                        at = _timestamp(receipt.get("timestamp"))
                        if new_status == "failed" and row.status not in {"delivered", "read"}:
                            row.status = "failed"; row.failed_at = at; row.failure_reason = "provider_delivery_failed"
                        elif new_status in rank and rank.get(new_status, 0) >= rank.get(row.status, 0):
                            row.status = new_status; row.provider_status_at = max(row.provider_status_at or at, at)
                            if new_status == "delivered": row.delivered_at = at
                            if new_status == "read": row.read_at = at
                event.processing_status = "processed"; event.processed_at = datetime.now(timezone.utc); processed += 1
    return processed, queued_ai


async def replay_meta_event(db: AsyncSession, event: MessagingProviderEvent) -> None:
    if event.processing_status != "failed":
        return
    channel = await db.scalar(select(MessagingChannel).where(MessagingChannel.id == event.channel_id).execution_options(include_all_stores=True)) if event.channel_id else None
    if channel is None:
        event.processing_status = "ignored"; event.processed_at = datetime.now(timezone.utc); return
    event.processing_status = "processing"; event.failure_reason = None; event.retry_count += 1
    try:
        if event.event_type == "message":
            value = event.payload
            sent_at = _timestamp(value.get("timestamp") / 1000 if event.provider == "meta_facebook" and isinstance(value.get("timestamp"), (int, float)) else value.get("timestamp"))
            with tenant_scope(store_id=channel.store_id, organization_id=channel.organization_id):
                await ingest_inbound(db, channel=channel, value=InboundMessage(external_account_ref=event.external_asset_ref or "", external_conversation_ref=str(value.get("sender_ref") or ""), external_user_ref=str(value.get("sender_ref") or ""), provider_message_ref=str(value.get("message_id") or ""), text=str(value.get("text") or "Unsupported message type"), sent_at=sent_at, display_name=value.get("display_name"), phone=value.get("phone"), phone_verified=event.provider == "meta_whatsapp", message_type=str(value.get("message_type") or "system") if str(value.get("message_type") or "") in {"text", "image", "file", "system"} else "system"))
        event.processing_status = "processed"; event.processed_at = datetime.now(timezone.utc)
    except Exception as exc:
        event.processing_status = "failed"; event.failure_reason = exc.__class__.__name__
