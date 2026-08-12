import asyncio
import uuid

import httpx
import pytest
from sqlalchemy import delete, func, select

from app.core.database import AsyncSessionLocal, engine
from app.core.security import get_password_hash
from app.main import app
from app.core.tenant import tenant_scope
from app.models import (
    AIExecution,
    Conversation,
    Customer,
    DnsZone,
    InventoryItem,
    MediaAsset,
    Organization,
    Order,
    Product,
    Store,
    StoreDomain,
    User,
)
from app.services.demo_seed_service import (
    DemoSeedSafetyError,
    seed_demo_platform,
    verify_demo_platform,
)
from scripts.demo_seed_manifest import DEMO_STORE_IDS, TECHNEST, URBAN


def test_demo_seed_refuses_production() -> None:
    async def exercise() -> None:
        async with AsyncSessionLocal() as db:
            with pytest.raises(DemoSeedSafetyError, match="disabled"):
                await seed_demo_platform(db, environment="production")

    asyncio.run(exercise())
    asyncio.run(engine.dispose())


def test_seeded_urban_thread_browser_api_shapes_resolve() -> None:
    async def exercise() -> None:
        async with AsyncSessionLocal() as db:
            await seed_demo_platform(db, environment="test")
            await db.commit()

        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            login = await client.post(
                "/api/v1/auth/login",
                json={"email": URBAN["owner_email"], "password": "AmarDemo!2026"},
            )
            assert login.status_code == 200, login.text
            headers = {
                "Authorization": f"Bearer {login.json()['access_token']}",
                "X-Amar-Store": URBAN["store_slug"],
            }

            summary = await client.get("/api/v1/inventory/hub-summary", headers=headers)
            stock = await client.get("/api/v1/inventory?skip=0&limit=100", headers=headers)
            report = await client.get("/api/v1/reports/inventory", headers=headers)
            suppliers = await client.get("/api/v1/suppliers?skip=0&limit=100", headers=headers)
            purchases = await client.get("/api/v1/purchase-orders?skip=0&limit=100", headers=headers)
            for response in (summary, stock, report, suppliers, purchases):
                assert response.status_code == 200, response.text

            oxford_rows = [row for row in stock.json() if row["sku"] == "UT-OXF-BLK-XL"]
            assert {row["warehouseName"]: row["quantity"] for row in oxford_rows} == {
                "Main Warehouse — Dhaka": 12,
                "Dhanmondi Outlet": 3,
                "Chattogram Warehouse": 0,
            }
            assert sum(row["quantity"] for row in oxford_rows) == 15
            assert all(item["email"].endswith("@example.invalid") for item in suppliers.json())

            themes = await client.get("/api/v1/admin/storefront/themes", headers=headers)
            settings = await client.get("/api/v1/admin/storefront/settings", headers=headers)
            menus = await client.get("/api/v1/admin/storefront/menus", headers=headers)
            saved_sections = await client.get("/api/v1/admin/storefront/saved-sections", headers=headers)
            for response in (themes, settings, menus, saved_sections):
                assert response.status_code == 200, response.text
            assert {theme["status"] for theme in themes.json()} >= {"published", "draft"}
            draft = next(theme for theme in themes.json() if theme["status"] == "draft")
            detail = await client.get(f"/api/v1/admin/storefront/themes/{draft['id']}", headers=headers)
            styles = await client.get(f"/api/v1/admin/storefront/themes/{draft['id']}/style-classes", headers=headers)
            assert detail.status_code == 200, detail.text
            assert styles.status_code == 200, styles.text
            assert detail.json()["templates"]

    try:
        asyncio.run(exercise())
    finally:
        asyncio.run(engine.dispose())


def test_demo_seed_is_idempotent_repairs_truth_and_preserves_unrelated_data() -> None:
    outsider_org_id = uuid.uuid4()
    outsider_store_id = uuid.uuid4()
    outsider_user_id = uuid.uuid4()
    outsider_product_id = uuid.uuid4()
    outsider_media_id = uuid.uuid4()
    suffix = uuid.uuid4().hex

    async def seed_initial() -> dict[str, object]:
        async with AsyncSessionLocal() as db:
            await seed_demo_platform(db, environment="test")
            await db.commit()
        async with AsyncSessionLocal() as db:
            return await verify_demo_platform(db, environment="test")

    async def add_outsider_and_corrupt_demo() -> None:
        async with AsyncSessionLocal() as db:
            organization = Organization(
                id=outsider_org_id,
                name="Unrelated Reset Safety Merchant",
                slug=f"unrelated-seed-safety-{suffix}",
                status="active",
            )
            store = Store(
                id=outsider_store_id,
                organization_id=outsider_org_id,
                name="Unrelated Store",
                slug=f"unrelated-store-{suffix}",
                status="active",
                timezone="Asia/Dhaka",
                locale="en-BD",
                default_currency="BDT",
                is_primary=False,
            )
            user = User(
                id=outsider_user_id,
                full_name="Unrelated User",
                email=f"unrelated-{suffix}@example.test",
                hashed_password=get_password_hash("Unrelated!2026"),
                role="admin",
                is_active=True,
                is_platform_admin=False,
            )
            db.add_all([organization, store, user])
            await db.flush()
            with tenant_scope(store_id=outsider_store_id, organization_id=outsider_org_id):
                db.add_all([
                    Product(
                        id=outsider_product_id,
                        name="Unrelated Product",
                        slug="unrelated-product",
                        sku=f"UNRELATED-{suffix[:8]}",
                        price=100,
                        cost_price=50,
                        status="active",
                    ),
                    MediaAsset(
                        id=outsider_media_id,
                        filename="unrelated.jpg",
                        original_filename="unrelated.jpg",
                        storage_key=f"unrelated/{suffix}.jpg",
                        mime_type="image/jpeg",
                        file_size=10,
                        uploaded_by_id=outsider_user_id,
                        ),
                    ])
                await db.flush()
            with tenant_scope(store_id=URBAN["store_id"], organization_id=URBAN["organization_id"]):
                inventory = list((await db.execute(
                    select(InventoryItem).where(InventoryItem.variant_id == URBAN["oxford_variant_id"])
                )).scalars())
                assert sum(row.quantity for row in inventory) == 15
                for row in inventory:
                    row.quantity = 0
            await db.commit()

    async def reseed_and_assert(first_counts: dict[str, object]) -> None:
        async with AsyncSessionLocal() as db:
            await seed_demo_platform(db, reset=True, environment="test")
            await db.commit()
        async with AsyncSessionLocal() as db:
            repaired = await verify_demo_platform(db, environment="test")
            assert repaired == first_counts
            assert await db.get(Organization, outsider_org_id) is not None
            assert await db.get(Store, outsider_store_id) is not None
            assert await db.get(User, outsider_user_id) is not None
            with tenant_scope(store_id=outsider_store_id, organization_id=outsider_org_id):
                assert await db.get(Product, outsider_product_id) is not None
                assert await db.get(MediaAsset, outsider_media_id) is not None

            # Aggregate/projection queries must receive the same automatic tenant
            # constraint as entity selects; this guards a leak found by the full QA.
            with tenant_scope(store_id=URBAN["store_id"], organization_id=URBAN["organization_id"]):
                assert int(await db.scalar(select(func.count()).select_from(Product)) or 0) == 40
            with tenant_scope(store_id=TECHNEST["store_id"], organization_id=TECHNEST["organization_id"]):
                assert int(await db.scalar(select(func.count()).select_from(Product)) or 0) == 12

            urban_store = await db.get(Store, URBAN["store_id"])
            with tenant_scope(store_id=TECHNEST["store_id"], organization_id=TECHNEST["organization_id"]):
                assert await db.get(Product, URBAN["oxford_product_id"]) is None
                assert await db.get(Customer, URBAN["rahim_customer_id"]) is None
                assert await db.get(Order, URBAN["order_1042_id"]) is None
                assert await db.scalar(select(Conversation).where(Conversation.store_id == urban_store.id)) is None
                assert await db.scalar(select(StoreDomain).where(StoreDomain.store_id == urban_store.id)) is None
                assert await db.scalar(select(DnsZone).where(DnsZone.store_id == urban_store.id)) is None
                assert await db.scalar(select(AIExecution).where(AIExecution.store_id == urban_store.id)) is None

    async def assert_second_seed_is_stable(first_counts: dict[str, object]) -> None:
        async with AsyncSessionLocal() as db:
            before = {
                model.__tablename__: int(await db.scalar(
                    select(func.count()).select_from(model).where(model.store_id.in_(DEMO_STORE_IDS))
                ) or 0)
                for model in (Product, Customer, Order, Conversation)
            }
            await seed_demo_platform(db, environment="test")
            await db.commit()
        async with AsyncSessionLocal() as db:
            assert await verify_demo_platform(db, environment="test") == first_counts
            after = {
                model.__tablename__: int(await db.scalar(
                    select(func.count()).select_from(model).where(model.store_id.in_(DEMO_STORE_IDS))
                ) or 0)
                for model in (Product, Customer, Order, Conversation)
            }
            assert after == before

    async def cleanup_outsider() -> None:
        async with AsyncSessionLocal() as db:
            with tenant_scope(store_id=outsider_store_id, organization_id=outsider_org_id):
                await db.execute(delete(MediaAsset).where(MediaAsset.id == outsider_media_id))
                await db.execute(delete(Product).where(Product.id == outsider_product_id))
            await db.execute(delete(Store).where(Store.id == outsider_store_id))
            await db.execute(delete(Organization).where(Organization.id == outsider_org_id))
            await db.execute(delete(User).where(User.id == outsider_user_id))
            await db.commit()

    try:
        expected = asyncio.run(seed_initial())
        asyncio.run(add_outsider_and_corrupt_demo())
        asyncio.run(reseed_and_assert(expected))
        asyncio.run(assert_second_seed_is_stable(expected))
    finally:
        asyncio.run(cleanup_outsider())
        asyncio.run(engine.dispose())
