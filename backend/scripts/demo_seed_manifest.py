"""Stable identifiers and canonical facts for the Amar full-platform demo seed."""

from __future__ import annotations

import uuid


DEMO_NAMESPACE = uuid.UUID("a6a95bd8-d8a4-5e96-9277-3e047db21b59")
SEED_VERSION = "15.5a.1"


def fixture_uuid(key: str) -> uuid.UUID:
    return uuid.uuid5(DEMO_NAMESPACE, key)


URBAN = {
    "organization_id": fixture_uuid("urban.organization"),
    "organization_slug": "amar-demo-urban-thread",
    "organization_name": "Urban Thread Group Ltd.",
    "store_id": fixture_uuid("urban.store"),
    "store_slug": "urban-thread-demo",
    "store_name": "Urban Thread BD",
    "custom_hostname": "urban-thread-demo.example.com",
    "owner_email": "owner@urban-thread.example",
    "manager_email": "manager@urban-thread.example",
    "sales_email": "sales@urban-thread.example",
    "support_email": "support@urban-thread.example",
    "inventory_email": "inventory@urban-thread.example",
    "hr_email": "hr@urban-thread.example",
    "restricted_email": "restricted@urban-thread.example",
    "oxford_product_id": fixture_uuid("urban.product.classic-oxford-shirt"),
    "oxford_variant_id": fixture_uuid("urban.variant.oxford.black-xl"),
    "rahim_customer_id": fixture_uuid("urban.customer.rahim-ahmed"),
    "order_1042_id": fixture_uuid("urban.order.UT-1042"),
}


TECHNEST = {
    "organization_id": fixture_uuid("technest.organization"),
    "organization_slug": "amar-demo-technest",
    "organization_name": "TechNest Group Ltd.",
    "store_id": fixture_uuid("technest.store"),
    "store_slug": "technest-demo",
    "store_name": "TechNest BD",
    "owner_email": "owner@technest.example",
    "staff_email": "staff@technest.example",
}


CANONICAL = {
    "product": "Classic Oxford Shirt",
    "product_slug": "classic-oxford-shirt",
    "variant": "Black / XL",
    "sku": "UT-OXF-BLK-XL",
    "price": "2490.00",
    "warehouses": {
        "Main Warehouse — Dhaka": 12,
        "Dhanmondi Outlet": 3,
        "Chattogram Warehouse": 0,
    },
    "stock_total": 15,
    "customer": "Rahim Ahmed",
    "order_number": "UT-1042",
    "order_status": "shipped",
    "tracking": "UT-TRACK-1042",
}


DEMO_ORGANIZATION_IDS = (URBAN["organization_id"], TECHNEST["organization_id"])
DEMO_STORE_IDS = (URBAN["store_id"], TECHNEST["store_id"])
DEMO_ORGANIZATION_SLUGS = (URBAN["organization_slug"], TECHNEST["organization_slug"])
DEMO_STORE_SLUGS = (URBAN["store_slug"], TECHNEST["store_slug"])

