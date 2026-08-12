from __future__ import annotations

import hashlib
import json
import re
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.crypto import decrypt_secret, encrypt_secret
from app.models.access_control import ActivityLog
from app.models.messaging import Conversation, ConversationMessage, MessagingChannel, MessagingChannelSecret, MessagingOAuthState, MessagingTemplate
from app.models.tenant import Store
from app.models.user import User
from app.services.messaging_credentials import MessagingCredentialVault
from app.services.meta_graph import MetaProviderError, get_meta_graph_client


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def meta_configuration() -> dict:
    facebook = bool(settings.META_APP_ID and settings.META_APP_SECRET and settings.META_OAUTH_REDIRECT_URI)
    whatsapp = bool(facebook and settings.META_WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID)
    return {"configured": facebook, "facebook_configured": facebook, "whatsapp_configured": whatsapp,
            "app_id": settings.META_APP_ID if facebook else None, "embedded_signup_config_id": settings.META_WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID if whatsapp else None,
            "graph_api_version": settings.META_GRAPH_API_VERSION if facebook else None,
            "message": None if facebook else "Meta integration is not configured for this environment."}


async def create_facebook_oauth_state(db: AsyncSession, *, store: Store, user: User) -> tuple[str, MessagingOAuthState]:
    client = get_meta_graph_client()
    if not client.configured:
        raise HTTPException(status_code=503, detail="Meta integration is not configured for this environment.")
    raw = secrets.token_urlsafe(48)
    row = MessagingOAuthState(
        organization_id=store.organization_id, store_id=store.id, user_id=user.id,
        provider="meta_facebook", state_hash=hashlib.sha256(raw.encode()).hexdigest(), status="pending",
        encrypted_payload=encrypt_secret("{}"), expires_at=now_utc() + timedelta(minutes=settings.META_OAUTH_STATE_MINUTES),
    )
    db.add(row)
    await db.flush()
    return raw, row


async def authorize_facebook_callback(db: AsyncSession, *, state_value: str, code: str) -> tuple[MessagingOAuthState, list[dict]]:
    digest = hashlib.sha256(state_value.encode()).hexdigest()
    row = await db.scalar(select(MessagingOAuthState).where(MessagingOAuthState.state_hash == digest).execution_options(include_all_stores=True).with_for_update())
    if row is None or row.status != "pending" or row.expires_at <= now_utc():
        raise HTTPException(status_code=400, detail="OAuth state is invalid, expired, or already used")
    client = get_meta_graph_client()
    token = await client.exchange_code(code)
    pages = await client.list_pages(token)
    safe_pages = [{"id": str(item.get("id")), "name": str(item.get("name") or "Facebook Page")} for item in pages if item.get("id")]
    row.encrypted_payload = encrypt_secret(json.dumps({"token": token, "pages": pages}, separators=(",", ":")))
    row.status = "authorized"
    return row, safe_pages


async def connect_facebook_page(db: AsyncSession, *, store: Store, user: User, flow_id: UUID, page_id: str) -> MessagingChannel:
    flow = await db.scalar(select(MessagingOAuthState).where(
        MessagingOAuthState.id == flow_id, MessagingOAuthState.store_id == store.id,
        MessagingOAuthState.user_id == user.id, MessagingOAuthState.provider == "meta_facebook",
    ).with_for_update())
    if flow is None or flow.status != "authorized" or flow.expires_at <= now_utc():
        raise HTTPException(status_code=400, detail="Facebook authorization is invalid or expired")
    payload = json.loads(decrypt_secret(flow.encrypted_payload))
    page = next((item for item in payload.get("pages", []) if str(item.get("id")) == page_id), None)
    if page is None or not page.get("access_token"):
        raise HTTPException(status_code=403, detail="The selected Page is not available to this authorization")
    tasks = {str(item).upper() for item in page.get("tasks", [])}
    if tasks and not ({"MESSAGING", "MODERATE"} & tasks):
        raise HTTPException(status_code=403, detail="Required Messenger permissions were not granted")
    token = str(page["access_token"])
    client = get_meta_graph_client()
    granted = await client.granted_permissions(str(payload.get("token") or ""))
    required = {"pages_show_list", "pages_messaging", "pages_manage_metadata"}
    if not required.issubset(granted):
        raise HTTPException(status_code=403, detail="Required Page/Messenger permissions were not granted")
    await client.page_permissions(page_id, token)
    await client.subscribe_page(page_id, token)
    external = f"facebook:{page_id}"
    channel = await db.scalar(select(MessagingChannel).where(MessagingChannel.provider == "meta_facebook", MessagingChannel.external_account_ref == external).execution_options(include_all_stores=True))
    if channel is not None and channel.store_id != store.id:
        raise HTTPException(status_code=409, detail="This Facebook Page is already connected")
    if channel is None:
        channel = MessagingChannel(organization_id=store.organization_id, store_id=store.id, channel_type="facebook_messenger", provider="meta_facebook", name=str(page.get("name") or "Facebook Messenger"), external_account_ref=external)
        db.add(channel)
        await db.flush()
    channel.status = "connected"
    channel.capabilities = {"text": True, "image": True, "file": True, "read_receipts": True, "templates": False}
    channel.configuration_metadata = {"page_id": page_id, "page_name": str(page.get("name") or "Facebook Page"), "webhook_subscription": "subscribed", "health": "connected"}
    await MessagingCredentialVault(db).store(channel, {"page_access_token": token})
    flow.status = "consumed"; flow.consumed_at = now_utc(); flow.encrypted_payload = encrypt_secret("{}")
    db.add(ActivityLog(organization_id=store.organization_id, user_id=user.id, action="facebook_page_connected", module="inbox", entity_type="messaging_channel", entity_id=str(channel.id), message="Facebook Messenger channel connected."))
    return channel


async def connect_whatsapp(db: AsyncSession, *, store: Store, user: User, code: str, waba_id: str, phone_number_id: str, registration_pin: str | None) -> MessagingChannel:
    client = get_meta_graph_client()
    if not client.configured:
        raise HTTPException(status_code=503, detail="Meta integration is not configured for this environment.")
    token = await client.exchange_code(code)
    waba, phone = await client.verify_whatsapp_assets(waba_id=waba_id, phone_number_id=phone_number_id, access_token=token)
    await client.subscribe_waba(waba_id, token)
    if registration_pin:
        await client.register_phone(phone_number_id, token, registration_pin)
    external = f"whatsapp:{phone_number_id}"
    channel = await db.scalar(select(MessagingChannel).where(MessagingChannel.provider == "meta_whatsapp", MessagingChannel.external_account_ref == external).execution_options(include_all_stores=True))
    if channel is not None and channel.store_id != store.id:
        raise HTTPException(status_code=409, detail="This WhatsApp number is already connected")
    if channel is None:
        channel = MessagingChannel(organization_id=store.organization_id, store_id=store.id, channel_type="whatsapp", provider="meta_whatsapp", name=str(phone.get("verified_name") or "WhatsApp Business"), external_account_ref=external)
        db.add(channel); await db.flush()
    channel.status = "connected"
    channel.capabilities = {"text": True, "image": True, "file": True, "delivery_receipts": True, "read_receipts": True, "templates": True}
    channel.configuration_metadata = {"waba_id": waba_id, "waba_name": waba.get("name"), "phone_number_id": phone_number_id, "display_phone_number": phone.get("display_phone_number"), "verified_name": phone.get("verified_name"), "webhook_subscription": "subscribed", "registration": "registered" if registration_pin else "provider_managed", "health": "connected"}
    await MessagingCredentialVault(db).store(channel, {"access_token": token})
    db.add(ActivityLog(organization_id=store.organization_id, user_id=user.id, action="whatsapp_connected", module="inbox", entity_type="messaging_channel", entity_id=str(channel.id), message="WhatsApp Business channel connected."))
    return channel


async def sync_whatsapp_templates(db: AsyncSession, *, channel: MessagingChannel) -> list[MessagingTemplate]:
    if channel.provider != "meta_whatsapp":
        raise HTTPException(status_code=422, detail="Templates are only available for WhatsApp channels")
    credentials = await MessagingCredentialVault(db).load_for_provider(channel)
    source = await get_meta_graph_client().list_whatsapp_templates(str(channel.configuration_metadata.get("waba_id") or ""), credentials.get("access_token", ""))
    timestamp = now_utc()
    for item in source:
        ref, language = str(item.get("id") or item.get("name")), str(item.get("language") or "")
        template = await db.scalar(select(MessagingTemplate).where(MessagingTemplate.channel_id == channel.id, MessagingTemplate.provider_template_ref == ref, MessagingTemplate.language == language))
        if template is None:
            template = MessagingTemplate(store_id=channel.store_id, channel_id=channel.id, provider_template_ref=ref, name=str(item.get("name") or ref), language=language)
            db.add(template)
        template.category = str(item.get("category") or "").lower() or None
        template.status = str(item.get("status") or "pending").lower()
        template.components = item.get("components") if isinstance(item.get("components"), list) else []
        template.last_synced_at = timestamp
    channel.configuration_metadata = {**channel.configuration_metadata, "template_sync_status": "synced", "templates_last_synced_at": timestamp.isoformat()}
    await db.flush()
    return list((await db.execute(select(MessagingTemplate).where(MessagingTemplate.channel_id == channel.id).order_by(MessagingTemplate.name))).scalars().all())


def _required_variables(template: MessagingTemplate) -> int:
    indexes: set[int] = set()
    for component in template.components:
        for match in re.findall(r"\{\{(\d+)\}\}", str(component.get("text") or "")):
            indexes.add(int(match))
    return max(indexes, default=0)


async def send_whatsapp_template(db: AsyncSession, *, conversation: Conversation, template: MessagingTemplate, variables: list[str], actor: User, idempotency_key: str) -> ConversationMessage:
    if template.store_id != conversation.store_id or template.channel_id != conversation.channel_id:
        raise HTTPException(status_code=404, detail="Template not found")
    if template.status != "approved":
        raise HTTPException(status_code=409, detail="Only approved WhatsApp templates can be sent")
    required = _required_variables(template)
    if len(variables) != required or any(not value.strip() or len(value) > 1024 for value in variables):
        raise HTTPException(status_code=422, detail=f"This template requires exactly {required} variables")
    duplicate = await db.scalar(select(ConversationMessage).where(ConversationMessage.conversation_id == conversation.id, ConversationMessage.idempotency_key == idempotency_key))
    if duplicate: return duplicate
    credentials = await MessagingCredentialVault(db).load_for_provider(conversation.channel)
    components = [] if not variables else [{"type": "body", "parameters": [{"type": "text", "text": value.strip()} for value in variables]}]
    ref = await get_meta_graph_client().send_whatsapp_template(str(conversation.channel.configuration_metadata.get("phone_number_id") or ""), conversation.external_conversation_ref or "", template.name, template.language, components, credentials.get("access_token", ""))
    message = ConversationMessage(store_id=conversation.store_id, conversation_id=conversation.id, channel_id=conversation.channel_id, direction="outbound", message_type="text", sender_type="agent", sender_user_id=actor.id, idempotency_key=idempotency_key, provider_message_ref=ref, text_content=f"WhatsApp template: {template.name}", status="sent", sent_at=now_utc(), provider_metadata={"template_id": str(template.id), "template_name": template.name})
    db.add(message); conversation.last_message_at = message.sent_at; await db.flush(); return message


async def disconnect_meta_channel(db: AsyncSession, *, channel: MessagingChannel, actor: User) -> None:
    credentials = await MessagingCredentialVault(db).load_for_provider(channel)
    try:
        if channel.provider == "meta_facebook":
            await get_meta_graph_client().unsubscribe_page(str(channel.configuration_metadata.get("page_id") or ""), credentials.get("page_access_token", ""))
    except MetaProviderError:
        pass
    await db.execute(delete(MessagingChannelSecret).where(MessagingChannelSecret.channel_id == channel.id))
    channel.status = "disconnected"
    channel.configuration_metadata = {**channel.configuration_metadata, "health": "disconnected", "webhook_subscription": "unsubscribed"}
    db.add(ActivityLog(organization_id=channel.organization_id, user_id=actor.id, action="meta_channel_disconnected", module="inbox", entity_type="messaging_channel", entity_id=str(channel.id), message="Meta messaging channel disconnected."))


class MetaChannelHealthService:
    """Checks provider authorization without exposing credentials to callers."""
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def check(self, channel: MessagingChannel) -> dict:
        credentials = await MessagingCredentialVault(self.db).load_for_provider(channel)
        try:
            if channel.provider == "meta_facebook":
                await get_meta_graph_client().page_permissions(str(channel.configuration_metadata.get("page_id") or ""), credentials.get("page_access_token", ""))
            elif channel.provider == "meta_whatsapp":
                await get_meta_graph_client().verify_whatsapp_assets(waba_id=str(channel.configuration_metadata.get("waba_id") or ""), phone_number_id=str(channel.configuration_metadata.get("phone_number_id") or ""), access_token=credentials.get("access_token", ""))
            else:
                return {"status": channel.status, "health": "not_applicable"}
            channel.status = "connected"
            channel.configuration_metadata = {**channel.configuration_metadata, "health": "connected", "health_checked_at": now_utc().isoformat()}
        except MetaProviderError as exc:
            channel.status = "authorization_expired" if exc.kind == "authorization_required" else "permissions_revoked" if exc.kind == "permission_denied" else "provider_error"
            channel.configuration_metadata = {**channel.configuration_metadata, "health": channel.status, "health_checked_at": now_utc().isoformat()}
            if exc.kind in {"authorization_required", "permission_denied"}:
                self.db.add(ActivityLog(organization_id=channel.organization_id, action="provider_authorization_lost", module="inbox", entity_type="messaging_channel", entity_id=str(channel.id), message="Meta channel authorization requires attention."))
        await self.db.flush()
        return {"status": channel.status, "health": channel.configuration_metadata.get("health"), "checked_at": channel.configuration_metadata.get("health_checked_at")}
