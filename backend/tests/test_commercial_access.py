import asyncio
from datetime import timedelta
import uuid

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.database import AsyncSessionLocal, engine
from app.core.tenant import tenant_scope
from app.main import app
from app.models.commercial import StoreEntitlementOverride, StorePlanAssignment
from app.models.tenant import Store
from app.services.commercial_access_service import EntitlementService, utc_now
from app.services.commercial_registry import validate_feature_value
from tests.test_merchant_onboarding import _cleanup, _find_test_identities, _payload


def test_feature_value_validation_and_unlimited_contract() -> None:
    assert validate_feature_value("advanced_builder", True) is True
    assert validate_feature_value("product_limit", None) is None
    assert validate_feature_value("product_limit", 12) == 12
    for key, value in (("advanced_builder", "yes"), ("product_limit", -1), ("product_limit", "banana")):
        try:
            validate_feature_value(key, value)
        except ValueError:
            pass
        else:
            raise AssertionError(f"{key} accepted invalid value {value!r}")


def test_signup_trial_limit_enforcement_and_platform_security() -> None:
    suffix = uuid.uuid4().hex[:10]
    slug = f"commercial-{suffix}"
    payload = _payload(suffix, email_prefix="commercial", slug=slug)
    try:
        with TestClient(app) as client:
            signup = client.post("/api/v1/onboarding/signup", json=payload)
            assert signup.status_code == 201, signup.text
            verified = client.post("/api/v1/onboarding/verify-email", json={"token": signup.json()["verification_token"]})
            assert verified.status_code == 200, verified.text
            headers = {"Authorization": f"Bearer {verified.json()['access_token']}", "X-Amar-Store": slug}
            summary = client.get("/api/v1/commercial/summary", headers=headers)
            assert summary.status_code == 200, summary.text
            assert summary.json()["plan"]["key"] == "growth"
            assert summary.json()["status"] == "trialing"
            assert summary.json()["usage"]["product_limit"]["usage"] == 0
            assert client.get("/api/v1/platform/commercial/plans", headers=headers).status_code == 403

        asyncio.run(engine.dispose())

        async def lower_limit_and_test_override() -> None:
            async with AsyncSessionLocal() as db:
                store = await db.scalar(select(Store).where(Store.slug == slug).execution_options(include_all_stores=True))
                assert store is not None
                with tenant_scope(store_id=store.id, organization_id=store.organization_id):
                    assignment = await db.scalar(select(StorePlanAssignment).where(StorePlanAssignment.store_id == store.id))
                    assert assignment is not None
                    assignment.entitlement_snapshot = {
                        **assignment.entitlement_snapshot,
                        "product_limit": 1,
                        "staff_limit": 0,
                        "warehouse_limit": 1,
                        "store_limit": 1,
                        "theme_count_limit": 1,
                    }
                    override = StoreEntitlementOverride(
                        feature_key="product_limit", value=4, reason="Automated support test",
                        starts_at=utc_now() - timedelta(minutes=1), ends_at=utc_now() + timedelta(minutes=1),
                    )
                    db.add(override)
                    await db.commit()
                    service = EntitlementService(db, store_id=store.id, organization_id=store.organization_id)
                    assert await service.get_limit("product_limit") == 4
                    override.ends_at = utc_now() - timedelta(seconds=1)
                    await db.commit()
                    service = EntitlementService(db, store_id=store.id, organization_id=store.organization_id)
                    assert await service.get_limit("product_limit") == 1
                    assignment.trial_ends_at = utc_now() - timedelta(seconds=1)
                    await db.commit()
                    expired = EntitlementService(db, store_id=store.id, organization_id=store.organization_id)
                    assert (await expired.resolve()).status == "expired"
                    assignment.trial_ends_at = utc_now() + timedelta(days=1)
                    await db.commit()

        asyncio.run(lower_limit_and_test_override())
        asyncio.run(engine.dispose())
        with TestClient(app) as client:
            login = client.post("/api/v1/auth/login", json={"email": payload["email"], "password": payload["password"]})
            headers = {"Authorization": f"Bearer {login.json()['access_token']}", "X-Amar-Store": slug}
            blocked_staff = client.post("/api/v1/users", headers=headers, json={"full_name": "Extra staff", "email": f"staff-{suffix}@example.com", "password": "StrongPass123", "role": "staff"})
            assert blocked_staff.status_code == 409 and blocked_staff.json()["detail"]["feature"] == "staff_limit"
            blocked_warehouse = client.post("/api/v1/warehouses", headers=headers, json={"name": "Second", "code": "SECOND"})
            assert blocked_warehouse.status_code == 409 and blocked_warehouse.json()["detail"]["feature"] == "warehouse_limit"
            blocked_theme = client.post("/api/v1/admin/storefront/themes", headers=headers, json={"name": "Second", "key": f"second-{suffix}"})
            assert blocked_theme.status_code == 409 and blocked_theme.json()["detail"]["feature"] == "theme_count_limit"
            blocked_store = client.post("/api/v1/tenant/stores", headers=headers, json={"name": "Second", "slug": f"second-{suffix}"})
            assert blocked_store.status_code == 409 and blocked_store.json()["detail"]["feature"] == "store_limit"
            product = {"name": "Product A", "slug": f"product-a-{suffix}", "sku": f"SKU-A-{suffix}", "price": "10.00", "cost_price": "5.00", "variants": []}
            created = client.post("/api/v1/products", headers=headers, json=product)
            assert created.status_code == 201, created.text
            blocked = client.post("/api/v1/products", headers=headers, json={**product, "name": "Product B", "slug": f"product-b-{suffix}", "sku": f"SKU-B-{suffix}"})
            assert blocked.status_code == 409, blocked.text
            assert blocked.json()["detail"] == {"code": "PLAN_LIMIT_REACHED", "feature": "product_limit", "limit": 1, "usage": 1, "message": "Your plan limit for products has been reached."}
            existing = client.patch(f"/api/v1/products/{created.json()['id']}", headers=headers, json={"name": "Product A updated"})
            assert existing.status_code == 200, existing.text
    finally:
        asyncio.run(engine.dispose())
        stores, organizations, users = asyncio.run(_find_test_identities((slug,)))
        if stores:
            asyncio.run(_cleanup(stores, organizations, users))
        asyncio.run(engine.dispose())
