import asyncio
import io
import uuid

from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import delete, select, text

from app.core.database import AsyncSessionLocal, TENANT_OWNED_TABLES, engine
from app.core.tenant import tenant_scope
from app.main import app
from app.models.tenant import Organization, OrganizationMember, Store, StoreMember
from app.models.user import User
from app.services.commercial_access_service import assign_plan, ensure_commercial_catalog
from app.services.store_domain_service import ensure_platform_domain


PASSWORD = "StrongPass123"


def _image_bytes() -> bytes:
    data = io.BytesIO()
    Image.new("RGB", (8, 8), "#2255aa").save(data, format="PNG")
    return data.getvalue()


def _register_and_login(client: TestClient, email: str) -> tuple[dict, dict[str, str]]:
    response = client.post("/api/v1/auth/register", json={
        "full_name": email.split("@", 1)[0],
        "email": email,
        "password": PASSWORD,
        "role": "admin",
        "is_active": True,
    })
    assert response.status_code == 201, response.text
    login = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    assert login.status_code == 200, login.text
    return response.json(), {"Authorization": f"Bearer {login.json()['access_token']}"}


async def _provision_second_store(user_id: str, suffix: str) -> Store:
    async with AsyncSessionLocal() as db:
        organization = Organization(name=f"Tenant B {suffix}", slug=f"tenant-b-{suffix}", status="active")
        db.add(organization)
        await db.flush()
        store = Store(
            organization_id=organization.id,
            name=f"Store B {suffix}",
            slug=f"store-b-{suffix}",
            status="active",
            timezone="Asia/Dhaka",
            locale="en-BD",
            default_currency="BDT",
        )
        db.add(store)
        await db.flush()
        db.add(OrganizationMember(organization_id=organization.id, user_id=uuid.UUID(user_id), role="owner", status="active"))
        db.add(StoreMember(store_id=store.id, user_id=uuid.UUID(user_id), role="admin", status="active"))
        with tenant_scope(store_id=store.id, organization_id=organization.id):
            await ensure_platform_domain(db, store)
            plans = await ensure_commercial_catalog(db)
            await assign_plan(db, store_id=store.id, plan=plans["legacy"], source="test_factory", start_trial=False)
        await db.commit()
        await db.refresh(store)
        return store


async def _cleanup(store_id: uuid.UUID, organization_id: uuid.UUID, user_ids: list[uuid.UUID]) -> None:
    async with AsyncSessionLocal() as db:
        # Exact test tenant cleanup. FK-dependent tables are deleted in repeated passes.
        remaining = set(TENANT_OWNED_TABLES)
        for _ in range(8):
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
        await db.execute(delete(StoreMember).where(StoreMember.store_id == store_id))
        await db.execute(delete(OrganizationMember).where(OrganizationMember.organization_id == organization_id))
        await db.execute(delete(Store).where(Store.id == store_id))
        await db.execute(delete(Organization).where(Organization.id == organization_id))
        for user_id in user_ids:
            await db.execute(delete(StoreMember).where(StoreMember.user_id == user_id))
            await db.execute(delete(OrganizationMember).where(OrganizationMember.user_id == user_id))
            await db.execute(delete(User).where(User.id == user_id))
        await db.commit()


def test_cross_tenant_api_public_checkout_inventory_media_and_theme_isolation() -> None:
    suffix = uuid.uuid4().hex[:8]
    email_a = f"tenant-a-{suffix}@example.com"
    email_b = f"tenant-b-{suffix}@example.com"
    store_b: Store | None = None
    user_ids: list[uuid.UUID] = []

    try:
        with TestClient(app) as client:
            user_a, auth_a = _register_and_login(client, email_a)
            user_b, auth_b = _register_and_login(client, email_b)
            user_ids = [uuid.UUID(user_a["id"]), uuid.UUID(user_b["id"])]
        asyncio.run(engine.dispose())
        store_b = asyncio.run(_provision_second_store(user_b["id"], suffix))
        asyncio.run(engine.dispose())

        headers_b = {**auth_b, "X-Amar-Store": store_b.slug}
        with TestClient(app) as client:
            current_a = client.get("/api/v1/tenant/current", headers=auth_a)
            assert current_a.status_code == 200, current_a.text
            store_a = current_a.json()["store"]

            unauthorized_switch = client.post(f"/api/v1/tenant/switch/{store_b.slug}", headers=auth_a)
            assert unauthorized_switch.status_code == 404
            assert client.get("/api/v1/tenant/current", headers=headers_b).status_code == 200

            shared_slug = f"black-shirt-{suffix}"
            shared_sku = f"ABC-{suffix}"
            base_product = {
                "name": "Tenant black shirt", "slug": shared_slug, "sku": shared_sku,
                "description": "Tenant isolation", "price": 100, "cost_price": 50,
                "status": "active", "variants": [],
            }
            product_a_response = client.post("/api/v1/products", headers=auth_a, json=base_product)
            product_b_response = client.post("/api/v1/products", headers=headers_b, json={**base_product, "name": "Store B black shirt"})
            assert product_a_response.status_code == 201, product_a_response.text
            assert product_b_response.status_code == 201, product_b_response.text
            product_a, product_b = product_a_response.json(), product_b_response.json()

            assert [item["id"] for item in client.get("/api/v1/products", headers=auth_a).json() if item["slug"] == shared_slug] == [product_a["id"]]
            assert client.get(f"/api/v1/products/{product_b['id']}", headers=auth_a).status_code == 404
            assert client.patch(f"/api/v1/products/{product_b['id']}", headers=auth_a, json={"name": "probe"}).status_code == 404

            public_a = client.get(f"/api/v1/public/products/slug/{shared_slug}", headers={"Host": f"{store_a['slug']}.amar-ecom.com"})
            public_b = client.get(f"/api/v1/public/products/slug/{shared_slug}", headers={"Host": f"{store_b.slug}.amar-ecom.com"})
            assert public_a.json()["id"] == product_a["id"]
            assert public_b.json()["id"] == product_b["id"]
            context_a = client.get("/api/v1/public/storefront/context", headers={"Host": f"{store_a['slug']}.amar-ecom.com"})
            context_b = client.get("/api/v1/public/storefront/context", headers={"Host": f"{store_b.slug}.amar-ecom.com"})
            assert context_a.json()["hostname"] == f"{store_a['slug']}.amar-ecom.com"
            assert context_b.json()["hostname"] == f"{store_b.slug}.amar-ecom.com"
            assert context_a.json()["canonical_url"] != context_b.json()["canonical_url"]

            checkout_probe = client.post("/api/v1/public/storefront/orders", headers={"Host": f"{store_a['slug']}.amar-ecom.com"}, json={
                "customer_name": "Probe", "phone": "01700000000", "email": None,
                "address": "Dhaka", "district": "Dhaka", "delivery_zone": "inside_dhaka",
                "payment_method": "cash_on_delivery", "items": [{"product_id": product_b["id"], "quantity": 1}],
            })
            assert checkout_probe.status_code == 400

            warehouse_b = client.post("/api/v1/warehouses", headers=headers_b, json={"name": "Main", "code": "MAIN", "is_active": True})
            assert warehouse_b.status_code == 201, warehouse_b.text
            inventory_probe = client.post("/api/v1/inventory", headers=auth_a, json={
                "product_id": product_b["id"], "warehouse_id": warehouse_b.json()["id"],
                "variant_id": None, "quantity": 1, "low_stock_threshold": 1,
            })
            assert inventory_probe.status_code == 404

            upload_b = client.post("/api/v1/media/upload", headers=headers_b, files={"file": ("tenant.png", _image_bytes(), "image/png")})
            assert upload_b.status_code == 201, upload_b.text
            assert client.get(f"/api/v1/media/{upload_b.json()['id']}", headers=auth_a).status_code == 404

            themes_b = client.get("/api/v1/admin/storefront/themes", headers=headers_b)
            assert themes_b.status_code == 200, themes_b.text
            theme_b = themes_b.json()[0]
            assert client.get(f"/api/v1/admin/storefront/themes/{theme_b['id']}", headers=auth_a).status_code == 404
            domains_a = client.get("/api/v1/admin/storefront/domains", headers=auth_a)
            domains_b = client.get("/api/v1/admin/storefront/domains", headers=headers_b)
            assert domains_a.status_code == 200 and domains_b.status_code == 200
            assert {item["hostname"] for item in domains_a.json()}.isdisjoint({item["hostname"] for item in domains_b.json()})
            assert client.post(f"/api/v1/admin/storefront/domains/{domains_b.json()[0]['id']}/check", headers=auth_a).status_code == 404
            assert client.post(f"/api/v1/admin/storefront/domains/{domains_b.json()[0]['id']}/make-primary", headers=auth_a).status_code == 404
            assert client.delete(f"/api/v1/admin/storefront/domains/{domains_b.json()[0]['id']}", headers=auth_a).status_code in {404, 405}
            assert client.delete(f"/api/v1/products/{product_a['id']}", headers=auth_a).status_code == 204
    finally:
        asyncio.run(engine.dispose())
        if store_b is not None:
            asyncio.run(_cleanup(store_b.id, store_b.organization_id, user_ids))
        asyncio.run(engine.dispose())
