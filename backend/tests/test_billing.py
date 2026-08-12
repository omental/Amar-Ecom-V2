import asyncio
import json
import uuid
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.core.database import AsyncSessionLocal, engine
from app.main import app
from app.models.billing import BillingCheckoutSession, BillingInvoice, BillingPayment, BillingProviderEvent, StoreSubscription
from app.models.commercial import StorePlanAssignment
from app.models.tenant import Store
from app.services.billing_provider import TestBillingProvider
from tests.test_merchant_onboarding import _cleanup, _find_test_identities, _payload


def test_billing_checkout_webhook_lifecycle_and_tenant_isolation() -> None:
    suffix = uuid.uuid4().hex[:10]
    slugs = (f"billing-a-{suffix}", f"billing-b-{suffix}")
    payloads = [_payload(suffix, email_prefix=f"billing-{key}", slug=slug) for key, slug in zip(("a", "b"), slugs, strict=True)]
    try:
        with TestClient(app) as client:
            headers = []
            for payload, slug in zip(payloads, slugs, strict=True):
                signup = client.post("/api/v1/onboarding/signup", json=payload)
                assert signup.status_code == 201, signup.text
                verified = client.post("/api/v1/onboarding/verify-email", json={"token": signup.json()["verification_token"]})
                headers.append({"Authorization": f"Bearer {verified.json()['access_token']}", "X-Amar-Store": slug})

            prices = client.get("/api/v1/billing/prices").json()
            growth = next(item for item in prices if item["plan_key"] == "growth" and item["billing_cycle"] == "monthly")
            idem = f"checkout-{suffix}"
            first = client.post("/api/v1/billing/checkouts", headers=headers[0], json={"plan_price_id": growth["id"], "idempotency_key": idem})
            repeated = client.post("/api/v1/billing/checkouts", headers=headers[0], json={"plan_price_id": growth["id"], "idempotency_key": idem})
            assert first.status_code == 201 and repeated.json()["id"] == first.json()["id"]
            assert client.get(f"/api/v1/billing/checkouts/{first.json()['id']}", headers=headers[1]).status_code == 404

            invalid = client.post("/api/v1/billing/webhooks/test", content=b"{}", headers={"X-Billing-Signature": "bad"})
            assert invalid.status_code == 400

        asyncio.run(engine.dispose())

        async def event_payload() -> bytes:
            async with AsyncSessionLocal() as db:
                session = await db.scalar(select(BillingCheckoutSession).where(BillingCheckoutSession.id == uuid.UUID(first.json()["id"])).execution_options(include_all_stores=True))
                now = datetime.now(timezone.utc)
                return json.dumps({"id": f"evt-{suffix}", "type": "checkout.completed", "created_at": now.isoformat(), "data": {"checkout_session_ref": session.provider_session_ref, "subscription_ref": f"sub-{suffix}", "payment_ref": f"pay-{suffix}", "invoice_ref": f"inv-{suffix}", "period_start": now.isoformat(), "period_end": (now + timedelta(days=30)).isoformat()}}, sort_keys=True).encode()

        body = asyncio.run(event_payload())
        asyncio.run(engine.dispose())
        signature = TestBillingProvider.signature(body)
        with TestClient(app) as client:
            event_headers = {"X-Billing-Signature": signature, "Content-Type": "application/json"}
            accepted = client.post("/api/v1/billing/webhooks/test", content=body, headers=event_headers)
            duplicate = client.post("/api/v1/billing/webhooks/test", content=body, headers=event_headers)
            assert accepted.status_code == 200, accepted.text
            assert duplicate.status_code == 200
            summary = client.get("/api/v1/billing/summary", headers=headers[0])
            assert summary.json()["subscription"]["status"] == "active"
            assert summary.json()["subscription"]["plan_key"] == "growth"
            invoices = client.get("/api/v1/billing/invoices", headers=headers[0])
            assert invoices.status_code == 200 and len(invoices.json()) == 1
            invoice_id = invoices.json()[0]["id"]
            assert client.get(f"/api/v1/billing/invoices/{invoice_id}", headers=headers[1]).status_code == 404
            cancelled = client.post("/api/v1/billing/subscription/cancel", headers=headers[0], json={"at_period_end": True})
            assert cancelled.status_code == 200 and cancelled.json()["cancel_at_period_end"] is True
            resumed = client.post("/api/v1/billing/subscription/resume", headers=headers[0])
            assert resumed.status_code == 200 and resumed.json()["cancel_at_period_end"] is False

            pro = next(item for item in prices if item["plan_key"] == "pro" and item["billing_cycle"] == "monthly")
            upgraded = client.post("/api/v1/billing/subscription/change", headers=headers[0], json={"plan_price_id": pro["id"]})
            assert upgraded.status_code == 200 and upgraded.json()["plan_key"] == "pro"
            starter = next(item for item in prices if item["plan_key"] == "starter" and item["billing_cycle"] == "monthly")
            downgraded = client.post("/api/v1/billing/subscription/change", headers=headers[0], json={"plan_price_id": starter["id"]})
            assert downgraded.status_code == 200 and downgraded.json()["plan_key"] == "pro" and downgraded.json()["pending_price_id"] == starter["id"]

            # Free prices activate through the internal provider without claiming
            # an external payment occurred.
            free = client.post("/api/v1/billing/checkouts", headers=headers[1], json={"plan_price_id": starter["id"], "idempotency_key": f"free-{suffix}"})
            assert free.status_code == 201 and free.json()["status"] == "completed"

            def send(event_id: str, event_type: str, created: datetime, data: dict):
                raw = json.dumps({"id": event_id, "type": event_type, "created_at": created.isoformat(), "data": data}, sort_keys=True).encode()
                return client.post("/api/v1/billing/webhooks/test", content=raw, headers={"X-Billing-Signature": TestBillingProvider.signature(raw), "Content-Type": "application/json"})

            stale = send(f"stale-{suffix}", "subscription.cancelled", datetime.now(timezone.utc) - timedelta(days=1), {"subscription_ref": f"sub-{suffix}"})
            assert stale.status_code == 200 and stale.json()["status"] == "ignored"
            failed_at = datetime.now(timezone.utc) + timedelta(seconds=2)
            failed = send(f"failed-{suffix}", "payment.failed", failed_at, {"subscription_ref": f"sub-{suffix}", "payment_ref": f"failed-pay-{suffix}", "invoice_ref": f"failed-inv-{suffix}"})
            assert failed.status_code == 200
            assert client.get("/api/v1/billing/summary", headers=headers[0]).json()["subscription"]["status"] == "past_due"
            renewed_at = failed_at + timedelta(seconds=2)
            renewed = send(f"renew-{suffix}", "subscription.renewed", renewed_at, {"subscription_ref": f"sub-{suffix}", "payment_ref": f"renew-pay-{suffix}", "invoice_ref": f"renew-inv-{suffix}", "period_start": renewed_at.isoformat(), "period_end": (renewed_at + timedelta(days=30)).isoformat()})
            assert renewed.status_code == 200
            renewed_duplicate = send(f"renew-{suffix}", "subscription.renewed", renewed_at, {"subscription_ref": f"sub-{suffix}"})
            assert renewed_duplicate.status_code == 200
            after_renewal = client.get("/api/v1/billing/summary", headers=headers[0]).json()["subscription"]
            # Scheduled downgrade becomes effective at authoritative renewal.
            assert after_renewal["status"] == "active" and after_renewal["plan_key"] == "starter"

            refunded = send(f"refund-{suffix}", "payment.refunded", renewed_at + timedelta(seconds=1), {"subscription_ref": f"sub-{suffix}", "payment_ref": f"pay-{suffix}", "refunded_amount": "100"})
            assert refunded.status_code == 200
            assert any(item["status"] == "partially_refunded" for item in client.get("/api/v1/billing/payments", headers=headers[0]).json())
            full_refund = send(f"full-refund-{suffix}", "payment.refunded", renewed_at + timedelta(seconds=2), {"subscription_ref": f"sub-{suffix}", "payment_ref": f"pay-{suffix}", "refunded_amount": growth["amount"]})
            assert full_refund.status_code == 200
            assert any(item["status"] == "refunded" for item in client.get("/api/v1/billing/payments", headers=headers[0]).json())

        asyncio.run(engine.dispose())

        async def assertions() -> None:
            async with AsyncSessionLocal() as db:
                store = await db.scalar(select(Store).where(Store.slug == slugs[0]).execution_options(include_all_stores=True))
                sub = await db.scalar(select(StoreSubscription).where(StoreSubscription.store_id == store.id).execution_options(include_all_stores=True))
                assignment = await db.scalar(select(StorePlanAssignment).where(StorePlanAssignment.store_id == store.id).execution_options(include_all_stores=True))
                assert sub and sub.status == "active" and sub.plan_key_snapshot == "starter"
                assert assignment and assignment.status == "active" and assignment.source == "billing" and assignment.trial_ends_at is None and assignment.plan_key_snapshot == "starter"
                assert await db.scalar(select(func.count()).select_from(BillingProviderEvent).where(BillingProviderEvent.provider_event_id == f"evt-{suffix}")) == 1
                assert await db.scalar(select(func.count()).select_from(BillingPayment).where(BillingPayment.store_id == store.id).execution_options(include_all_stores=True)) == 3
                assert await db.scalar(select(func.count()).select_from(BillingInvoice).where(BillingInvoice.store_id == store.id).execution_options(include_all_stores=True)) == 3

        asyncio.run(assertions())
    finally:
        asyncio.run(engine.dispose())
        stores, organizations, users = asyncio.run(_find_test_identities(slugs))
        if stores:
            asyncio.run(_cleanup(stores, organizations, users))
        asyncio.run(engine.dispose())
