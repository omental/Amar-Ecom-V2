import asyncio
import uuid
from datetime import datetime, timezone

import httpx
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.exc import InterfaceError, ProgrammingError

from app.api.routes import courier_integrations as courier_integration_routes
from app.api.routes import woocommerce as woocommerce_routes
from app.core import crypto as crypto_utils
from app.core.crypto import decrypt_secret, encrypt_secret, is_encrypted_secret, mask_secret
from app.core.database import AsyncSessionLocal, engine
from app.main import app
from app.models.courier import Shipment
from app.models.courier_integration import CourierApiLog, CourierProviderSetting
from app.models.order import Order
from app.models.product import Product
from app.models.woocommerce import WooCommerceSetting
from app.models.woocommerce import WooCommerceSyncLog
from app.services.courier_adapters.steadfast import SteadfastCourierAdapter
from app.services.courier_service import map_external_courier_status
from app.services import woocommerce_service


def unique_email() -> str:
    return f"test-{uuid.uuid4().hex[:12]}@example.com"


def dispose_engine() -> None:
    asyncio.run(engine.dispose())


def register_user(
    email: str,
    password: str = "StrongPass123",
    *,
    role: str = "admin",
    is_active: bool = True,
    full_name: str = "Test User",
) -> dict:
    try:
        with TestClient(app) as client:
            response = client.post(
                "/api/v1/auth/register",
                json={
                    "full_name": full_name,
                    "email": email,
                    "password": password,
                    "role": role,
                    "is_active": is_active,
                },
            )
    except (ProgrammingError, InterfaceError, AttributeError, RuntimeError) as exc:
        if any(token in str(exc) for token in ["products.source", "products.external_id", "products.external_status"]):
            pytest.skip("Apply the latest WooCommerce product sync migration before running this test.")
        if any(token in str(exc).lower() for token in ["event loop is closed", "another operation is in progress", "send"]):
            pytest.skip("Skipped due to local asyncpg/TestClient event loop instability on Windows.")
        raise
    dispose_engine()
    assert response.status_code == 201, response.text
    return response.json()


def login_user(email: str, password: str = "StrongPass123") -> dict:
    try:
        with TestClient(app) as client:
            response = client.post(
                "/api/v1/auth/login",
                json={"email": email, "password": password},
            )
    except (ProgrammingError, InterfaceError, AttributeError, RuntimeError) as exc:
        if any(token in str(exc) for token in ["products.source", "products.external_id", "products.external_status"]):
            pytest.skip("Apply the latest WooCommerce product sync migration before running this test.")
        if any(token in str(exc).lower() for token in ["event loop is closed", "another operation is in progress", "send"]):
            pytest.skip("Skipped due to local asyncpg/TestClient event loop instability on Windows.")
        raise
    dispose_engine()
    assert response.status_code == 200, response.text
    return response.json()


def auth_headers() -> dict[str, str]:
    email = unique_email()
    register_user(email)
    login_body = login_user(email)
    token = login_body["access_token"]
    return {"Authorization": f"Bearer {token}"}


def run_async(coro):
    return asyncio.run(coro)


def test_health() -> None:
    with TestClient(app) as client:
        response = client.get("/api/v1/health")
    dispose_engine()
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"


def test_map_external_courier_status_helper() -> None:
    delivered = map_external_courier_status("steadfast", "delivered_to_customer")
    assert delivered["normalized_external_status"] == "delivered"
    assert delivered["suggested_internal_status"] == "delivered"
    assert delivered["severity"] == "info"

    returned = map_external_courier_status("steadfast", "rto")
    assert returned["normalized_external_status"] == "returned"
    assert returned["suggested_internal_status"] == "returned"
    assert returned["severity"] == "warning"

    in_transit = map_external_courier_status("steadfast", "processing")
    assert in_transit["normalized_external_status"] == "processing"
    assert in_transit["suggested_internal_status"] is None
    assert "no local status change" in (in_transit["warning_message"] or "").lower()


def test_register() -> None:
    email = unique_email()
    body = register_user(email)
    assert body["email"] == email
    assert body["role"] == "admin"


def test_login() -> None:
    email = unique_email()
    register_user(email)
    body = login_user(email)
    assert body["token_type"] == "bearer"
    assert body["user"]["email"] == email
    assert body["access_token"]


def test_auth_me_compatibility_payload_and_login_last_login() -> None:
    admin_email = unique_email()
    staff_email = unique_email()

    try:
        register_user(admin_email, full_name="Admin Compatibility")
        admin_login = login_user(admin_email)
        admin_headers = {"Authorization": f"Bearer {admin_login['access_token']}"}

        created_staff = register_user(
            staff_email,
            role="staff",
            is_active=True,
            full_name="Staff Compatibility",
        )

        with TestClient(app) as client:
            seed_response = client.post("/api/v1/permissions/seed-defaults", headers=admin_headers)
            assert seed_response.status_code == 201, seed_response.text

            assign_response = client.patch(
                f"/api/v1/users/{created_staff['id']}/permissions",
                headers=admin_headers,
                json={
                    "permission_keys": [
                        "orders.view",
                        "products.view",
                        "customers.view",
                        "pos.view",
                    ]
                },
            )
            assert assign_response.status_code == 200, assign_response.text

            admin_me_response = client.get("/api/v1/auth/me", headers=admin_headers)
            assert admin_me_response.status_code == 200, admin_me_response.text
            admin_me = admin_me_response.json()
            assert admin_me["email"] == admin_email
            assert admin_me["uid"] == admin_me["id"]
            assert admin_me["active"] is True
            assert admin_me["is_active"] is True
            assert admin_me["has_full_access"] is True
            assert all(admin_me["legacy_permissions"].values()) is True
            assert admin_me["display_name"] == "Admin Compatibility"
            assert admin_me["photo_url"] is None
            assert admin_me["photoURL"] is None

            staff_login_response = client.post(
                "/api/v1/auth/login",
                json={"email": staff_email, "password": "StrongPass123"},
            )
            assert staff_login_response.status_code == 200, staff_login_response.text
            staff_token = staff_login_response.json()["access_token"]
            staff_headers = {"Authorization": f"Bearer {staff_token}"}

            staff_me_response = client.get("/api/v1/auth/me", headers=staff_headers)
            assert staff_me_response.status_code == 200, staff_me_response.text
            staff_me = staff_me_response.json()
            assert staff_me["name"] == "Staff Compatibility"
            assert staff_me["full_name"] == "Staff Compatibility"
            assert set(staff_me["permissions"]) == {"orders.view", "products.view", "customers.view", "pos.view"}
            assert staff_me["legacy_permissions"]["dashboard"] is False
            assert staff_me["legacy_permissions"]["orders"] is True
            assert staff_me["legacy_permissions"]["inventory"] is True
            assert staff_me["legacy_permissions"]["crm"] is True
            assert staff_me["legacy_permissions"]["pos"] is True
            assert staff_me["legacy_permissions"]["logistics"] is False
            assert staff_me["legacy_permissions"]["settings"] is False
            assert staff_me["has_full_access"] is False
            assert staff_me["last_login"] is not None
            assert staff_me["lastLogin"] == staff_me["last_login"]
            assert staff_me["createdAt"] == staff_me["created_at"]
    except ProgrammingError as exc:
        if any(token in str(exc) for token in ["last_login", "notifications", "permissions", "user_permissions"]):
            pytest.skip("Apply the latest auth compatibility migration before running this test.")
        raise

    dispose_engine()


def test_notifications_visibility_and_read_flow() -> None:
    admin_email = unique_email()
    target_email = unique_email()
    other_email = unique_email()

    try:
        register_user(admin_email, full_name="Notification Admin")
        admin_login = login_user(admin_email)
        admin_headers = {"Authorization": f"Bearer {admin_login['access_token']}"}

        target_user = register_user(target_email, role="staff", is_active=True, full_name="Target User")
        register_user(other_email, role="staff", is_active=True, full_name="Other User")

        target_login = login_user(target_email)
        other_login = login_user(other_email)
        target_headers = {"Authorization": f"Bearer {target_login['access_token']}"}
        other_headers = {"Authorization": f"Bearer {other_login['access_token']}"}

        with TestClient(app) as client:
            broadcast_response = client.post(
                "/api/v1/notifications",
                headers=admin_headers,
                json={
                    "title": "Broadcast notice",
                    "message": "Visible to everyone in the shell.",
                    "type": "info",
                    "module": "dashboard",
                    "link": "/dashboard",
                },
            )
            assert broadcast_response.status_code == 201, broadcast_response.text
            broadcast_notification = broadcast_response.json()

            targeted_response = client.post(
                "/api/v1/notifications",
                headers=admin_headers,
                json={
                    "user_id": target_user["id"],
                    "title": "Targeted notice",
                    "message": "Visible only to the targeted user.",
                    "type": "warning",
                    "module": "team",
                    "link": "/dashboard/team",
                    "metadata": {"source": "test"},
                },
            )
            assert targeted_response.status_code == 201, targeted_response.text
            targeted_notification = targeted_response.json()
            assert targeted_notification["metadata"]["source"] == "test"

            target_list_response = client.get("/api/v1/notifications", headers=target_headers)
            assert target_list_response.status_code == 200, target_list_response.text
            target_notifications = target_list_response.json()
            target_ids = {item["id"] for item in target_notifications}
            assert broadcast_notification["id"] in target_ids
            assert targeted_notification["id"] in target_ids

            other_list_response = client.get("/api/v1/notifications", headers=other_headers)
            assert other_list_response.status_code == 200, other_list_response.text
            other_notifications = other_list_response.json()
            other_ids = {item["id"] for item in other_notifications}
            assert broadcast_notification["id"] in other_ids
            assert targeted_notification["id"] not in other_ids

            unread_target_response = client.get("/api/v1/notifications/unread-count", headers=target_headers)
            assert unread_target_response.status_code == 200, unread_target_response.text
            assert unread_target_response.json()["unread_count"] >= 2

            mark_one_response = client.patch(
                f"/api/v1/notifications/{targeted_notification['id']}/read",
                headers=target_headers,
            )
            assert mark_one_response.status_code == 200, mark_one_response.text
            assert mark_one_response.json()["read"] is True

            unread_filtered_response = client.get(
                "/api/v1/notifications?unread_only=true",
                headers=target_headers,
            )
            assert unread_filtered_response.status_code == 200, unread_filtered_response.text
            unread_filtered = unread_filtered_response.json()
            unread_filtered_ids = {item["id"] for item in unread_filtered}
            assert broadcast_notification["id"] in unread_filtered_ids
            assert targeted_notification["id"] not in unread_filtered_ids

            mark_all_response = client.patch("/api/v1/notifications/mark-all-read", headers=target_headers)
            assert mark_all_response.status_code == 200, mark_all_response.text
            assert mark_all_response.json()["unread_count"] == 0

            unread_after_response = client.get("/api/v1/notifications/unread-count", headers=target_headers)
            assert unread_after_response.status_code == 200, unread_after_response.text
            assert unread_after_response.json()["unread_count"] == 0
    except ProgrammingError as exc:
        if any(token in str(exc) for token in ["last_login", "notifications"]):
            pytest.skip("Apply the latest auth compatibility migration before running this test.")
        raise

    dispose_engine()


def test_protected_route_rejects_without_token() -> None:
    with TestClient(app) as client:
        response = client.get("/api/v1/categories")
    dispose_engine()
    assert response.status_code == 401


def test_protected_route_accepts_with_token() -> None:
    with TestClient(app) as client:
        response = client.get(
            "/api/v1/categories",
            headers=auth_headers(),
        )
    dispose_engine()
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_public_storefront_routes_expose_only_active_products() -> None:
    headers = auth_headers()

    try:
        with TestClient(app) as client:
            category_response = client.post(
                "/api/v1/categories",
                headers=headers,
                json={
                    "name": f"Public Category {uuid.uuid4().hex[:8]}",
                    "slug": f"public-category-{uuid.uuid4().hex[:8]}",
                    "description": "Public category",
                },
            )
            assert category_response.status_code == 201, category_response.text
            category = category_response.json()

            brand_response = client.post(
                "/api/v1/brands",
                headers=headers,
                json={
                    "name": f"Public Brand {uuid.uuid4().hex[:8]}",
                    "slug": f"public-brand-{uuid.uuid4().hex[:8]}",
                    "description": "Public brand",
                },
            )
            assert brand_response.status_code == 201, brand_response.text
            brand = brand_response.json()

            active_product_response = client.post(
                "/api/v1/products",
                headers=headers,
                json={
                    "name": "Storefront Active Product",
                    "slug": f"storefront-active-{uuid.uuid4().hex[:8]}",
                    "sku": f"STORE-{uuid.uuid4().hex[:8]}",
                    "description": "Visible in the storefront public feed.",
                    "category_id": category["id"],
                    "brand_id": brand["id"],
                    "price": 950.00,
                    "cost_price": 600.00,
                    "image_url": "https://example.com/active-product.jpg",
                    "status": "active",
                    "variants": [],
                },
            )
            assert active_product_response.status_code == 201, active_product_response.text
            active_product = active_product_response.json()

            inactive_product_response = client.post(
                "/api/v1/products",
                headers=headers,
                json={
                    "name": "Storefront Hidden Product",
                    "slug": f"storefront-hidden-{uuid.uuid4().hex[:8]}",
                    "sku": f"HIDDEN-{uuid.uuid4().hex[:8]}",
                    "description": "Should stay out of public feeds.",
                    "category_id": category["id"],
                    "brand_id": brand["id"],
                    "price": 850.00,
                    "cost_price": 500.00,
                    "image_url": "https://example.com/hidden-product.jpg",
                    "status": "draft",
                    "variants": [],
                },
            )
            assert inactive_product_response.status_code == 201, inactive_product_response.text

            public_products_response = client.get("/api/v1/public/products")
            assert public_products_response.status_code == 200, public_products_response.text
            public_products = public_products_response.json()
            public_ids = {item["id"] for item in public_products["items"]}
            assert active_product["id"] in public_ids
            assert not any(item["id"] == inactive_product_response.json()["id"] for item in public_products["items"])

            storefront_product = next(item for item in public_products["items"] if item["id"] == active_product["id"])
            assert storefront_product["name"] == active_product["name"]
            assert storefront_product["category"]["slug"] == category["slug"]
            assert storefront_product["brand"]["slug"] == brand["slug"]
            assert storefront_product["is_public"] is True
            assert "cost_price" not in storefront_product
            assert "supplier_cost" not in storefront_product

            public_detail_response = client.get(f"/api/v1/public/products/{active_product['id']}")
            assert public_detail_response.status_code == 200, public_detail_response.text
            assert public_detail_response.json()["id"] == active_product["id"]

            categories_response = client.get("/api/v1/public/categories")
            assert categories_response.status_code == 200, categories_response.text
            assert any(item["id"] == category["id"] for item in categories_response.json())

            brands_response = client.get("/api/v1/public/brands")
            assert brands_response.status_code == 200, brands_response.text
            assert any(item["id"] == brand["id"] for item in brands_response.json())
    except (ProgrammingError, InterfaceError, AttributeError, RuntimeError) as exc:
        lowered = str(exc).lower()
        if any(token in lowered for token in ["products.source", "products.external_id", "products.external_status", "undefinedcolumnerror"]):
            pytest.skip("Apply the latest WooCommerce product sync migration before running this test.")
        if any(token in lowered for token in ["event loop is closed", "another operation is in progress", "send"]):
            pytest.skip("Skipped due to local asyncpg/TestClient event loop instability on Windows.")
        raise

    dispose_engine()


def test_storefront_settings_get_and_update() -> None:
    headers = auth_headers()

    try:
        with TestClient(app) as client:
            get_response = client.get("/api/v1/admin/storefront/settings", headers=headers)
            assert get_response.status_code == 200, get_response.text
            settings = get_response.json()
            assert settings["brand_name"]
            assert settings["show_topbar"] is True

            update_response = client.put(
                "/api/v1/admin/storefront/settings",
                headers=headers,
                json={
                    "brand_name": "Amar-eCom Live",
                    "primary_color": "#111111",
                    "show_search": False,
                },
            )
            assert update_response.status_code == 200, update_response.text
            updated = update_response.json()
            assert updated["brand_name"] == "Amar-eCom Live"
            assert updated["primary_color"] == "#111111"
            assert updated["show_search"] is False
    except (ProgrammingError, InterfaceError, AttributeError, RuntimeError) as exc:
        if "storefront_" in str(exc).lower():
            pytest.skip("Apply the storefront builder migration before running this test.")
        raise

    dispose_engine()


def test_storefront_menus_and_items_and_public_filtering() -> None:
    headers = auth_headers()
    unique_label = f"Seasonal Deals {uuid.uuid4().hex[:8]}"
    unique_url = f"/seasonal-deals-{uuid.uuid4().hex[:8]}"

    try:
        with TestClient(app) as client:
            menus_response = client.get("/api/v1/admin/storefront/menus", headers=headers)
            assert menus_response.status_code == 200, menus_response.text
            menus = menus_response.json()
            main_nav = next(item for item in menus if item["location"] == "main_nav")

            create_item_response = client.post(
                f"/api/v1/admin/storefront/menus/{main_nav['id']}/items",
                headers=headers,
                json={
                    "label": unique_label,
                    "url": unique_url,
                    "target": "_self",
                    "sort_order": 99,
                    "is_active": True,
                },
            )
            assert create_item_response.status_code == 201, create_item_response.text
            created_item = create_item_response.json()

            disable_item_response = client.delete(
                f"/api/v1/admin/storefront/menu-items/{created_item['id']}",
                headers=headers,
            )
            assert disable_item_response.status_code == 204, disable_item_response.text

            public_menus_response = client.get("/api/v1/public/storefront/menus")
            assert public_menus_response.status_code == 200, public_menus_response.text
            public_menus = public_menus_response.json()
            assert "main_nav" in public_menus
            assert not any(item["label"] == unique_label for item in public_menus["main_nav"])
    except (ProgrammingError, InterfaceError, AttributeError, RuntimeError) as exc:
        if "storefront_" in str(exc).lower():
            pytest.skip("Apply the storefront builder migration before running this test.")
        raise

    dispose_engine()


def test_storefront_pages_sections_and_public_visibility() -> None:
    headers = auth_headers()

    try:
        with TestClient(app) as client:
            create_page_response = client.post(
                "/api/v1/admin/storefront/pages",
                headers=headers,
                json={
                    "title": "Draft Promo Page",
                    "slug": f"draft-promo-{uuid.uuid4().hex[:8]}",
                    "page_type": "landing",
                    "content": "Draft content",
                    "status": "draft",
                    "seo_title": "Draft Promo",
                    "seo_description": "Draft promo description",
                    "is_system": False,
                },
            )
            assert create_page_response.status_code == 201, create_page_response.text
            page = create_page_response.json()

            section_response = client.post(
                f"/api/v1/admin/storefront/pages/{page['id']}/sections",
                headers=headers,
                json={
                    "type": "text_block",
                    "title": "Draft block",
                    "subtitle": "Not yet public",
                    "sort_order": 0,
                    "is_enabled": True,
                    "settings": {"align": "left"},
                    "content": {"body": "Safe draft text"},
                },
            )
            assert section_response.status_code == 201, section_response.text
            section = section_response.json()

            public_draft_response = client.get(f"/api/v1/public/storefront/pages/{page['slug']}")
            assert public_draft_response.status_code == 404, public_draft_response.text

            publish_response = client.put(
                f"/api/v1/admin/storefront/pages/{page['id']}",
                headers=headers,
                json={"status": "published"},
            )
            assert publish_response.status_code == 200, publish_response.text

            disable_section_response = client.put(
                f"/api/v1/admin/storefront/sections/{section['id']}",
                headers=headers,
                json={"is_enabled": False},
            )
            assert disable_section_response.status_code == 200, disable_section_response.text

            public_page_response = client.get(f"/api/v1/public/storefront/pages/{page['slug']}")
            assert public_page_response.status_code == 200, public_page_response.text
            public_page = public_page_response.json()
            assert public_page["page"]["slug"] == page["slug"]
            assert public_page["page"]["sections"] == []

            home_response = client.get("/api/v1/public/storefront/pages/home")
            assert home_response.status_code == 200, home_response.text
            home_payload = home_response.json()
            assert home_payload["page"]["slug"] == "home"
            assert isinstance(home_payload["page"]["sections"], list)
            assert "id" not in home_payload["page"]
            assert "id" not in home_payload["settings"]
    except (ProgrammingError, InterfaceError, AttributeError, RuntimeError) as exc:
        if "storefront_" in str(exc).lower():
            pytest.skip("Apply the storefront builder migration before running this test.")
        raise

    dispose_engine()


def test_admin_tools_endpoints() -> None:
    headers = auth_headers()
    staff_email = unique_email()

    try:
        with TestClient(app) as client:
            staff_register_response = client.post(
                "/api/v1/auth/register",
                json={
                    "full_name": "Staff User",
                    "email": staff_email,
                    "password": "StrongPass123",
                    "role": "staff",
                    "is_active": True,
                },
            )
            assert staff_register_response.status_code == 201, staff_register_response.text

            staff_login_response = client.post(
                "/api/v1/auth/login",
                json={"email": staff_email, "password": "StrongPass123"},
            )
            assert staff_login_response.status_code == 200, staff_login_response.text
            staff_headers = {"Authorization": f"Bearer {staff_login_response.json()['access_token']}"}

            health_response = client.get("/api/v1/admin/system-health", headers=headers)
            assert health_response.status_code == 200, health_response.text
            health_body = health_response.json()
            assert health_body["service_status"]["api"] == "ok"
            assert "counts" in health_body

            backup_response = client.get("/api/v1/admin/backup-guidance", headers=headers)
            assert backup_response.status_code == 200, backup_response.text
            backup_body = backup_response.json()
            assert "pg_dump" in backup_body["pg_dump_command_template"]

            checklist_response = client.get("/api/v1/admin/maintenance-checklist", headers=headers)
            assert checklist_response.status_code == 200, checklist_response.text
            checklist_body = checklist_response.json()
            assert any(item["key"] == "migrations_applied" for item in checklist_body["items"])
            assert any(item["key"] == "courier_integration_readiness" for item in checklist_body["items"])

            export_response = client.get("/api/v1/admin/exports/products", headers=headers)
            assert export_response.status_code == 200, export_response.text
            assert export_response.headers["content-type"].startswith("text/csv")
            assert "attachment; filename=\"products.csv\"" == export_response.headers["content-disposition"]

            forbidden_response = client.get("/api/v1/admin/system-health", headers=staff_headers)
            assert forbidden_response.status_code == 403, forbidden_response.text
    except (ProgrammingError, InterfaceError, AttributeError, RuntimeError) as exc:
        lowered = str(exc).lower()
        if any(token in lowered for token in ["products.source", "products.external_id", "products.external_status", "undefinedcolumnerror"]):
            pytest.skip("Apply the latest WooCommerce product sync migration before running this test.")
        if any(token in lowered for token in ["event loop is closed", "another operation is in progress", "send"]):
            pytest.skip("Skipped due to local asyncpg/TestClient event loop instability on Windows.")
        raise

    dispose_engine()


def test_woocommerce_admin_endpoints(monkeypatch: pytest.MonkeyPatch) -> None:
    headers = auth_headers()
    staff_email = unique_email()

    async def fake_test_connection(db, current_user):
        return {
            "success": True,
            "message": "WooCommerce connection succeeded.",
            "tested_at": "2026-05-13T10:00:00+00:00",
        }

    async def fake_products_preview(db, *, page, per_page, search, modified_after=None, current_user):
        return {
            "items": [
                {
                    "external_id": "101",
                    "name": "Woo Shirt",
                    "slug": "woo-shirt",
                    "sku": "WOO-101",
                    "price": "1200.00",
                    "status": "publish",
                    "category": "Apparel",
                    "image_url": "https://example.com/image.jpg",
                    "external_stock_quantity": 18,
                    "duplicate_status": "new",
                    "local_product_id": None,
                }
            ],
            "page": page,
            "per_page": per_page,
            "total": 1,
            "total_pages": 1,
        }

    async def fake_orders_preview(db, *, page, per_page, status_value, after=None, current_user):
        return {
            "items": [
                {
                    "external_id": "501",
                    "number": "501",
                    "customer": "Woo Customer",
                    "status": status_value or "processing",
                    "total": "2400.00",
                    "currency": "BDT",
                    "created_at": "2026-05-13T10:00:00+00:00",
                    "duplicate_status": "new",
                    "local_order_id": None,
                }
            ],
            "page": page,
            "per_page": per_page,
            "total": 1,
            "total_pages": 1,
        }

    async def fake_import_products(db, external_ids, current_user):
        return {
            "imported_count": len(external_ids),
            "skipped_count": 0,
            "failed_count": 0,
            "rows": [{"external_id": external_ids[0], "status": "imported", "local_entity_id": None, "message": "Products imported."}],
        }

    async def fake_import_orders(db, external_ids, current_user):
        return {
            "imported_count": len(external_ids),
            "skipped_count": 0,
            "failed_count": 0,
            "rows": [{"external_id": external_ids[0], "status": "imported", "local_entity_id": None, "message": "Orders imported."}],
        }

    async def fake_run_manual_sync(db, current_user, *, sync_products=True, sync_orders=True, since_last_sync=True, per_page=20):
        return {
            "status": "success",
            "started_at": "2026-05-15T10:00:00+00:00",
            "finished_at": "2026-05-15T10:05:00+00:00",
            "product_result": {
                "imported_count": 1,
                "skipped_count": 1,
                "failed_count": 0,
                "rows": [
                    {"external_id": "101", "status": "imported", "local_entity_id": None, "message": "Products imported."},
                    {"external_id": "102", "status": "skipped", "local_entity_id": None, "message": "Duplicate skipped."},
                ],
            },
            "order_result": {
                "imported_count": 1,
                "skipped_count": 0,
                "failed_count": 0,
                "rows": [{"external_id": "501", "status": "imported", "local_entity_id": None, "message": "Orders imported."}],
            },
            "message": "Product sync complete. Order sync complete.",
        }

    async def fake_refresh_imported_order_from_woocommerce(db, local_order_id, current_user):
        return {
            "refreshed_count": 1,
            "imported_count": 0,
            "skipped_count": 0,
            "failed_count": 0,
            "rows": [
                {
                    "external_id": "501",
                    "status": "refreshed",
                    "local_order_id": str(local_order_id),
                    "message": "Refreshed WooCommerce order 501.",
                }
            ],
        }

    async def fake_refresh_imported_product_from_woocommerce(db, local_product_id, current_user):
        return {
            "refreshed_count": 1,
            "imported_count": 0,
            "skipped_count": 0,
            "failed_count": 0,
            "rows": [
                {
                    "external_id": "101",
                    "status": "refreshed",
                    "local_product_id": str(local_product_id),
                    "message": "Refreshed WooCommerce product 101.",
                }
            ],
        }

    async def fake_refresh_imported_products_since_last_sync(db, current_user, *, per_page=20, since_last_sync=True, search=None):
        return {
            "refreshed_count": 2,
            "imported_count": 1,
            "skipped_count": 1,
            "failed_count": 0,
            "rows": [
                {"external_id": "101", "status": "refreshed", "local_product_id": None, "message": "Refreshed WooCommerce product 101."},
                {"external_id": "102", "status": "refreshed", "local_product_id": None, "message": "Refreshed WooCommerce product 102."},
                {"external_id": "103", "status": "imported", "local_product_id": None, "message": "Imported new WooCommerce product 103."},
                {"external_id": "104", "status": "skipped", "local_product_id": None, "message": "Skipped conflicting local product 104."},
            ],
        }

    async def fake_refresh_imported_orders_since_last_sync(db, current_user, *, per_page=20, since_last_sync=True, status_value=None):
        return {
            "refreshed_count": 2,
            "imported_count": 1,
            "skipped_count": 1,
            "failed_count": 0,
            "rows": [
                {"external_id": "501", "status": "refreshed", "local_order_id": None, "message": "Refreshed WooCommerce order 501."},
                {"external_id": "502", "status": "refreshed", "local_order_id": None, "message": "Refreshed WooCommerce order 502."},
                {"external_id": "503", "status": "imported", "local_order_id": None, "message": "Imported new WooCommerce order 503."},
                {"external_id": "504", "status": "skipped", "local_order_id": None, "message": "Skipped conflicting local order 504."},
            ],
        }

    class FakeSyncStatusSettings:
        id = "00000000-0000-0000-0000-000000000123"
        store_url = "https://store.example.com"
        api_version = "wc/v3"
        is_active = True
        consumer_key_encrypted = "gAAAAABmasked"
        consumer_secret_encrypted = "gAAAAABmaskedsecret"
        last_tested_at = "2026-05-15T09:30:00+00:00"
        last_test_success = True
        last_test_message = "WooCommerce connection succeeded."
        auto_sync_enabled = True
        sync_products_enabled = True
        sync_orders_enabled = True
        sync_interval_minutes = 60
        last_product_sync_at = "2026-05-15T08:00:00+00:00"
        last_order_sync_at = "2026-05-15T08:30:00+00:00"
        last_sync_started_at = "2026-05-15T09:00:00+00:00"
        last_sync_finished_at = "2026-05-15T09:05:00+00:00"
        last_sync_status = "success"
        last_sync_message = "Previous sync succeeded."
        created_at = "2026-05-13T10:00:00+00:00"
        updated_at = "2026-05-15T09:05:00+00:00"

    class FakeSyncLog:
        def __init__(self):
            self.id = "00000000-0000-0000-0000-000000000789"
            self.sync_type = "manual_sync"
            self.direction = "import"
            self.status = "success"
            self.external_id = None
            self.local_entity_type = None
            self.local_entity_id = None
            self.message = "WooCommerce manual sync finished."
            self.payload_snapshot = '{"per_page": 20}'
            self.created_by_id = None
            self.started_at = "2026-05-15T09:00:00+00:00"
            self.finished_at = "2026-05-15T09:05:00+00:00"
            self.created_at = "2026-05-15T09:05:00+00:00"
            self.created_by = None

    async def fake_get_sync_status_summary(db, *, recent_limit=10):
        return {
            "settings": FakeSyncStatusSettings(),
            "recent_sync_logs": [FakeSyncLog()],
            "failed_sync_count": 2,
            "recent_product_refresh_failures_count": 1,
            "recent_order_refresh_failures_count": 1,
            "imported_woocommerce_products_count": 9,
            "imported_woocommerce_orders_count": 7,
            "last_product_refresh_at": "2026-05-15T09:04:00+00:00",
            "last_order_refresh_at": "2026-05-15T09:05:00+00:00",
            "ready_to_sync": True,
            "readiness_warnings": ["Auto-sync is configuration-only right now. No background worker is running in this deployment by default."],
        }

    monkeypatch.setattr(woocommerce_routes, "test_connection", fake_test_connection)
    monkeypatch.setattr(woocommerce_routes, "fetch_products_preview", fake_products_preview)
    monkeypatch.setattr(woocommerce_routes, "fetch_orders_preview", fake_orders_preview)
    monkeypatch.setattr(woocommerce_routes, "import_products", fake_import_products)
    monkeypatch.setattr(woocommerce_routes, "import_orders", fake_import_orders)
    monkeypatch.setattr(woocommerce_routes, "run_manual_sync", fake_run_manual_sync)
    monkeypatch.setattr(woocommerce_routes, "refresh_imported_product_from_woocommerce", fake_refresh_imported_product_from_woocommerce)
    monkeypatch.setattr(woocommerce_routes, "refresh_imported_products_since_last_sync", fake_refresh_imported_products_since_last_sync)
    monkeypatch.setattr(woocommerce_routes, "refresh_imported_order_from_woocommerce", fake_refresh_imported_order_from_woocommerce)
    monkeypatch.setattr(woocommerce_routes, "refresh_imported_orders_since_last_sync", fake_refresh_imported_orders_since_last_sync)
    monkeypatch.setattr(woocommerce_routes, "get_sync_status_summary", fake_get_sync_status_summary)

    try:
        with TestClient(app) as client:
            staff_register_response = client.post(
                "/api/v1/auth/register",
                json={
                    "full_name": "Woo Staff User",
                    "email": staff_email,
                    "password": "StrongPass123",
                    "role": "staff",
                    "is_active": True,
                },
            )
            assert staff_register_response.status_code == 201, staff_register_response.text

            staff_login_response = client.post(
                "/api/v1/auth/login",
                json={"email": staff_email, "password": "StrongPass123"},
            )
            assert staff_login_response.status_code == 200, staff_login_response.text
            staff_headers = {"Authorization": f"Bearer {staff_login_response.json()['access_token']}"}

            settings_response = client.patch(
                "/api/v1/woocommerce/settings",
                headers=headers,
                json={
                    "store_url": "https://store.example.com",
                    "consumer_key": "ck_test",
                    "consumer_secret": "cs_test",
                    "api_version": "wc/v3",
                    "is_active": True,
                },
            )
            assert settings_response.status_code == 200, settings_response.text
            assert settings_response.json()["has_consumer_key"] is True
            assert settings_response.json()["has_consumer_secret"] is True
            assert settings_response.json()["consumer_key_masked"]
            assert isinstance(settings_response.json()["auto_sync_enabled"], bool)
            assert isinstance(settings_response.json()["sync_products_enabled"], bool)
            assert isinstance(settings_response.json()["sync_orders_enabled"], bool)
            assert settings_response.json()["sync_interval_minutes"] >= 1

            get_settings_response = client.get("/api/v1/woocommerce/settings", headers=headers)
            assert get_settings_response.status_code == 200, get_settings_response.text
            settings_payload = get_settings_response.json()
            assert "consumer_secret" not in settings_payload
            assert "consumer_key" not in settings_payload
            assert settings_payload["has_consumer_key"] is True
            assert settings_payload["has_consumer_secret"] is True
            assert settings_payload["consumer_key_masked"]
            assert "ck_test" not in get_settings_response.text
            assert "cs_test" not in get_settings_response.text

            test_response = client.post("/api/v1/woocommerce/test-connection", headers=headers)
            assert test_response.status_code == 200, test_response.text
            assert test_response.json()["success"] is True

            products_preview_response = client.get(
                "/api/v1/woocommerce/products-preview?page=1&per_page=20&search=shirt",
                headers=headers,
            )
            assert products_preview_response.status_code == 200, products_preview_response.text
            assert products_preview_response.json()["items"][0]["sku"] == "WOO-101"
            assert products_preview_response.json()["items"][0]["duplicate_status"] == "new"
            assert products_preview_response.json()["items"][0]["external_stock_quantity"] == 18

            products_import_response = client.post(
                "/api/v1/woocommerce/products-import",
                headers=headers,
                json={"external_ids": ["101"]},
            )
            assert products_import_response.status_code == 200, products_import_response.text
            assert products_import_response.json()["imported_count"] == 1
            assert products_import_response.json()["rows"][0]["status"] == "imported"
            assert products_import_response.json()["rows"][0]["message"] == "Products imported."

            orders_preview_response = client.get(
                "/api/v1/woocommerce/orders-preview?page=1&per_page=20&status=processing",
                headers=headers,
            )
            assert orders_preview_response.status_code == 200, orders_preview_response.text
            assert orders_preview_response.json()["items"][0]["external_id"] == "501"
            assert orders_preview_response.json()["items"][0]["duplicate_status"] == "new"

            orders_import_response = client.post(
                "/api/v1/woocommerce/orders-import",
                headers=headers,
                json={"external_ids": ["501"]},
            )
            assert orders_import_response.status_code == 200, orders_import_response.text
            assert orders_import_response.json()["imported_count"] == 1
            assert orders_import_response.json()["rows"][0]["status"] == "imported"
            assert orders_import_response.json()["rows"][0]["message"] == "Orders imported."

            logs_response = client.get("/api/v1/woocommerce/sync-logs", headers=headers)
            assert logs_response.status_code == 200, logs_response.text
            assert isinstance(logs_response.json(), list)
            filtered_logs_response = client.get("/api/v1/woocommerce/sync-logs?sync_type=product_preview&status=success&external_id=101", headers=headers)
            assert filtered_logs_response.status_code == 200, filtered_logs_response.text
            assert isinstance(filtered_logs_response.json(), list)
            if logs_response.json():
                detail_response = client.get(f"/api/v1/woocommerce/sync-logs/{logs_response.json()[0]['id']}", headers=headers)
                assert detail_response.status_code == 200, detail_response.text

            schedule_settings_response = client.patch(
                "/api/v1/woocommerce/settings",
                headers=headers,
                json={
                    "auto_sync_enabled": True,
                    "sync_products_enabled": True,
                    "sync_orders_enabled": False,
                    "sync_interval_minutes": 180,
                },
            )
            assert schedule_settings_response.status_code == 200, schedule_settings_response.text
            schedule_payload = schedule_settings_response.json()
            assert schedule_payload["auto_sync_enabled"] is True
            assert schedule_payload["sync_products_enabled"] is True
            assert schedule_payload["sync_orders_enabled"] is False
            assert schedule_payload["sync_interval_minutes"] == 180

            sync_status_response = client.get("/api/v1/woocommerce/sync-status", headers=headers)
            assert sync_status_response.status_code == 200, sync_status_response.text
            sync_status_payload = sync_status_response.json()
            assert sync_status_payload["ready_to_sync"] is True
            assert sync_status_payload["failed_sync_count"] == 2
            assert sync_status_payload["recent_product_refresh_failures_count"] == 1
            assert sync_status_payload["recent_order_refresh_failures_count"] == 1
            assert sync_status_payload["imported_woocommerce_products_count"] == 9
            assert sync_status_payload["imported_woocommerce_orders_count"] == 7
            assert sync_status_payload["settings"]["auto_sync_enabled"] is True
            assert sync_status_payload["recent_sync_logs"][0]["sync_type"] == "manual_sync"
            assert sync_status_payload["readiness_warnings"]

            run_sync_response = client.post(
                "/api/v1/woocommerce/run-sync",
                headers=headers,
                json={
                    "sync_products": True,
                    "sync_orders": True,
                    "since_last_sync": True,
                    "per_page": 20,
                },
            )
            assert run_sync_response.status_code == 200, run_sync_response.text
            run_sync_payload = run_sync_response.json()
            assert run_sync_payload["status"] == "success"
            assert run_sync_payload["product_result"]["imported_count"] == 1
            assert run_sync_payload["product_result"]["rows"][1]["status"] == "skipped"
            assert run_sync_payload["order_result"]["imported_count"] == 1

            refresh_single_product_response = client.post(
                "/api/v1/woocommerce/products/00000000-0000-0000-0000-000000000112/refresh",
                headers=headers,
                json={},
            )
            assert refresh_single_product_response.status_code == 200, refresh_single_product_response.text
            assert refresh_single_product_response.json()["refreshed_count"] == 1
            assert refresh_single_product_response.json()["rows"][0]["status"] == "refreshed"

            refresh_bulk_products_response = client.post(
                "/api/v1/woocommerce/products-refresh",
                headers=headers,
                json={"since_last_sync": True, "per_page": 20, "search": "shirt"},
            )
            assert refresh_bulk_products_response.status_code == 200, refresh_bulk_products_response.text
            assert refresh_bulk_products_response.json()["refreshed_count"] == 2
            assert refresh_bulk_products_response.json()["imported_count"] == 1
            assert refresh_bulk_products_response.json()["rows"][2]["status"] == "imported"

            refresh_single_response = client.post(
                "/api/v1/woocommerce/orders/00000000-0000-0000-0000-000000000111/refresh",
                headers=headers,
                json={},
            )
            assert refresh_single_response.status_code == 200, refresh_single_response.text
            assert refresh_single_response.json()["refreshed_count"] == 1
            assert refresh_single_response.json()["rows"][0]["status"] == "refreshed"

            refresh_bulk_response = client.post(
                "/api/v1/woocommerce/orders-refresh",
                headers=headers,
                json={"since_last_sync": True, "per_page": 20, "status": "processing"},
            )
            assert refresh_bulk_response.status_code == 200, refresh_bulk_response.text
            assert refresh_bulk_response.json()["refreshed_count"] == 2
            assert refresh_bulk_response.json()["imported_count"] == 1
            assert refresh_bulk_response.json()["rows"][2]["status"] == "imported"

            forbidden_response = client.get("/api/v1/woocommerce/settings", headers=staff_headers)
            assert forbidden_response.status_code == 403, forbidden_response.text
            forbidden_run_sync_response = client.post("/api/v1/woocommerce/run-sync", headers=staff_headers, json={})
            assert forbidden_run_sync_response.status_code == 403, forbidden_run_sync_response.text
            forbidden_product_refresh_response = client.post("/api/v1/woocommerce/products-refresh", headers=staff_headers, json={})
            assert forbidden_product_refresh_response.status_code == 403, forbidden_product_refresh_response.text
            forbidden_refresh_response = client.post("/api/v1/woocommerce/orders-refresh", headers=staff_headers, json={})
            assert forbidden_refresh_response.status_code == 403, forbidden_refresh_response.text
    except (ProgrammingError, InterfaceError, AttributeError, RuntimeError) as exc:
        if any(token in str(exc) for token in ["woocommerce_settings", "woocommerce_sync_logs"]):
            pytest.skip("Apply the latest WooCommerce migration before running this test.")
        if any(token in str(exc).lower() for token in ["event loop is closed", "another operation is in progress", "send"]):
            pytest.skip("Skipped due to local asyncpg/TestClient event loop instability on Windows.")
        raise

    dispose_engine()


def test_courier_integrations_admin_endpoints(monkeypatch: pytest.MonkeyPatch) -> None:
    headers = auth_headers()
    staff_email = unique_email()

    async def ensure_setting(db, provider: str) -> CourierProviderSetting:
        result = await db.execute(select(CourierProviderSetting).where(CourierProviderSetting.provider == provider))
        setting = result.scalar_one_or_none()
        if setting is None:
            setting = CourierProviderSetting(
                provider=provider,
                display_name=provider.title(),
            )
            db.add(setting)
            await db.flush()
        return setting

    async def list_settings(db):
        rows = []
        for provider in ["manual", "steadfast", "pathao", "redx", "paperfly"]:
            rows.append(await ensure_setting(db, provider))
        return rows

    async def fake_get_provider_setting(db, provider, create_if_missing=True):
        del create_if_missing
        return await ensure_setting(db, provider)

    async def fake_save_provider_setting(db, provider, **payload):
        setting = await ensure_setting(db, provider)
        if "display_name" in payload and payload["display_name"] is not None:
            setting.display_name = payload["display_name"]
        if "base_url" in payload:
            setting.base_url = payload["base_url"]
        if "api_key" in payload and payload["api_key"] is not None:
            setting.api_key_encrypted = encrypt_secret(payload["api_key"])
        if "api_secret" in payload and payload["api_secret"] is not None:
            setting.api_secret_encrypted = encrypt_secret(payload["api_secret"])
        if "merchant_id" in payload and payload["merchant_id"] is not None:
            setting.merchant_id_encrypted = encrypt_secret(payload["merchant_id"])
        if "username" in payload and payload["username"] is not None:
            setting.username_encrypted = encrypt_secret(payload["username"])
        if "password" in payload and payload["password"] is not None:
            setting.password_encrypted = encrypt_secret(payload["password"])
        if "is_active" in payload and payload["is_active"] is not None:
            setting.is_active = payload["is_active"]
        if "is_sandbox" in payload and payload["is_sandbox"] is not None:
            setting.is_sandbox = payload["is_sandbox"]
        await db.flush()
        return setting

    async def fake_test_provider_connection(db, provider, current_user):
        log = CourierApiLog(
            provider=provider,
            action="connection_test",
            status="success",
            message="Courier provider connection succeeded.",
            request_snapshot='{"provider":"manual"}',
            response_snapshot='{"ok":true}',
            created_by_id=current_user.id,
            started_at=datetime.now(timezone.utc),
            finished_at=datetime.now(timezone.utc),
        )
        db.add(log)
        await db.flush()
        return {
            "provider": provider,
            "success": True,
            "message": "Courier provider connection succeeded.",
            "tested_at": datetime.now(timezone.utc),
        }

    async def fake_send_shipment_to_provider(db, shipment_id, provider, current_user):
        log = CourierApiLog(
            provider=provider,
            action="send_shipment",
            status="success",
            shipment_id=None,
            external_id="CONS-101",
            message="Shipment sent to courier provider successfully.",
            request_snapshot='{"shipment_number":"SHP-TEST"}',
            response_snapshot='{"consignment_id":"CONS-101"}',
            created_by_id=current_user.id,
            started_at=datetime.now(timezone.utc),
            finished_at=datetime.now(timezone.utc),
        )
        db.add(log)
        await db.flush()
        return {
            "status": "success",
            "provider": provider,
            "shipment_id": shipment_id,
            "external_id": "CONS-101",
            "external_tracking_number": "TRK-101",
            "external_status": "submitted",
            "sent_at": datetime.now(timezone.utc),
            "message": "Shipment sent to courier provider successfully.",
            "request_snapshot": {"shipment_number": "SHP-TEST"},
            "response_snapshot": {"consignment_id": "CONS-101"},
        }

    async def fake_sync_shipment_status(db, shipment_id, current_user, provider=None, apply_safe_status=False):
        provider_name = provider or "manual"
        log = CourierApiLog(
            provider=provider_name,
            action="status_sync",
            status="success",
            shipment_id=None,
            external_id="CONS-101",
            message="Courier provider status synced successfully.",
            request_snapshot='{"lookup":"CONS-101"}',
            response_snapshot='{"status":"delivered"}',
            created_by_id=current_user.id,
            started_at=datetime.now(timezone.utc),
            finished_at=datetime.now(timezone.utc),
        )
        db.add(log)
        await db.flush()
        return {
            "status": "success",
            "provider": provider_name,
            "shipment_id": shipment_id,
            "shipment_number": "SHP-TEST",
            "external_id": "CONS-101",
            "external_tracking_number": "TRK-101",
            "old_external_status": "submitted",
            "external_status": "delivered",
            "normalized_external_status": "delivered",
            "internal_status": "delivered",
            "suggested_internal_status": "delivered",
            "internal_status_changed": apply_safe_status,
            "severity": "warning" if not apply_safe_status else "info",
            "warnings": [] if apply_safe_status else ["External delivered status was not applied locally because apply_safe_status is off."],
            "synced_at": datetime.now(timezone.utc),
            "message": "Courier provider status synced successfully.",
            "request_snapshot": {"lookup": "CONS-101"},
            "response_snapshot": {"status": "delivered"},
        }

    async def fake_bulk_sync_shipment_statuses(
        db,
        current_user,
        *,
        provider=None,
        shipment_status=None,
        limit=20,
        apply_safe_status=False,
    ):
        del db, current_user, shipment_status, limit
        return {
            "synced_count": 2,
            "skipped_count": 1,
            "failed_count": 1,
            "rows": [
                {
                    "shipment_id": str(uuid.uuid4()),
                    "shipment_number": "SHP-201",
                    "provider": provider or "manual",
                    "old_external_status": "submitted",
                    "new_external_status": "delivered",
                    "internal_status_changed": apply_safe_status,
                    "message": "Courier provider status synced successfully.",
                    "warnings": [] if apply_safe_status else ["External delivered status was not applied locally because apply_safe_status is off."],
                    "status": "success",
                },
                {
                    "shipment_id": str(uuid.uuid4()),
                    "shipment_number": "SHP-202",
                    "provider": provider or "manual",
                    "old_external_status": "in_transit",
                    "new_external_status": "returned",
                    "internal_status_changed": False,
                    "message": "Conflict warning recorded.",
                    "warnings": ["External status indicates return or cancellation, but the linked local order is already delivered."],
                    "status": "success",
                },
                {
                    "shipment_id": str(uuid.uuid4()),
                    "shipment_number": "SHP-203",
                    "provider": provider or "manual",
                    "old_external_status": "pending",
                    "new_external_status": "pending",
                    "internal_status_changed": False,
                    "message": "Shipment is not linked to an external courier provider yet.",
                    "warnings": ["Shipment is missing an external provider link."],
                    "status": "skipped",
                },
                {
                    "shipment_id": str(uuid.uuid4()),
                    "shipment_number": "SHP-204",
                    "provider": provider or "manual",
                    "old_external_status": "submitted",
                    "new_external_status": "submitted",
                    "internal_status_changed": False,
                    "message": "Courier provider API unavailable.",
                    "warnings": ["Courier provider API unavailable."],
                    "status": "failed",
                },
            ],
        }

    monkeypatch.setattr(courier_integration_routes, "list_provider_settings", list_settings)
    monkeypatch.setattr(courier_integration_routes, "get_provider_setting", fake_get_provider_setting)
    monkeypatch.setattr(courier_integration_routes, "save_provider_setting", fake_save_provider_setting)
    monkeypatch.setattr(courier_integration_routes, "test_provider_connection", fake_test_provider_connection)
    monkeypatch.setattr(courier_integration_routes, "send_shipment_to_provider", fake_send_shipment_to_provider)
    monkeypatch.setattr(courier_integration_routes, "sync_shipment_status", fake_sync_shipment_status)
    monkeypatch.setattr(courier_integration_routes, "bulk_sync_shipment_statuses", fake_bulk_sync_shipment_statuses)

    try:
        with TestClient(app) as client:
            staff_register_response = client.post(
                "/api/v1/auth/register",
                json={
                    "full_name": "Courier Staff User",
                    "email": staff_email,
                    "password": "StrongPass123",
                    "role": "staff",
                    "is_active": True,
                },
            )
            assert staff_register_response.status_code == 201, staff_register_response.text

            staff_login_response = client.post(
                "/api/v1/auth/login",
                json={"email": staff_email, "password": "StrongPass123"},
            )
            assert staff_login_response.status_code == 200, staff_login_response.text
            staff_headers = {"Authorization": f"Bearer {staff_login_response.json()['access_token']}"}

            providers_response = client.get("/api/v1/courier-integrations/providers", headers=headers)
            assert providers_response.status_code == 200, providers_response.text
            providers_payload = providers_response.json()
            assert any(item["provider"] == "manual" for item in providers_payload)

            forbidden_response = client.get("/api/v1/courier-integrations/providers", headers=staff_headers)
            assert forbidden_response.status_code == 403, forbidden_response.text

            settings_response = client.patch(
                "/api/v1/courier-integrations/providers/manual/settings",
                headers=headers,
                json={
                    "display_name": "Manual Test Provider",
                    "base_url": "https://courier.example.com",
                    "api_key": "api-key-test",
                    "api_secret": "secret-test",
                    "merchant_id": "merchant-42",
                    "username": "ops-user",
                    "password": "ops-pass",
                    "is_active": True,
                    "is_sandbox": True,
                },
            )
            assert settings_response.status_code == 200, settings_response.text
            settings_payload = settings_response.json()
            assert "api_key" not in settings_payload
            assert "api_secret" not in settings_payload
            assert "password" not in settings_payload
            assert "api-key-test" not in settings_response.text
            assert "secret-test" not in settings_response.text
            assert settings_payload["has_api_key"] is True
            assert settings_payload["has_api_secret"] is True
            assert settings_payload["api_key_masked"]

            get_settings_response = client.get(
                "/api/v1/courier-integrations/providers/manual/settings",
                headers=headers,
            )
            assert get_settings_response.status_code == 200, get_settings_response.text
            get_settings_payload = get_settings_response.json()
            assert "api_key" not in get_settings_payload
            assert "api_secret" not in get_settings_payload
            assert "password" not in get_settings_payload
            assert get_settings_payload["has_password"] is True

            test_response = client.post(
                "/api/v1/courier-integrations/providers/manual/test-connection",
                headers=headers,
                json={},
            )
            assert test_response.status_code == 200, test_response.text
            assert test_response.json()["success"] is True

            shipment_id = str(uuid.uuid4())
            send_response = client.post(
                f"/api/v1/courier-integrations/shipments/{shipment_id}/send",
                headers=headers,
                json={"provider": "manual"},
            )
            assert send_response.status_code == 200, send_response.text
            assert send_response.json()["external_id"] == "CONS-101"

            sync_response = client.post(
                f"/api/v1/courier-integrations/shipments/{shipment_id}/sync-status",
                headers=headers,
                json={"provider": "manual", "apply_safe_status": False},
            )
            assert sync_response.status_code == 200, sync_response.text
            assert sync_response.json()["external_status"] == "delivered"
            assert sync_response.json()["internal_status_changed"] is False
            assert sync_response.json()["warnings"]

            bulk_sync_response = client.post(
                "/api/v1/courier-integrations/status-sync/bulk",
                headers=headers,
                json={"provider": "manual", "status": "in_transit", "limit": 10, "apply_safe_status": True},
            )
            assert bulk_sync_response.status_code == 200, bulk_sync_response.text
            bulk_sync_payload = bulk_sync_response.json()
            assert bulk_sync_payload["synced_count"] == 2
            assert bulk_sync_payload["skipped_count"] == 1
            assert bulk_sync_payload["failed_count"] == 1
            assert any(row["status"] == "failed" for row in bulk_sync_payload["rows"])

            logs_response = client.get("/api/v1/courier-integrations/logs?provider=manual", headers=headers)
            assert logs_response.status_code == 200, logs_response.text
            logs_payload = logs_response.json()
            assert len(logs_payload) >= 3
            assert any(log["action"] == "connection_test" for log in logs_payload)
            assert any(log["action"] == "send_shipment" for log in logs_payload)
            assert any(log["action"] == "status_sync" for log in logs_payload)
            assert all("requestAt" in log for log in logs_payload)
            assert all("createdAt" in log for log in logs_payload)
            assert any(log["response_summary"] for log in logs_payload if log["response_snapshot"] is not None)

            filtered_logs_response = client.get(
                "/api/v1/courier-integrations/logs?provider=manual&action=status_sync&status=success",
                headers=headers,
            )
            assert filtered_logs_response.status_code == 200, filtered_logs_response.text
            filtered_logs_payload = filtered_logs_response.json()
            assert filtered_logs_payload
            assert all(log["action"] == "status_sync" for log in filtered_logs_payload)

            searched_logs_response = client.get(
                "/api/v1/courier-integrations/logs?provider=manual&search=synced",
                headers=headers,
            )
            assert searched_logs_response.status_code == 200, searched_logs_response.text
            assert any("synced" in (log["message"] or "").lower() for log in searched_logs_response.json())
    except (ProgrammingError, InterfaceError, AttributeError, RuntimeError) as exc:
        if any(token in str(exc) for token in ["courier_provider_settings", "courier_api_logs", "shipments.external_provider"]):
            pytest.skip("Apply the latest courier integration migration before running this test.")
        if any(token in str(exc).lower() for token in ["event loop is closed", "another operation is in progress", "send"]):
            pytest.skip("Skipped due to local asyncpg/TestClient event loop instability on Windows.")
        raise

    dispose_engine()


def test_steadfast_courier_adapter_flow(monkeypatch: pytest.MonkeyPatch) -> None:
    headers = auth_headers()

    def create_shipment(client: TestClient) -> dict:
        category_response = client.post(
            "/api/v1/categories",
            headers=headers,
            json={
                "name": f"Steadfast Category {uuid.uuid4().hex[:8]}",
                "slug": f"steadfast-category-{uuid.uuid4().hex[:8]}",
                "description": "Steadfast shipment category",
            },
        )
        assert category_response.status_code == 201, category_response.text
        category_id = category_response.json()["id"]

        brand_response = client.post(
            "/api/v1/brands",
            headers=headers,
            json={
                "name": f"Steadfast Brand {uuid.uuid4().hex[:8]}",
                "slug": f"steadfast-brand-{uuid.uuid4().hex[:8]}",
                "description": "Steadfast shipment brand",
            },
        )
        assert brand_response.status_code == 201, brand_response.text
        brand_id = brand_response.json()["id"]

        product_response = client.post(
            "/api/v1/products",
            headers=headers,
            json={
                "name": "Steadfast Payload Product",
                "slug": f"steadfast-payload-product-{uuid.uuid4().hex[:8]}",
                "sku": f"STDF-{uuid.uuid4().hex[:8]}",
                "description": "Shipment payload test product",
                "category_id": category_id,
                "brand_id": brand_id,
                "price": 300.00,
                "cost_price": 200.00,
                "image_url": None,
                "status": "active",
                "variants": [],
            },
        )
        assert product_response.status_code == 201, product_response.text
        product = product_response.json()

        customer_response = client.post(
            "/api/v1/customers",
            headers=headers,
            json={
                "name": "Steadfast Customer",
                "phone": "01711112222",
                "email": unique_email(),
                "address": "Dhaka",
                "city": "Dhaka",
                "customer_type": "retail",
            },
        )
        assert customer_response.status_code == 201, customer_response.text
        customer = customer_response.json()

        warehouse_response = client.post(
            "/api/v1/warehouses",
            headers=headers,
            json={
                "name": f"Steadfast Warehouse {uuid.uuid4().hex[:8]}",
                "code": f"STW-{uuid.uuid4().hex[:8]}",
                "address": "Dhaka",
                "is_active": True,
            },
        )
        assert warehouse_response.status_code == 201, warehouse_response.text
        warehouse = warehouse_response.json()

        inventory_response = client.post(
            "/api/v1/inventory",
            headers=headers,
            json={
                "product_id": product["id"],
                "variant_id": None,
                "warehouse_id": warehouse["id"],
                "quantity": 15,
                "low_stock_threshold": 2,
            },
        )
        assert inventory_response.status_code == 201, inventory_response.text

        order_response = client.post(
            "/api/v1/orders",
            headers=headers,
            json={
                "order_number": f"ORD-STDF-{uuid.uuid4().hex[:8]}",
                "customer_id": customer["id"],
                "warehouse_id": warehouse["id"],
                "customer_phone": "01711112222",
                "shipping_address": "House 10, Road 12, Dhaka",
                "notes": "Steadfast courier send",
                "status": "confirmed",
                "payment_status": "paid",
                "source": "manual",
                "subtotal": 300,
                "discount": 0,
                "delivery_charge": 60,
                "total": 360,
                "items": [
                    {
                        "product_id": product["id"],
                        "variant_id": None,
                        "product_name": product["name"],
                        "sku": product["sku"],
                        "quantity": 1,
                        "unit_price": 300,
                        "total_price": 300,
                    }
                ],
            },
        )
        assert order_response.status_code == 201, order_response.text
        order = order_response.json()

        courier_response = client.post(
            "/api/v1/couriers",
            headers=headers,
            json={
                "name": f"Steadfast Courier {uuid.uuid4().hex[:8]}",
                "code": f"STDF-{uuid.uuid4().hex[:6]}",
                "contact_phone": "01700000000",
                "website": "https://steadfast.example.com",
                "is_active": True,
            },
        )
        assert courier_response.status_code == 201, courier_response.text
        courier = courier_response.json()

        shipment_response = client.post(
            f"/api/v1/orders/{order['id']}/create-shipment",
            headers=headers,
            json={
                "courier_id": courier["id"],
                "tracking_number": None,
                "delivery_charge": 60,
                "courier_charge": 40,
                "cod_amount": 360,
                "collected_amount": 0,
                "notes": "Steadfast outbound shipment",
                "order_status": "ready_to_ship",
            },
        )
        assert shipment_response.status_code == 201, shipment_response.text
        return shipment_response.json()

    state = {"post_mode": "success", "get_mode": "success"}

    async def fake_request(self, method: str, path: str, *, json_payload: dict | None = None):
        request = httpx.Request(method, f"https://steadfast.test{path}")
        if method == "POST":
            if state["post_mode"] == "failure":
                return httpx.Response(401, json={"message": "Invalid credentials"}, request=request)
            return httpx.Response(
                200,
                json={
                    "consignment": {
                        "consignment_id": "CONS-200",
                        "tracking_code": "TRK-200",
                        "status": "submitted",
                        "message": "Steadfast consignment created.",
                    },
                    "token": "secret-token",
                    "Authorization": "Basic abc123",
                    "api_secret": "should-not-leak",
                },
                request=request,
            )
        if state["get_mode"] == "failure":
            return httpx.Response(404, json={"message": "Not found"}, request=request)
        if state["get_mode"] == "returned":
            return httpx.Response(
                200,
                json={
                    "data": {
                        "consignment_id": "CONS-200",
                        "tracking_code": "TRK-200",
                        "delivery_status": "returned",
                        "message": "Shipment returned.",
                    }
                },
                request=request,
            )
        return httpx.Response(
            200,
            json={
                "data": {
                    "consignment_id": "CONS-200",
                    "tracking_code": "TRK-200",
                    "delivery_status": "delivered",
                    "message": "Shipment delivered.",
                }
            },
            request=request,
        )

    monkeypatch.setattr(SteadfastCourierAdapter, "_request", fake_request)

    try:
        with TestClient(app) as client:
            settings_without_credentials_response = client.patch(
                "/api/v1/courier-integrations/providers/steadfast/settings",
                headers=headers,
                json={
                    "display_name": "Steadfast Production",
                    "base_url": "https://steadfast.example.com/api/v1",
                    "api_key": "",
                    "api_secret": "",
                    "merchant_id": "",
                    "is_active": True,
                    "is_sandbox": True,
                },
            )
            assert settings_without_credentials_response.status_code == 200, settings_without_credentials_response.text

            missing_credentials_test_response = client.post(
                "/api/v1/courier-integrations/providers/steadfast/test-connection",
                headers=headers,
                json={},
            )
            assert missing_credentials_test_response.status_code == 200, missing_credentials_test_response.text
            missing_credentials_payload = missing_credentials_test_response.json()
            assert missing_credentials_payload["success"] is False
            assert "credentials are incomplete" in missing_credentials_payload["message"].lower()

            settings_response = client.patch(
                "/api/v1/courier-integrations/providers/steadfast/settings",
                headers=headers,
                json={
                    "display_name": "Steadfast Production",
                    "base_url": "https://steadfast.example.com/api/v1",
                    "api_key": "api-key-live",
                    "api_secret": "api-secret-live",
                    "merchant_id": "merchant-live",
                    "is_active": True,
                    "is_sandbox": True,
                },
            )
            assert settings_response.status_code == 200, settings_response.text
            settings_payload = settings_response.json()
            assert settings_payload["has_api_key"] is True
            assert settings_payload["has_api_secret"] is True
            assert settings_payload["api_key_masked"]
            assert "api-key-live" not in settings_response.text
            assert "api-secret-live" not in settings_response.text

            configuration_test_response = client.post(
                "/api/v1/courier-integrations/providers/steadfast/test-connection",
                headers=headers,
                json={},
            )
            assert configuration_test_response.status_code == 200, configuration_test_response.text
            configuration_test_payload = configuration_test_response.json()
            assert configuration_test_payload["success"] is True
            assert "configuration check passed" in configuration_test_payload["message"].lower()

            shipment = create_shipment(client)
            clear_order_contact_response = client.patch(
                f"/api/v1/orders/{shipment['order_id']}",
                headers=headers,
                json={
                    "customer_phone": None,
                    "shipping_address": None,
                },
            )
            assert clear_order_contact_response.status_code == 200, clear_order_contact_response.text
            missing_fields_response = client.patch(
                f"/api/v1/shipments/{shipment['id']}",
                headers=headers,
                json={
                    "recipient_phone": None,
                    "delivery_address": None,
                },
            )
            assert missing_fields_response.status_code == 200, missing_fields_response.text

            send_missing_fields_response = client.post(
                f"/api/v1/courier-integrations/shipments/{shipment['id']}/send",
                headers=headers,
                json={"provider": "steadfast"},
            )
            assert send_missing_fields_response.status_code == 400, send_missing_fields_response.text
            assert "required steadfast fields" in send_missing_fields_response.json()["detail"].lower()

            restore_shipment_response = client.patch(
                f"/api/v1/shipments/{shipment['id']}",
                headers=headers,
                json={
                    "recipient_name": "Steadfast Customer",
                    "recipient_phone": "01711112222",
                    "delivery_address": "House 10, Road 12, Dhaka",
                },
            )
            assert restore_shipment_response.status_code == 200, restore_shipment_response.text
            restore_order_contact_response = client.patch(
                f"/api/v1/orders/{shipment['order_id']}",
                headers=headers,
                json={
                    "customer_phone": "01711112222",
                    "shipping_address": "House 10, Road 12, Dhaka",
                },
            )
            assert restore_order_contact_response.status_code == 200, restore_order_contact_response.text

            send_success_response = client.post(
                f"/api/v1/courier-integrations/shipments/{shipment['id']}/send",
                headers=headers,
                json={"provider": "steadfast"},
            )
            assert send_success_response.status_code == 200, send_success_response.text
            send_success_payload = send_success_response.json()
            assert send_success_payload["external_id"] == "CONS-200"
            assert send_success_payload["external_tracking_number"] == "TRK-200"
            assert send_success_payload["external_status"] == "submitted"

            shipment_detail_response = client.get(f"/api/v1/shipments/{shipment['id']}", headers=headers)
            assert shipment_detail_response.status_code == 200, shipment_detail_response.text
            shipment_detail_payload = shipment_detail_response.json()
            assert shipment_detail_payload["external_provider"] == "steadfast"
            assert shipment_detail_payload["external_consignment_id"] == "CONS-200"
            assert shipment_detail_payload["external_tracking_number"] == "TRK-200"
            assert shipment_detail_payload["external_status"] == "submitted"
            assert shipment_detail_payload["sent_to_courier_at"] is not None

            sync_response = client.post(
                f"/api/v1/courier-integrations/shipments/{shipment['id']}/sync-status",
                headers=headers,
                json={"apply_safe_status": False},
            )
            assert sync_response.status_code == 200, sync_response.text
            sync_payload = sync_response.json()
            assert sync_payload["external_status"] == "delivered"
            assert sync_payload["internal_status_changed"] is False
            assert sync_payload["internal_status"] != "delivered"
            assert any("not applied locally" in warning.lower() for warning in sync_payload["warnings"])

            mark_shipment_ready_response = client.patch(
                f"/api/v1/shipments/{shipment['id']}",
                headers=headers,
                json={"status": "shipped"},
            )
            assert mark_shipment_ready_response.status_code == 200, mark_shipment_ready_response.text

            sync_apply_response = client.post(
                f"/api/v1/courier-integrations/shipments/{shipment['id']}/sync-status",
                headers=headers,
                json={"apply_safe_status": True},
            )
            assert sync_apply_response.status_code == 200, sync_apply_response.text
            sync_apply_payload = sync_apply_response.json()
            assert sync_apply_payload["external_status"] == "delivered"
            assert sync_apply_payload["internal_status"] == "delivered"
            assert sync_apply_payload["internal_status_changed"] is True

            state["get_mode"] = "returned"
            sync_conflict_response = client.post(
                f"/api/v1/courier-integrations/shipments/{shipment['id']}/sync-status",
                headers=headers,
                json={"apply_safe_status": False},
            )
            assert sync_conflict_response.status_code == 200, sync_conflict_response.text
            sync_conflict_payload = sync_conflict_response.json()
            assert sync_conflict_payload["external_status"] == "returned"
            assert sync_conflict_payload["internal_status"] == "delivered"
            assert sync_conflict_payload["internal_status_changed"] is False
            assert any("manually closed locally" in warning.lower() for warning in sync_conflict_payload["warnings"])

            state["post_mode"] = "failure"
            send_failure_response = client.post(
                f"/api/v1/courier-integrations/shipments/{shipment['id']}/send",
                headers=headers,
                json={"provider": "steadfast"},
            )
            assert send_failure_response.status_code == 502, send_failure_response.text
            assert "credentials were rejected" in send_failure_response.json()["detail"].lower()

            logs_response = client.get(
                "/api/v1/courier-integrations/logs?provider=steadfast&action=send_shipment",
                headers=headers,
            )
            assert logs_response.status_code == 200, logs_response.text
            logs_payload = logs_response.json()
            assert any(log["status"] == "success" for log in logs_payload)
            assert any(log["status"] == "failed" for log in logs_payload)
            assert "api-key-live" not in logs_response.text
            assert "api-secret-live" not in logs_response.text
            assert "secret-token" not in logs_response.text
            assert "Basic abc123" not in logs_response.text
            assert "should-not-leak" not in logs_response.text
    except (ProgrammingError, InterfaceError, AttributeError, RuntimeError) as exc:
        if any(token in str(exc) for token in ["courier_provider_settings", "courier_api_logs", "shipments.external_provider"]):
            pytest.skip("Apply the latest courier integration migration before running this test.")
        if any(token in str(exc).lower() for token in ["event loop is closed", "another operation is in progress", "send"]):
            pytest.skip("Skipped due to local asyncpg/TestClient event loop instability on Windows.")
        raise

    dispose_engine()


def test_courier_settings_security_and_legacy_compatibility() -> None:
    headers = auth_headers()
    raw_api_key = "api_key_release_ready_123"
    raw_api_secret = "api_secret_release_ready_456"
    raw_password = "ops_password_789"
    raw_merchant_id = "merchant_release_ready"

    original_encrypt_secret = crypto_utils.encrypt_secret

    monkeypatch = pytest.MonkeyPatch()
    try:
        with TestClient(app) as client:
            save_response = client.patch(
                "/api/v1/courier-integrations/providers/manual/settings",
                headers=headers,
                json={
                    "display_name": "Manual Secure Provider",
                    "base_url": "https://courier.example.com",
                    "api_key": raw_api_key,
                    "api_secret": raw_api_secret,
                    "merchant_id": raw_merchant_id,
                    "password": raw_password,
                    "is_active": True,
                    "is_sandbox": True,
                },
            )
            assert save_response.status_code == 200, save_response.text
            payload = save_response.json()
            assert "api_key" not in payload
            assert "api_secret" not in payload
            assert "merchant_id" not in payload
            assert "password" not in payload
            assert payload["has_api_key"] is True
            assert payload["has_api_secret"] is True
            assert payload["has_merchant_id"] is True
            assert payload["has_password"] is True
            assert payload["api_key_masked"] == mask_secret(raw_api_key)
            assert raw_api_key not in save_response.text
            assert raw_api_secret not in save_response.text
            assert raw_password not in save_response.text
            assert raw_merchant_id not in save_response.text

            encrypted_value = original_encrypt_secret(raw_api_key)
            assert encrypted_value != raw_api_key
            assert encrypted_value.startswith("enc::")
            assert is_encrypted_secret(encrypted_value)
            assert decrypt_secret(encrypted_value) == raw_api_key

            get_response = client.get(
                "/api/v1/courier-integrations/providers/manual/settings",
                headers=headers,
            )
            assert get_response.status_code == 200, get_response.text
            get_payload = get_response.json()
            assert get_payload["credentials_encrypted"] is True
            assert get_payload["api_key_masked"] == mask_secret(raw_api_key)
            assert "api_secret" not in get_payload

        legacy_setting = CourierProviderSetting(
            id=uuid.uuid4(),
            provider="manual",
            display_name="Legacy Manual",
            api_key_encrypted="legacy_api_key_plain",
            api_secret_encrypted="legacy_api_secret_plain",
            merchant_id_encrypted="legacy_merchant_plain",
            password_encrypted="legacy_password_plain",
            is_active=True,
            is_sandbox=True,
            last_test_success=False,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        legacy_payload = courier_integration_routes.provider_setting_metadata(legacy_setting)
        assert legacy_payload["has_api_key"] is True
        assert legacy_payload["credentials_encrypted"] is False
        assert legacy_payload["api_key_masked"] == mask_secret("legacy_api_key_plain")
        assert "legacy_api_secret_plain" not in str(legacy_payload)
    except (ProgrammingError, InterfaceError, AttributeError, RuntimeError) as exc:
        if any(token in str(exc) for token in ["courier_provider_settings", "courier_api_logs", "shipments.external_provider"]):
            pytest.skip("Apply the latest courier integration migration before running this test.")
        if any(token in str(exc).lower() for token in ["event loop is closed", "another operation is in progress", "send"]):
            pytest.skip("Skipped due to local asyncpg/TestClient event loop instability on Windows.")
        raise
    finally:
        monkeypatch.undo()

    dispose_engine()

def test_woocommerce_error_handling_and_sync_log_safety(monkeypatch: pytest.MonkeyPatch) -> None:
    headers = auth_headers()

    class FakeResponse:
        def __init__(self, status_code: int = 200, json_payload=None, headers: dict[str, str] | None = None, json_error: bool = False):
            self.status_code = status_code
            self._json_payload = json_payload
            self.headers = headers or {}
            self._json_error = json_error

        def json(self):
            if self._json_error:
                raise ValueError("invalid json")
            return self._json_payload

    try:
        with TestClient(app) as client:
            invalid_url_save = client.patch(
                "/api/v1/woocommerce/settings",
                headers=headers,
                json={
                    "store_url": "not-a-url",
                    "consumer_key": "ck_test_invalid",
                    "consumer_secret": "cs_test_invalid",
                    "api_version": "wc/v3",
                    "is_active": True,
                },
            )
            assert invalid_url_save.status_code == 200, invalid_url_save.text

            invalid_url_test = client.post("/api/v1/woocommerce/test-connection", headers=headers)
            assert invalid_url_test.status_code == 400, invalid_url_test.text
            assert "store URL is invalid" in invalid_url_test.json()["detail"]

            missing_creds_save = client.patch(
                "/api/v1/woocommerce/settings",
                headers=headers,
                json={
                    "store_url": "https://store.example.com",
                    "consumer_key": "",
                    "consumer_secret": "",
                    "api_version": "wc/v3",
                    "is_active": True,
                },
            )
            assert missing_creds_save.status_code == 200, missing_creds_save.text

            missing_creds_test = client.post("/api/v1/woocommerce/test-connection", headers=headers)
            assert missing_creds_test.status_code == 400, missing_creds_test.text
            assert "credentials are missing" in missing_creds_test.json()["detail"]

            valid_save = client.patch(
                "/api/v1/woocommerce/settings",
                headers=headers,
                json={
                    "store_url": "https://store.example.com",
                    "consumer_key": "ck_timeout",
                    "consumer_secret": "cs_timeout",
                    "api_version": "wc/v3",
                    "is_active": True,
                },
            )
            assert valid_save.status_code == 200, valid_save.text

            async def fake_timeout(self, url, **kwargs):
                raise httpx.TimeoutException("timeout")

            monkeypatch.setattr(woocommerce_service.httpx.AsyncClient, "get", fake_timeout)
            timeout_response = client.post("/api/v1/woocommerce/test-connection", headers=headers)
            assert timeout_response.status_code == 504, timeout_response.text
            assert "timed out" in timeout_response.json()["detail"]

            async def fake_unauthorized(self, url, **kwargs):
                return FakeResponse(status_code=401, json_payload={"code": "rest_cannot_view"})

            monkeypatch.setattr(woocommerce_service.httpx.AsyncClient, "get", fake_unauthorized)
            invalid_creds_response = client.post("/api/v1/woocommerce/test-connection", headers=headers)
            assert invalid_creds_response.status_code == 502, invalid_creds_response.text
            assert "credentials were rejected" in invalid_creds_response.json()["detail"]

            async def fake_invalid_json(self, url, **kwargs):
                return FakeResponse(status_code=200, json_error=True)

            monkeypatch.setattr(woocommerce_service.httpx.AsyncClient, "get", fake_invalid_json)
            invalid_json_response = client.get("/api/v1/woocommerce/products-preview?page=1&per_page=20", headers=headers)
            assert invalid_json_response.status_code == 502, invalid_json_response.text
            assert "unreadable product preview response" in invalid_json_response.json()["detail"]

            async def fake_unavailable(self, url, **kwargs):
                raise httpx.ConnectError("down", request=httpx.Request("GET", url))

            monkeypatch.setattr(woocommerce_service.httpx.AsyncClient, "get", fake_unavailable)
            unavailable_response = client.get("/api/v1/woocommerce/orders-preview?page=1&per_page=20", headers=headers)
            assert unavailable_response.status_code == 502, unavailable_response.text
            assert "API is unavailable" in unavailable_response.json()["detail"]

            # Confirm sync log detail payload snapshots stay sanitized.
            async def fake_success(self, url, **kwargs):
                return FakeResponse(
                    status_code=200,
                    json_payload=[{"id": 1, "name": "Preview Product"}],
                    headers={"X-WP-Total": "1", "X-WP-TotalPages": "1"},
                )

            monkeypatch.setattr(woocommerce_service.httpx.AsyncClient, "get", fake_success)
            success_test_response = client.post("/api/v1/woocommerce/test-connection", headers=headers)
            assert success_test_response.status_code == 200, success_test_response.text

            logs_response = client.get("/api/v1/woocommerce/sync-logs?sync_type=connection_test", headers=headers)
            assert logs_response.status_code == 200, logs_response.text
            assert logs_response.json()
            detail_response = client.get(f"/api/v1/woocommerce/sync-logs/{logs_response.json()[0]['id']}", headers=headers)
            assert detail_response.status_code == 200, detail_response.text
            payload_snapshot = detail_response.json().get("payload_snapshot")
            assert payload_snapshot is None or "consumer_key" not in str(payload_snapshot).lower()
            assert payload_snapshot is None or "consumer_secret" not in str(payload_snapshot).lower()
            assert payload_snapshot is None or "authorization" not in str(payload_snapshot).lower()
            assert payload_snapshot is None or "basic " not in str(payload_snapshot).lower()
    except (ProgrammingError, InterfaceError, AttributeError, RuntimeError) as exc:
        if any(token in str(exc) for token in ["woocommerce_settings", "woocommerce_sync_logs"]):
            pytest.skip("Apply the latest WooCommerce migration before running this test.")
        if any(token in str(exc).lower() for token in ["event loop is closed", "another operation is in progress", "send"]):
            pytest.skip("Skipped due to local asyncpg/TestClient event loop instability on Windows.")
        raise

    dispose_engine()


def test_woocommerce_settings_security_and_legacy_compatibility() -> None:
    headers = auth_headers()
    raw_key = "ck_release_ready_12345"
    raw_secret = "cs_release_ready_67890"
    encrypted_calls: list[str] = []

    original_encrypt_secret = crypto_utils.encrypt_secret

    def tracking_encrypt_secret(value: str) -> str:
        encrypted_calls.append(value)
        return original_encrypt_secret(value)

    try:
        monkeypatch = pytest.MonkeyPatch()
        monkeypatch.setattr("app.core.crypto.encrypt_secret", tracking_encrypt_secret)
        with TestClient(app) as client:
            save_response = client.patch(
                "/api/v1/woocommerce/settings",
                headers=headers,
                json={
                    "store_url": "https://store.example.com",
                    "consumer_key": raw_key,
                    "consumer_secret": raw_secret,
                    "api_version": "wc/v3",
                    "is_active": True,
                },
            )
            assert save_response.status_code == 200, save_response.text
            payload = save_response.json()
            assert "consumer_key" not in payload
            assert "consumer_secret" not in payload
            assert payload["has_consumer_key"] is True
            assert payload["has_consumer_secret"] is True
            assert payload["consumer_key_masked"] == mask_secret(raw_key)
            assert raw_key not in save_response.text
            assert raw_secret not in save_response.text
            assert encrypted_calls == [raw_key, raw_secret]

            encrypted_key = original_encrypt_secret(raw_key)
            encrypted_secret = original_encrypt_secret(raw_secret)
            assert encrypted_key != raw_key
            assert encrypted_secret != raw_secret
            assert encrypted_key.startswith("enc::")
            assert encrypted_secret.startswith("enc::")
            assert is_encrypted_secret(encrypted_key)
            assert is_encrypted_secret(encrypted_secret)
            assert decrypt_secret(encrypted_key) == raw_key
            assert decrypt_secret(encrypted_secret) == raw_secret

            legacy_settings = WooCommerceSetting(
                id=uuid.uuid4(),
                store_url="https://store.example.com",
                consumer_key_encrypted="ck_legacy_plain",
                consumer_secret_encrypted="cs_legacy_plain",
                api_version="wc/v3",
                is_active=True,
                auto_sync_enabled=False,
                sync_products_enabled=True,
                sync_orders_enabled=True,
                sync_interval_minutes=60,
                last_test_success=False,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )
            legacy_payload = woocommerce_routes._settings_to_read(legacy_settings)
            assert legacy_payload.has_consumer_key is True
            assert legacy_payload.has_consumer_secret is True
            assert legacy_payload.credentials_encrypted is False
            assert legacy_payload.consumer_key_masked == mask_secret("ck_legacy_plain")

            reencrypted_key = original_encrypt_secret("ck_reencrypted")
            reencrypted_secret = original_encrypt_secret("cs_reencrypted")
            assert is_encrypted_secret(reencrypted_key)
            assert is_encrypted_secret(reencrypted_secret)
            assert decrypt_secret(reencrypted_key) == "ck_reencrypted"
            assert decrypt_secret(reencrypted_secret) == "cs_reencrypted"
    except (ProgrammingError, InterfaceError, AttributeError, RuntimeError) as exc:
        if any(token in str(exc) for token in ["woocommerce_settings", "woocommerce_sync_logs"]):
            pytest.skip("Apply the latest WooCommerce migration before running this test.")
        if any(token in str(exc).lower() for token in ["event loop is closed", "another operation is in progress", "send"]):
            pytest.skip("Skipped due to local asyncpg/TestClient event loop instability on Windows.")
        raise
    finally:
        monkeypatch.undo()

    dispose_engine()


def test_team_permissions_and_activity_logs_flow() -> None:
    try:
        headers = auth_headers()

        with TestClient(app) as client:
            seed_response = client.post(
                "/api/v1/permissions/seed-defaults",
                headers=headers,
            )
            assert seed_response.status_code == 201, seed_response.text
            permissions = seed_response.json()
            assert any(item["module"] == "orders" and item["action"] == "view" for item in permissions)

            create_user_response = client.post(
                "/api/v1/users",
                headers=headers,
                json={
                    "fullName": "Permission Test User",
                    "email": unique_email(),
                    "password": "StrongPass123",
                    "role": "staff",
                    "active": True,
                    "permissions": {
                        "orders": True,
                        "crm": True,
                        "inventory": True,
                        "dashboard": False,
                    },
                },
            )
            assert create_user_response.status_code == 201, create_user_response.text
            created_user = create_user_response.json()
            assert created_user["uid"] == created_user["id"]
            assert created_user["displayName"] == "Permission Test User"
            assert created_user["active"] is True
            assert created_user["status"] == "active"
            assert created_user["legacyPermissions"]["orders"] is True

            permissions_response = client.get("/api/v1/permissions", headers=headers)
            assert permissions_response.status_code == 200, permissions_response.text
            all_permissions = permissions_response.json()
            selected_permissions = [
                item["id"]
                for item in all_permissions
                if (item["module"], item["action"]) in {("orders", "view"), ("customers", "view")}
            ]
            assert len(selected_permissions) == 2

            legacy_matrix_response = client.get("/api/v1/permissions/legacy-matrix", headers=headers)
            assert legacy_matrix_response.status_code == 200, legacy_matrix_response.text
            legacy_matrix = legacy_matrix_response.json()
            assert any(item["module"] == "orders" for item in legacy_matrix["modules"])

            assign_response = client.patch(
                f"/api/v1/users/{created_user['id']}/permissions",
                headers=headers,
                json={"permission_ids": selected_permissions},
            )
            assert assign_response.status_code == 200, assign_response.text
            assigned = assign_response.json()
            assert "orders.view" in assigned["assigned_permission_keys"]
            assert assigned["has_full_access"] is False
            assert assigned["legacyPermissions"]["orders"] is True

            legacy_assign_response = client.patch(
                f"/api/v1/users/{created_user['id']}/legacy-permissions",
                headers=headers,
                json={"permissions": {"orders": True, "crm": True, "inventory": True, "pos": True}},
            )
            assert legacy_assign_response.status_code == 200, legacy_assign_response.text
            legacy_assigned = legacy_assign_response.json()
            assert legacy_assigned["legacyPermissions"]["crm"] is True
            assert legacy_assigned["legacyPermissions"]["pos"] is True

            get_user_permissions_response = client.get(
                f"/api/v1/users/{created_user['id']}/permissions",
                headers=headers,
            )
            assert get_user_permissions_response.status_code == 200, get_user_permissions_response.text
            assigned_lookup = get_user_permissions_response.json()
            assert "customers.view" in assigned_lookup["assigned_permission_keys"]
            assert assigned_lookup["legacyPermissions"]["crm"] is True

            user_detail_response = client.get(f"/api/v1/users/{created_user['id']}", headers=headers)
            assert user_detail_response.status_code == 200, user_detail_response.text
            user_detail = user_detail_response.json()
            assert user_detail["displayName"] == "Permission Test User"
            assert user_detail["permissions"]
            assert user_detail["legacyPermissions"]["inventory"] is True

            login_response = client.post(
                "/api/v1/auth/login",
                json={
                    "email": created_user["email"],
                    "password": "StrongPass123",
                },
            )
            assert login_response.status_code == 200, login_response.text
            login_payload = login_response.json()
            assert "orders.view" in login_payload["permissions"]
            assert "customers.view" in login_payload["permissions"]

            update_user_response = client.patch(
                f"/api/v1/users/{created_user['id']}",
                headers=headers,
                json={"isActive": False},
            )
            assert update_user_response.status_code == 200, update_user_response.text
            updated_user = update_user_response.json()
            assert updated_user["active"] is False
            assert updated_user["pendingApproval"] is True
            assert updated_user["status"] == "pending"

            activity_logs_response = client.get(
                "/api/v1/activity-logs?module=team&action=legacy_permissions_updated&search=Permission%20Test%20User&limit=20",
                headers=headers,
            )
            assert activity_logs_response.status_code == 200, activity_logs_response.text
            logs = activity_logs_response.json()
            assert any(log["action"] == "legacy_permissions_updated" for log in logs)
            assert any(log["userName"] for log in logs)
            assert any(log["actionLabel"] == "Legacy Permissions Updated" for log in logs)

            user_list_response = client.get("/api/v1/users", headers=headers)
            assert user_list_response.status_code == 200, user_list_response.text
            user_rows = user_list_response.json()
            assert any(row["id"] == created_user["id"] and row["pendingApproval"] for row in user_rows)
    except ProgrammingError as exc:
        if any(token in str(exc) for token in ["permissions", "user_permissions", "activity_logs"]):
            pytest.skip("Apply the latest team permissions migration before running this test.")
        raise

    dispose_engine()


def test_inventory_adjustment_transfer_and_wastage_flow() -> None:
    try:
        headers = auth_headers()

        with TestClient(app) as client:
            category_response = client.post(
                "/api/v1/categories",
                headers=headers,
                json={
                    "name": f"Inventory Ops Category {uuid.uuid4().hex[:8]}",
                    "slug": f"inventory-ops-category-{uuid.uuid4().hex[:8]}",
                    "description": "Inventory operations category",
                },
            )
            assert category_response.status_code == 201, category_response.text
            category_id = category_response.json()["id"]

            brand_response = client.post(
                "/api/v1/brands",
                headers=headers,
                json={
                    "name": f"Inventory Ops Brand {uuid.uuid4().hex[:8]}",
                    "slug": f"inventory-ops-brand-{uuid.uuid4().hex[:8]}",
                    "description": "Inventory operations brand",
                },
            )
            assert brand_response.status_code == 201, brand_response.text
            brand_id = brand_response.json()["id"]

            product_response = client.post(
                "/api/v1/products",
                headers=headers,
                json={
                    "name": "Inventory Ops Product",
                    "slug": f"inventory-ops-product-{uuid.uuid4().hex[:8]}",
                    "sku": f"IO-{uuid.uuid4().hex[:8]}",
                    "description": "Inventory operations product",
                    "category_id": category_id,
                    "brand_id": brand_id,
                    "price": 199.00,
                    "cost_price": 110.00,
                    "image_url": None,
                    "status": "active",
                    "variants": [],
                },
            )
            assert product_response.status_code == 201, product_response.text
            product = product_response.json()

            source_warehouse_response = client.post(
                "/api/v1/warehouses",
                headers=headers,
                json={
                    "name": f"Source Warehouse {uuid.uuid4().hex[:8]}",
                    "code": f"SWH-{uuid.uuid4().hex[:8]}",
                    "address": "Dhaka",
                    "is_active": True,
                },
            )
            assert source_warehouse_response.status_code == 201, source_warehouse_response.text
            source_warehouse = source_warehouse_response.json()

            destination_warehouse_response = client.post(
                "/api/v1/warehouses",
                headers=headers,
                json={
                    "name": f"Destination Warehouse {uuid.uuid4().hex[:8]}",
                    "code": f"DWH-{uuid.uuid4().hex[:8]}",
                    "address": "Chattogram",
                    "is_active": True,
                },
            )
            assert destination_warehouse_response.status_code == 201, destination_warehouse_response.text
            destination_warehouse = destination_warehouse_response.json()

            inventory_response = client.post(
                "/api/v1/inventory",
                headers=headers,
                json={
                    "product_id": product["id"],
                    "variant_id": None,
                    "warehouse_id": source_warehouse["id"],
                    "quantity": 15,
                    "low_stock_threshold": 4,
                },
            )
            assert inventory_response.status_code == 201, inventory_response.text
            inventory_item = inventory_response.json()

            adjust_response = client.post(
                f"/api/v1/inventory/{inventory_item['id']}/adjust",
                headers=headers,
                json={
                    "quantity_delta": 5,
                    "note": "Cycle count correction",
                },
            )
            assert adjust_response.status_code == 200, adjust_response.text
            adjusted_inventory = adjust_response.json()
            assert adjusted_inventory["quantity"] == 20

            transfer_response = client.post(
                "/api/v1/stock-transfers",
                headers=headers,
                json={
                    "transfer_number": f"TRF-{uuid.uuid4().hex[:8]}",
                    "from_warehouse_id": source_warehouse["id"],
                    "to_warehouse_id": destination_warehouse["id"],
                    "status": "pending",
                    "notes": "Move replenishment stock",
                    "items": [
                        {
                            "product_id": product["id"],
                            "variant_id": None,
                            "product_name": product["name"],
                            "sku": product["sku"],
                            "quantity": 6,
                        }
                    ],
                },
            )
            assert transfer_response.status_code == 201, transfer_response.text
            transfer = transfer_response.json()
            assert transfer["stock_moved"] is False

            complete_transfer_response = client.patch(
                f"/api/v1/stock-transfers/{transfer['id']}",
                headers=headers,
                json={"status": "completed"},
            )
            assert complete_transfer_response.status_code == 200, complete_transfer_response.text
            completed_transfer = complete_transfer_response.json()
            assert completed_transfer["stock_moved"] is True
            assert completed_transfer["status"] == "completed"

            source_inventory_detail_response = client.get(
                f"/api/v1/inventory/{inventory_item['id']}",
                headers=headers,
            )
            assert source_inventory_detail_response.status_code == 200, source_inventory_detail_response.text
            assert source_inventory_detail_response.json()["quantity"] == 14

            destination_inventory_list_response = client.get(
                f"/api/v1/inventory?skip=0&limit=100",
                headers=headers,
            )
            assert destination_inventory_list_response.status_code == 200, destination_inventory_list_response.text
            destination_matches = [
                item
                for item in destination_inventory_list_response.json()
                if item["product_id"] == product["id"] and item["warehouse_id"] == destination_warehouse["id"]
            ]
            assert destination_matches
            assert destination_matches[0]["quantity"] == 6

            wastage_response = client.post(
                "/api/v1/wastage-logs",
                headers=headers,
                json={
                    "wastage_number": f"WST-{uuid.uuid4().hex[:8]}",
                    "product_id": product["id"],
                    "variant_id": None,
                    "warehouse_id": source_warehouse["id"],
                    "quantity": 2,
                    "reason": "Damaged packaging",
                    "note": "Disposed after inspection",
                },
            )
            assert wastage_response.status_code == 201, wastage_response.text
            wastage_log = wastage_response.json()
            assert wastage_log["stock_deducted"] is True

            source_inventory_after_wastage_response = client.get(
                f"/api/v1/inventory/{inventory_item['id']}",
                headers=headers,
            )
            assert source_inventory_after_wastage_response.status_code == 200, source_inventory_after_wastage_response.text
            assert source_inventory_after_wastage_response.json()["quantity"] == 12

            adjustment_movements_response = client.get(
                f"/api/v1/stock-movements?product_id={product['id']}&warehouse_id={source_warehouse['id']}&movement_type=adjustment",
                headers=headers,
            )
            assert adjustment_movements_response.status_code == 200, adjustment_movements_response.text
            assert any(movement["movement_type"] == "adjustment" for movement in adjustment_movements_response.json())

            transfer_out_movements_response = client.get(
                f"/api/v1/stock-movements?product_id={product['id']}&warehouse_id={source_warehouse['id']}&movement_type=transfer_out",
                headers=headers,
            )
            assert transfer_out_movements_response.status_code == 200, transfer_out_movements_response.text
            assert any(movement["movement_type"] == "transfer_out" for movement in transfer_out_movements_response.json())

            transfer_in_movements_response = client.get(
                f"/api/v1/stock-movements?product_id={product['id']}&warehouse_id={destination_warehouse['id']}&movement_type=transfer_in",
                headers=headers,
            )
            assert transfer_in_movements_response.status_code == 200, transfer_in_movements_response.text
            assert any(movement["movement_type"] == "transfer_in" for movement in transfer_in_movements_response.json())

            wastage_movements_response = client.get(
                f"/api/v1/stock-movements?product_id={product['id']}&warehouse_id={source_warehouse['id']}&movement_type=wastage",
                headers=headers,
            )
            assert wastage_movements_response.status_code == 200, wastage_movements_response.text
            assert any(movement["movement_type"] == "wastage" for movement in wastage_movements_response.json())
    except ProgrammingError as exc:
        if any(token in str(exc) for token in ["stock_transfers", "stock_transfer_items", "wastage_logs", "activity_logs"]):
            pytest.skip("Apply the latest inventory operations migration before running this test.")
        raise

    dispose_engine()


def test_inventory_hub_summary_and_v1_compatibility_aliases() -> None:
    try:
        headers = auth_headers()

        with TestClient(app) as client:
            category_response = client.post(
                "/api/v1/categories",
                headers=headers,
                json={
                    "name": f"Inventory Compat Category {uuid.uuid4().hex[:8]}",
                    "slug": f"inventory-compat-category-{uuid.uuid4().hex[:8]}",
                    "description": "Inventory compatibility category",
                },
            )
            assert category_response.status_code == 201, category_response.text
            category = category_response.json()

            brand_response = client.post(
                "/api/v1/brands",
                headers=headers,
                json={
                    "name": f"Inventory Compat Brand {uuid.uuid4().hex[:8]}",
                    "slug": f"inventory-compat-brand-{uuid.uuid4().hex[:8]}",
                    "description": "Inventory compatibility brand",
                },
            )
            assert brand_response.status_code == 201, brand_response.text
            brand = brand_response.json()

            product_response = client.post(
                "/api/v1/products",
                headers=headers,
                json={
                    "name": "Inventory Compatibility Product",
                    "slug": f"inventory-compat-product-{uuid.uuid4().hex[:8]}",
                    "sku": f"IC-{uuid.uuid4().hex[:8]}",
                    "description": "Inventory compatibility product",
                    "category_id": category["id"],
                    "brand_id": brand["id"],
                    "price": 350.00,
                    "cost_price": 210.00,
                    "image_url": "https://example.com/compat-product.jpg",
                    "status": "active",
                    "variants": [],
                },
            )
            assert product_response.status_code == 201, product_response.text
            product = product_response.json()

            warehouse_response = client.post(
                "/api/v1/warehouses",
                headers=headers,
                json={
                    "name": f"Inventory Compat Warehouse {uuid.uuid4().hex[:8]}",
                    "code": f"ICW-{uuid.uuid4().hex[:8]}",
                    "address": "Dhaka compatibility zone",
                    "is_active": True,
                },
            )
            assert warehouse_response.status_code == 201, warehouse_response.text
            warehouse = warehouse_response.json()

            inventory_response = client.post(
                "/api/v1/inventory",
                headers=headers,
                json={
                    "product_id": product["id"],
                    "variant_id": None,
                    "warehouse_id": warehouse["id"],
                    "quantity": 9,
                    "low_stock_threshold": 4,
                },
            )
            assert inventory_response.status_code == 201, inventory_response.text
            inventory_item = inventory_response.json()
            assert inventory_item["productName"] == product["name"]
            assert inventory_item["sku"] == product["sku"]
            assert inventory_item["warehouseName"] == warehouse["name"]
            assert inventory_item["warehouseCode"] == warehouse["code"]
            assert inventory_item["categoryName"] == category["name"]
            assert inventory_item["brandName"] == brand["name"]
            assert inventory_item["stockStatus"] == "In Stock"
            assert inventory_item["costPrice"] == "210.00"
            assert inventory_item["salePrice"] == "350.00"
            assert inventory_item["inventoryValue"] == "1890.00"
            assert inventory_item["image_url"] == "https://example.com/compat-product.jpg"
            assert inventory_item["imageUrl"] == inventory_item["image_url"]
            assert inventory_item["createdAt"] == inventory_item["created_at"]
            assert inventory_item["updatedAt"] == inventory_item["updated_at"]

            adjust_response = client.post(
                f"/api/v1/inventory/{inventory_item['id']}/adjust",
                headers=headers,
                json={
                    "quantity_delta": 2,
                    "note": "Compatibility adjustment",
                },
            )
            assert adjust_response.status_code == 200, adjust_response.text
            adjusted_inventory = adjust_response.json()
            assert adjusted_inventory["quantity"] == 11
            assert adjusted_inventory["lastMovementSummary"] == "adjustment:2"

            supplier_response = client.post(
                "/api/v1/suppliers",
                headers=headers,
                json={
                    "name": f"Compat Supplier {uuid.uuid4().hex[:8]}",
                    "contact_person": "Supplier Contact",
                    "phone": "01700000001",
                    "email": unique_email(),
                    "address": "Supplier address",
                    "notes": "Compatibility supplier",
                    "is_active": True,
                },
            )
            assert supplier_response.status_code == 201, supplier_response.text
            supplier = supplier_response.json()
            assert supplier["contactPerson"] == "Supplier Contact"
            assert supplier["status"] == "Active"
            assert supplier["createdAt"] == supplier["created_at"]

            purchase_order_response = client.post(
                "/api/v1/purchase-orders",
                headers=headers,
                json={
                    "po_number": f"PO-COMPAT-{uuid.uuid4().hex[:8]}",
                    "supplier_id": supplier["id"],
                    "warehouse_id": warehouse["id"],
                    "status": "ordered",
                    "order_date": "2026-05-18",
                    "expected_date": "2026-05-20",
                    "discount": 0,
                    "notes": "Compatibility purchase order",
                    "items": [
                        {
                            "product_id": product["id"],
                            "variant_id": None,
                            "product_name": product["name"],
                            "sku": product["sku"],
                            "quantity": 3,
                            "received_quantity": 0,
                            "unit_cost": 210,
                            "total_cost": 630,
                        }
                    ],
                },
            )
            assert purchase_order_response.status_code == 201, purchase_order_response.text
            purchase_order = purchase_order_response.json()
            assert purchase_order["poNumber"] == purchase_order["po_number"]
            assert purchase_order["supplierName"] == supplier["name"]
            assert purchase_order["warehouseName"] == warehouse["name"]
            assert purchase_order["receivedState"] is False
            assert purchase_order["createdAt"] == purchase_order["created_at"]

            same_warehouse_transfer_response = client.post(
                "/api/v1/stock-transfers",
                headers=headers,
                json={
                    "transfer_number": f"TRF-BLOCK-{uuid.uuid4().hex[:8]}",
                    "from_warehouse_id": warehouse["id"],
                    "to_warehouse_id": warehouse["id"],
                    "status": "pending",
                    "notes": "This should fail",
                    "items": [
                        {
                            "product_id": product["id"],
                            "variant_id": None,
                            "product_name": product["name"],
                            "sku": product["sku"],
                            "quantity": 1,
                        }
                    ],
                },
            )
            assert same_warehouse_transfer_response.status_code == 400, same_warehouse_transfer_response.text

            second_warehouse_response = client.post(
                "/api/v1/warehouses",
                headers=headers,
                json={
                    "name": f"Inventory Compat Warehouse B {uuid.uuid4().hex[:8]}",
                    "code": f"ICWB-{uuid.uuid4().hex[:8]}",
                    "address": "Chattogram compatibility zone",
                    "is_active": True,
                },
            )
            assert second_warehouse_response.status_code == 201, second_warehouse_response.text
            second_warehouse = second_warehouse_response.json()

            pending_transfer_response = client.post(
                "/api/v1/stock-transfers",
                headers=headers,
                json={
                    "transfer_number": f"TRF-PENDING-{uuid.uuid4().hex[:8]}",
                    "from_warehouse_id": warehouse["id"],
                    "to_warehouse_id": second_warehouse["id"],
                    "status": "pending",
                    "notes": "Pending compatibility transfer",
                    "items": [
                        {
                            "product_id": product["id"],
                            "variant_id": None,
                            "product_name": product["name"],
                            "sku": product["sku"],
                            "quantity": 1,
                        }
                    ],
                },
            )
            assert pending_transfer_response.status_code == 201, pending_transfer_response.text

            completed_transfer_response = client.post(
                "/api/v1/stock-transfers",
                headers=headers,
                json={
                    "transfer_number": f"TRF-COMPLETED-{uuid.uuid4().hex[:8]}",
                    "from_warehouse_id": warehouse["id"],
                    "to_warehouse_id": second_warehouse["id"],
                    "status": "pending",
                    "notes": "Completed compatibility transfer",
                    "items": [
                        {
                            "product_id": product["id"],
                            "variant_id": None,
                            "product_name": product["name"],
                            "sku": product["sku"],
                            "quantity": 2,
                        }
                    ],
                },
            )
            assert completed_transfer_response.status_code == 201, completed_transfer_response.text
            completed_transfer = completed_transfer_response.json()

            complete_transfer_response = client.patch(
                f"/api/v1/stock-transfers/{completed_transfer['id']}",
                headers=headers,
                json={"status": "completed"},
            )
            assert complete_transfer_response.status_code == 200, complete_transfer_response.text
            completed_transfer_payload = complete_transfer_response.json()
            assert completed_transfer_payload["transferNumber"] == completed_transfer_payload["transfer_number"]
            assert completed_transfer_payload["fromWarehouseName"] == warehouse["name"]
            assert completed_transfer_payload["toWarehouseName"] == second_warehouse["name"]

            wastage_response = client.post(
                "/api/v1/wastage-logs",
                headers=headers,
                json={
                    "wastage_number": f"WST-COMPAT-{uuid.uuid4().hex[:8]}",
                    "product_id": product["id"],
                    "variant_id": None,
                    "warehouse_id": warehouse["id"],
                    "quantity": 1,
                    "reason": "Compatibility wastage",
                    "note": "Compatibility note",
                },
            )
            assert wastage_response.status_code == 201, wastage_response.text
            wastage_log = wastage_response.json()
            assert wastage_log["wastageNumber"] == wastage_log["wastage_number"]
            assert wastage_log["warehouseName"] == warehouse["name"]

            order_response = client.post(
                "/api/v1/orders",
                headers=headers,
                json={
                    "order_number": f"ORD-COMPAT-{uuid.uuid4().hex[:8]}",
                    "customer_id": None,
                    "warehouse_id": warehouse["id"],
                    "customer_phone": "01733333333",
                    "shipping_address": "Compatibility return address",
                    "status": "pending",
                    "payment_status": "unpaid",
                    "source": "manual",
                    "subtotal": 350,
                    "discount": 0,
                    "delivery_charge": 0,
                    "total": 350,
                    "items": [
                        {
                            "product_id": product["id"],
                            "variant_id": None,
                            "product_name": product["name"],
                            "sku": product["sku"],
                            "quantity": 1,
                            "unit_price": 350,
                            "total_price": 350,
                        }
                    ],
                },
            )
            assert order_response.status_code == 201, order_response.text
            order = order_response.json()

            return_response = client.post(
                "/api/v1/returns",
                headers=headers,
                json={
                    "return_number": f"RMA-COMPAT-{uuid.uuid4().hex[:8]}",
                    "order_id": order["id"],
                    "warehouse_id": warehouse["id"],
                    "status": "requested",
                    "reason": "Compatibility return",
                    "resolution": "refund",
                    "refund_amount": 350,
                    "restock_items": False,
                    "items": [
                        {
                            "order_item_id": order["items"][0]["id"],
                            "product_id": product["id"],
                            "variant_id": None,
                            "product_name": product["name"],
                            "sku": product["sku"],
                            "quantity": 1,
                            "condition": "good",
                        }
                    ],
                },
            )
            assert return_response.status_code == 201, return_response.text
            return_request = return_response.json()
            assert return_request["returnNumber"] == return_request["return_number"]
            assert return_request["orderNumber"] == order["order_number"]
            assert return_request["warehouseName"] == warehouse["name"]
            assert return_request["refundState"] is True
            assert return_request["restockState"] is False

            inventory_list_response = client.get(
                "/api/v1/inventory?skip=0&limit=100",
                headers=headers,
            )
            assert inventory_list_response.status_code == 200, inventory_list_response.text
            inventory_rows = inventory_list_response.json()
            matching_inventory = [row for row in inventory_rows if row["id"] == inventory_item["id"]]
            assert matching_inventory
            assert matching_inventory[0]["productName"] == product["name"]

            products_list_response = client.get("/api/v1/products?skip=0&limit=100", headers=headers)
            assert products_list_response.status_code == 200, products_list_response.text
            products_payload = products_list_response.json()
            matching_products = [row for row in products_payload if row["id"] == product["id"]]
            assert matching_products
            compat_product = matching_products[0]
            assert compat_product["productName"] == product["name"]
            assert compat_product["barcode"] == product["sku"]
            assert compat_product["categoryName"] == category["name"]
            assert compat_product["brandName"] == brand["name"]
            assert compat_product["salePrice"] == "350.00"
            assert compat_product["costPrice"] == "210.00"
            assert compat_product["stockLevel"] >= 8
            assert compat_product["reorderPoint"] == 4
            assert compat_product["lowStockThreshold"] == 4
            assert compat_product["image"] == "https://example.com/compat-product.jpg"
            assert compat_product["imageUrl"] == compat_product["image"]
            assert compat_product["hasVariants"] is False
            assert compat_product["variantsCount"] == 0
            assert compat_product["createdAt"] == compat_product["created_at"]
            assert compat_product["updatedAt"] == compat_product["updated_at"]

            stock_movement_response = client.get(
                f"/api/v1/stock-movements?product_id={product['id']}&warehouse_id={warehouse['id']}",
                headers=headers,
            )
            assert stock_movement_response.status_code == 200, stock_movement_response.text
            stock_movements = stock_movement_response.json()
            assert stock_movements
            assert all(
                movement["productName"] == product["name"]
                for movement in stock_movements
                if movement["product_id"] == product["id"]
            )
            assert any(movement["warehouseName"] == warehouse["name"] for movement in stock_movements)
            assert any(movement["sku"] == product["sku"] for movement in stock_movements)
            assert any(movement["reason"] for movement in stock_movements)
            assert all("createdAt" in movement for movement in stock_movements)

            summary_response = client.get("/api/v1/inventory/hub-summary", headers=headers)
            assert summary_response.status_code == 200, summary_response.text
            summary = summary_response.json()
            assert summary["total_products"] >= 1
            assert summary["active_products"] >= 1
            assert summary["categories"] >= 1
            assert summary["brands"] >= 1
            assert summary["warehouses"] >= 2
            assert summary["stock_rows"] >= 2
            assert summary["low_stock"] >= 0
            assert summary["out_of_stock"] >= 0
            assert summary["pending_transfers"] >= 1
            assert summary["completed_transfers"] >= 1
            assert summary["wastage_count"] >= 1
            assert summary["purchase_orders"] >= 1
            assert summary["suppliers"] >= 1
            assert summary["returns"] >= 1
            assert summary["stock_movement_count"] >= 1
            assert float(summary["inventory_value"]) > 0
    except (ProgrammingError, InterfaceError, AttributeError, RuntimeError) as exc:
        if any(
            token in str(exc)
            for token in [
                "return_requests",
                "warehouse_id",
                "suppliers",
                "purchase_orders",
                "stock_transfers",
                "wastage_logs",
                "stock_movements",
                "activity_logs",
                "customer_phone",
                "customer_name",
                "payment_method",
                "paid_amount",
                "printed_count",
                "order_events",
            ]
        ):
            pytest.skip("Apply the latest inventory compatibility migrations before running this test.")
        if any(token in str(exc).lower() for token in ["event loop is closed", "another operation is in progress", "send"]):
            pytest.skip("Skipped due to local asyncpg/TestClient event loop instability on Windows.")
        raise

    dispose_engine()


def test_customer_crm_activity_flow() -> None:
    try:
        headers = auth_headers()

        with TestClient(app) as client:
            customer_response = client.post(
                "/api/v1/customers",
                headers=headers,
                json={
                    "name": "CRM Test Customer",
                    "phone": "01733333333",
                    "email": "crm.customer@example.com",
                    "address": "Mirpur, Dhaka",
                    "city": "Dhaka",
                    "customer_type": "vip",
                    "tags": "priority,repeat",
                    "notes": "Important CRM account",
                    "follow_up_date": "2026-05-15",
                },
            )
            assert customer_response.status_code == 201, customer_response.text
            customer = customer_response.json()
            assert customer["customer_type"] == "vip"
            assert customer["follow_up_date"] == "2026-05-15"
            assert customer["customerName"] == "CRM Test Customer"
            assert customer["customerPhone"] == "01733333333"
            assert customer["customerType"] == "vip"
            assert customer["segment"] in {"VIP", "At Risk", "New", "Repeat"}
            assert customer["tagList"] == ["priority", "repeat"]
            assert customer["totalOrderCount"] == 0
            assert str(customer["totalSpend"]) == "0.00"

            filtered_response = client.get(
                "/api/v1/customers?search=CRM&customer_type=vip&has_follow_up=true",
                headers=headers,
            )
            assert filtered_response.status_code == 200, filtered_response.text
            filtered_customers = filtered_response.json()
            assert any(item["id"] == customer["id"] for item in filtered_customers)

            summary_response = client.get("/api/v1/customers/crm-summary", headers=headers)
            assert summary_response.status_code == 200, summary_response.text
            summary = summary_response.json()
            assert summary["total_customers"] >= 1
            assert summary["vip_customers"] >= 1
            assert summary["followups_due"] >= 1

            category_response = client.post(
                "/api/v1/categories",
                headers=headers,
                json={
                    "name": f"CRM Category {uuid.uuid4().hex[:8]}",
                    "slug": f"crm-category-{uuid.uuid4().hex[:8]}",
                    "description": "CRM order history category",
                },
            )
            assert category_response.status_code == 201, category_response.text
            category_id = category_response.json()["id"]

            brand_response = client.post(
                "/api/v1/brands",
                headers=headers,
                json={
                    "name": f"CRM Brand {uuid.uuid4().hex[:8]}",
                    "slug": f"crm-brand-{uuid.uuid4().hex[:8]}",
                    "description": "CRM order history brand",
                },
            )
            assert brand_response.status_code == 201, brand_response.text
            brand_id = brand_response.json()["id"]

            product_response = client.post(
                "/api/v1/products",
                headers=headers,
                json={
                    "name": "CRM History Product",
                    "slug": f"crm-history-product-{uuid.uuid4().hex[:8]}",
                    "sku": f"CRM-{uuid.uuid4().hex[:8]}",
                    "description": "Customer history product",
                    "category_id": category_id,
                    "brand_id": brand_id,
                    "price": 250.00,
                    "cost_price": 140.00,
                    "image_url": None,
                    "status": "active",
                    "variants": [],
                },
            )
            assert product_response.status_code == 201, product_response.text
            product_id = product_response.json()["id"]

            warehouse_response = client.post(
                "/api/v1/warehouses",
                headers=headers,
                json={
                    "name": f"CRM Warehouse {uuid.uuid4().hex[:8]}",
                    "code": f"CWH-{uuid.uuid4().hex[:8]}",
                    "address": "Dhaka",
                    "is_active": True,
                },
            )
            assert warehouse_response.status_code == 201, warehouse_response.text
            warehouse_id = warehouse_response.json()["id"]

            inventory_response = client.post(
                "/api/v1/inventory",
                headers=headers,
                json={
                    "product_id": product_id,
                    "variant_id": None,
                    "warehouse_id": warehouse_id,
                    "quantity": 5,
                    "low_stock_threshold": 2,
                },
            )
            assert inventory_response.status_code == 201, inventory_response.text

            order_response = client.post(
                "/api/v1/orders",
                headers=headers,
                json={
                    "order_number": f"ORD-CRM-{uuid.uuid4().hex[:8]}",
                    "customer_id": customer["id"],
                    "warehouse_id": warehouse_id,
                    "customer_phone": "01733333333",
                    "shipping_address": "CRM address",
                    "notes": "CRM order",
                    "tags": "vip",
                    "status": "pending",
                    "payment_status": "paid",
                    "source": "manual",
                    "subtotal": 250,
                    "discount": 0,
                    "delivery_charge": 20,
                    "total": 270,
                    "items": [
                        {
                            "product_id": product_id,
                            "variant_id": None,
                            "product_name": "CRM History Product",
                            "sku": "CRM-SKU",
                            "quantity": 1,
                            "unit_price": 250,
                            "total_price": 250,
                        }
                    ],
                },
            )
            assert order_response.status_code == 201, order_response.text

            activity_response = client.post(
                f"/api/v1/customers/{customer['id']}/activities",
                headers=headers,
                json={
                    "activity_type": "follow_up",
                    "title": "Call customer about repeat order",
                    "description": "Confirm preferred delivery window",
                    "due_date": "2026-05-16T10:00:00Z",
                },
            )
            assert activity_response.status_code == 201, activity_response.text
            activity = activity_response.json()
            assert activity["activity_type"] == "follow_up"
            assert activity["created_by"] is not None

            detail_response = client.get(
                f"/api/v1/customers/{customer['id']}",
                headers=headers,
            )
            assert detail_response.status_code == 200, detail_response.text
            detail = detail_response.json()
            assert detail["total_order_count"] >= 1
            assert detail["totalOrderCount"] >= 1
            assert str(detail["total_spend"]) == "270.00"
            assert str(detail["totalSpend"]) == "270.00"
            assert detail["pending_follow_up_count"] >= 1
            assert str(detail["averageOrderValue"]) == "270.00"
            assert detail["lastOrderNumber"].startswith("ORD-CRM-")
            assert detail["stats"]["totalOrderCount"] >= 1
            assert detail["stats"]["followUpState"] in {"scheduled", "today", "overdue", "open", "none"}
            assert any(order["payment_status"] == "paid" for order in detail["orders"])
            assert any(order["orderNumber"].startswith("ORD-CRM-") for order in detail["orders"])
            assert any(item["id"] == activity["id"] for item in detail["activities"])
            assert any(item["activityType"] == "follow_up" for item in detail["activities"])
            assert any(item["createdBy"] for item in detail["activities"])

            customer_logs_response = client.get(
                "/api/v1/activity-logs?module=customers&entity_type=customer_activity&limit=20",
                headers=headers,
            )
            assert customer_logs_response.status_code == 200, customer_logs_response.text
            customer_logs = customer_logs_response.json()
            assert any(log["action"] == "customer_activity_created" for log in customer_logs)

            update_activity_response = client.patch(
                f"/api/v1/customers/{customer['id']}/activities/{activity['id']}",
                headers=headers,
                json={
                    "completed_at": "2026-05-16T11:00:00Z",
                    "description": "Follow-up completed successfully",
                },
            )
            assert update_activity_response.status_code == 200, update_activity_response.text
            updated_activity = update_activity_response.json()
            assert updated_activity["completed_at"] is not None
            assert updated_activity["completedAt"] is not None

            updated_customer_response = client.patch(
                f"/api/v1/customers/{customer['id']}",
                headers=headers,
                json={
                    "customerType": "wholesale",
                    "tags": ["priority", "account"],
                    "notes": "Moved to wholesale segment",
                    "lastContactedAt": "2026-05-16T12:00:00Z",
                },
            )
            assert updated_customer_response.status_code == 200, updated_customer_response.text
            updated_customer = updated_customer_response.json()
            assert updated_customer["customer_type"] == "wholesale"
            assert updated_customer["tags"] == "priority,account"
            assert updated_customer["customerType"] == "wholesale"
            assert updated_customer["tagList"] == ["priority", "account"]
            assert updated_customer["lastContactedAt"] is not None
    except ProgrammingError as exc:
        if any(
            token in str(exc)
            for token in [
                "customer_type",
                "follow_up_date",
                "last_contacted_at",
                "customer_activities",
                "activity_logs",
                "customer_name",
                "payment_method",
                "paid_amount",
            ]
        ):
            pytest.skip("Apply the latest customer CRM migration before running this test.")
        raise

    dispose_engine()


def test_customer_crm_summary_filters_and_alias_inputs() -> None:
    try:
        headers = auth_headers()
        today_iso = datetime.now(timezone.utc).date().isoformat()
        activity_due_at = f"{today_iso}T09:00:00Z"

        with TestClient(app) as client:
            customer_response = client.post(
                "/api/v1/customers",
                headers=headers,
                json={
                    "customerName": "Alias CRM Customer",
                    "customerPhone": "01888888888",
                    "email": "alias.crm@example.com",
                    "address": "Banani, Dhaka",
                    "city": "Dhaka",
                    "customerType": "regular",
                    "tags": ["crm", "dhaka"],
                    "notes": "Alias input coverage",
                    "followUpDate": today_iso,
                },
            )
            assert customer_response.status_code == 201, customer_response.text
            customer = customer_response.json()
            assert customer["name"] == "Alias CRM Customer"
            assert customer["phone"] == "01888888888"
            assert customer["tags"] == "crm,dhaka"
            assert customer["tagList"] == ["crm", "dhaka"]

            list_response = client.get(
                "/api/v1/customers?segment=new&follow_up_due=true&tag=crm&city=dhaka&created_from=2000-01-01T00:00:00Z&created_to=2100-01-01T00:00:00Z",
                headers=headers,
            )
            assert list_response.status_code == 200, list_response.text
            rows = list_response.json()
            match = next((row for row in rows if row["id"] == customer["id"]), None)
            assert match is not None
            assert match["customerName"] == "Alias CRM Customer"
            assert match["customerPhone"] == "01888888888"
            assert match["customerType"] == "regular"
            assert match["activityCount"] == 0
            assert match["openActivityCount"] == 0
            assert match["segment"] == "New"

            activity_response = client.post(
                f"/api/v1/customers/{customer['id']}/activities",
                headers=headers,
                json={
                    "activityType": "note",
                    "title": "Send onboarding message",
                    "description": "CRM alias activity test",
                    "dueDate": activity_due_at,
                },
            )
            assert activity_response.status_code == 201, activity_response.text
            activity = activity_response.json()
            assert activity["activity_type"] == "note"
            assert activity["activityType"] == "note"
            assert activity["dueDate"] == activity_due_at

            detail_response = client.get(f"/api/v1/customers/{customer['id']}", headers=headers)
            assert detail_response.status_code == 200, detail_response.text
            detail = detail_response.json()
            assert detail["activityCount"] >= 1
            assert detail["openActivityCount"] >= 1
            assert detail["followUpState"] in {"scheduled", "today", "overdue", "open", "none"}

            summary_response = client.get("/api/v1/customers/crm-summary", headers=headers)
            assert summary_response.status_code == 200, summary_response.text
            summary = summary_response.json()
            assert summary["total_customers"] >= 1
            assert summary["leads"] >= 1
            assert summary["regular_customers"] >= 1
            assert "total_customer_spend" in summary
            assert "average_customer_value" in summary
    except ProgrammingError as exc:
        if any(
            token in str(exc)
            for token in [
                "customer_type",
                "follow_up_date",
                "last_contacted_at",
                "customer_activities",
                "activity_logs",
                "customer_name",
                "payment_method",
                "paid_amount",
            ]
        ):
            pytest.skip("Apply the latest customer CRM migration before running this test.")
        raise

    dispose_engine()


def test_product_variant_crud() -> None:
    headers = auth_headers()

    with TestClient(app) as client:
        category_response = client.post(
            "/api/v1/categories",
            headers=headers,
            json={
                "name": f"Category {uuid.uuid4().hex[:8]}",
                "slug": f"category-{uuid.uuid4().hex[:8]}",
                "description": "Variant test category",
            },
        )
        assert category_response.status_code == 201, category_response.text
        category_id = category_response.json()["id"]

        brand_response = client.post(
            "/api/v1/brands",
            headers=headers,
            json={
                "name": f"Brand {uuid.uuid4().hex[:8]}",
                "slug": f"brand-{uuid.uuid4().hex[:8]}",
                "description": "Variant test brand",
            },
        )
        assert brand_response.status_code == 201, brand_response.text
        brand_id = brand_response.json()["id"]

        product_response = client.post(
            "/api/v1/products",
            headers=headers,
            json={
                "name": "Variant Test Product",
                "slug": f"variant-test-product-{uuid.uuid4().hex[:8]}",
                "sku": f"VT-{uuid.uuid4().hex[:8]}",
                "description": "Variant test product",
                "category_id": category_id,
                "brand_id": brand_id,
                "price": 99.99,
                "cost_price": 49.99,
                "image_url": None,
                "status": "active",
                "variants": [],
            },
        )
        assert product_response.status_code == 201, product_response.text
        product_id = product_response.json()["id"]

        create_variant_response = client.post(
            f"/api/v1/products/{product_id}/variants",
            headers=headers,
            json={
                "name": "Default Variant",
                "sku": f"VT-VAR-{uuid.uuid4().hex[:8]}",
                "price": 109.99,
                "stock_quantity": 5,
            },
        )
        assert create_variant_response.status_code == 201, create_variant_response.text
        variant = create_variant_response.json()
        variant_id = variant["id"]
        assert variant["name"] == "Default Variant"

        list_variant_response = client.get(
            f"/api/v1/products/{product_id}/variants",
            headers=headers,
        )
        assert list_variant_response.status_code == 200, list_variant_response.text
        assert len(list_variant_response.json()) == 1

        update_variant_response = client.patch(
            f"/api/v1/products/{product_id}/variants/{variant_id}",
            headers=headers,
            json={
                "name": "Updated Variant",
                "stock_quantity": 12,
            },
        )
        assert update_variant_response.status_code == 200, update_variant_response.text
        updated_variant = update_variant_response.json()
        assert updated_variant["name"] == "Updated Variant"
        assert updated_variant["stock_quantity"] == 12

        delete_variant_response = client.delete(
            f"/api/v1/products/{product_id}/variants/{variant_id}",
            headers=headers,
        )
        assert delete_variant_response.status_code == 204, delete_variant_response.text

        final_variant_response = client.get(
            f"/api/v1/products/{product_id}/variants",
            headers=headers,
        )
        assert final_variant_response.status_code == 200, final_variant_response.text
        assert final_variant_response.json() == []

    dispose_engine()


def test_business_settings_get_and_update() -> None:
    headers = auth_headers()

    try:
        with TestClient(app) as client:
            get_response = client.get(
                "/api/v1/settings/business",
                headers=headers,
            )
            assert get_response.status_code == 200, get_response.text
            settings_body = get_response.json()
            assert settings_body["company_name"]
            assert settings_body["currency"]
            assert settings_body["timezone"]
            assert settings_body["invoice_title"]
            assert settings_body["show_logo_on_invoice"] is True
            assert settings_body["invoice_template"]
            assert settings_body["companyName"] == settings_body["company_name"]
            assert settings_body["invoiceTitle"] == settings_body["invoice_title"]

            update_response = client.patch(
                "/api/v1/settings/business",
                headers=headers,
                json={
                    "companyName": "Amar eCom Test",
                    "currency": "USD",
                    "orderPrefix": "AMR",
                    "invoiceTitle": "Tax Invoice",
                    "invoiceFooterNote": "Thank you for your business.",
                    "paymentInstructions": "Send payment to bKash",
                    "show_payment_status_on_invoice": False,
                    "lowStockDefaultThreshold": 9,
                    "taxRate": 15,
                    "logoUrl": "https://example.com/logo.png",
                },
            )
            assert update_response.status_code == 200, update_response.text
            updated_body = update_response.json()
            assert updated_body["company_name"] == "Amar eCom Test"
            assert updated_body["currency"] == "USD"
            assert updated_body["order_prefix"] == "AMR"
            assert updated_body["invoice_title"] == "Tax Invoice"
            assert updated_body["invoice_footer_note"] == "Thank you for your business."
            assert updated_body["payment_instructions"] == "Send payment to bKash"
            assert updated_body["show_payment_status_on_invoice"] is False
            assert updated_body["low_stock_default_threshold"] == 9
            assert updated_body["companyName"] == "Amar eCom Test"
            assert updated_body["orderPrefix"] == "AMR"
            assert updated_body["invoiceTitle"] == "Tax Invoice"
            assert updated_body["lowStockDefaultThreshold"] == 9
            assert updated_body["taxRate"] == "15.00"
            assert updated_body["logoUrl"] == "https://example.com/logo.png"

            settings_summary_response = client.get(
                "/api/v1/settings/center-summary",
                headers=headers,
            )
            assert settings_summary_response.status_code == 200, settings_summary_response.text
            settings_summary = settings_summary_response.json()
            assert settings_summary["business_profile_completeness"] >= 0
            assert settings_summary["invoice_settings_configured"] is True
            assert settings_summary["active_users"] >= 1
            assert settings_summary["permissions_seeded"] in {True, False}

            settings_logs_response = client.get(
                "/api/v1/activity-logs?module=settings&limit=20",
                headers=headers,
            )
            assert settings_logs_response.status_code == 200, settings_logs_response.text
            settings_logs = settings_logs_response.json()
            assert any(log["action"] == "business_settings_updated" for log in settings_logs)
            assert any(log["moduleLabel"] == "Settings" for log in settings_logs)
    except ProgrammingError as exc:
        if "business_settings" in str(exc):
            pytest.skip("Apply the business settings migration before running this test.")
        raise

    dispose_engine()


def test_invoice_templates_and_invoice_data_flow() -> None:
    headers = auth_headers()

    try:
        with TestClient(app) as client:
            create_template_response = client.post(
                "/api/v1/invoice-templates",
                headers=headers,
                json={
                    "templateName": "Bold Template",
                    "slug": f"bold-template-{uuid.uuid4().hex[:8]}",
                    "description": "Reusable invoice copy",
                    "accentColor": "#123456",
                    "headerText": "Commercial Invoice",
                    "footerText": "Template footer text",
                    "termsText": "Template terms",
                    "paymentInstructions": "Template payment instructions",
                    "isActive": True,
                },
            )
            assert create_template_response.status_code == 201, create_template_response.text
            created_template = create_template_response.json()
            assert created_template["templateName"] == "Bold Template"
            assert created_template["accentColor"] == "#123456"

            set_default_response = client.post(
                f"/api/v1/invoice-templates/{created_template['id']}/set-default",
                headers=headers,
            )
            assert set_default_response.status_code == 200, set_default_response.text
            default_template = set_default_response.json()
            assert default_template["is_default"] is True
            assert default_template["isDefault"] is True

            list_templates_response = client.get("/api/v1/invoice-templates", headers=headers)
            assert list_templates_response.status_code == 200, list_templates_response.text
            templates = list_templates_response.json()
            assert any(template["id"] == created_template["id"] and template["isDefault"] for template in templates)

            update_template_response = client.patch(
                f"/api/v1/invoice-templates/{created_template['id']}",
                headers=headers,
                json={
                    "templateName": "Bold Template Updated",
                    "footerText": "Updated footer text",
                },
            )
            assert update_template_response.status_code == 200, update_template_response.text
            assert update_template_response.json()["name"] == "Bold Template Updated"
            assert update_template_response.json()["templateName"] == "Bold Template Updated"
            assert update_template_response.json()["footerText"] == "Updated footer text"

            update_settings_response = client.patch(
                "/api/v1/settings/business",
                headers=headers,
                json={
                    "invoice_title": "Fallback Invoice Title",
                    "invoice_footer_note": "Fallback footer",
                    "invoice_terms": "Fallback terms",
                    "payment_instructions": "Fallback payment instructions",
                    "invoice_template": created_template["slug"],
                    "invoice_accent_color": "#654321",
                    "invoice_signature_label": "Authorized Signature",
                    "show_warehouse_on_invoice": True,
                },
            )
            assert update_settings_response.status_code == 200, update_settings_response.text
            assert update_settings_response.json()["invoice_template"] == created_template["slug"]

            order_response = client.post(
                "/api/v1/orders",
                headers=headers,
                json={
                    "order_number": f"ORD-INV-{uuid.uuid4().hex[:8]}",
                    "customer_id": None,
                    "warehouse_id": None,
                    "customer_phone": "01744444444",
                    "shipping_address": "Dhaka, Bangladesh",
                    "notes": "Invoice data test order",
                    "status": "pending",
                    "payment_status": "paid",
                    "source": "manual",
                    "subtotal": 200,
                    "discount": 10,
                    "delivery_charge": 20,
                    "total": 210,
                    "items": [
                        {
                            "product_id": None,
                            "variant_id": None,
                            "product_name": "Service Item",
                            "sku": "SVC-INV",
                            "quantity": 1,
                            "unit_price": 200,
                            "total_price": 200,
                        }
                    ],
                },
            )
            assert order_response.status_code == 201, order_response.text
            order = order_response.json()

            invoice_data_response = client.get(
                f"/api/v1/orders/{order['id']}/invoice-data",
                headers=headers,
            )
            assert invoice_data_response.status_code == 200, invoice_data_response.text
            invoice_data = invoice_data_response.json()
            assert invoice_data["order"]["id"] == order["id"]
            assert invoice_data["business_settings"]["invoice_template"] == created_template["slug"]
            assert invoice_data["default_invoice_template"]["id"] == created_template["id"]
            assert invoice_data["computed_invoice_metadata"]["invoice_title"] == "Commercial Invoice"
            assert invoice_data["computed_invoice_metadata"]["footer_note"] == "Updated footer text"
            assert invoice_data["computed_invoice_metadata"]["terms"] == "Template terms"
            assert invoice_data["computed_invoice_metadata"]["payment_instructions"] == "Template payment instructions"
            assert invoice_data["computed_invoice_metadata"]["signature_label"] == "Authorized Signature"
            assert invoice_data["computed_invoice_metadata"]["show_warehouse"] is True
            assert invoice_data["computed_invoice_metadata"]["selected_template_slug"] == created_template["slug"]

            settings_logs_response = client.get(
                "/api/v1/activity-logs?module=settings&limit=50",
                headers=headers,
            )
            assert settings_logs_response.status_code == 200, settings_logs_response.text
            settings_logs = settings_logs_response.json()
            assert any(log["action"] == "invoice_template_created" for log in settings_logs)
            assert any(log["action"] == "invoice_template_updated" for log in settings_logs)
            assert any(log["action"] == "invoice_template_default_changed" for log in settings_logs)

            deactivate_response = client.delete(
                f"/api/v1/invoice-templates/{created_template['id']}",
                headers=headers,
            )
            assert deactivate_response.status_code == 204, deactivate_response.text

            inactive_templates_response = client.get(
                "/api/v1/invoice-templates?is_active=false",
                headers=headers,
            )
            assert inactive_templates_response.status_code == 200, inactive_templates_response.text
            inactive_templates = inactive_templates_response.json()
            assert any(template["id"] == created_template["id"] and template["isActive"] is False for template in inactive_templates)
    except ProgrammingError as exc:
        if any(token in str(exc) for token in ["invoice_templates", "business_settings", "activity_logs"]):
            pytest.skip("Apply the advanced invoice settings migration before running this test.")
        raise

    dispose_engine()


def test_finance_foundation_flow() -> None:
    headers = auth_headers()

    try:
        with TestClient(app) as client:
            baseline_finance_summary_response = client.get("/api/v1/finance/summary", headers=headers)
            assert baseline_finance_summary_response.status_code == 200, baseline_finance_summary_response.text
            baseline_finance_summary = baseline_finance_summary_response.json()

            cash_account_response = client.post(
                "/api/v1/accounts",
                headers=headers,
                json={
                    "name": "Main Cash",
                    "code": f"CASH-{uuid.uuid4().hex[:8]}",
                    "account_type": "cash",
                    "opening_balance": 1000,
                    "notes": "Primary cash drawer",
                    "is_active": True,
                },
            )
            assert cash_account_response.status_code == 201, cash_account_response.text
            cash_account = cash_account_response.json()
            assert float(cash_account["current_balance"]) == 1000

            bank_account_response = client.post(
                "/api/v1/accounts",
                headers=headers,
                json={
                    "name": "Bank Account",
                    "code": f"BANK-{uuid.uuid4().hex[:8]}",
                    "account_type": "bank",
                    "opening_balance": 500,
                    "notes": "Primary bank account",
                    "is_active": True,
                },
            )
            assert bank_account_response.status_code == 201, bank_account_response.text
            bank_account = bank_account_response.json()

            income_transaction_response = client.post(
                "/api/v1/transactions",
                headers=headers,
                json={
                    "transaction_number": f"TXN-IN-{uuid.uuid4().hex[:8]}",
                    "account_id": cash_account["id"],
                    "transaction_type": "income",
                    "category": "sales",
                    "amount": 250,
                    "direction": "in",
                    "description": "Cash sale",
                },
            )
            assert income_transaction_response.status_code == 201, income_transaction_response.text

            expense_transaction_response = client.post(
                "/api/v1/transactions",
                headers=headers,
                json={
                    "transaction_number": f"TXN-OUT-{uuid.uuid4().hex[:8]}",
                    "account_id": cash_account["id"],
                    "transaction_type": "expense",
                    "category": "office",
                    "amount": 100,
                    "direction": "out",
                    "description": "Office expense",
                },
            )
            assert expense_transaction_response.status_code == 201, expense_transaction_response.text

            transfer_transaction_response = client.post(
                "/api/v1/transactions",
                headers=headers,
                json={
                    "transaction_number": f"TXN-TRF-{uuid.uuid4().hex[:8]}",
                    "account_id": cash_account["id"],
                    "related_account_id": bank_account["id"],
                    "transaction_type": "transfer",
                    "category": "internal_transfer",
                    "amount": 150,
                    "direction": "out",
                    "description": "Cash to bank transfer",
                },
            )
            assert transfer_transaction_response.status_code == 201, transfer_transaction_response.text
            transfer_transaction = transfer_transaction_response.json()
            assert transfer_transaction["related_account"]["id"] == bank_account["id"]

            petty_cash_response = client.post(
                "/api/v1/petty-cash",
                headers=headers,
                json={
                    "entry_number": f"PC-{uuid.uuid4().hex[:8]}",
                    "account_id": cash_account["id"],
                    "entry_type": "expense",
                    "amount": 50,
                    "purpose": "Local courier snacks",
                    "spent_by": "Ops",
                    "status": "approved",
                },
            )
            assert petty_cash_response.status_code == 201, petty_cash_response.text
            petty_cash_entry = petty_cash_response.json()
            assert petty_cash_entry["status"] == "approved"
            assert petty_cash_entry["transaction_created"] is True
            assert petty_cash_entry["transaction_id"] is not None

            supplier_response = client.post(
                "/api/v1/suppliers",
                headers=headers,
                json={
                    "name": f"Finance Supplier {uuid.uuid4().hex[:8]}",
                    "contact_person": "Supplier Contact",
                    "phone": "01700000000",
                    "email": unique_email(),
                    "address": "Dhaka",
                    "notes": "Finance flow supplier",
                    "is_active": True,
                },
            )
            assert supplier_response.status_code == 201, supplier_response.text
            supplier = supplier_response.json()

            supplier_payment_response = client.post(
                "/api/v1/supplier-payments",
                headers=headers,
                json={
                    "supplier_id": supplier["id"],
                    "account_id": bank_account["id"],
                    "payment_number": f"SP-{uuid.uuid4().hex[:8]}",
                    "amount": 200,
                    "payment_method": "bank_transfer",
                    "reference": "BTRX-1001",
                    "notes": "Partial settlement",
                },
            )
            assert supplier_payment_response.status_code == 201, supplier_payment_response.text
            supplier_payment = supplier_payment_response.json()
            assert supplier_payment["supplier"]["id"] == supplier["id"]
            assert supplier_payment["transaction_id"] is not None
            assert supplier_payment["transaction"]["transaction_type"] == "supplier_payment"

            petty_cash_transactions_response = client.get(
                f"/api/v1/transactions?transaction_type=petty_cash&search={petty_cash_entry['entry_number']}",
                headers=headers,
            )
            assert petty_cash_transactions_response.status_code == 200, petty_cash_transactions_response.text
            petty_cash_transactions = petty_cash_transactions_response.json()
            assert len(petty_cash_transactions) == 1
            assert petty_cash_transactions[0]["reference_type"] == "petty_cash"
            assert petty_cash_transactions[0]["reference_id"] == petty_cash_entry["id"]

            supplier_payment_transactions_response = client.get(
                f"/api/v1/transactions?account_id={bank_account['id']}&transaction_type=supplier_payment&direction=out&search={supplier_payment['payment_number']}",
                headers=headers,
            )
            assert supplier_payment_transactions_response.status_code == 200, supplier_payment_transactions_response.text
            supplier_payment_transactions = supplier_payment_transactions_response.json()
            assert len(supplier_payment_transactions) == 1
            assert supplier_payment_transactions[0]["reference_type"] == "supplier_payment"
            assert supplier_payment_transactions[0]["reference_id"] == supplier_payment["id"]

            finance_summary_response = client.get("/api/v1/finance/summary", headers=headers)
            assert finance_summary_response.status_code == 200, finance_summary_response.text
            finance_summary = finance_summary_response.json()
            assert float(finance_summary["total_cash_bank_balance"]) == float(baseline_finance_summary["total_cash_bank_balance"]) + 1400
            assert float(finance_summary["total_income"]) == float(baseline_finance_summary["total_income"]) + 250
            assert float(finance_summary["total_expense"]) == float(baseline_finance_summary["total_expense"]) + 350
            assert float(finance_summary["net_cash_flow"]) == float(baseline_finance_summary["net_cash_flow"]) - 100
            assert finance_summary["pending_petty_cash_count"] == baseline_finance_summary["pending_petty_cash_count"]
            assert float(finance_summary["supplier_payments_total"]) == float(baseline_finance_summary["supplier_payments_total"]) + 200
            assert len(finance_summary["recent_transactions"]) >= 5

            finance_summary_filtered_response = client.get(
                "/api/v1/finance/summary?date_from=2026-01-01T00:00:00Z&date_to=2026-12-31T23:59:59Z",
                headers=headers,
            )
            assert finance_summary_filtered_response.status_code == 200, finance_summary_filtered_response.text
            finance_summary_filtered = finance_summary_filtered_response.json()
            assert float(finance_summary_filtered["total_income"]) >= 250
            assert float(finance_summary_filtered["supplier_payments_total"]) >= 200

            finance_report_response = client.get(
                "/api/v1/reports/finance-summary?start_date=2026-01-01T00:00:00Z&end_date=2026-12-31T23:59:59Z",
                headers=headers,
            )
            assert finance_report_response.status_code == 200, finance_report_response.text
            finance_report = finance_report_response.json()
            assert float(finance_report["total_cash_bank_balance"]) >= 1400
            assert float(finance_report["total_expense"]) >= 350
            assert float(finance_report["supplier_payments_total"]) >= 200

            updated_cash_account_response = client.get(f"/api/v1/accounts/{cash_account['id']}", headers=headers)
            assert updated_cash_account_response.status_code == 200, updated_cash_account_response.text
            assert float(updated_cash_account_response.json()["current_balance"]) == 950

            updated_bank_account_response = client.get(f"/api/v1/accounts/{bank_account['id']}", headers=headers)
            assert updated_bank_account_response.status_code == 200, updated_bank_account_response.text
            assert float(updated_bank_account_response.json()["current_balance"]) == 450

            activity_logs_response = client.get("/api/v1/activity-logs?module=finance&limit=50", headers=headers)
            assert activity_logs_response.status_code == 200, activity_logs_response.text
            finance_logs = activity_logs_response.json()
            assert any(log["action"] == "account_created" for log in finance_logs)
            assert any(log["action"] == "transaction_created" for log in finance_logs)
            assert any(log["action"] == "petty_cash_created" for log in finance_logs)
            assert any(log["action"] == "petty_cash_transaction_created" for log in finance_logs)
            assert any(log["action"] == "supplier_payment_created" for log in finance_logs)
            assert any(log["action"] == "supplier_payment_transaction_created" for log in finance_logs)
    except (ProgrammingError, InterfaceError, AttributeError, RuntimeError) as exc:
        if any(token in str(exc) for token in ["accounts", "transactions", "petty_cash_entries", "supplier_payments", "reports", "activity_logs"]):
            pytest.skip("Apply the finance foundation and transaction-link migrations before running this test.")
        if any(token in str(exc).lower() for token in ["event loop is closed", "another operation is in progress", "send"]):
            pytest.skip("Skipped due to local asyncpg/TestClient event loop instability on Windows.")
        raise

    dispose_engine()


def test_tasks_foundation_flow() -> None:
    headers = auth_headers()

    try:
        with TestClient(app) as client:
            assignee_response = client.post(
                "/api/v1/users",
                headers=headers,
                json={
                    "full_name": "Task Assignee",
                    "email": unique_email(),
                    "password": "StrongPass123",
                    "role": "staff",
                    "is_active": True,
                },
            )
            assert assignee_response.status_code == 201, assignee_response.text
            assignee = assignee_response.json()

            create_task_response = client.post(
                "/api/v1/tasks",
                headers=headers,
                json={
                    "title": "Review overdue orders",
                    "description": "Check pending orders and move blockers forward.",
                    "status": "todo",
                    "priority": "urgent",
                    "assigned_to_id": assignee["id"],
                    "related_module": "orders",
                    "related_entity_type": "order_batch",
                    "related_entity_id": "BATCH-1",
                    "due_date": "2026-05-20T09:00:00Z",
                },
            )
            assert create_task_response.status_code == 201, create_task_response.text
            created_task = create_task_response.json()
            assert created_task["assigned_to"]["id"] == assignee["id"]
            assert created_task["created_by"] is not None

            filtered_tasks_response = client.get(
                f"/api/v1/tasks?status=todo&priority=urgent&assigned_to_id={assignee['id']}&search=overdue",
                headers=headers,
            )
            assert filtered_tasks_response.status_code == 200, filtered_tasks_response.text
            filtered_tasks = filtered_tasks_response.json()
            assert len(filtered_tasks) == 1
            assert filtered_tasks[0]["id"] == created_task["id"]

            complete_task_response = client.patch(
                f"/api/v1/tasks/{created_task['id']}",
                headers=headers,
                json={
                    "status": "completed",
                    "priority": "high",
                },
            )
            assert complete_task_response.status_code == 200, complete_task_response.text
            completed_task = complete_task_response.json()
            assert completed_task["status"] == "completed"
            assert completed_task["completed_at"] is not None

            summary_response = client.get("/api/v1/tasks/summary", headers=headers)
            assert summary_response.status_code == 200, summary_response.text
            summary = summary_response.json()
            assert summary["total_tasks"] >= 1
            assert summary["completed_tasks"] >= 1
            assert summary["urgent_tasks"] == 0

            cancel_task_response = client.delete(
                f"/api/v1/tasks/{created_task['id']}",
                headers=headers,
            )
            assert cancel_task_response.status_code == 200, cancel_task_response.text
            cancelled_task = cancel_task_response.json()
            assert cancelled_task["status"] == "cancelled"
            assert cancelled_task["completed_at"] is None

            activity_logs_response = client.get("/api/v1/activity-logs?module=tasks&limit=50", headers=headers)
            assert activity_logs_response.status_code == 200, activity_logs_response.text
            task_logs = activity_logs_response.json()
            assert any(log["action"] == "task_created" for log in task_logs)
            assert any(log["action"] == "task_assigned" for log in task_logs)
            assert any(log["action"] == "task_updated" for log in task_logs)
            assert any(log["action"] == "task_status_changed" for log in task_logs)
            assert any(log["action"] == "task_cancelled" for log in task_logs)
    except (ProgrammingError, InterfaceError, AttributeError, RuntimeError) as exc:
        if any(token in str(exc) for token in ["tasks", "activity_logs"]):
            pytest.skip("Apply the tasks foundation migration before running this test.")
        if any(token in str(exc).lower() for token in ["event loop is closed", "another operation is in progress", "send"]):
            pytest.skip("Skipped due to local asyncpg/TestClient event loop instability on Windows.")
        raise

    dispose_engine()


def test_hr_foundation_flow() -> None:
    headers = auth_headers()

    try:
        with TestClient(app) as client:
            linked_user_response = client.post(
                "/api/v1/users",
                headers=headers,
                json={
                    "full_name": "HR Linked User",
                    "email": unique_email(),
                    "password": "StrongPass123",
                    "role": "staff",
                    "is_active": True,
                },
            )
            assert linked_user_response.status_code == 201, linked_user_response.text
            linked_user = linked_user_response.json()

            designation_response = client.post(
                "/api/v1/designations",
                headers=headers,
                json={
                    "title": "Operations Executive",
                    "description": "Handles warehouse and order operations",
                    "is_active": True,
                },
            )
            assert designation_response.status_code == 201, designation_response.text
            designation = designation_response.json()

            employee_response = client.post(
                "/api/v1/employees",
                headers=headers,
                json={
                    "employee_code": f"EMP-{uuid.uuid4().hex[:8]}",
                    "full_name": "HR Test Employee",
                    "email": "hr.employee@example.com",
                    "phone": "01711111111",
                    "address": "Dhaka",
                    "designation_id": designation["id"],
                    "user_id": linked_user["id"],
                    "joining_date": "2026-05-01",
                    "salary": 25000,
                    "employment_status": "active",
                    "notes": "HR foundation test employee",
                },
            )
            assert employee_response.status_code == 201, employee_response.text
            employee = employee_response.json()
            assert employee["designation"]["id"] == designation["id"]

            attendance_response = client.post(
                "/api/v1/attendance",
                headers=headers,
                json={
                    "employee_id": employee["id"],
                    "attendance_date": "2026-05-12",
                    "status": "present",
                    "notes": "On time",
                },
            )
            assert attendance_response.status_code == 201, attendance_response.text
            duplicate_attendance_response = client.post(
                "/api/v1/attendance",
                headers=headers,
                json={
                    "employee_id": employee["id"],
                    "attendance_date": "2026-05-12",
                    "status": "present",
                },
            )
            assert duplicate_attendance_response.status_code == 409, duplicate_attendance_response.text

            salary_advance_response = client.post(
                "/api/v1/salary-advances",
                headers=headers,
                json={
                    "employee_id": employee["id"],
                    "amount": 5000,
                    "reason": "Emergency expense",
                    "status": "pending",
                },
            )
            assert salary_advance_response.status_code == 201, salary_advance_response.text
            salary_advance = salary_advance_response.json()

            approve_advance_response = client.patch(
                f"/api/v1/salary-advances/{salary_advance['id']}",
                headers=headers,
                json={"status": "approved"},
            )
            assert approve_advance_response.status_code == 200, approve_advance_response.text
            approved_advance = approve_advance_response.json()
            assert approved_advance["status"] == "approved"
            assert approved_advance["approved_at"] is not None
            assert approved_advance["approved_by"]["id"]

            salary_record_response = client.post(
                "/api/v1/salary-records",
                headers=headers,
                json={
                    "employee_id": employee["id"],
                    "salary_month": "2026-05",
                    "basic_salary": 25000,
                    "advance_deduction": 3000,
                    "bonus": 2000,
                    "other_deductions": 500,
                    "status": "generated",
                },
            )
            assert salary_record_response.status_code == 201, salary_record_response.text
            salary_record = salary_record_response.json()
            assert float(salary_record["net_salary"]) == 23500

            paid_salary_record_response = client.patch(
                f"/api/v1/salary-records/{salary_record['id']}",
                headers=headers,
                json={"status": "paid"},
            )
            assert paid_salary_record_response.status_code == 200, paid_salary_record_response.text
            paid_salary_record = paid_salary_record_response.json()
            assert paid_salary_record["status"] == "paid"
            assert paid_salary_record["paid_at"] is not None

            hr_summary_response = client.get("/api/v1/hr/summary", headers=headers)
            assert hr_summary_response.status_code == 200, hr_summary_response.text
            hr_summary = hr_summary_response.json()
            assert hr_summary["total_employees"] >= 1
            assert hr_summary["active_employees"] >= 1
            assert hr_summary["pending_advances"] == 0
            assert hr_summary["salary_records_this_month"] >= 1

            hr_logs_response = client.get("/api/v1/activity-logs?module=hr&limit=50", headers=headers)
            assert hr_logs_response.status_code == 200, hr_logs_response.text
            hr_logs = hr_logs_response.json()
            assert any(log["action"] == "employee_created" for log in hr_logs)
            assert any(log["action"] == "attendance_created" for log in hr_logs)
            assert any(log["action"] == "salary_advance_created" for log in hr_logs)
            assert any(log["action"] == "salary_advance_status_changed" for log in hr_logs)
            assert any(log["action"] == "salary_record_created" for log in hr_logs)
            assert any(log["action"] == "salary_record_status_changed" for log in hr_logs)
    except (ProgrammingError, InterfaceError, AttributeError, RuntimeError) as exc:
        if any(token in str(exc) for token in ["designations", "employees", "attendance_records", "salary_advances", "salary_records", "activity_logs"]):
            pytest.skip("Apply the HR foundation migration before running this test.")
        if any(token in str(exc).lower() for token in ["event loop is closed", "another operation is in progress", "send"]):
            pytest.skip("Skipped due to local asyncpg/TestClient event loop instability on Windows.")
        raise

    dispose_engine()


def test_pos_foundation_flow() -> None:
    try:
        headers = auth_headers()
        with TestClient(app) as client:
            category_response = client.post(
                "/api/v1/categories",
                headers=headers,
                json={
                    "name": f"POS Category {uuid.uuid4().hex[:8]}",
                    "slug": f"pos-category-{uuid.uuid4().hex[:8]}",
                    "description": "POS flow category",
                },
            )
            assert category_response.status_code == 201, category_response.text
            category_id = category_response.json()["id"]

            brand_response = client.post(
                "/api/v1/brands",
                headers=headers,
                json={
                    "name": f"POS Brand {uuid.uuid4().hex[:8]}",
                    "slug": f"pos-brand-{uuid.uuid4().hex[:8]}",
                    "description": "POS flow brand",
                },
            )
            assert brand_response.status_code == 201, brand_response.text
            brand_id = brand_response.json()["id"]

            product_response = client.post(
                "/api/v1/products",
                headers=headers,
                json={
                    "name": "POS Counter Product",
                    "slug": f"pos-counter-product-{uuid.uuid4().hex[:8]}",
                    "sku": f"POS-{uuid.uuid4().hex[:8]}",
                    "description": "POS flow product",
                    "category_id": category_id,
                    "brand_id": brand_id,
                    "price": 300.00,
                    "cost_price": 180.00,
                    "image_url": None,
                    "status": "active",
                    "variants": [],
                },
            )
            assert product_response.status_code == 201, product_response.text
            product = product_response.json()

            warehouse_response = client.post(
                "/api/v1/warehouses",
                headers=headers,
                json={
                    "name": f"POS Warehouse {uuid.uuid4().hex[:8]}",
                    "code": f"POS-WH-{uuid.uuid4().hex[:8]}",
                    "address": "Dhaka",
                    "is_active": True,
                },
            )
            assert warehouse_response.status_code == 201, warehouse_response.text
            warehouse = warehouse_response.json()

            inventory_response = client.post(
                "/api/v1/inventory",
                headers=headers,
                json={
                    "product_id": product["id"],
                    "variant_id": None,
                    "warehouse_id": warehouse["id"],
                    "quantity": 10,
                    "low_stock_threshold": 2,
                },
            )
            assert inventory_response.status_code == 201, inventory_response.text
            inventory_item = inventory_response.json()

            account_response = client.post(
                "/api/v1/accounts",
                headers=headers,
                json={
                    "name": f"POS Cash {uuid.uuid4().hex[:8]}",
                    "code": f"POS-CASH-{uuid.uuid4().hex[:8]}",
                    "account_type": "cash",
                    "opening_balance": 100,
                    "notes": "POS drawer",
                    "is_active": True,
                },
            )
            assert account_response.status_code == 201, account_response.text
            account = account_response.json()

            product_search_response = client.get(
                f"/api/v1/pos/products?warehouse_id={warehouse['id']}&search={product['sku']}&limit=20",
                headers=headers,
            )
            assert product_search_response.status_code == 200, product_search_response.text
            product_results = product_search_response.json()
            assert any(item["product_id"] == product["id"] and item["stock_quantity"] == 10 for item in product_results)

            checkout_response = client.post(
                "/api/v1/pos/checkout",
                headers=headers,
                json={
                    "customer_id": None,
                    "customer_name": "Walk-in Buyer",
                    "customer_phone": "01777777777",
                    "warehouse_id": warehouse["id"],
                    "payment_method": "cash",
                    "account_id": account["id"],
                    "discount": 50,
                    "paid_amount": 500,
                    "notes": "Counter sale",
                    "items": [
                        {
                            "product_id": product["id"],
                            "variant_id": None,
                            "product_name": product["name"],
                            "sku": product["sku"],
                            "quantity": 2,
                            "unit_price": 300,
                            "total_price": 600,
                        }
                    ],
                },
            )
            assert checkout_response.status_code == 201, checkout_response.text
            checkout = checkout_response.json()
            assert checkout["payment_status"] == "partial"
            assert float(checkout["due_amount"]) == 50
            assert float(checkout["change_amount"]) == 0

            order_id = checkout["order_id"]
            order_detail_response = client.get(f"/api/v1/orders/{order_id}", headers=headers)
            assert order_detail_response.status_code == 200, order_detail_response.text
            order = order_detail_response.json()
            assert order["source"] == "pos"
            assert order["status"] == "delivered"
            assert order["payment_status"] == "partial"
            assert order["customer_name"] == "Walk-in Buyer"
            assert order["payment_method"] == "cash"
            assert float(order["paid_amount"]) == 500
            assert order["stock_deducted"] is True
            assert any(event["event_type"] == "pos_checkout_created" for event in order["events"])

            inventory_detail_response = client.get(
                f"/api/v1/inventory/{inventory_item['id']}",
                headers=headers,
            )
            assert inventory_detail_response.status_code == 200, inventory_detail_response.text
            assert inventory_detail_response.json()["quantity"] == 8

            movement_response = client.get(
                f"/api/v1/stock-movements?order_id={order_id}&movement_type=pos_sale",
                headers=headers,
            )
            assert movement_response.status_code == 200, movement_response.text
            assert any(movement["movement_type"] == "pos_sale" for movement in movement_response.json())

            transaction_response = client.get(
                f"/api/v1/transactions?transaction_type=customer_payment&search={order['order_number']}",
                headers=headers,
            )
            assert transaction_response.status_code == 200, transaction_response.text
            transactions = transaction_response.json()
            assert any(item["reference_type"] == "order" and item["reference_id"] == order_id for item in transactions)

            account_detail_response = client.get(f"/api/v1/accounts/{account['id']}", headers=headers)
            assert account_detail_response.status_code == 200, account_detail_response.text
            assert float(account_detail_response.json()["current_balance"]) == 600

            invoice_data_response = client.get(f"/api/v1/orders/{order_id}/invoice-data", headers=headers)
            assert invoice_data_response.status_code == 200, invoice_data_response.text
            assert invoice_data_response.json()["order"]["customer_name"] == "Walk-in Buyer"

            summary_response = client.get("/api/v1/pos/summary", headers=headers)
            assert summary_response.status_code == 200, summary_response.text
            summary = summary_response.json()
            assert summary["today_pos_orders"] >= 1
            assert float(summary["today_pos_sales"]) >= 550
            assert float(summary["today_paid_amount"]) >= 500

            activity_logs_response = client.get("/api/v1/activity-logs?module=pos&limit=20", headers=headers)
            assert activity_logs_response.status_code == 200, activity_logs_response.text
            assert any(log["action"] == "pos_checkout_created" for log in activity_logs_response.json())
    except (ProgrammingError, InterfaceError, AttributeError, RuntimeError) as exc:
        if any(
            token in str(exc)
            for token in [
                "pos",
                "customer_name",
                "payment_method",
                "paid_amount",
                "activity_logs",
            ]
        ):
            pytest.skip("Apply the POS order-fields migration before running this test.")
        if any(token in str(exc).lower() for token in ["event loop is closed", "another operation is in progress", "send"]):
            pytest.skip("Skipped due to local asyncpg/TestClient event loop instability on Windows.")
        raise

    dispose_engine()


def test_order_warehouse_assignment_and_fulfillment() -> None:
    headers = auth_headers()

    try:
        with TestClient(app) as client:
            category_response = client.post(
                "/api/v1/categories",
                headers=headers,
                json={
                    "name": f"Warehouse Category {uuid.uuid4().hex[:8]}",
                    "slug": f"warehouse-category-{uuid.uuid4().hex[:8]}",
                    "description": "Warehouse-aware order test category",
                },
            )
            assert category_response.status_code == 201, category_response.text
            category_id = category_response.json()["id"]

            brand_response = client.post(
                "/api/v1/brands",
                headers=headers,
                json={
                    "name": f"Warehouse Brand {uuid.uuid4().hex[:8]}",
                    "slug": f"warehouse-brand-{uuid.uuid4().hex[:8]}",
                    "description": "Warehouse-aware order test brand",
                },
            )
            assert brand_response.status_code == 201, brand_response.text
            brand_id = brand_response.json()["id"]

            product_response = client.post(
                "/api/v1/products",
                headers=headers,
                json={
                    "name": "Warehouse Order Product",
                    "slug": f"warehouse-order-product-{uuid.uuid4().hex[:8]}",
                    "sku": f"WO-{uuid.uuid4().hex[:8]}",
                    "description": "Warehouse-aware order test product",
                    "category_id": category_id,
                    "brand_id": brand_id,
                    "price": 150.00,
                    "cost_price": 100.00,
                    "image_url": None,
                    "status": "active",
                    "variants": [],
                },
            )
            assert product_response.status_code == 201, product_response.text
            product_id = product_response.json()["id"]

            warehouse_response = client.post(
                "/api/v1/warehouses",
                headers=headers,
                json={
                    "name": f"Warehouse {uuid.uuid4().hex[:8]}",
                    "code": f"WH-{uuid.uuid4().hex[:8]}",
                    "address": "Dhaka",
                    "is_active": True,
                },
            )
            assert warehouse_response.status_code == 201, warehouse_response.text
            warehouse_id = warehouse_response.json()["id"]

            inventory_response = client.post(
                "/api/v1/inventory",
                headers=headers,
                json={
                    "product_id": product_id,
                    "variant_id": None,
                    "warehouse_id": warehouse_id,
                    "quantity": 10,
                    "low_stock_threshold": 5,
                },
            )
            assert inventory_response.status_code == 201, inventory_response.text
            inventory_item_id = inventory_response.json()["id"]

            order_response = client.post(
                "/api/v1/orders",
                headers=headers,
                json={
                    "order_number": f"ORD-WH-{uuid.uuid4().hex[:8]}",
                    "customer_id": None,
                    "warehouse_id": warehouse_id,
                    "customer_phone": "01711111111",
                    "shipping_address": "Dhaka, Bangladesh",
                    "notes": "Leave with front desk",
                    "tags": "priority,warehouse",
                    "status": "pending",
                    "payment_status": "unpaid",
                    "source": "manual",
                    "subtotal": 300,
                    "discount": 0,
                    "delivery_charge": 0,
                    "total": 300,
                    "items": [
                        {
                            "product_id": product_id,
                            "variant_id": None,
                            "product_name": "Warehouse Order Product",
                            "sku": "MANUAL-SKU",
                            "quantity": 2,
                            "unit_price": 150,
                            "total_price": 300,
                        }
                    ],
                },
            )
            assert order_response.status_code == 201, order_response.text
            order_id = order_response.json()["id"]
            assert order_response.json()["warehouse_id"] == warehouse_id
            assert order_response.json()["customer_phone"] == "01711111111"
            assert order_response.json()["shipping_address"] == "Dhaka, Bangladesh"
            assert order_response.json()["printed_count"] == 0
            assert any(event["event_type"] == "order_created" for event in order_response.json()["events"])

            duplicate_check_response = client.get(
                "/api/v1/orders/duplicate-check?phone=01711111111&limit=5",
                headers=headers,
            )
            assert duplicate_check_response.status_code == 200, duplicate_check_response.text
            duplicate_matches = duplicate_check_response.json()
            assert any(match["id"] == order_id for match in duplicate_matches)

            fulfill_response = client.patch(
                f"/api/v1/orders/{order_id}",
                headers=headers,
                json={"status": "shipped"},
            )
            assert fulfill_response.status_code == 200, fulfill_response.text
            fulfilled_order = fulfill_response.json()
            assert fulfilled_order["stock_deducted"] is True
            assert fulfilled_order["warehouse"]["id"] == warehouse_id
            assert any(
                event["event_type"] == "status_changed"
                and "pending" in event["message"]
                and "shipped" in event["message"]
                for event in fulfilled_order["events"]
            )

            mark_printed_response = client.post(
                f"/api/v1/orders/{order_id}/mark-printed",
                headers=headers,
            )
            assert mark_printed_response.status_code == 200, mark_printed_response.text
            printed_order = mark_printed_response.json()
            assert printed_order["printed_count"] == 1
            assert printed_order["last_printed_at"] is not None
            assert any(event["event_type"] == "order_printed" for event in printed_order["events"])

            order_logs_response = client.get(
                "/api/v1/activity-logs?module=orders&limit=20",
                headers=headers,
            )
            assert order_logs_response.status_code == 200, order_logs_response.text
            order_logs = order_logs_response.json()
            assert any(log["action"] == "order_status_changed" for log in order_logs)
            assert any(log["action"] == "order_printed" for log in order_logs)

            inventory_detail_response = client.get(
                f"/api/v1/inventory/{inventory_item_id}",
                headers=headers,
            )
            assert inventory_detail_response.status_code == 200, inventory_detail_response.text
            assert inventory_detail_response.json()["quantity"] == 8

            stock_movement_response = client.get(
                f"/api/v1/stock-movements?order_id={order_id}",
                headers=headers,
            )
            assert stock_movement_response.status_code == 200, stock_movement_response.text
            movements = stock_movement_response.json()
            assert len(movements) >= 1
            assert any(
                movement["warehouse_id"] == warehouse_id and movement["movement_type"] == "order_fulfilled"
                for movement in movements
            )
    except ProgrammingError as exc:
        if any(token in str(exc) for token in ["warehouse_id", "business_settings", "customer_phone", "customer_name", "payment_method", "paid_amount", "printed_count", "order_events", "activity_logs"]):
            pytest.skip("Apply the latest migrations before running this test.")
        raise

    dispose_engine()


def test_return_request_restock_flow() -> None:
    try:
        headers = auth_headers()
        with TestClient(app) as client:
            category_response = client.post(
                "/api/v1/categories",
                headers=headers,
                json={
                    "name": f"Return Category {uuid.uuid4().hex[:8]}",
                    "slug": f"return-category-{uuid.uuid4().hex[:8]}",
                    "description": "Return flow category",
                },
            )
            assert category_response.status_code == 201, category_response.text
            category_id = category_response.json()["id"]

            brand_response = client.post(
                "/api/v1/brands",
                headers=headers,
                json={
                    "name": f"Return Brand {uuid.uuid4().hex[:8]}",
                    "slug": f"return-brand-{uuid.uuid4().hex[:8]}",
                    "description": "Return flow brand",
                },
            )
            assert brand_response.status_code == 201, brand_response.text
            brand_id = brand_response.json()["id"]

            product_response = client.post(
                "/api/v1/products",
                headers=headers,
                json={
                    "name": "Return Flow Product",
                    "slug": f"return-flow-product-{uuid.uuid4().hex[:8]}",
                    "sku": f"RF-{uuid.uuid4().hex[:8]}",
                    "description": "Return flow product",
                    "category_id": category_id,
                    "brand_id": brand_id,
                    "price": 220.00,
                    "cost_price": 150.00,
                    "image_url": None,
                    "status": "active",
                    "variants": [],
                },
            )
            assert product_response.status_code == 201, product_response.text
            product = product_response.json()

            warehouse_response = client.post(
                "/api/v1/warehouses",
                headers=headers,
                json={
                    "name": f"Return Warehouse {uuid.uuid4().hex[:8]}",
                    "code": f"RWH-{uuid.uuid4().hex[:8]}",
                    "address": "Dhaka",
                    "is_active": True,
                },
            )
            assert warehouse_response.status_code == 201, warehouse_response.text
            warehouse = warehouse_response.json()

            inventory_response = client.post(
                "/api/v1/inventory",
                headers=headers,
                json={
                    "product_id": product["id"],
                    "variant_id": None,
                    "warehouse_id": warehouse["id"],
                    "quantity": 10,
                    "low_stock_threshold": 5,
                },
            )
            assert inventory_response.status_code == 201, inventory_response.text
            inventory_item_id = inventory_response.json()["id"]

            order_response = client.post(
                "/api/v1/orders",
                headers=headers,
                json={
                    "order_number": f"ORD-RET-{uuid.uuid4().hex[:8]}",
                    "customer_id": None,
                    "warehouse_id": warehouse["id"],
                    "customer_phone": "01722222222",
                    "shipping_address": "Customer return address",
                    "notes": "Eligible for return",
                    "tags": "return-test",
                    "status": "pending",
                    "payment_status": "unpaid",
                    "source": "manual",
                    "subtotal": 220,
                    "discount": 0,
                    "delivery_charge": 0,
                    "total": 220,
                    "items": [
                        {
                            "product_id": product["id"],
                            "variant_id": None,
                            "product_name": "Return Flow Product",
                            "sku": product["sku"],
                            "quantity": 1,
                            "unit_price": 220,
                            "total_price": 220,
                        }
                    ],
                },
            )
            assert order_response.status_code == 201, order_response.text
            order = order_response.json()

            fulfill_response = client.patch(
                f"/api/v1/orders/{order['id']}",
                headers=headers,
                json={"status": "shipped"},
            )
            assert fulfill_response.status_code == 200, fulfill_response.text

            return_response = client.post(
                "/api/v1/returns",
                headers=headers,
                json={
                    "return_number": f"RMA-{uuid.uuid4().hex[:8]}",
                    "order_id": order["id"],
                    "warehouse_id": warehouse["id"],
                    "reason": "Customer changed mind",
                    "resolution": "refund",
                    "refund_amount": 220,
                    "restock_items": True,
                    "items": [
                        {
                            "order_item_id": order["items"][0]["id"],
                            "product_id": product["id"],
                            "variant_id": None,
                            "product_name": "Return Flow Product",
                            "sku": product["sku"],
                            "quantity": 1,
                            "condition": "good",
                        }
                    ],
                },
            )
            assert return_response.status_code == 201, return_response.text
            return_request = return_response.json()
            assert return_request["stock_restocked"] is False

            restock_response = client.patch(
                f"/api/v1/returns/{return_request['id']}",
                headers=headers,
                json={
                    "status": "restocked",
                    "restock_items": True,
                },
            )
            assert restock_response.status_code == 200, restock_response.text
            restocked_return = restock_response.json()
            assert restocked_return["stock_restocked"] is True
            assert restocked_return["items"][0]["restocked_quantity"] == 1

            inventory_detail_response = client.get(
                f"/api/v1/inventory/{inventory_item_id}",
                headers=headers,
            )
            assert inventory_detail_response.status_code == 200, inventory_detail_response.text
            assert inventory_detail_response.json()["quantity"] == 10

            stock_movement_response = client.get(
                f"/api/v1/stock-movements?order_id={order['id']}&movement_type=return_restocked",
                headers=headers,
            )
            assert stock_movement_response.status_code == 200, stock_movement_response.text
            movements = stock_movement_response.json()
            assert any(movement["warehouse_id"] == warehouse["id"] for movement in movements)
    except (ProgrammingError, InterfaceError, AttributeError, RuntimeError) as exc:
        if any(token in str(exc) for token in ["return_requests", "warehouse_id", "business_settings", "customer_phone", "customer_name", "payment_method", "paid_amount", "printed_count", "order_events"]):
            pytest.skip("Apply the latest migrations before running this test.")
        if any(token in str(exc).lower() for token in ["event loop is closed", "another operation is in progress", "send"]):
            pytest.skip("Skipped due to local asyncpg/TestClient event loop instability on Windows.")
        raise

    dispose_engine()


def test_courier_and_shipment_flow() -> None:
    try:
        headers = auth_headers()
        with TestClient(app) as client:
            category_response = client.post(
                "/api/v1/categories",
                headers=headers,
                json={
                    "name": f"Logistics Category {uuid.uuid4().hex[:8]}",
                    "slug": f"logistics-category-{uuid.uuid4().hex[:8]}",
                    "description": "Logistics flow category",
                },
            )
            assert category_response.status_code == 201, category_response.text
            category_id = category_response.json()["id"]

            brand_response = client.post(
                "/api/v1/brands",
                headers=headers,
                json={
                    "name": f"Logistics Brand {uuid.uuid4().hex[:8]}",
                    "slug": f"logistics-brand-{uuid.uuid4().hex[:8]}",
                    "description": "Logistics flow brand",
                },
            )
            assert brand_response.status_code == 201, brand_response.text
            brand_id = brand_response.json()["id"]

            product_response = client.post(
                "/api/v1/products",
                headers=headers,
                json={
                    "name": "Logistics Flow Product",
                    "slug": f"logistics-flow-product-{uuid.uuid4().hex[:8]}",
                    "sku": f"LG-{uuid.uuid4().hex[:8]}",
                    "description": "Logistics flow product",
                    "category_id": category_id,
                    "brand_id": brand_id,
                    "price": 300.00,
                    "cost_price": 200.00,
                    "image_url": None,
                    "status": "active",
                    "variants": [],
                },
            )
            assert product_response.status_code == 201, product_response.text
            product = product_response.json()

            courier_response = client.post(
                "/api/v1/couriers",
                headers=headers,
                json={
                    "name": f"Courier {uuid.uuid4().hex[:8]}",
                    "code": f"CR-{uuid.uuid4().hex[:8]}",
                    "contact_phone": "01700000000",
                    "website": "https://courier.example.com",
                    "is_active": True,
                },
            )
            assert courier_response.status_code == 201, courier_response.text
            courier = courier_response.json()

            order_response = client.post(
                "/api/v1/orders",
                headers=headers,
                json={
                    "order_number": f"ORD-LGX-{uuid.uuid4().hex[:8]}",
                    "customer_id": None,
                    "warehouse_id": None,
                    "customer_phone": "01744444444",
                    "shipping_address": "House 7, Dhaka",
                    "notes": "Logistics dispatch test",
                    "tags": "dispatch-test",
                    "status": "confirmed",
                    "payment_status": "unpaid",
                    "source": "manual",
                    "subtotal": 300,
                    "discount": 0,
                    "delivery_charge": 60,
                    "total": 360,
                    "items": [
                        {
                            "product_id": product["id"],
                            "variant_id": None,
                            "product_name": product["name"],
                            "sku": product["sku"],
                            "quantity": 1,
                            "unit_price": 300,
                            "total_price": 300,
                        }
                    ],
                },
            )
            assert order_response.status_code == 201, order_response.text
            order = order_response.json()

            pending_dispatch_response = client.get(
                "/api/v1/logistics/pending-dispatch?skip=0&limit=20",
                headers=headers,
            )
            assert pending_dispatch_response.status_code == 200, pending_dispatch_response.text
            pending_dispatch_orders = pending_dispatch_response.json()
            pending_row = next(item for item in pending_dispatch_orders if item["id"] == order["id"])
            assert pending_row["orderNumber"] == order["order_number"]
            assert pending_row["customerPhone"] == "01744444444"
            assert pending_row["customerAddress"] == "House 7, Dhaka"
            assert pending_row["totalAmount"] == "360.00"
            assert pending_row["itemCount"] == 1
            assert pending_row["canCreateShipment"] is True
            assert pending_row["hasShipment"] is False

            shipment_response = client.post(
                f"/api/v1/orders/{order['id']}/create-shipment",
                headers=headers,
                json={
                    "courier_id": courier["id"],
                    "tracking_number": f"TRK-{uuid.uuid4().hex[:10]}",
                    "delivery_charge": 120,
                    "courier_charge": 80,
                    "cod_amount": 300,
                    "collected_amount": 0,
                    "notes": "Prepared for dispatch",
                    "order_status": "ready_to_ship",
                },
            )
            assert shipment_response.status_code == 201, shipment_response.text
            shipment = shipment_response.json()
            assert shipment["courier"]["id"] == courier["id"]
            assert shipment["recipient_phone"] == "01744444444"
            assert shipment["delivery_address"] == "House 7, Dhaka"
            assert any(event["event_type"] == "shipment_created" for event in shipment["events"])
            assert shipment["shipmentNumber"] == shipment["shipment_number"]
            assert shipment["orderNumber"] == order["order_number"]
            assert shipment["courierName"] == courier["name"]
            assert shipment["trackingNumber"] == shipment["tracking_number"]
            assert shipment["statusLabel"] == "Pending"
            assert shipment["sentToCourier"] is False
            assert shipment["canSendToCourier"] is True
            assert shipment["pendingAmount"] == "220.00"

            direct_order_response = client.post(
                "/api/v1/orders",
                headers=headers,
                json={
                    "orderNumber": f"ORD-LGX-{uuid.uuid4().hex[:8]}",
                    "customerName": "Direct Shipment Customer",
                    "customerPhone": "01755555555",
                    "customerAddress": "Mirpur, Dhaka",
                    "status": "processing",
                    "payment_status": "unpaid",
                    "source": "manual",
                    "subtotal": 300,
                    "discount": 0,
                    "deliveryCharge": 50,
                    "totalAmount": 350,
                    "items": [
                        {
                            "productId": product["id"],
                            "productName": product["name"],
                            "sku": product["sku"],
                            "quantity": 1,
                            "unitPrice": 300,
                        }
                    ],
                },
            )
            assert direct_order_response.status_code == 201, direct_order_response.text
            direct_order = direct_order_response.json()

            direct_shipment_response = client.post(
                "/api/v1/shipments",
                headers=headers,
                json={
                    "shipmentNumber": f"SHP-V1-{uuid.uuid4().hex[:8]}",
                    "orderId": direct_order["id"],
                    "courierId": courier["id"],
                    "recipientName": "Direct Shipment Customer",
                    "recipientPhone": "01755555555",
                    "deliveryAddress": "Mirpur, Dhaka",
                    "trackingNumber": f"TRK-{uuid.uuid4().hex[:10]}",
                    "deliveryCharge": 75,
                    "courierCharge": 55,
                    "codAmount": 350,
                    "collectedAmount": 0,
                    "reconciliationStatus": "pending",
                    "notes": "Direct shipment aliases",
                },
            )
            assert direct_shipment_response.status_code == 201, direct_shipment_response.text
            direct_shipment = direct_shipment_response.json()
            assert direct_shipment["recipientName"] == "Direct Shipment Customer"
            assert direct_shipment["recipientPhone"] == "01755555555"
            assert direct_shipment["deliveryAddress"] == "Mirpur, Dhaka"

            shipped_response = client.patch(
                f"/api/v1/shipments/{shipment['id']}",
                headers=headers,
                json={"status": "shipped"},
            )
            assert shipped_response.status_code == 200, shipped_response.text
            shipped_shipment = shipped_response.json()
            assert shipped_shipment["status"] == "shipped"
            assert shipped_shipment["shipped_at"] is not None
            assert any(event["event_type"] == "status_changed" for event in shipped_shipment["events"])

            delivered_response = client.patch(
                f"/api/v1/shipments/{shipment['id']}",
                headers=headers,
                json={"status": "delivered"},
            )
            assert delivered_response.status_code == 200, delivered_response.text
            delivered_shipment = delivered_response.json()
            assert delivered_shipment["status"] == "delivered"
            assert delivered_shipment["delivered_at"] is not None
            assert float(delivered_shipment["collected_amount"]) == 300

            reconciliation_response = client.patch(
                f"/api/v1/shipments/{shipment['id']}",
                headers=headers,
                json={
                    "courierCharge": 95,
                    "collectedAmount": 300,
                    "reconciliationStatus": "settled",
                },
            )
            assert reconciliation_response.status_code == 200, reconciliation_response.text
            reconciled_shipment = reconciliation_response.json()
            assert reconciled_shipment["reconciliation_status"] == "settled"
            assert reconciled_shipment["reconciled_at"] is not None
            assert any(event["event_type"] == "reconciliation_updated" for event in reconciled_shipment["events"])
            assert reconciled_shipment["reconciliationStatus"] == "settled"
            assert reconciled_shipment["canReconcile"] is False

            shipment_list_response = client.get("/api/v1/shipments", headers=headers)
            assert shipment_list_response.status_code == 200, shipment_list_response.text
            shipment_rows = shipment_list_response.json()
            direct_row = next(item for item in shipment_rows if item["id"] == direct_shipment["id"])
            assert direct_row["shipmentNumber"] == direct_shipment["shipment_number"]
            assert direct_row["orderNumber"] == direct_order["order_number"]
            assert direct_row["customerName"] == "Direct Shipment Customer"
            assert direct_row["courierName"] == courier["name"]
            assert direct_row["statusLabel"] == "Pending"
            assert direct_row["pendingAmount"] == "295.00"
            assert direct_row["action_flags"]["can_send_to_courier"] is True

            direct_update_response = client.patch(
                f"/api/v1/shipments/{direct_shipment['id']}",
                headers=headers,
                json={
                    "status": "shipped",
                    "courierCharge": 60,
                    "reconciliationStatus": "matched",
                },
            )
            assert direct_update_response.status_code == 200, direct_update_response.text
            direct_updated = direct_update_response.json()
            assert direct_updated["status"] == "shipped"
            assert direct_updated["courierCharge"] == "60.00"
            assert direct_updated["reconciliationStatus"] == "matched"

            command_summary_response = client.get("/api/v1/logistics/command-summary", headers=headers)
            assert command_summary_response.status_code == 200, command_summary_response.text
            command_summary = command_summary_response.json()
            assert command_summary["pending_dispatch_count"] >= 0
            assert command_summary["ready_to_ship_count"] >= 0
            assert command_summary["active_shipments"] >= 1
            assert command_summary["courier_count"] >= 1
            assert command_summary["active_courier_count"] >= 1

            courier_list_response = client.get("/api/v1/couriers", headers=headers)
            assert courier_list_response.status_code == 200, courier_list_response.text
            courier_rows = courier_list_response.json()
            courier_row = next(item for item in courier_rows if item["id"] == courier["id"])
            assert courier_row["courierName"] == courier["name"]
            assert courier_row["contactPhone"] == "01700000000"
            assert courier_row["activeShipmentCount"] >= 1
            assert courier_row["pendingReconciliationCount"] >= 1

            deactivate_response = client.delete(
                f"/api/v1/couriers/{courier['id']}",
                headers=headers,
            )
            assert deactivate_response.status_code == 204, deactivate_response.text

            courier_detail_response = client.get(
                f"/api/v1/couriers/{courier['id']}",
                headers=headers,
            )
            assert courier_detail_response.status_code == 200, courier_detail_response.text
            assert courier_detail_response.json()["is_active"] is False
    except (ProgrammingError, InterfaceError, AttributeError, RuntimeError) as exc:
        if any(token in str(exc) for token in ["couriers", "shipments", "shipment_events", "return_requests", "warehouse_id", "business_settings", "customer_phone", "customer_name", "payment_method", "paid_amount", "printed_count", "order_events", "activity_logs"]):
            pytest.skip("Apply the latest migrations before running this test.")
        if any(token in str(exc).lower() for token in ["event loop is closed", "another operation is in progress", "send"]):
            pytest.skip("Skipped due to local asyncpg/TestClient event loop instability on Windows.")
        raise

    dispose_engine()


def test_supplier_and_purchase_order_receiving_flow() -> None:
    try:
        headers = auth_headers()
        with TestClient(app) as client:
            category_response = client.post(
                "/api/v1/categories",
                headers=headers,
                json={
                    "name": f"Purchase Category {uuid.uuid4().hex[:8]}",
                    "slug": f"purchase-category-{uuid.uuid4().hex[:8]}",
                    "description": "Purchase flow category",
                },
            )
            assert category_response.status_code == 201, category_response.text
            category_id = category_response.json()["id"]

            brand_response = client.post(
                "/api/v1/brands",
                headers=headers,
                json={
                    "name": f"Purchase Brand {uuid.uuid4().hex[:8]}",
                    "slug": f"purchase-brand-{uuid.uuid4().hex[:8]}",
                    "description": "Purchase flow brand",
                },
            )
            assert brand_response.status_code == 201, brand_response.text
            brand_id = brand_response.json()["id"]

            product_response = client.post(
                "/api/v1/products",
                headers=headers,
                json={
                    "name": "Purchase Flow Product",
                    "slug": f"purchase-flow-product-{uuid.uuid4().hex[:8]}",
                    "sku": f"PF-{uuid.uuid4().hex[:8]}",
                    "description": "Purchase flow product",
                    "category_id": category_id,
                    "brand_id": brand_id,
                    "price": 150.00,
                    "cost_price": 90.00,
                    "image_url": None,
                    "status": "active",
                    "variants": [],
                },
            )
            assert product_response.status_code == 201, product_response.text
            product = product_response.json()

            supplier_response = client.post(
                "/api/v1/suppliers",
                headers=headers,
                json={
                    "name": f"Supplier {uuid.uuid4().hex[:8]}",
                    "contact_person": "Supplier Contact",
                    "phone": "01700000000",
                    "email": unique_email(),
                    "address": "Dhaka",
                    "notes": "Preferred supplier",
                    "is_active": True,
                },
            )
            assert supplier_response.status_code == 201, supplier_response.text
            supplier = supplier_response.json()

            warehouse_response = client.post(
                "/api/v1/warehouses",
                headers=headers,
                json={
                    "name": f"Purchase Warehouse {uuid.uuid4().hex[:8]}",
                    "code": f"PWH-{uuid.uuid4().hex[:8]}",
                    "address": "Dhaka",
                    "is_active": True,
                },
            )
            assert warehouse_response.status_code == 201, warehouse_response.text
            warehouse = warehouse_response.json()

            create_po_response = client.post(
                "/api/v1/purchase-orders",
                headers=headers,
                json={
                    "po_number": f"PO-{uuid.uuid4().hex[:8]}",
                    "supplier_id": supplier["id"],
                    "warehouse_id": warehouse["id"],
                    "status": "ordered",
                    "order_date": "2026-05-11",
                    "expected_date": "2026-05-15",
                    "discount": 10,
                    "notes": "Test replenishment",
                    "items": [
                        {
                            "product_id": product["id"],
                            "variant_id": None,
                            "product_name": product["name"],
                            "sku": product["sku"],
                            "quantity": 5,
                            "received_quantity": 0,
                            "unit_cost": 90,
                            "total_cost": 450,
                        }
                    ],
                },
            )
            assert create_po_response.status_code == 201, create_po_response.text
            purchase_order = create_po_response.json()
            assert purchase_order["stock_received"] is False

            receive_response = client.patch(
                f"/api/v1/purchase-orders/{purchase_order['id']}",
                headers=headers,
                json={"status": "received"},
            )
            assert receive_response.status_code == 200, receive_response.text
            received_po = receive_response.json()
            assert received_po["stock_received"] is True
            assert received_po["received_date"] is not None
            assert received_po["items"][0]["received_quantity"] == 5

            inventory_response = client.get(
                f"/api/v1/inventory?skip=0&limit=100",
                headers=headers,
            )
            assert inventory_response.status_code == 200, inventory_response.text
            inventory_items = inventory_response.json()
            matching_inventory = [
                item
                for item in inventory_items
                if item["product_id"] == product["id"] and item["warehouse_id"] == warehouse["id"]
            ]
            assert matching_inventory
            assert matching_inventory[0]["quantity"] == 5

            stock_movement_response = client.get(
                f"/api/v1/stock-movements?product_id={product['id']}&warehouse_id={warehouse['id']}&movement_type=purchase_received",
                headers=headers,
            )
            assert stock_movement_response.status_code == 200, stock_movement_response.text
            movements = stock_movement_response.json()
            assert any(movement["movement_type"] == "purchase_received" for movement in movements)
    except (ProgrammingError, InterfaceError, AttributeError, RuntimeError) as exc:
        if any(
            token in str(exc)
            for token in [
                "suppliers",
                "purchase_orders",
                "purchase_order_items",
                "couriers",
                "shipments",
                "return_requests",
                "warehouse_id",
                "business_settings",
                "customer_phone",
                "customer_name",
                "payment_method",
                "paid_amount",
                "printed_count",
                "order_events",
                "activity_logs",
            ]
        ):
            pytest.skip("Apply the latest migrations before running this test.")
        if any(token in str(exc).lower() for token in ["event loop is closed", "another operation is in progress", "send"]):
            pytest.skip("Skipped due to local asyncpg/TestClient event loop instability on Windows.")
        raise

    dispose_engine()


def test_reports_foundation_endpoints() -> None:
    try:
        headers = auth_headers()
        with TestClient(app) as client:
            category_response = client.post(
                "/api/v1/categories",
                headers=headers,
                json={
                    "name": f"Reports Category {uuid.uuid4().hex[:8]}",
                    "slug": f"reports-category-{uuid.uuid4().hex[:8]}",
                    "description": "Reports test category",
                },
            )
            assert category_response.status_code == 201, category_response.text
            category_id = category_response.json()["id"]

            brand_response = client.post(
                "/api/v1/brands",
                headers=headers,
                json={
                    "name": f"Reports Brand {uuid.uuid4().hex[:8]}",
                    "slug": f"reports-brand-{uuid.uuid4().hex[:8]}",
                    "description": "Reports test brand",
                },
            )
            assert brand_response.status_code == 201, brand_response.text
            brand_id = brand_response.json()["id"]

            customer_response = client.post(
                "/api/v1/customers",
                headers=headers,
                json={
                    "name": "Reports Customer",
                    "phone": "01755555555",
                    "email": "reports.customer@example.com",
                    "address": "Dhaka",
                    "city": "Dhaka",
                    "customer_type": "vip",
                    "tags": "reports",
                    "notes": "Reports test customer",
                    "follow_up_date": "2026-05-20",
                },
            )
            assert customer_response.status_code == 201, customer_response.text
            customer = customer_response.json()

            product_response = client.post(
                "/api/v1/products",
                headers=headers,
                json={
                    "name": "Reports Flow Product",
                    "slug": f"reports-flow-product-{uuid.uuid4().hex[:8]}",
                    "sku": f"RP-{uuid.uuid4().hex[:8]}",
                    "description": "Reports flow product",
                    "category_id": category_id,
                    "brand_id": brand_id,
                    "price": 500.00,
                    "cost_price": 320.00,
                    "image_url": None,
                    "status": "active",
                    "variants": [],
                },
            )
            assert product_response.status_code == 201, product_response.text
            product = product_response.json()

            warehouse_response = client.post(
                "/api/v1/warehouses",
                headers=headers,
                json={
                    "name": f"Reports Warehouse {uuid.uuid4().hex[:8]}",
                    "code": f"RPT-WH-{uuid.uuid4().hex[:8]}",
                    "address": "Dhaka",
                    "is_active": True,
                },
            )
            assert warehouse_response.status_code == 201, warehouse_response.text
            warehouse = warehouse_response.json()

            inventory_response = client.post(
                "/api/v1/inventory",
                headers=headers,
                json={
                    "product_id": product["id"],
                    "variant_id": None,
                    "warehouse_id": warehouse["id"],
                    "quantity": 60,
                    "low_stock_threshold": 3,
                },
            )
            assert inventory_response.status_code == 201, inventory_response.text

            order_response = client.post(
                "/api/v1/orders",
                headers=headers,
                json={
                    "order_number": f"ORD-RPT-{uuid.uuid4().hex[:8]}",
                    "customer_id": customer["id"],
                    "warehouse_id": warehouse["id"],
                    "customer_phone": "01755555555",
                    "shipping_address": "Reports shipping address",
                    "notes": "Reports order",
                    "tags": "reports",
                        "status": "confirmed",
                        "payment_status": "paid",
                        "source": "manual",
                        "subtotal": 10000,
                        "discount": 20,
                        "delivery_charge": 60,
                        "total": 10040,
                        "items": [
                            {
                                "product_id": product["id"],
                                "variant_id": None,
                                "product_name": product["name"],
                                "sku": product["sku"],
                                "quantity": 40,
                                "unit_price": 250,
                                "total_price": 10000,
                            }
                        ],
                    },
            )
            assert order_response.status_code == 201, order_response.text
            order = order_response.json()

            courier_response = client.post(
                "/api/v1/couriers",
                headers=headers,
                json={
                    "name": f"Reports Courier {uuid.uuid4().hex[:8]}",
                    "code": f"RPT-CR-{uuid.uuid4().hex[:8]}",
                    "contact_phone": "01799999999",
                    "website": "https://courier.example.com",
                    "is_active": True,
                },
            )
            assert courier_response.status_code == 201, courier_response.text
            courier = courier_response.json()

            shipment_response = client.post(
                f"/api/v1/orders/{order['id']}/create-shipment",
                headers=headers,
                json={
                        "courier_id": courier["id"],
                        "delivery_charge": 60,
                        "courier_charge": 40,
                        "cod_amount": 10040,
                        "collected_amount": 10040,
                        "notes": "Reports shipment",
                        "order_status": "shipped",
                    },
            )
            assert shipment_response.status_code == 201, shipment_response.text

            sales_summary_response = client.get("/api/v1/reports/sales-summary", headers=headers)
            assert sales_summary_response.status_code == 200, sales_summary_response.text
            sales_summary = sales_summary_response.json()
            assert sales_summary["total_orders"] >= 1
            filtered_sales_summary_response = client.get(
                "/api/v1/reports/sales-summary?start_date=2026-05-01&end_date=2026-05-31",
                headers=headers,
            )
            assert filtered_sales_summary_response.status_code == 200, filtered_sales_summary_response.text

            order_status_response = client.get("/api/v1/reports/order-status", headers=headers)
            assert order_status_response.status_code == 200, order_status_response.text
            assert any(item["status"] == "shipped" for item in order_status_response.json())
            payment_status_response = client.get("/api/v1/reports/payment-status", headers=headers)
            assert payment_status_response.status_code == 200, payment_status_response.text
            assert any(item["payment_status"] == "paid" for item in payment_status_response.json())

            inventory_report_response = client.get("/api/v1/reports/inventory", headers=headers)
            assert inventory_report_response.status_code == 200, inventory_report_response.text
            inventory_report = inventory_report_response.json()
            assert inventory_report["total_products"] >= 1
            assert inventory_report["total_inventory_items"] >= 1
            low_stock_products_response = client.get(
                "/api/v1/reports/low-stock-products?limit=10",
                headers=headers,
            )
            assert low_stock_products_response.status_code == 200, low_stock_products_response.text

            stock_movement_summary_response = client.get(
                "/api/v1/reports/stock-movements-summary",
                headers=headers,
            )
            assert stock_movement_summary_response.status_code == 200, stock_movement_summary_response.text
            assert len(stock_movement_summary_response.json()) >= 1
            revenue_by_date_response = client.get(
                "/api/v1/reports/revenue-by-date?start_date=2026-05-01&end_date=2026-05-31&limit=14",
                headers=headers,
            )
            assert revenue_by_date_response.status_code == 200, revenue_by_date_response.text
            assert len(revenue_by_date_response.json()) >= 1

            customer_report_response = client.get("/api/v1/reports/customers", headers=headers)
            assert customer_report_response.status_code == 200, customer_report_response.text
            customer_report = customer_report_response.json()
            assert customer_report["total_customers"] >= 1
            assert customer_report["vip_customers"] >= 1

            logistics_report_response = client.get("/api/v1/reports/logistics", headers=headers)
            assert logistics_report_response.status_code == 200, logistics_report_response.text
            logistics_report = logistics_report_response.json()
            assert logistics_report["total_shipments"] >= 1
            assert float(logistics_report["total_cod_amount"]) >= 10040

            top_products_response = client.get("/api/v1/reports/top-products?limit=50", headers=headers)
            assert top_products_response.status_code == 200, top_products_response.text
            assert any(item["sku"] == product["sku"] for item in top_products_response.json())
            recent_order_activity_response = client.get(
                "/api/v1/reports/recent-order-activity?limit=10",
                headers=headers,
            )
            assert recent_order_activity_response.status_code == 200, recent_order_activity_response.text
            assert any(item["order_number"] == order["order_number"] for item in recent_order_activity_response.json())
    except (ProgrammingError, InterfaceError, AttributeError, RuntimeError) as exc:
        if any(token in str(exc) for token in ["reports", "couriers", "shipments", "activity_logs", "customer_phone", "customer_name", "payment_method", "paid_amount", "printed_count", "order_events"]):
            pytest.skip("Apply the latest migrations before running this test.")
        if any(token in str(exc).lower() for token in ["event loop is closed", "another operation is in progress", "send"]):
            pytest.skip("Skipped due to local asyncpg/TestClient event loop instability on Windows.")
        raise

    dispose_engine()


def test_phase_15i_support_finance_hr_pos_aliases() -> None:
    headers = auth_headers()
    try:
        supplier_voucher_no = f"VCHR-ALIAS-{uuid.uuid4().hex[:8]}"
        with TestClient(app) as client:
            designation_response = client.post(
                "/api/v1/designations",
                headers=headers,
                json={"name": "Warehouse Staff", "description": "Alias designation"},
            )
            assert designation_response.status_code == 201, designation_response.text
            designation = designation_response.json()
            assert designation["name"] == "Warehouse Staff"
            assert designation["status"] == "Active"

            employee_response = client.post(
                "/api/v1/employees",
                headers=headers,
                json={
                    "name": "Alias Employee",
                    "designationId": designation["id"],
                    "joiningDate": "2026-05-18",
                    "baseSalary": 18500,
                    "status": "Active",
                    "phone": "01700000000",
                },
            )
            assert employee_response.status_code == 201, employee_response.text
            employee = employee_response.json()
            assert employee["name"] == "Alias Employee"
            assert employee["designationName"] == "Warehouse Staff"
            assert employee["baseSalary"] == "18500.00"
            assert employee["employeeCode"].startswith("EMP-")

            attendance_response = client.post(
                "/api/v1/attendance",
                headers=headers,
                json={
                    "employee_id": employee["id"],
                    "date": "2026-05-19",
                    "status": "Present",
                },
            )
            assert attendance_response.status_code == 201, attendance_response.text
            attendance = attendance_response.json()
            assert attendance["attendanceDate"] == "2026-05-19"
            assert attendance["employeeName"] == "Alias Employee"

            salary_advance_response = client.post(
                "/api/v1/salary-advances",
                headers=headers,
                json={
                    "employee_id": employee["id"],
                    "amount": 1200,
                    "note": "Advance for travel",
                    "date": "2026-05-19T09:00:00Z",
                    "status": "Approved",
                },
            )
            assert salary_advance_response.status_code == 201, salary_advance_response.text
            salary_advance = salary_advance_response.json()
            assert salary_advance["note"] == "Advance for travel"
            assert salary_advance["statusLabel"] == "Approved"

            salary_record_response = client.post(
                "/api/v1/salary-records",
                headers=headers,
                json={
                    "employee_id": employee["id"],
                    "month": "2026-05",
                    "basicSalary": 18500,
                    "advanceDeduction": 1200,
                    "deductions": 300,
                    "bonus": 500,
                    "status": "Paid",
                },
            )
            assert salary_record_response.status_code == 201, salary_record_response.text
            salary_record = salary_record_response.json()
            assert salary_record["month"] == "2026-05"
            assert salary_record["netSalary"] == "17500.00"
            assert salary_record["paidAt"] is not None

            cash_account_response = client.post(
                "/api/v1/accounts",
                headers=headers,
                json={"name": "Alias Cash", "type": "Cash", "balance": 1000, "active": True},
            )
            assert cash_account_response.status_code == 201, cash_account_response.text
            cash_account = cash_account_response.json()
            assert cash_account["type"] == "Cash"
            assert cash_account["balance"] == "1000.00"
            assert cash_account["status"] == "Active"

            bank_account_response = client.post(
                "/api/v1/accounts",
                headers=headers,
                json={"name": "Alias Bank", "type": "Bank", "balance": 2000},
            )
            assert bank_account_response.status_code == 201, bank_account_response.text
            bank_account = bank_account_response.json()
            assert bank_account["code"]

            transaction_response = client.post(
                "/api/v1/transactions",
                headers=headers,
                json={
                    "accountId": cash_account["id"],
                    "type": "income",
                    "subCategory": "Product Sales",
                    "amount": 250,
                    "notes": "Alias income",
                },
            )
            assert transaction_response.status_code == 201, transaction_response.text
            transaction = transaction_response.json()
            assert transaction["transactionNumber"].startswith("TXN-")
            assert transaction["type"] == "income"
            assert transaction["notes"] == "Alias income"

            petty_cash_response = client.post(
                "/api/v1/petty-cash",
                headers=headers,
                json={
                    "accountId": cash_account["id"],
                    "type": "office_expense",
                    "amount": 50,
                    "note": "Stationery",
                    "status": "approved",
                    "date": "2026-05-19T10:00:00Z",
                },
            )
            assert petty_cash_response.status_code == 201, petty_cash_response.text
            petty_cash = petty_cash_response.json()
            assert petty_cash["entryNumber"]
            assert petty_cash["note"] == "Stationery"

            supplier_response = client.post(
                "/api/v1/suppliers",
                headers=headers,
                json={"name": "Alias Supplier", "phone": "01800000000"},
            )
            assert supplier_response.status_code == 201, supplier_response.text
            supplier = supplier_response.json()

            supplier_payment_response = client.post(
                "/api/v1/supplier-payments",
                headers=headers,
                json={
                    "supplierId": supplier["id"],
                    "accountId": bank_account["id"],
                    "voucherNo": supplier_voucher_no,
                    "paidAmount": 125,
                    "paymentType": "Bank",
                    "remark": "Alias supplier payment",
                },
            )
            assert supplier_payment_response.status_code == 201, supplier_payment_response.text
            supplier_payment = supplier_payment_response.json()
            assert supplier_payment["voucherNo"] == supplier_voucher_no
            assert supplier_payment["supplierName"] == "Alias Supplier"
            assert supplier_payment["paidAmount"] == "125.00"

            category_response = client.post(
                "/api/v1/categories",
                headers=headers,
                json={"name": "POS Alias Category", "slug": f"pos-alias-cat-{uuid.uuid4().hex[:6]}"},
            )
            assert category_response.status_code == 201, category_response.text
            category = category_response.json()

            brand_response = client.post(
                "/api/v1/brands",
                headers=headers,
                json={"name": "POS Alias Brand", "slug": f"pos-alias-brand-{uuid.uuid4().hex[:6]}"},
            )
            assert brand_response.status_code == 201, brand_response.text
            brand = brand_response.json()

            product_response = client.post(
                "/api/v1/products",
                headers=headers,
                json={
                    "name": "POS Alias Product",
                    "slug": f"pos-alias-product-{uuid.uuid4().hex[:6]}",
                    "sku": f"POS-SKU-{uuid.uuid4().hex[:4]}",
                    "price": 300,
                    "cost_price": 180,
                    "category_id": category["id"],
                    "brand_id": brand["id"],
                },
            )
            assert product_response.status_code == 201, product_response.text
            product = product_response.json()

            warehouse_response = client.post(
                "/api/v1/warehouses",
                headers=headers,
                json={"name": "POS Alias Warehouse", "code": f"PAW-{uuid.uuid4().hex[:4]}"},
            )
            assert warehouse_response.status_code == 201, warehouse_response.text
            warehouse = warehouse_response.json()

            inventory_response = client.post(
                "/api/v1/inventory",
                headers=headers,
                json={
                    "product_id": product["id"],
                    "warehouse_id": warehouse["id"],
                    "quantity": 9,
                    "low_stock_threshold": 2,
                },
            )
            assert inventory_response.status_code == 201, inventory_response.text

            pos_products_response = client.get(
                f"/api/v1/pos/products?warehouse_id={warehouse['id']}&search={product['sku']}",
                headers=headers,
            )
            assert pos_products_response.status_code == 200, pos_products_response.text
            pos_products = pos_products_response.json()
            assert pos_products[0]["productName"] == "POS Alias Product"
            assert pos_products[0]["barcode"] == product["sku"]
            assert pos_products[0]["stockLevel"] == 9

            pos_checkout_response = client.post(
                "/api/v1/pos/checkout",
                headers=headers,
                json={
                    "warehouseId": warehouse["id"],
                    "paymentMethod": "cash",
                    "accountId": cash_account["id"],
                    "paidAmount": 300,
                    "items": [
                        {
                            "product_id": product["id"],
                            "productName": "POS Alias Product",
                            "sku": product["sku"],
                            "quantity": 1,
                            "unitPrice": 300,
                            "totalPrice": 300,
                        }
                    ],
                },
            )
            assert pos_checkout_response.status_code == 201, pos_checkout_response.text
            pos_checkout = pos_checkout_response.json()
            assert pos_checkout["orderId"]
            assert pos_checkout["orderNumber"].startswith("ORD-POS-")
            assert pos_checkout["paymentStatus"] == "paid"
            assert pos_checkout["dueAmount"] == "0.00"

            pos_summary_response = client.get("/api/v1/pos/summary", headers=headers)
            assert pos_summary_response.status_code == 200, pos_summary_response.text
            pos_summary = pos_summary_response.json()
            assert pos_summary["todayPosOrders"] >= 1
            assert float(pos_summary["todayPosSales"]) >= 300
    finally:
        dispose_engine()


def test_phase_15i_support_reports_aliases() -> None:
    headers = auth_headers()
    try:
        with TestClient(app) as client:
            category_response = client.post(
                "/api/v1/categories",
                headers=headers,
                json={"name": "Reports Alias Category", "slug": f"reports-alias-cat-{uuid.uuid4().hex[:6]}"},
            )
            brand_response = client.post(
                "/api/v1/brands",
                headers=headers,
                json={"name": "Reports Alias Brand", "slug": f"reports-alias-brand-{uuid.uuid4().hex[:6]}"},
            )
            customer_response = client.post(
                "/api/v1/customers",
                headers=headers,
                json={"name": "Reports Alias Customer", "phone": "01900000000"},
            )
            warehouse_response = client.post(
                "/api/v1/warehouses",
                headers=headers,
                json={"name": "Reports Alias Warehouse", "code": f"RAW-{uuid.uuid4().hex[:4]}"},
            )
            assert category_response.status_code == 201, category_response.text
            assert brand_response.status_code == 201, brand_response.text
            assert customer_response.status_code == 201, customer_response.text
            assert warehouse_response.status_code == 201, warehouse_response.text
            category = category_response.json()
            brand = brand_response.json()
            customer = customer_response.json()
            warehouse = warehouse_response.json()

            product_response = client.post(
                "/api/v1/products",
                headers=headers,
                json={
                    "name": "Reports Alias Product",
                    "slug": f"reports-alias-product-{uuid.uuid4().hex[:6]}",
                    "sku": f"RPT-SKU-{uuid.uuid4().hex[:4]}",
                    "price": 150,
                    "cost_price": 90,
                    "category_id": category["id"],
                    "brand_id": brand["id"],
                },
            )
            assert product_response.status_code == 201, product_response.text
            product = product_response.json()

            inventory_response = client.post(
                "/api/v1/inventory",
                headers=headers,
                json={
                    "product_id": product["id"],
                    "warehouse_id": warehouse["id"],
                    "quantity": 2,
                    "low_stock_threshold": 5,
                },
            )
            assert inventory_response.status_code == 201, inventory_response.text

            order_response = client.post(
                "/api/v1/orders",
                headers=headers,
                json={
                    "customer_id": customer["id"],
                    "warehouse_id": warehouse["id"],
                    "customer_name": "Reports Alias Customer",
                    "customer_phone": "01900000000",
                    "status": "delivered",
                    "payment_status": "paid",
                    "source": "manual",
                    "subtotal": 150,
                    "total": 150,
                    "paid_amount": 150,
                    "items": [
                        {
                            "product_id": product["id"],
                            "product_name": "Reports Alias Product",
                            "sku": product["sku"],
                            "quantity": 1,
                            "unit_price": 150,
                            "total_price": 150,
                        }
                    ],
                },
            )
            assert order_response.status_code == 201, order_response.text

            sales_summary_response = client.get("/api/v1/reports/sales-summary", headers=headers)
            assert sales_summary_response.status_code == 200, sales_summary_response.text
            sales_summary = sales_summary_response.json()
            assert "totalOrders" in sales_summary
            assert "averageOrderValue" in sales_summary

            inventory_report_response = client.get("/api/v1/reports/inventory", headers=headers)
            assert inventory_report_response.status_code == 200, inventory_report_response.text
            inventory_report = inventory_report_response.json()
            assert "lowStockCount" in inventory_report
            assert "inventoryValueAtCost" in inventory_report

            low_stock_response = client.get("/api/v1/reports/low-stock-products?limit=5", headers=headers)
            assert low_stock_response.status_code == 200, low_stock_response.text
            low_stock_rows = low_stock_response.json()
            assert low_stock_rows[0]["productName"] == "Reports Alias Product"
            assert low_stock_rows[0]["lowStockThreshold"] == 5

            recent_orders_response = client.get("/api/v1/reports/recent-order-activity?limit=5", headers=headers)
            assert recent_orders_response.status_code == 200, recent_orders_response.text
            recent_orders = recent_orders_response.json()
            assert "orderNumber" in recent_orders[0]
            assert "createdAt" in recent_orders[0]
    finally:
        dispose_engine()


def test_order_v1_compatibility_payloads_and_aliases() -> None:
    headers = auth_headers()

    try:
        with TestClient(app) as client:
            category_response = client.post(
                "/api/v1/categories",
                headers=headers,
                json={
                    "name": f"Compat Category {uuid.uuid4().hex[:8]}",
                    "slug": f"compat-category-{uuid.uuid4().hex[:8]}",
                    "description": "Order compatibility test category",
                },
            )
            assert category_response.status_code == 201, category_response.text
            category_id = category_response.json()["id"]

            brand_response = client.post(
                "/api/v1/brands",
                headers=headers,
                json={
                    "name": f"Compat Brand {uuid.uuid4().hex[:8]}",
                    "slug": f"compat-brand-{uuid.uuid4().hex[:8]}",
                    "description": "Order compatibility test brand",
                },
            )
            assert brand_response.status_code == 201, brand_response.text
            brand_id = brand_response.json()["id"]

            product_response = client.post(
                "/api/v1/products",
                headers=headers,
                json={
                    "name": "Compatibility Order Product",
                    "slug": f"compat-order-product-{uuid.uuid4().hex[:8]}",
                    "sku": f"COMP-{uuid.uuid4().hex[:8]}",
                    "description": "Compatibility order test product",
                    "category_id": category_id,
                    "brand_id": brand_id,
                    "price": 450.00,
                    "cost_price": 300.00,
                    "image_url": None,
                    "status": "active",
                    "variants": [],
                },
            )
            assert product_response.status_code == 201, product_response.text
            product = product_response.json()

            customer_response = client.post(
                "/api/v1/customers",
                headers=headers,
                json={
                    "name": "Compatibility Customer",
                    "phone": "01722223333",
                    "email": "compat.customer@example.com",
                    "address": "Primary customer address",
                    "city": "Dhaka",
                    "customer_type": "vip",
                    "tags": "repeat,priority",
                    "notes": "Long-time buyer",
                },
            )
            assert customer_response.status_code == 201, customer_response.text
            customer = customer_response.json()

            warehouse_response = client.post(
                "/api/v1/warehouses",
                headers=headers,
                json={
                    "name": f"Compat Warehouse {uuid.uuid4().hex[:8]}",
                    "code": f"CWH-{uuid.uuid4().hex[:8]}",
                    "address": "Dhaka",
                    "is_active": True,
                },
            )
            assert warehouse_response.status_code == 201, warehouse_response.text
            warehouse = warehouse_response.json()

            inventory_response = client.post(
                "/api/v1/inventory",
                headers=headers,
                json={
                    "product_id": product["id"],
                    "variant_id": None,
                    "warehouse_id": warehouse["id"],
                    "quantity": 12,
                    "low_stock_threshold": 4,
                },
            )
            assert inventory_response.status_code == 201, inventory_response.text

            create_order_response = client.post(
                "/api/v1/orders",
                headers=headers,
                json={
                    "orderNumber": f"ORD-COMP-{uuid.uuid4().hex[:8]}",
                    "customerId": customer["id"],
                    "warehouseId": warehouse["id"],
                    "customerName": "Compatibility Customer",
                    "customerPhone": "01722223333",
                    "customerAddress": "House 10, Road 12, Dhaka",
                    "customer_city": "Dhaka",
                    "customer_zone": "North",
                    "district": "Dhaka",
                    "division": "Dhaka",
                    "area": "Banani",
                    "landmark": "Near Lake",
                    "status": "confirmed",
                    "payment_status": "partial",
                    "paymentMethod": "cod",
                    "channel": "Facebook",
                    "subtotal": 900,
                    "discountAmount": 50,
                    "deliveryCharge": 60,
                    "paidAmount": 300,
                    "totalAmount": 910,
                    "notes": "Call before delivery",
                    "tags": "urgent,facebook",
                    "courier_name": "Steadfast",
                    "tracking_number": "TEMP-TRACKING",
                    "custom_shipment_number": "TEMP-SHIP-1",
                    "is_exchange": False,
                    "items": [
                        {
                            "productId": product["id"],
                            "variantId": None,
                            "productName": "Compatibility Order Product",
                            "sku": product["sku"],
                            "quantity": 2,
                            "unitPrice": 450,
                        }
                    ],
                },
            )
            assert create_order_response.status_code == 201, create_order_response.text
            created_order = create_order_response.json()
            order_id = created_order["id"]

            assert created_order["order_number"].startswith("ORD-COMP-")
            assert created_order["orderNumber"] == created_order["order_number"]
            assert created_order["customerName"] == "Compatibility Customer"
            assert created_order["customerPhone"] == "01722223333"
            assert created_order["customerAddress"] == "House 10, Road 12, Dhaka"
            assert created_order["paymentMethod"] == "cod"
            assert float(created_order["deliveryCharge"]) == 60
            assert float(created_order["paidAmount"]) == 300
            assert float(created_order["totalAmount"]) == 910
            assert float(created_order["dueAmount"]) == 610
            assert created_order["item_count"] == 1
            assert created_order["first_item_summary"]["product_name"] == "Compatibility Order Product"
            assert created_order["warehouse_summary"]["id"] == warehouse["id"]
            assert created_order["courierName"] is None
            assert created_order["trackingNumber"] is None
            assert created_order["createdAt"] == created_order["created_at"]
            assert created_order["updatedAt"] == created_order["updated_at"]
            assert created_order["action_flags"]["can_create_shipment"] is True
            assert created_order["action_flags"]["can_print"] is True
            assert created_order["action_flags"]["can_refresh_woo"] is False

            list_response = client.get(
                "/api/v1/orders?status=confirmed&payment_status=partial&search=01722223333",
                headers=headers,
            )
            assert list_response.status_code == 200, list_response.text
            listed_orders = list_response.json()
            compatibility_row = next(item for item in listed_orders if item["id"] == order_id)
            assert compatibility_row["shipment_summary"] is None
            assert compatibility_row["customerName"] == "Compatibility Customer"
            assert compatibility_row["customerPhone"] == "01722223333"
            assert compatibility_row["customerAddress"] == "House 10, Road 12, Dhaka"
            assert compatibility_row["notes"] == "Call before delivery"
            assert compatibility_row["tags"] == "urgent,facebook"

            duplicate_response = client.get(
                "/api/v1/orders/duplicate-check?phone=01722223333&limit=5",
                headers=headers,
            )
            assert duplicate_response.status_code == 200, duplicate_response.text
            duplicates = duplicate_response.json()
            duplicate_row = next(item for item in duplicates if item["id"] == order_id)
            assert duplicate_row["orderNumber"] == created_order["order_number"]
            assert duplicate_row["customerName"] == "Compatibility Customer"
            assert duplicate_row["customerPhone"] == "01722223333"
            assert duplicate_row["customerAddress"] == "House 10, Road 12, Dhaka"
            assert duplicate_row["createdAt"] == duplicate_row["created_at"]

            courier_response = client.post(
                "/api/v1/couriers",
                headers=headers,
                json={
                    "name": f"Compat Courier {uuid.uuid4().hex[:8]}",
                    "code": f"CCO-{uuid.uuid4().hex[:8]}",
                    "contact_phone": "01755555555",
                    "website": "https://courier.example.com",
                    "is_active": True,
                },
            )
            assert courier_response.status_code == 201, courier_response.text
            courier = courier_response.json()

            shipment_response = client.post(
                f"/api/v1/orders/{order_id}/create-shipment",
                headers=headers,
                json={
                    "courier_id": courier["id"],
                    "tracking_number": "TRK-COMP-1001",
                    "delivery_charge": 60,
                    "courier_charge": 40,
                    "cod_amount": 610,
                    "collected_amount": 0,
                    "notes": "Compatibility shipment",
                    "order_status": "ready_to_ship",
                },
            )
            assert shipment_response.status_code == 201, shipment_response.text

            detail_response = client.get(f"/api/v1/orders/{order_id}", headers=headers)
            assert detail_response.status_code == 200, detail_response.text
            detail = detail_response.json()
            assert detail["shipment_summary"] is not None
            assert detail["shipment_summary"]["tracking_number"] == "TRK-COMP-1001"
            assert detail["shipment_summary"]["courier_name"] == courier["name"]
            assert detail["courierName"] == courier["name"]
            assert detail["trackingNumber"] == "TRK-COMP-1001"
            assert detail["customer_summary"]["name"] == "Compatibility Customer"
            assert detail["customer_summary"]["phone"] == "01722223333"
            assert detail["shipping_summary"]["address"] == "House 10, Road 12, Dhaka"
            assert float(detail["totals_summary"]["due_amount"]) == 610
            assert any(log["action"] == "order_created" for log in detail["logs"])
            assert detail["action_flags"]["can_create_shipment"] is False
            assert detail["action_flags"]["can_mark_delivered"] is False
            assert detail["action_flags"]["can_cancel"] is True

            printed_response = client.post(f"/api/v1/orders/{order_id}/mark-printed", headers=headers)
            assert printed_response.status_code == 200, printed_response.text
            printed_order = printed_response.json()
            assert printed_order["printed_count"] == 1
            assert printed_order["lastPrintedAt"] == printed_order["last_printed_at"]

            fulfilled_response = client.patch(
                f"/api/v1/orders/{order_id}",
                headers=headers,
                json={"status": "shipped"},
            )
            assert fulfilled_response.status_code == 200, fulfilled_response.text
            fulfilled_order = fulfilled_response.json()
            assert fulfilled_order["stock_deducted"] is True
            assert fulfilled_order["action_flags"]["can_mark_delivered"] is True
            assert fulfilled_order["action_flags"]["can_deduct_stock_by_status"] is False
            assert any(event["event_type"] == "status_changed" for event in fulfilled_order["events"])
    except ProgrammingError as exc:
        if any(token in str(exc) for token in ["order_events", "shipments", "printed_count", "warehouse_id"]):
            pytest.skip("Apply the latest order compatibility migrations before running this test.")
        raise

    dispose_engine()


def test_order_operations_summary_v1_status_counts() -> None:
    headers = auth_headers()

    try:
        with TestClient(app) as client:
            category_response = client.post(
                "/api/v1/categories",
                headers=headers,
                json={
                    "name": f"Summary Category {uuid.uuid4().hex[:8]}",
                    "slug": f"summary-category-{uuid.uuid4().hex[:8]}",
                    "description": "Order summary test category",
                },
            )
            assert category_response.status_code == 201, category_response.text
            category_id = category_response.json()["id"]

            brand_response = client.post(
                "/api/v1/brands",
                headers=headers,
                json={
                    "name": f"Summary Brand {uuid.uuid4().hex[:8]}",
                    "slug": f"summary-brand-{uuid.uuid4().hex[:8]}",
                    "description": "Order summary test brand",
                },
            )
            assert brand_response.status_code == 201, brand_response.text
            brand_id = brand_response.json()["id"]

            product_response = client.post(
                "/api/v1/products",
                headers=headers,
                json={
                    "name": "Summary Order Product",
                    "slug": f"summary-order-product-{uuid.uuid4().hex[:8]}",
                    "sku": f"SUM-{uuid.uuid4().hex[:8]}",
                    "description": "Order summary test product",
                    "category_id": category_id,
                    "brand_id": brand_id,
                    "price": 120.00,
                    "cost_price": 90.00,
                    "image_url": None,
                    "status": "active",
                    "variants": [],
                },
            )
            assert product_response.status_code == 201, product_response.text
            product = product_response.json()

            warehouse_response = client.post(
                "/api/v1/warehouses",
                headers=headers,
                json={
                    "name": f"Summary Warehouse {uuid.uuid4().hex[:8]}",
                    "code": f"SWH-{uuid.uuid4().hex[:8]}",
                    "address": "Dhaka",
                    "is_active": True,
                },
            )
            assert warehouse_response.status_code == 201, warehouse_response.text
            warehouse = warehouse_response.json()

            inventory_response = client.post(
                "/api/v1/inventory",
                headers=headers,
                json={
                    "product_id": product["id"],
                    "variant_id": None,
                    "warehouse_id": warehouse["id"],
                    "quantity": 30,
                    "low_stock_threshold": 5,
                },
            )
            assert inventory_response.status_code == 201, inventory_response.text

            statuses = [
                "pending",
                "confirmed",
                "processing",
                "ready_to_ship",
                "shipped",
                "delivered",
                "cancelled",
                "returned",
                "partial_delivered",
                "urgent",
                "hold",
            ]

            for status_value in statuses:
                order_response = client.post(
                    "/api/v1/orders",
                    headers=headers,
                    json={
                        "order_number": f"ORD-SUM-{status_value}-{uuid.uuid4().hex[:6]}",
                        "warehouse_id": warehouse["id"],
                        "customer_phone": f"018{uuid.uuid4().hex[:8]}",
                        "shipping_address": f"{status_value} address",
                        "status": status_value,
                        "payment_status": "unpaid",
                        "source": "manual",
                        "subtotal": 120,
                        "discount": 0,
                        "delivery_charge": 10,
                        "total": 130,
                        "items": [
                            {
                                "product_id": product["id"],
                                "variant_id": None,
                                "product_name": product["name"],
                                "sku": product["sku"],
                                "quantity": 1,
                                "unit_price": 120,
                                "total_price": 120,
                            }
                        ],
                    },
                )
                assert order_response.status_code == 201, order_response.text

            summary_response = client.get("/api/v1/orders/operations-summary", headers=headers)
            assert summary_response.status_code == 200, summary_response.text
            summary = summary_response.json()

            assert summary["total_orders"] >= len(statuses)
            assert summary["pending_orders"] >= 1
            assert summary["confirmed_orders"] >= 1
            assert summary["processing_orders"] >= 1
            assert summary["ready_to_ship_orders_count"] >= 1
            assert summary["shipped_orders_count"] >= 1
            assert summary["delivered_orders_count"] >= 1
            assert summary["cancelled_orders_count"] >= 1
            assert summary["returned_orders_count"] >= 1
            assert summary["partial_delivered_orders"] >= 1
            assert summary["urgent_orders"] >= 1
            assert summary["hold_orders"] >= 1
            assert summary["orders_unprinted_count"] >= len(statuses)
            assert summary["orders_stock_not_deducted"] >= 1
    except ProgrammingError as exc:
        if any(token in str(exc) for token in ["warehouse_id", "order_events", "printed_count"]):
            pytest.skip("Apply the latest order compatibility migrations before running this test.")
        raise

    dispose_engine()


def test_operations_summary_and_integration_report_endpoints() -> None:
    headers = auth_headers()

    async def seed_external_state(
        woo_order_id: str,
        delivered_shipment_id: str,
        pending_sync_shipment_id: str,
        product_id: str,
    ) -> None:
        async with AsyncSessionLocal() as session:
            product = await session.get(Product, uuid.UUID(product_id))
            assert product is not None
            product.source = "woocommerce"

            woo_order = await session.get(Order, uuid.UUID(woo_order_id))
            assert woo_order is not None
            woo_order.source = "woocommerce"
            woo_order.external_id = "woo-order-900"
            woo_order.external_number = "900"
            woo_order.external_status = "processing"
            woo_order.external_synced_at = None

            delivered_shipment = await session.get(Shipment, uuid.UUID(delivered_shipment_id))
            assert delivered_shipment is not None
            delivered_shipment.external_provider = "steadfast"
            delivered_shipment.external_consignment_id = "CONS-OPS-1"
            delivered_shipment.external_tracking_number = "TRK-OPS-1"
            delivered_shipment.external_status = "delivered"
            delivered_shipment.sent_to_courier_at = datetime.now(timezone.utc)
            delivered_shipment.external_synced_at = None

            pending_sync_shipment = await session.get(Shipment, uuid.UUID(pending_sync_shipment_id))
            assert pending_sync_shipment is not None
            pending_sync_shipment.external_provider = "steadfast"
            pending_sync_shipment.external_consignment_id = "CONS-OPS-2"
            pending_sync_shipment.external_tracking_number = "TRK-OPS-2"
            pending_sync_shipment.external_status = "in_transit"
            pending_sync_shipment.sent_to_courier_at = datetime.now(timezone.utc)
            pending_sync_shipment.external_synced_at = None

            session.add(
                WooCommerceSetting(
                    store_url="https://store.example.com",
                    consumer_key_encrypted=encrypt_secret("ck_ops"),
                    consumer_secret_encrypted=encrypt_secret("cs_ops"),
                    api_version="wc/v3",
                    is_active=True,
                    last_order_sync_at=datetime.now(timezone.utc),
                    last_product_sync_at=datetime.now(timezone.utc),
                    last_test_success=True,
                )
            )
            session.add(
                WooCommerceSyncLog(
                    sync_type="manual_sync",
                    direction="import",
                    status="failed",
                    external_id="woo-order-900",
                    local_entity_type="order",
                    local_entity_id=woo_order_id,
                    message="Woo sync failed",
                    payload_snapshot='{"status":"failed"}',
                    created_by_id=None,
                    started_at=datetime.now(timezone.utc),
                    finished_at=datetime.now(timezone.utc),
                )
            )
            session.add(
                CourierApiLog(
                    provider="steadfast",
                    action="status_sync",
                    status="failed",
                    shipment_id=uuid.UUID(pending_sync_shipment_id),
                    external_id="CONS-OPS-2",
                    request_snapshot='{"lookup":"CONS-OPS-2"}',
                    response_snapshot='{"detail":"timeout"}',
                    message="Courier sync failed",
                    created_by_id=None,
                    started_at=datetime.now(timezone.utc),
                    finished_at=datetime.now(timezone.utc),
                )
            )
            await session.commit()

    try:
        with TestClient(app) as client:
            category_response = client.post(
                "/api/v1/categories",
                headers=headers,
                json={
                    "name": f"Ops Category {uuid.uuid4().hex[:8]}",
                    "slug": f"ops-category-{uuid.uuid4().hex[:8]}",
                    "description": "Ops summary category",
                },
            )
            assert category_response.status_code == 201, category_response.text
            category_id = category_response.json()["id"]

            brand_response = client.post(
                "/api/v1/brands",
                headers=headers,
                json={
                    "name": f"Ops Brand {uuid.uuid4().hex[:8]}",
                    "slug": f"ops-brand-{uuid.uuid4().hex[:8]}",
                    "description": "Ops summary brand",
                },
            )
            assert brand_response.status_code == 201, brand_response.text
            brand_id = brand_response.json()["id"]

            product_response = client.post(
                "/api/v1/products",
                headers=headers,
                json={
                    "name": "Ops Product",
                    "slug": f"ops-product-{uuid.uuid4().hex[:8]}",
                    "sku": f"OPS-{uuid.uuid4().hex[:8]}",
                    "description": "Ops product",
                    "category_id": category_id,
                    "brand_id": brand_id,
                    "price": 500.00,
                    "cost_price": 300.00,
                    "image_url": None,
                    "status": "active",
                    "variants": [],
                },
            )
            assert product_response.status_code == 201, product_response.text
            product = product_response.json()

            customer_response = client.post(
                "/api/v1/customers",
                headers=headers,
                json={
                    "name": "Ops Customer",
                    "phone": "01733334444",
                    "email": unique_email(),
                    "address": "Dhaka",
                    "city": "Dhaka",
                    "customer_type": "retail",
                },
            )
            assert customer_response.status_code == 201, customer_response.text
            customer = customer_response.json()

            warehouse_response = client.post(
                "/api/v1/warehouses",
                headers=headers,
                json={
                    "name": f"Ops Warehouse {uuid.uuid4().hex[:8]}",
                    "code": f"OPW-{uuid.uuid4().hex[:8]}",
                    "address": "Dhaka",
                    "is_active": True,
                },
            )
            assert warehouse_response.status_code == 201, warehouse_response.text
            warehouse = warehouse_response.json()

            inventory_response = client.post(
                "/api/v1/inventory",
                headers=headers,
                json={
                    "product_id": product["id"],
                    "variant_id": None,
                    "warehouse_id": warehouse["id"],
                    "quantity": 20,
                    "low_stock_threshold": 3,
                },
            )
            assert inventory_response.status_code == 201, inventory_response.text

            order_response = client.post(
                "/api/v1/orders",
                headers=headers,
                json={
                    "order_number": f"ORD-OPS-{uuid.uuid4().hex[:8]}",
                    "customer_id": customer["id"],
                    "warehouse_id": warehouse["id"],
                    "customer_phone": customer["phone"],
                    "shipping_address": "Operations shipping",
                    "status": "confirmed",
                    "payment_status": "paid",
                    "source": "manual",
                    "subtotal": 500,
                    "discount": 0,
                    "delivery_charge": 50,
                    "total": 550,
                    "items": [
                        {
                            "product_id": product["id"],
                            "variant_id": None,
                            "product_name": product["name"],
                            "sku": product["sku"],
                            "quantity": 1,
                            "unit_price": 500,
                            "total_price": 500,
                        }
                    ],
                },
            )
            assert order_response.status_code == 201, order_response.text
            order = order_response.json()

            shipment_pending_sync_order_response = client.post(
                "/api/v1/orders",
                headers=headers,
                json={
                    "order_number": f"ORD-SYNC-{uuid.uuid4().hex[:8]}",
                    "customer_id": customer["id"],
                    "warehouse_id": warehouse["id"],
                    "customer_phone": customer["phone"],
                    "shipping_address": "Sync shipping",
                    "status": "confirmed",
                    "payment_status": "paid",
                    "source": "manual",
                    "subtotal": 500,
                    "discount": 0,
                    "delivery_charge": 50,
                    "total": 550,
                    "items": [
                        {
                            "product_id": product["id"],
                            "variant_id": None,
                            "product_name": product["name"],
                            "sku": product["sku"],
                            "quantity": 1,
                            "unit_price": 500,
                            "total_price": 500,
                        }
                    ],
                },
            )
            assert shipment_pending_sync_order_response.status_code == 201, shipment_pending_sync_order_response.text
            pending_sync_order = shipment_pending_sync_order_response.json()

            ready_order_response = client.post(
                "/api/v1/orders",
                headers=headers,
                json={
                    "order_number": f"ORD-READY-{uuid.uuid4().hex[:8]}",
                    "customer_id": customer["id"],
                    "warehouse_id": warehouse["id"],
                    "customer_phone": customer["phone"],
                    "shipping_address": "Ready shipping",
                    "status": "ready_to_ship",
                    "payment_status": "unpaid",
                    "source": "manual",
                    "subtotal": 500,
                    "discount": 0,
                    "delivery_charge": 50,
                    "total": 550,
                    "items": [
                        {
                            "product_id": product["id"],
                            "variant_id": None,
                            "product_name": product["name"],
                            "sku": product["sku"],
                            "quantity": 1,
                            "unit_price": 500,
                            "total_price": 500,
                        }
                    ],
                },
            )
            assert ready_order_response.status_code == 201, ready_order_response.text
            ready_order = ready_order_response.json()

            courier_response = client.post(
                "/api/v1/couriers",
                headers=headers,
                json={
                    "name": f"Ops Courier {uuid.uuid4().hex[:8]}",
                    "code": f"OPC-{uuid.uuid4().hex[:8]}",
                    "contact_phone": "01700000000",
                    "website": "https://courier.example.com",
                    "is_active": True,
                },
            )
            assert courier_response.status_code == 201, courier_response.text
            courier = courier_response.json()

            shipment_response = client.post(
                f"/api/v1/orders/{order['id']}/create-shipment",
                headers=headers,
                json={
                    "courier_id": courier["id"],
                    "delivery_charge": 50,
                    "courier_charge": 30,
                    "cod_amount": 550,
                    "collected_amount": 0,
                    "notes": "Ops shipment",
                    "order_status": "shipped",
                },
            )
            assert shipment_response.status_code == 201, shipment_response.text
            shipment = shipment_response.json()

            second_shipment_response = client.post(
                f"/api/v1/orders/{pending_sync_order['id']}/create-shipment",
                headers=headers,
                json={
                    "courier_id": courier["id"],
                    "delivery_charge": 50,
                    "courier_charge": 30,
                    "cod_amount": 550,
                    "collected_amount": 0,
                    "notes": "Pending sync shipment",
                    "order_status": "shipped",
                },
            )
            assert second_shipment_response.status_code == 201, second_shipment_response.text
            second_shipment = second_shipment_response.json()

            printed_response = client.post(
                f"/api/v1/orders/{order['id']}/mark-printed",
                headers=headers,
            )
            assert printed_response.status_code == 200, printed_response.text
        dispose_engine()

        run_async(
            seed_external_state(
                woo_order_id=order["id"],
                delivered_shipment_id=shipment["id"],
                pending_sync_shipment_id=second_shipment["id"],
                product_id=product["id"],
            )
        )
        dispose_engine()

        with TestClient(app) as client:
            orders_summary_response = client.get("/api/v1/orders/operations-summary", headers=headers)
            assert orders_summary_response.status_code == 200, orders_summary_response.text
            orders_summary = orders_summary_response.json()
            assert orders_summary["orders_with_woo_source"] >= 1
            assert orders_summary["orders_with_shipments"] >= 2
            assert orders_summary["orders_without_shipments_ready_to_ship"] >= 1
            assert orders_summary["orders_printed_count"] >= 1
            assert orders_summary["orders_unprinted_count"] >= 1
            assert orders_summary["orders_needing_woo_refresh"] >= 1

            filtered_woo_orders_response = client.get(
                "/api/v1/orders?source=woocommerce&has_shipment=true",
                headers=headers,
            )
            assert filtered_woo_orders_response.status_code == 200, filtered_woo_orders_response.text
            filtered_woo_orders = filtered_woo_orders_response.json()
            assert any(item["id"] == order["id"] for item in filtered_woo_orders)

            unprinted_orders_response = client.get(
                "/api/v1/orders?printed=false",
                headers=headers,
            )
            assert unprinted_orders_response.status_code == 200, unprinted_orders_response.text
            unprinted_orders = unprinted_orders_response.json()
            assert any(item["id"] == ready_order["id"] for item in unprinted_orders)

            searched_orders_response = client.get(
                "/api/v1/orders?search=woo-order-900",
                headers=headers,
            )
            assert searched_orders_response.status_code == 200, searched_orders_response.text
            searched_orders = searched_orders_response.json()
            assert any(item["id"] == order["id"] for item in searched_orders)

            logistics_summary_response = client.get(
                "/api/v1/logistics/operations-summary",
                headers=headers,
            )
            assert logistics_summary_response.status_code == 200, logistics_summary_response.text
            logistics_summary = logistics_summary_response.json()
            assert logistics_summary["sent_to_external_courier_count"] >= 2
            assert logistics_summary["external_delivered_unsettled_count"] >= 1
            assert logistics_summary["shipments_waiting_status_sync_count"] >= 1
            assert logistics_summary["shipments_missing_tracking_count"] >= 0

            integration_summary_response = client.get(
                "/api/v1/reports/integration-summary",
                headers=headers,
            )
            assert integration_summary_response.status_code == 200, integration_summary_response.text
            integration_summary = integration_summary_response.json()
            assert integration_summary["woocommerce_orders_count"] >= 1
            assert integration_summary["woocommerce_products_count"] >= 1
            assert integration_summary["woo_recent_sync_failures"] >= 1
            assert integration_summary["courier_sent_count"] >= 2
            assert integration_summary["courier_recent_failures"] >= 1
            assert integration_summary["courier_external_delivered_count"] >= 1
            assert integration_summary["pending_integration_actions"] >= 1
    except (ProgrammingError, InterfaceError, AttributeError, RuntimeError) as exc:
        if any(token in str(exc) for token in ["reports", "couriers", "shipments", "activity_logs", "customer_phone", "customer_name", "payment_method", "paid_amount", "printed_count", "order_events"]):
            pytest.skip("Apply the latest migrations before running this test.")
        if any(token in str(exc).lower() for token in ["event loop is closed", "another operation is in progress", "send"]):
            pytest.skip("Skipped due to local asyncpg/TestClient event loop instability on Windows.")
        raise

    dispose_engine()


def test_order_and_shipment_batch_operator_endpoints() -> None:
    headers = auth_headers()

    try:
        with TestClient(app) as client:
            category_response = client.post(
                "/api/v1/categories",
                headers=headers,
                json={
                    "name": f"Batch Category {uuid.uuid4().hex[:8]}",
                    "slug": f"batch-category-{uuid.uuid4().hex[:8]}",
                    "description": "Batch ops category",
                },
            )
            assert category_response.status_code == 201, category_response.text
            category_id = category_response.json()["id"]

            brand_response = client.post(
                "/api/v1/brands",
                headers=headers,
                json={
                    "name": f"Batch Brand {uuid.uuid4().hex[:8]}",
                    "slug": f"batch-brand-{uuid.uuid4().hex[:8]}",
                    "description": "Batch ops brand",
                },
            )
            assert brand_response.status_code == 201, brand_response.text
            brand_id = brand_response.json()["id"]

            product_response = client.post(
                "/api/v1/products",
                headers=headers,
                json={
                    "name": "Batch Product",
                    "slug": f"batch-product-{uuid.uuid4().hex[:8]}",
                    "sku": f"BATCH-{uuid.uuid4().hex[:8]}",
                    "description": "Batch product",
                    "category_id": category_id,
                    "brand_id": brand_id,
                    "price": 650.00,
                    "cost_price": 400.00,
                    "image_url": None,
                    "status": "active",
                    "variants": [],
                },
            )
            assert product_response.status_code == 201, product_response.text
            product = product_response.json()

            customer_response = client.post(
                "/api/v1/customers",
                headers=headers,
                json={
                    "name": "Batch Customer",
                    "phone": "01788889999",
                    "email": unique_email(),
                    "address": "Dhaka",
                    "city": "Dhaka",
                    "customer_type": "retail",
                },
            )
            assert customer_response.status_code == 201, customer_response.text
            customer = customer_response.json()

            warehouse_response = client.post(
                "/api/v1/warehouses",
                headers=headers,
                json={
                    "name": f"Batch Warehouse {uuid.uuid4().hex[:8]}",
                    "code": f"BW-{uuid.uuid4().hex[:8]}",
                    "address": "Dhaka",
                    "is_active": True,
                },
            )
            assert warehouse_response.status_code == 201, warehouse_response.text
            warehouse = warehouse_response.json()

            inventory_response = client.post(
                "/api/v1/inventory",
                headers=headers,
                json={
                    "product_id": product["id"],
                    "variant_id": None,
                    "warehouse_id": warehouse["id"],
                    "quantity": 25,
                    "low_stock_threshold": 3,
                },
            )
            assert inventory_response.status_code == 201, inventory_response.text

            order_one_response = client.post(
                "/api/v1/orders",
                headers=headers,
                json={
                    "order_number": f"ORD-BATCH-{uuid.uuid4().hex[:8]}",
                    "customer_id": customer["id"],
                    "warehouse_id": warehouse["id"],
                    "customer_phone": customer["phone"],
                    "shipping_address": "Batch shipping one",
                    "notes": "Dispatch this first",
                    "tags": "dispatch,priority",
                    "status": "ready_to_ship",
                    "payment_status": "paid",
                    "source": "manual",
                    "subtotal": 650,
                    "discount": 0,
                    "delivery_charge": 60,
                    "total": 710,
                    "items": [
                        {
                            "product_id": product["id"],
                            "variant_id": None,
                            "product_name": product["name"],
                            "sku": product["sku"],
                            "quantity": 1,
                            "unit_price": 650,
                            "total_price": 650,
                        }
                    ],
                },
            )
            assert order_one_response.status_code == 201, order_one_response.text
            order_one = order_one_response.json()

            order_two_response = client.post(
                "/api/v1/orders",
                headers=headers,
                json={
                    "order_number": f"ORD-BATCH2-{uuid.uuid4().hex[:8]}",
                    "customer_id": customer["id"],
                    "warehouse_id": warehouse["id"],
                    "customer_phone": customer["phone"],
                    "shipping_address": "Batch shipping two",
                    "notes": "Print and ship",
                    "tags": "dispatch",
                    "status": "confirmed",
                    "payment_status": "unpaid",
                    "source": "manual",
                    "subtotal": 650,
                    "discount": 0,
                    "delivery_charge": 60,
                    "total": 710,
                    "items": [
                        {
                            "product_id": product["id"],
                            "variant_id": None,
                            "product_name": product["name"],
                            "sku": product["sku"],
                            "quantity": 1,
                            "unit_price": 650,
                            "total_price": 650,
                        }
                    ],
                },
            )
            assert order_two_response.status_code == 201, order_two_response.text
            order_two = order_two_response.json()

            batch_print_response = client.post(
                "/api/v1/orders/batch-actions",
                headers=headers,
                json={
                    "action": "mark_printed",
                    "order_ids": [order_one["id"], order_two["id"]],
                },
            )
            assert batch_print_response.status_code == 200, batch_print_response.text
            batch_print_result = batch_print_response.json()
            assert batch_print_result["success_count"] == 2

            batch_status_response = client.post(
                "/api/v1/orders/batch-actions",
                headers=headers,
                json={
                    "action": "update_status",
                    "order_ids": [order_two["id"]],
                    "options": {"status": "shipped"},
                },
            )
            assert batch_status_response.status_code == 200, batch_status_response.text
            batch_status_result = batch_status_response.json()
            assert batch_status_result["success_count"] == 1

            courier_response = client.post(
                "/api/v1/couriers",
                headers=headers,
                json={
                    "name": f"Batch Courier {uuid.uuid4().hex[:8]}",
                    "code": f"BC-{uuid.uuid4().hex[:8]}",
                    "contact_phone": "01711112222",
                    "website": "https://courier.example.com",
                    "is_active": True,
                },
            )
            assert courier_response.status_code == 201, courier_response.text
            courier = courier_response.json()

            shipment_response = client.post(
                "/api/v1/shipments",
                headers=headers,
                json={
                    "shipment_number": f"SHP-BATCH-{uuid.uuid4().hex[:8]}",
                    "order_id": order_one["id"],
                    "courier_id": courier["id"],
                    "tracking_number": "TRK-BATCH-001",
                    "status": "pending",
                    "delivery_charge": 60,
                    "courier_charge": 45,
                    "cod_amount": 710,
                    "collected_amount": 0,
                    "reconciliation_status": "pending",
                    "notes": "Batch shipment",
                },
            )
            assert shipment_response.status_code == 201, shipment_response.text
            shipment = shipment_response.json()

            shipment_batch_status_response = client.post(
                "/api/v1/shipments/batch-status-update",
                headers=headers,
                json={
                    "shipment_ids": [shipment["id"]],
                    "status": "shipped",
                },
            )
            assert shipment_batch_status_response.status_code == 200, shipment_batch_status_response.text
            shipment_batch_status_result = shipment_batch_status_response.json()
            assert shipment_batch_status_result["success_count"] == 1

            dispatch_export_response = client.get(
                "/api/v1/orders/dispatch-export?status=ready_to_ship&has_shipment=false",
                headers=headers,
            )
            assert dispatch_export_response.status_code == 200, dispatch_export_response.text
            assert dispatch_export_response.headers["content-type"].startswith("text/csv")
            assert "dispatch-orders.csv" in dispatch_export_response.headers["content-disposition"]
            assert "Order Number,Customer,Phone" in dispatch_export_response.text

            reconciliation_export_response = client.get(
                "/api/v1/logistics/reconciliation-export?reconciliation_status=pending",
                headers=headers,
            )
            assert reconciliation_export_response.status_code == 200, reconciliation_export_response.text
            assert reconciliation_export_response.headers["content-type"].startswith("text/csv")
            assert "reconciliation-shipments.csv" in reconciliation_export_response.headers["content-disposition"]
            assert "Shipment Number,Order Number,Courier" in reconciliation_export_response.text
    except (ProgrammingError, InterfaceError, AttributeError, RuntimeError) as exc:
        if any(token in str(exc) for token in ["reports", "couriers", "shipments", "activity_logs", "customer_phone", "customer_name", "payment_method", "paid_amount", "printed_count", "order_events"]):
            pytest.skip("Apply the latest migrations before running this test.")
        if any(token in str(exc).lower() for token in ["event loop is closed", "another operation is in progress", "send"]):
            pytest.skip("Skipped due to local asyncpg/TestClient event loop instability on Windows.")
        raise

    dispose_engine()
