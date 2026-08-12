from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Protocol

from app.core.config import settings


@dataclass(frozen=True, slots=True)
class InboundMessage:
    external_account_ref: str
    external_conversation_ref: str
    external_user_ref: str
    provider_message_ref: str
    text: str
    sent_at: datetime
    display_name: str | None = None
    phone: str | None = None
    email: str | None = None
    phone_verified: bool = False
    email_verified: bool = False
    message_type: str = "text"
    metadata: dict = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class OutboundResult:
    provider_message_ref: str
    status: str = "sent"
    delivered_at: datetime | None = None
    read_at: datetime | None = None


class MessagingProvider(Protocol):
    key: str

    def capabilities(self) -> dict[str, bool]: ...
    async def send_message(self, *, external_conversation_ref: str, text: str, idempotency_key: str) -> OutboundResult: ...
    async def mark_read(self, *, external_conversation_ref: str, provider_message_ref: str | None) -> None: ...


@dataclass(slots=True)
class TestMessagingProvider:
    """Deterministic development adapter. It never represents a real channel."""

    key: str = "test"
    fail_sends: bool = False
    sends: dict[str, OutboundResult] = field(default_factory=dict)
    read_receipts: list[tuple[str, str | None]] = field(default_factory=list)

    def capabilities(self) -> dict[str, bool]:
        return {"text": True, "image": True, "file": True, "read_receipts": True, "typing": False, "reactions": False, "templates": False, "rich_product_messages": False}

    async def send_message(self, *, external_conversation_ref: str, text: str, idempotency_key: str) -> OutboundResult:
        del text
        if idempotency_key in self.sends:
            return self.sends[idempotency_key]
        if self.fail_sends:
            raise RuntimeError("Test messaging provider send failure")
        result = OutboundResult(provider_message_ref=f"test-message:{external_conversation_ref}:{idempotency_key}")
        self.sends[idempotency_key] = result
        return result

    async def mark_read(self, *, external_conversation_ref: str, provider_message_ref: str | None) -> None:
        self.read_receipts.append((external_conversation_ref, provider_message_ref))

    def acknowledge(self, idempotency_key: str, status: str) -> OutboundResult:
        current = self.sends[idempotency_key]
        result = OutboundResult(current.provider_message_ref, status=status)
        self.sends[idempotency_key] = result
        return result


_test_provider = TestMessagingProvider()


def configured_messaging_provider(provider: str, *, credentials: dict[str, str] | None = None, metadata: dict | None = None) -> MessagingProvider:
    normalized = provider.strip().lower()
    if normalized == "test":
        if settings.APP_ENV not in {"development", "test"}:
            raise RuntimeError("The test messaging provider is forbidden outside development/test")
        return _test_provider
    if normalized == "meta_facebook":
        from app.services.meta_messaging import FacebookMessengerProvider
        return FacebookMessengerProvider(credentials or {}, metadata or {})
    if normalized == "meta_whatsapp":
        from app.services.meta_messaging import WhatsAppCloudProvider
        return WhatsAppCloudProvider(credentials or {}, metadata or {})
    raise RuntimeError(f"Messaging provider is not installed: {normalized}")
