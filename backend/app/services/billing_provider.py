from __future__ import annotations

import hashlib
import hmac
import json
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Protocol

from app.core.config import settings


@dataclass(frozen=True, slots=True)
class ProviderCheckout:
    reference: str
    url: str


@dataclass(frozen=True, slots=True)
class NormalizedBillingEvent:
    id: str
    type: str
    created_at: datetime
    data: dict


class BillingProvider(Protocol):
    name: str
    def create_checkout(self, *, session_id: str) -> ProviderCheckout: ...
    def verify_and_parse(self, payload: bytes, signature: str | None) -> NormalizedBillingEvent: ...
    def confirm_plan_change(self, *, subscription_ref: str | None, price_key: str) -> bool: ...
    def schedule_cancellation(self, *, subscription_ref: str | None) -> bool: ...
    def resume_subscription(self, *, subscription_ref: str | None) -> bool: ...


class TestBillingProvider:
    """Deterministic local adapter. It never contacts or impersonates a real processor."""

    name = "test"

    def create_checkout(self, *, session_id: str) -> ProviderCheckout:
        return ProviderCheckout(reference=f"test_cs_{session_id}", url=f"{settings.FRONTEND_URL}/dashboard/billing/checkout/{session_id}")

    def confirm_plan_change(self, *, subscription_ref: str | None, price_key: str) -> bool:
        return bool(subscription_ref and price_key)

    def schedule_cancellation(self, *, subscription_ref: str | None) -> bool:
        return bool(subscription_ref)

    def resume_subscription(self, *, subscription_ref: str | None) -> bool:
        return bool(subscription_ref)

    @staticmethod
    def signature(payload: bytes) -> str:
        return hmac.new(settings.BILLING_WEBHOOK_SECRET.encode(), payload, hashlib.sha256).hexdigest()

    def verify_and_parse(self, payload: bytes, signature: str | None) -> NormalizedBillingEvent:
        expected = self.signature(payload)
        if not signature or not hmac.compare_digest(expected, signature):
            raise ValueError("Invalid billing webhook signature")
        value = json.loads(payload)
        if not isinstance(value, dict) or not all(key in value for key in ("id", "type", "created_at", "data")):
            raise ValueError("Malformed billing event")
        data = value["data"]
        if not isinstance(data, dict):
            raise ValueError("Malformed billing event data")
        moment = datetime.fromisoformat(str(value["created_at"]).replace("Z", "+00:00"))
        if moment.tzinfo is None:
            moment = moment.replace(tzinfo=timezone.utc)
        return NormalizedBillingEvent(str(value["id"]), str(value["type"]), moment, data)


class InternalBillingProvider(TestBillingProvider):
    """Zero-cost plan lifecycle; it has no webhook or external money movement."""
    name = "internal"

    def verify_and_parse(self, payload: bytes, signature: str | None) -> NormalizedBillingEvent:
        raise ValueError("Internal billing does not accept webhooks")


def get_billing_provider(name: str | None = None) -> BillingProvider:
    provider = name or settings.BILLING_PROVIDER
    if provider == "internal":
        return InternalBillingProvider()
    if provider == "test":
        if settings.APP_ENV not in {"development", "test"}:
            raise RuntimeError("The test billing provider is disabled outside development/test")
        return TestBillingProvider()
    raise ValueError(f"Unsupported billing provider: {provider}")
