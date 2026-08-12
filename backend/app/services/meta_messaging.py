from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from app.core.config import settings
from app.services.meta_graph import MetaProviderError, get_meta_graph_client
from app.services.messaging_provider import OutboundResult


@dataclass(slots=True)
class FacebookMessengerProvider:
    credentials: dict[str, str]
    metadata: dict
    key: str = "meta_facebook"

    def capabilities(self) -> dict[str, bool]:
        return {"text": True, "image": True, "file": True, "read_receipts": True, "typing": False, "reactions": False, "templates": False, "rich_product_messages": False}

    async def send_message(self, *, external_conversation_ref: str, text: str, idempotency_key: str) -> OutboundResult:
        del idempotency_key
        token = self.credentials.get("page_access_token")
        page_id = str(self.metadata.get("page_id") or "")
        if not token or not page_id:
            raise MetaProviderError("authorization_required", "Reconnect Facebook to send messages.")
        ref = await get_meta_graph_client().send_facebook_text(page_id, external_conversation_ref, text, token)
        return OutboundResult(provider_message_ref=ref, status="sent")

    async def mark_read(self, *, external_conversation_ref: str, provider_message_ref: str | None) -> None:
        del external_conversation_ref, provider_message_ref


@dataclass(slots=True)
class WhatsAppCloudProvider:
    credentials: dict[str, str]
    metadata: dict
    key: str = "meta_whatsapp"

    def capabilities(self) -> dict[str, bool]:
        return {"text": True, "image": True, "file": True, "read_receipts": True, "delivery_receipts": True, "typing": False, "reactions": False, "templates": True, "rich_product_messages": False}

    async def send_message(self, *, external_conversation_ref: str, text: str, idempotency_key: str) -> OutboundResult:
        del idempotency_key
        token = self.credentials.get("access_token")
        phone_id = str(self.metadata.get("phone_number_id") or "")
        if not token or not phone_id:
            raise MetaProviderError("authorization_required", "Reconnect WhatsApp to send messages.")
        ref = await get_meta_graph_client().send_whatsapp_text(phone_id, external_conversation_ref, text, token)
        return OutboundResult(provider_message_ref=ref, status="sent")

    async def mark_read(self, *, external_conversation_ref: str, provider_message_ref: str | None) -> None:
        del external_conversation_ref, provider_message_ref


def reply_window_ends_at(sent_at: datetime) -> datetime:
    return sent_at + timedelta(hours=settings.META_FREEFORM_WINDOW_HOURS)


def provider_send_eligibility(channel_type: str, window_ends_at: datetime | None, now: datetime | None = None) -> dict:
    current = now or datetime.now(timezone.utc)
    if channel_type not in {"facebook_messenger", "whatsapp"}:
        return {"can_send_freeform": True, "window_ends_at": None, "remaining_seconds": None, "reason": None}
    allowed = bool(window_ends_at and window_ends_at > current)
    return {
        "can_send_freeform": allowed,
        "window_ends_at": window_ends_at,
        "remaining_seconds": max(0, int((window_ends_at - current).total_seconds())) if window_ends_at else 0,
        "reason": None if allowed else ("template_required" if channel_type == "whatsapp" else "window_closed"),
    }
