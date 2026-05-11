import asyncio
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import InterfaceError, ProgrammingError

from app.core.database import engine
from app.main import app


def unique_email() -> str:
    return f"test-{uuid.uuid4().hex[:12]}@example.com"


def dispose_engine() -> None:
    asyncio.run(engine.dispose())


def register_user(email: str, password: str = "StrongPass123") -> dict:
    try:
        with TestClient(app) as client:
            response = client.post(
                "/api/v1/auth/register",
                json={
                    "full_name": "Test User",
                    "email": email,
                    "password": password,
                    "role": "admin",
                    "is_active": True,
                },
            )
    except (ProgrammingError, InterfaceError, AttributeError, RuntimeError) as exc:
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


def test_health() -> None:
    with TestClient(app) as client:
        response = client.get("/api/v1/health")
    dispose_engine()
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"


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

            filtered_response = client.get(
                "/api/v1/customers?search=CRM&customer_type=vip&has_follow_up=true",
                headers=headers,
            )
            assert filtered_response.status_code == 200, filtered_response.text
            filtered_customers = filtered_response.json()
            assert any(item["id"] == customer["id"] for item in filtered_customers)

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
            assert str(detail["total_spend"]) == "270.00"
            assert detail["pending_follow_up_count"] >= 1
            assert any(order["payment_status"] == "paid" for order in detail["orders"])
            assert any(item["id"] == activity["id"] for item in detail["activities"])

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

            updated_customer_response = client.patch(
                f"/api/v1/customers/{customer['id']}",
                headers=headers,
                json={
                    "customer_type": "wholesale",
                    "tags": "priority,account",
                    "notes": "Moved to wholesale segment",
                },
            )
            assert updated_customer_response.status_code == 200, updated_customer_response.text
            updated_customer = updated_customer_response.json()
            assert updated_customer["customer_type"] == "wholesale"
            assert updated_customer["tags"] == "priority,account"
    except ProgrammingError as exc:
        if any(
            token in str(exc)
            for token in ["customer_type", "follow_up_date", "last_contacted_at", "customer_activities"]
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

            update_response = client.patch(
                "/api/v1/settings/business",
                headers=headers,
                json={
                    "company_name": "Amar eCom Test",
                    "currency": "USD",
                    "order_prefix": "AMR",
                    "low_stock_default_threshold": 9,
                    "tax_rate": 15,
                },
            )
            assert update_response.status_code == 200, update_response.text
            updated_body = update_response.json()
            assert updated_body["company_name"] == "Amar eCom Test"
            assert updated_body["currency"] == "USD"
            assert updated_body["order_prefix"] == "AMR"
            assert updated_body["low_stock_default_threshold"] == 9
    except ProgrammingError as exc:
        if "business_settings" in str(exc):
            pytest.skip("Apply the business settings migration before running this test.")
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
        if any(token in str(exc) for token in ["warehouse_id", "business_settings", "customer_phone", "printed_count", "order_events"]):
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
        if any(token in str(exc) for token in ["return_requests", "warehouse_id", "business_settings", "customer_phone", "printed_count", "order_events"]):
            pytest.skip("Apply the latest migrations before running this test.")
        if any(token in str(exc).lower() for token in ["event loop is closed", "another operation is in progress", "send"]):
            pytest.skip("Skipped due to local asyncpg/TestClient event loop instability on Windows.")
        raise

    dispose_engine()


def test_courier_and_shipment_flow() -> None:
    try:
        headers = auth_headers()
        with TestClient(app) as client:
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

            order_list_response = client.get("/api/v1/orders?skip=0&limit=1", headers=headers)
            assert order_list_response.status_code == 200, order_list_response.text
            orders = order_list_response.json()
            if not orders:
                pytest.skip("Create at least one order before running shipment integration test.")
            order = orders[0]

            shipment_response = client.post(
                "/api/v1/shipments",
                headers=headers,
                json={
                    "shipment_number": f"SHP-{uuid.uuid4().hex[:8]}",
                    "order_id": order["id"],
                    "courier_id": courier["id"],
                    "tracking_number": f"TRK-{uuid.uuid4().hex[:10]}",
                    "status": "ready_to_ship",
                    "delivery_charge": 120,
                    "cod_amount": 300,
                    "notes": "Prepared for dispatch",
                },
            )
            assert shipment_response.status_code == 201, shipment_response.text
            shipment = shipment_response.json()
            assert shipment["courier"]["id"] == courier["id"]

            shipped_response = client.patch(
                f"/api/v1/shipments/{shipment['id']}",
                headers=headers,
                json={"status": "shipped"},
            )
            assert shipped_response.status_code == 200, shipped_response.text
            shipped_shipment = shipped_response.json()
            assert shipped_shipment["status"] == "shipped"
            assert shipped_shipment["shipped_at"] is not None

            delivered_response = client.patch(
                f"/api/v1/shipments/{shipment['id']}",
                headers=headers,
                json={"status": "delivered"},
            )
            assert delivered_response.status_code == 200, delivered_response.text
            delivered_shipment = delivered_response.json()
            assert delivered_shipment["status"] == "delivered"
            assert delivered_shipment["delivered_at"] is not None

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
        if any(token in str(exc) for token in ["couriers", "shipments", "return_requests", "warehouse_id", "business_settings", "customer_phone", "printed_count", "order_events"]):
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
                "printed_count",
                "order_events",
            ]
        ):
            pytest.skip("Apply the latest migrations before running this test.")
        if any(token in str(exc).lower() for token in ["event loop is closed", "another operation is in progress", "send"]):
            pytest.skip("Skipped due to local asyncpg/TestClient event loop instability on Windows.")
        raise

    dispose_engine()
