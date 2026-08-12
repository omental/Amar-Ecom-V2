import asyncio
import uuid

from fastapi.testclient import TestClient
from fastapi import HTTPException
import pytest
from sqlalchemy import delete, func, select, text

from app.core.database import AsyncSessionLocal, TENANT_OWNED_TABLES, engine
from app.main import app
from app.models.storefront import StorefrontSectionGroup, StorefrontSetting, StorefrontTemplate, StorefrontTheme
from app.models.tenant import Organization, OrganizationMember, Store, StoreDomain, StoreMember, StoreOnboarding
from app.models.commercial import StorePlanAssignment
from app.models.billing import BillingAccount
from app.models.access_control import ActivityLog
from app.models.user import User
from app.schemas.onboarding import MerchantSignupRequest
from app.services import merchant_provisioning_service


PASSWORD = "StrongPass123"


def _payload(suffix: str, *, email_prefix: str, slug: str) -> dict:
    return {
        "full_name": f"Merchant {suffix}",
        "email": f"{email_prefix}-{suffix}@example.com",
        "password": PASSWORD,
        "confirm_password": PASSWORD,
        "business_name": f"Business {suffix}",
        "store_name": f"Store {suffix}",
        "store_slug": slug,
        "timezone": "Asia/Dhaka",
        "locale": "en-BD",
        "currency": "BDT",
    }


async def _assert_bootstrap(store_slug: str) -> tuple[uuid.UUID, uuid.UUID, uuid.UUID]:
    async with AsyncSessionLocal() as db:
        store = await db.scalar(
            select(Store).where(Store.slug == store_slug).execution_options(include_all_stores=True)
        )
        assert store is not None
        organization = await db.get(Organization, store.organization_id)
        assert organization is not None
        owner_membership = await db.scalar(
            select(OrganizationMember).where(
                OrganizationMember.organization_id == organization.id,
                OrganizationMember.role == "owner",
            )
        )
        assert owner_membership is not None
        store_membership = await db.scalar(
            select(StoreMember).where(StoreMember.store_id == store.id, StoreMember.user_id == owner_membership.user_id)
        )
        assert store_membership is not None
        checks = {
            "settings": StorefrontSetting,
            "themes": StorefrontTheme,
            "templates": StorefrontTemplate,
            "groups": StorefrontSectionGroup,
            "onboarding": StoreOnboarding,
            "commercial": StorePlanAssignment,
            "domains": StoreDomain,
        }
        counts = {}
        for key, model in checks.items():
            counts[key] = int(
                await db.scalar(
                    select(func.count()).select_from(model).where(model.store_id == store.id).execution_options(include_all_stores=True)
                )
                or 0
            )
        assert counts == {"settings": 1, "themes": 1, "templates": 7, "groups": 2, "onboarding": 1, "commercial": 1, "domains": 1}
        domain = await db.scalar(select(StoreDomain).where(StoreDomain.store_id == store.id).execution_options(include_all_stores=True))
        assert domain is not None
        assert domain.hostname == f"{store.slug}.amar-ecom.com"
        assert domain.domain_type == "platform_subdomain" and domain.is_primary and domain.status == "active"
        assert domain.verification_status == "not_required"
        assignment = await db.scalar(select(StorePlanAssignment).where(StorePlanAssignment.store_id == store.id).execution_options(include_all_stores=True))
        assert assignment is not None and assignment.plan_key_snapshot == "growth" and assignment.status == "trialing"
        theme = await db.scalar(
            select(StorefrontTheme).where(StorefrontTheme.store_id == store.id).execution_options(include_all_stores=True)
        )
        assert theme is not None and theme.status == "published"
        return store.id, organization.id, owner_membership.user_id


async def _cleanup(store_ids: list[uuid.UUID], organization_ids: list[uuid.UUID], user_ids: list[uuid.UUID]) -> None:
    async with AsyncSessionLocal() as db:
        for store_id in store_ids:
            # Financial history has deliberate RESTRICT relationships. Tests remove
            # it leaf-first; production never destructively deletes a Store.
            await db.execute(text("DELETE FROM billing_payments WHERE store_id=:store_id OR invoice_id IN (SELECT id FROM billing_invoices WHERE store_id=:store_id)"), {"store_id": store_id})
            await db.commit()
            for table_name in ("billing_invoice_lines", "subscription_changes", "billing_invoices", "billing_checkout_sessions", "store_subscriptions"):
                if table_name in TENANT_OWNED_TABLES:
                    await db.execute(text(f'DELETE FROM "{table_name}" WHERE store_id = :store_id'), {"store_id": store_id})
                    await db.commit()
            remaining = set(TENANT_OWNED_TABLES)
            for _ in range(10):
                progressed = False
                for table_name in tuple(remaining):
                    try:
                        await db.execute(text(f'DELETE FROM "{table_name}" WHERE store_id = :store_id'), {"store_id": store_id})
                        await db.commit()
                        remaining.remove(table_name)
                        progressed = True
                    except Exception:
                        await db.rollback()
                if not remaining or not progressed:
                    break
            assert not remaining, f"Could not clean tenant tables: {sorted(remaining)}"
            await db.execute(delete(StoreMember).where(StoreMember.store_id == store_id))
            await db.execute(delete(Store).where(Store.id == store_id))
        for organization_id in organization_ids:
            await db.execute(delete(ActivityLog).where(ActivityLog.organization_id == organization_id).execution_options(include_all_stores=True))
            await db.execute(delete(BillingAccount).where(BillingAccount.organization_id == organization_id))
            await db.execute(delete(OrganizationMember).where(OrganizationMember.organization_id == organization_id))
            await db.execute(delete(Organization).where(Organization.id == organization_id))
        for user_id in user_ids:
            await db.execute(delete(StoreMember).where(StoreMember.user_id == user_id))
            await db.execute(delete(OrganizationMember).where(OrganizationMember.user_id == user_id))
            await db.execute(delete(User).where(User.id == user_id))
        await db.commit()


async def _find_test_identities(store_slugs: tuple[str, ...]) -> tuple[list[uuid.UUID], list[uuid.UUID], list[uuid.UUID]]:
    async with AsyncSessionLocal() as db:
        stores = list(
            (
                await db.execute(
                    select(Store).where(Store.slug.in_(store_slugs)).execution_options(include_all_stores=True)
                )
            ).scalars().all()
        )
        organization_ids = [store.organization_id for store in stores]
        memberships = list(
            (
                await db.execute(
                    select(OrganizationMember).where(OrganizationMember.organization_id.in_(organization_ids))
                )
            ).scalars().all()
        ) if organization_ids else []
        return [store.id for store in stores], organization_ids, [membership.user_id for membership in memberships]


def test_public_merchant_provisioning_bootstrap_verification_and_isolation() -> None:
    suffix = uuid.uuid4().hex[:10]
    slug_a = f"merchant-a-{suffix}"
    slug_b = f"merchant-b-{suffix}"
    payload_a = _payload(suffix, email_prefix="owner-a", slug=" Merchant A " + suffix)
    payload_b = _payload(suffix, email_prefix="owner-b", slug=slug_b)
    store_ids: list[uuid.UUID] = []
    organization_ids: list[uuid.UUID] = []
    user_ids: list[uuid.UUID] = []

    try:
        with TestClient(app) as client:
            reserved = client.get("/api/v1/onboarding/slug-availability", params={"slug": "admin"})
            assert reserved.status_code == 200 and reserved.json() == {"slug": "admin", "available": False}
            available = client.get("/api/v1/onboarding/slug-availability", params={"slug": payload_a["store_slug"]})
            assert available.status_code == 200
            normalized_slug_a = available.json()["slug"]
            assert normalized_slug_a == slug_a
            assert available.json()["available"] is True

            escalation = client.post("/api/v1/onboarding/signup", json={**payload_a, "role": "super_admin"})
            assert escalation.status_code == 422

            signup_a = client.post("/api/v1/onboarding/signup", json=payload_a)
            assert signup_a.status_code == 201, signup_a.text
            assert signup_a.json()["store_slug"] == slug_a
            assert signup_a.json()["verification_required"] is True
            assert signup_a.json()["verification_token"]

            duplicate_email = client.post(
                "/api/v1/onboarding/signup",
                json={**payload_a, "store_slug": f"another-{suffix}"},
            )
            assert duplicate_email.status_code == 409
            duplicate_slug = client.post(
                "/api/v1/onboarding/signup",
                json={**payload_b, "store_slug": slug_a},
            )
            assert duplicate_slug.status_code == 409

            signup_b = client.post("/api/v1/onboarding/signup", json=payload_b)
            assert signup_b.status_code == 201, signup_b.text
            verify_a = client.post(
                "/api/v1/onboarding/verify-email",
                json={"token": signup_a.json()["verification_token"]},
            )
            verify_b = client.post(
                "/api/v1/onboarding/verify-email",
                json={"token": signup_b.json()["verification_token"]},
            )
            assert verify_a.status_code == 200, verify_a.text
            assert verify_b.status_code == 200, verify_b.text
            headers_a = {
                "Authorization": f"Bearer {verify_a.json()['access_token']}",
                "X-Amar-Store": slug_a,
            }
            headers_b = {
                "Authorization": f"Bearer {verify_b.json()['access_token']}",
                "X-Amar-Store": slug_b,
            }
            assert client.get("/api/v1/tenant/current", headers=headers_a).status_code == 200
            assert client.get("/api/v1/tenant/current", headers=headers_b).status_code == 200
            assert client.post(f"/api/v1/tenant/switch/{slug_b}", headers=headers_a).status_code == 404
            assert client.post(f"/api/v1/tenant/switch/{slug_a}", headers=headers_b).status_code == 404
            public_home = client.get(
                "/api/v1/public/storefront/theme/resolve/home",
                headers={"X-Storefront-Store": slug_a},
            )
            assert public_home.status_code == 200, public_home.text
            assert public_home.json()["header_group"] is not None
            assert public_home.json()["footer_group"] is not None

            progress = client.get("/api/v1/onboarding/progress", headers=headers_a)
            assert progress.status_code == 200, progress.text
            assert progress.json()["completion_percent"] > 0
            dismissed = client.patch("/api/v1/onboarding/progress", headers=headers_a, json={"dismissed": True})
            assert dismissed.status_code == 200 and dismissed.json()["dismissed_at"]

        asyncio.run(engine.dispose())
        for slug in (slug_a, slug_b):
            store_id, organization_id, user_id = asyncio.run(_assert_bootstrap(slug))
            store_ids.append(store_id)
            organization_ids.append(organization_id)
            user_ids.append(user_id)
            asyncio.run(engine.dispose())
        assert store_ids[0] != store_ids[1]
        assert organization_ids[0] != organization_ids[1]
    finally:
        asyncio.run(engine.dispose())
        found_stores, found_organizations, found_users = asyncio.run(_find_test_identities((slug_a, slug_b)))
        if found_stores:
            asyncio.run(_cleanup(found_stores, found_organizations, found_users))
        asyncio.run(engine.dispose())


def test_provisioning_failure_rolls_back_every_identity(monkeypatch: pytest.MonkeyPatch) -> None:
    suffix = uuid.uuid4().hex[:10]
    payload = MerchantSignupRequest.model_validate(_payload(suffix, email_prefix="rollback", slug=f"rollback-{suffix}"))

    async def fail_theme_bootstrap(*_args, **_kwargs):
        raise RuntimeError("forced bootstrap failure")

    async def run() -> None:
        monkeypatch.setattr(merchant_provisioning_service, "ensure_default_theme", fail_theme_bootstrap)
        async with AsyncSessionLocal() as db:
            with pytest.raises(HTTPException) as error:
                await merchant_provisioning_service.provision_merchant_store(db, payload)
            assert error.value.status_code == 503
        async with AsyncSessionLocal() as db:
            assert await db.scalar(select(User.id).where(User.email == payload.email)) is None
            assert await db.scalar(
                select(Store.id).where(Store.slug == payload.store_slug).execution_options(include_all_stores=True)
            ) is None

    asyncio.run(run())
    asyncio.run(engine.dispose())
