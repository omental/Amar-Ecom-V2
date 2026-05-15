import json
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Any
from urllib.parse import urlparse

import httpx
from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.crypto import decrypt_secret
from app.models.category import Category
from app.models.customer import Customer
from app.models.order import Order, OrderEvent, OrderItem
from app.models.product import Product
from app.models.user import User
from app.models.woocommerce import WooCommerceSetting, WooCommerceSyncLog


_REDACTED = "[redacted]"
_SENSITIVE_SNAPSHOT_KEYS = {
    "consumer_key",
    "consumer_secret",
    "authorization",
    "authorization_header",
    "basic_auth",
    "basic_authorization",
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _to_decimal(value: Any, default: str = "0.00") -> Decimal:
    try:
        return Decimal(str(value or default).strip() or default)
    except (InvalidOperation, ValueError):
        return Decimal(default)


def _normalize_store_url(store_url: str) -> str:
    return store_url.rstrip("/")


def _build_api_base(settings: WooCommerceSetting) -> str:
    return f"{_normalize_store_url(settings.store_url or '')}/wp-json/{settings.api_version.strip('/')}"


def _sanitize_payload_snapshot(payload: Any) -> Any:
    if isinstance(payload, dict):
        sanitized: dict[str, Any] = {}
        for key, value in payload.items():
            normalized_key = str(key).lower().replace("-", "_")
            if normalized_key in _SENSITIVE_SNAPSHOT_KEYS:
                sanitized[key] = _REDACTED
            else:
                sanitized[key] = _sanitize_payload_snapshot(value)
        return sanitized
    if isinstance(payload, list):
        return [_sanitize_payload_snapshot(item) for item in payload]
    if isinstance(payload, tuple):
        return [_sanitize_payload_snapshot(item) for item in payload]
    if isinstance(payload, str):
        lowered = payload.lower()
        if lowered.startswith("basic ") or "authorization:" in lowered:
            return _REDACTED
    return payload


def _safe_payload_snapshot(payload: Any) -> str:
    sanitized_payload = _sanitize_payload_snapshot(payload)
    try:
        return json.dumps(sanitized_payload, ensure_ascii=True, default=str)
    except TypeError:
        return json.dumps({"payload": str(sanitized_payload)}, ensure_ascii=True)


def _safe_slug(value: str, fallback: str) -> str:
    normalized = "".join(char.lower() if char.isalnum() else "-" for char in value).strip("-")
    collapsed = "-".join(part for part in normalized.split("-") if part)
    return collapsed or fallback


def _shipping_address_from_order_payload(order_payload: dict[str, Any]) -> str | None:
    shipping = order_payload.get("shipping") or {}
    billing = order_payload.get("billing") or {}
    source = shipping if any(shipping.values()) else billing
    parts = [
        source.get("address_1"),
        source.get("address_2"),
        source.get("city"),
        source.get("state"),
        source.get("postcode"),
        source.get("country"),
    ]
    address = ", ".join(part.strip() for part in parts if isinstance(part, str) and part.strip())
    return address or None


def _map_woo_status(status_value: str | None) -> str:
    status_map = {
        "pending": "pending",
        "processing": "processing",
        "completed": "delivered",
        "cancelled": "cancelled",
        "refunded": "returned",
        "failed": "cancelled",
        "on-hold": "confirmed",
    }
    return status_map.get((status_value or "").lower(), "pending")


def _map_payment_status(order_payload: dict[str, Any]) -> str:
    woo_status = (order_payload.get("status") or "").lower()
    if order_payload.get("date_paid") or woo_status in {"completed", "processing"}:
        return "paid"
    return "unpaid"


def _validate_store_url(store_url: str | None) -> str:
    normalized = (store_url or "").strip()
    if not normalized:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="WooCommerce store URL is missing.")
    parsed = urlparse(normalized)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="WooCommerce store URL is invalid. Use a full http:// or https:// URL.",
        )
    return normalized


def _get_decrypted_credentials(settings: WooCommerceSetting) -> tuple[str, str]:
    raw_key = settings.consumer_key_encrypted or ""
    raw_secret = settings.consumer_secret_encrypted or ""
    if not raw_key or not raw_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="WooCommerce credentials are missing. Save both consumer key and consumer secret.",
        )
    try:
        consumer_key = decrypt_secret(raw_key).strip()
        consumer_secret = decrypt_secret(raw_secret).strip()
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="WooCommerce credentials could not be decrypted. Re-save the credentials and try again.",
        ) from exc
    if not consumer_key or not consumer_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="WooCommerce credentials are missing. Save both consumer key and consumer secret.",
        )
    return consumer_key, consumer_secret


async def _create_sync_log(
    db: AsyncSession,
    *,
    sync_type: str,
    status_value: str = "pending",
    external_id: str | None = None,
    local_entity_type: str | None = None,
    local_entity_id: str | None = None,
    message: str | None = None,
    payload_snapshot: Any = None,
    created_by_id=None,
) -> WooCommerceSyncLog:
    log = WooCommerceSyncLog(
        sync_type=sync_type,
        direction="import",
        status=status_value,
        external_id=external_id,
        local_entity_type=local_entity_type,
        local_entity_id=local_entity_id,
        message=message,
        payload_snapshot=_safe_payload_snapshot(payload_snapshot) if payload_snapshot is not None else None,
        created_by_id=created_by_id,
        started_at=_now(),
        finished_at=_now() if status_value in {"success", "failed", "skipped"} else None,
    )
    db.add(log)
    await db.flush()
    return log


async def get_active_woocommerce_settings(db: AsyncSession) -> WooCommerceSetting:
    result = await db.execute(select(WooCommerceSetting).order_by(WooCommerceSetting.created_at.asc()).limit(1))
    settings = result.scalar_one_or_none()
    if settings is None:
        settings = WooCommerceSetting()
        db.add(settings)
        await db.flush()
    if not settings.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="WooCommerce integration is inactive")
    _validate_store_url(settings.store_url)
    if not settings.consumer_key_encrypted or not settings.consumer_secret_encrypted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="WooCommerce credentials are missing. Save both consumer key and consumer secret.",
        )
    return settings


async def _request_woo(
    settings: WooCommerceSetting,
    path: str,
    *,
    params: dict[str, Any] | None = None,
) -> httpx.Response:
    consumer_key, consumer_secret = _get_decrypted_credentials(settings)
    async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
        try:
            return await client.get(
                f"{_build_api_base(settings)}{path}",
                params=params,
                auth=(consumer_key, consumer_secret),
            )
        except httpx.TimeoutException as exc:
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail="WooCommerce request timed out. Check the store URL, credentials, and network availability.",
            ) from exc
        except httpx.InvalidURL as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="WooCommerce store URL is invalid. Use a full http:// or https:// URL.",
            ) from exc
        except httpx.HTTPError as exc:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="WooCommerce API is unavailable right now. Please try again shortly.",
            ) from exc


def _parse_woocommerce_json(response: httpx.Response, entity_label: str) -> Any:
    try:
        return response.json()
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"WooCommerce returned an unreadable {entity_label} response.",
        ) from exc


async def _match_products_for_preview(db: AsyncSession, payload: list[dict[str, Any]]) -> list[dict[str, Any]]:
    sku_values = sorted({(item.get("sku") or "").strip() for item in payload if (item.get("sku") or "").strip()})
    slug_values = sorted(
        {
            _safe_slug(item.get("slug") or item.get("name") or f"woo-product-{item.get('id')}", f"woo-product-{item.get('id')}")
            for item in payload
        }
    )

    existing_products: list[Product] = []
    conditions = []
    if sku_values:
        conditions.append(Product.sku.in_(sku_values))
    if slug_values:
        conditions.append(Product.slug.in_(slug_values))
    if conditions:
        existing_products = list((await db.execute(select(Product).where(or_(*conditions)))).scalars().all())

    by_sku = {product.sku: product for product in existing_products}
    by_slug = {product.slug: product for product in existing_products}
    items: list[dict[str, Any]] = []

    for item in payload:
        external_id = str(item.get("id"))
        sku = (item.get("sku") or "").strip() or None
        slug = _safe_slug(item.get("slug") or item.get("name") or f"woo-product-{external_id}", f"woo-product-{external_id}")
        matched_product = by_sku.get(sku) if sku else None
        duplicate_status = "new"

        if matched_product is not None:
            duplicate_status = "existing_by_sku"
        else:
            matched_product = by_slug.get(slug)
            if matched_product is not None:
                duplicate_status = "existing_by_slug"
            elif not sku:
                duplicate_status = "missing_sku"

        items.append(
            {
                "external_id": external_id,
                "name": item.get("name") or "Untitled product",
                "slug": item.get("slug"),
                "sku": sku,
                "price": _to_decimal(item.get("regular_price") or item.get("price")),
                "status": item.get("status"),
                "category": ", ".join(category.get("name", "") for category in item.get("categories", []) if category.get("name")) or None,
                "image_url": (item.get("images") or [{}])[0].get("src"),
                "duplicate_status": duplicate_status,
                "local_product_id": matched_product.id if matched_product is not None else None,
            }
        )

    return items


async def _match_orders_for_preview(db: AsyncSession, payload: list[dict[str, Any]]) -> list[dict[str, Any]]:
    order_numbers = {f"WC-{item.get('number') or item.get('id')}" for item in payload}
    existing_orders = list((await db.execute(select(Order).where(Order.order_number.in_(order_numbers)))).scalars().all()) if order_numbers else []
    by_order_number = {order.order_number: order for order in existing_orders}

    items: list[dict[str, Any]] = []
    for item in payload:
        external_id = str(item.get("id"))
        local_order_number = f"WC-{item.get('number') or item.get('id')}"
        matched_order = by_order_number.get(local_order_number)
        items.append(
            {
                "external_id": external_id,
                "number": str(item.get("number") or item.get("id")),
                "customer": " ".join(
                    part for part in [(item.get("billing") or {}).get("first_name"), (item.get("billing") or {}).get("last_name")] if part
                )
                or (item.get("billing") or {}).get("email")
                or "Walk-in customer",
                "status": item.get("status"),
                "total": _to_decimal(item.get("total")),
                "currency": item.get("currency"),
                "created_at": item.get("date_created"),
                "duplicate_status": "existing_by_order_number" if matched_order is not None else "new",
                "local_order_id": matched_order.id if matched_order is not None else None,
            }
        )
    return items


async def test_connection(db: AsyncSession, current_user: User) -> dict[str, Any]:
    settings = await get_active_woocommerce_settings(db)
    log = await _create_sync_log(
        db,
        sync_type="connection_test",
        created_by_id=current_user.id,
        payload_snapshot={"store_url": settings.store_url, "api_version": settings.api_version},
    )
    try:
        response = await _request_woo(settings, "/products", params={"per_page": 1, "page": 1})
        success = response.status_code == 200
        if response.status_code in {401, 403}:
            message = "WooCommerce credentials were rejected. Check the consumer key and consumer secret."
        else:
            message = "WooCommerce connection succeeded." if success else f"WooCommerce returned status {response.status_code}."
        settings.last_tested_at = _now()
        settings.last_test_success = success
        settings.last_test_message = message
        log.status = "success" if success else "failed"
        log.message = message
        log.finished_at = _now()
        if not success:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=message)
        return {"success": True, "message": message, "tested_at": settings.last_tested_at}
    except HTTPException as exc:
        settings.last_tested_at = _now()
        settings.last_test_success = False
        settings.last_test_message = str(exc.detail)
        log.status = "failed"
        log.message = settings.last_test_message
        log.finished_at = _now()
        raise


async def fetch_products_preview(
    db: AsyncSession,
    *,
    page: int = 1,
    per_page: int = 20,
    search: str | None = None,
    current_user: User,
) -> dict[str, Any]:
    settings = await get_active_woocommerce_settings(db)
    params: dict[str, Any] = {"page": page, "per_page": per_page}
    if search:
        params["search"] = search
    response = await _request_woo(settings, "/products", params=params)
    if response.status_code != 200:
        if response.status_code in {401, 403}:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="WooCommerce credentials were rejected while loading product preview.",
            )
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"WooCommerce returned status {response.status_code} while loading product preview.")
    payload = _parse_woocommerce_json(response, "product preview")
    items = await _match_products_for_preview(db, payload)
    await _create_sync_log(
        db,
        sync_type="product_preview",
        status_value="success",
        message=f"Previewed {len(items)} WooCommerce products.",
        payload_snapshot={"page": page, "per_page": per_page, "search": search},
        created_by_id=current_user.id,
    )
    return {
        "items": items,
        "page": page,
        "per_page": per_page,
        "total": int(response.headers.get("X-WP-Total")) if response.headers.get("X-WP-Total") else None,
        "total_pages": int(response.headers.get("X-WP-TotalPages")) if response.headers.get("X-WP-TotalPages") else None,
    }


async def fetch_orders_preview(
    db: AsyncSession,
    *,
    page: int = 1,
    per_page: int = 20,
    status_value: str | None = None,
    current_user: User,
) -> dict[str, Any]:
    settings = await get_active_woocommerce_settings(db)
    params: dict[str, Any] = {"page": page, "per_page": per_page}
    if status_value:
        params["status"] = status_value
    response = await _request_woo(settings, "/orders", params=params)
    if response.status_code != 200:
        if response.status_code in {401, 403}:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="WooCommerce credentials were rejected while loading order preview.",
            )
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=f"WooCommerce returned status {response.status_code} while loading order preview.")
    payload = _parse_woocommerce_json(response, "order preview")
    items = await _match_orders_for_preview(db, payload)
    await _create_sync_log(
        db,
        sync_type="order_preview",
        status_value="success",
        message=f"Previewed {len(items)} WooCommerce orders.",
        payload_snapshot={"page": page, "per_page": per_page, "status": status_value},
        created_by_id=current_user.id,
    )
    return {
        "items": items,
        "page": page,
        "per_page": per_page,
        "total": int(response.headers.get("X-WP-Total")) if response.headers.get("X-WP-Total") else None,
        "total_pages": int(response.headers.get("X-WP-TotalPages")) if response.headers.get("X-WP-TotalPages") else None,
    }


async def _find_or_create_category(db: AsyncSession, category_payload: dict[str, Any] | None) -> Category | None:
    if not category_payload or not (category_payload.get("name") or "").strip():
        return None
    category_name = category_payload["name"].strip()
    category_slug = _safe_slug(category_payload.get("slug") or category_name, f"woo-category-{category_payload.get('id', 'unknown')}")
    result = await db.execute(select(Category).where((Category.slug == category_slug) | (Category.name == category_name)))
    category = result.scalar_one_or_none()
    if category is not None:
        return category
    category = Category(name=category_name, slug=category_slug, description="Imported from WooCommerce.")
    db.add(category)
    await db.flush()
    return category


async def import_products(db: AsyncSession, external_ids: list[str], current_user: User) -> dict[str, Any]:
    settings = await get_active_woocommerce_settings(db)
    imported = 0
    skipped = 0
    failed = 0
    rows: list[dict[str, Any]] = []

    for external_id in external_ids:
        try:
            response = await _request_woo(settings, f"/products/{external_id}")
            if response.status_code != 200:
                failed += 1
                if response.status_code in {401, 403}:
                    message = f"Product {external_id} failed because WooCommerce credentials were rejected."
                else:
                    message = f"Product {external_id}: WooCommerce returned status {response.status_code}."
                rows.append({"external_id": external_id, "status": "failed", "local_entity_id": None, "message": message})
                await _create_sync_log(db, sync_type="product_import", status_value="failed", external_id=external_id, message=message, created_by_id=current_user.id)
                continue

            payload = _parse_woocommerce_json(response, "product")
            incoming_sku = (payload.get("sku") or "").strip() or f"WC-PROD-{external_id}"
            incoming_slug = _safe_slug(payload.get("slug") or payload.get("name") or f"woo-product-{external_id}", f"woo-product-{external_id}")
            existing_product = (
                await db.execute(select(Product).where((Product.sku == incoming_sku) | (Product.slug == incoming_slug)))
            ).scalar_one_or_none()
            if existing_product is not None:
                skipped += 1
                if existing_product.sku == incoming_sku:
                    message = f"Product {external_id} skipped because SKU {incoming_sku} already exists locally."
                else:
                    message = f"Product {external_id} skipped because slug {incoming_slug} already exists locally."
                rows.append(
                    {
                        "external_id": external_id,
                        "status": "skipped",
                        "local_entity_id": existing_product.id,
                        "message": message,
                    }
                )
                await _create_sync_log(
                    db,
                    sync_type="product_import",
                    status_value="skipped",
                    external_id=external_id,
                    local_entity_type="product",
                    local_entity_id=str(existing_product.id),
                    message=message,
                    created_by_id=current_user.id,
                )
                continue

            category = await _find_or_create_category(db, (payload.get("categories") or [None])[0])
            product = Product(
                name=payload.get("name") or f"Woo Product {external_id}",
                slug=incoming_slug,
                sku=incoming_sku,
                description=payload.get("description") or payload.get("short_description"),
                category_id=category.id if category else None,
                brand_id=None,
                price=_to_decimal(payload.get("regular_price") or payload.get("price")),
                cost_price=Decimal("0.00"),
                image_url=(payload.get("images") or [{}])[0].get("src"),
                status=payload.get("status") or "draft",
            )
            db.add(product)
            await db.flush()
            imported += 1
            message = f"Imported WooCommerce product {external_id}."
            rows.append({"external_id": external_id, "status": "imported", "local_entity_id": product.id, "message": message})
            await _create_sync_log(
                db,
                sync_type="product_import",
                status_value="success",
                external_id=external_id,
                local_entity_type="product",
                local_entity_id=str(product.id),
                message=message,
                payload_snapshot={"sku": product.sku, "slug": product.slug},
                created_by_id=current_user.id,
            )
        except Exception as exc:
            failed += 1
            message = f"Product {external_id} failed: {exc}"
            rows.append({"external_id": external_id, "status": "failed", "local_entity_id": None, "message": message})
            await _create_sync_log(db, sync_type="product_import", status_value="failed", external_id=external_id, message=message, created_by_id=current_user.id)

    return {"imported_count": imported, "skipped_count": skipped, "failed_count": failed, "rows": rows}


async def _find_or_create_customer_from_woo(db: AsyncSession, order_payload: dict[str, Any]) -> Customer | None:
    billing = order_payload.get("billing") or {}
    full_name = " ".join(part for part in [(billing.get("first_name") or "").strip(), (billing.get("last_name") or "").strip()] if part).strip()
    email = (billing.get("email") or "").strip() or None
    phone = (billing.get("phone") or "").strip() or None

    if phone:
        existing_by_phone = (await db.execute(select(Customer).where(Customer.phone == phone))).scalar_one_or_none()
        if existing_by_phone is not None:
            return existing_by_phone
    if email:
        existing_by_email = (await db.execute(select(Customer).where(Customer.email == email))).scalar_one_or_none()
        if existing_by_email is not None:
            return existing_by_email
    if not full_name or not (phone or email):
        return None

    customer = Customer(
        name=full_name,
        phone=phone or f"WOO-{order_payload.get('id')}",
        email=email,
        address=_shipping_address_from_order_payload(order_payload),
        city=(order_payload.get("shipping") or {}).get("city") or billing.get("city"),
        notes="Created from WooCommerce order import.",
    )
    db.add(customer)
    await db.flush()
    return customer


async def import_orders(db: AsyncSession, external_ids: list[str], current_user: User) -> dict[str, Any]:
    settings = await get_active_woocommerce_settings(db)
    imported = 0
    skipped = 0
    failed = 0
    rows: list[dict[str, Any]] = []

    for external_id in external_ids:
        try:
            response = await _request_woo(settings, f"/orders/{external_id}")
            if response.status_code != 200:
                failed += 1
                if response.status_code in {401, 403}:
                    message = f"Order {external_id} failed because WooCommerce credentials were rejected."
                else:
                    message = f"Order {external_id}: WooCommerce returned status {response.status_code}."
                rows.append({"external_id": external_id, "status": "failed", "local_entity_id": None, "message": message})
                await _create_sync_log(db, sync_type="order_import", status_value="failed", external_id=external_id, message=message, created_by_id=current_user.id)
                continue

            payload = _parse_woocommerce_json(response, "order")
            order_number = f"WC-{payload.get('number') or payload.get('id')}"
            existing_order = (await db.execute(select(Order).where(Order.order_number == order_number))).scalar_one_or_none()
            if existing_order is not None:
                skipped += 1
                message = f"Order {external_id} skipped because {order_number} already exists locally."
                rows.append(
                    {
                        "external_id": external_id,
                        "status": "skipped",
                        "local_entity_id": existing_order.id,
                        "message": message,
                    }
                )
                await _create_sync_log(
                    db,
                    sync_type="order_import",
                    status_value="skipped",
                    external_id=external_id,
                    local_entity_type="order",
                    local_entity_id=str(existing_order.id),
                    message=message,
                    created_by_id=current_user.id,
                )
                continue

            customer = await _find_or_create_customer_from_woo(db, payload)
            subtotal = sum(_to_decimal(item.get("subtotal")) for item in payload.get("line_items", []))
            total = _to_decimal(payload.get("total"))
            delivery_charge = _to_decimal(payload.get("shipping_total"))
            paid_amount = total if _map_payment_status(payload) == "paid" else Decimal("0.00")
            billing = payload.get("billing") or {}
            customer_name = " ".join(part for part in [billing.get("first_name"), billing.get("last_name")] if part).strip() or None

            order = Order(
                order_number=order_number,
                customer_id=customer.id if customer else None,
                warehouse_id=None,
                customer_name=customer_name,
                customer_phone=billing.get("phone") or None,
                shipping_address=_shipping_address_from_order_payload(payload),
                notes=f"Imported from WooCommerce order {payload.get('id')}.",
                tags="woocommerce-import",
                status=_map_woo_status(payload.get("status")),
                payment_status=_map_payment_status(payload),
                payment_method=payload.get("payment_method_title") or payload.get("payment_method") or None,
                source="woocommerce",
                subtotal=subtotal,
                discount=Decimal("0.00"),
                delivery_charge=delivery_charge,
                paid_amount=paid_amount,
                total=total,
                stock_deducted=False,
            )
            order.events.append(
                OrderEvent(
                    event_type="woo_order_imported",
                    message=f"Imported from WooCommerce order {payload.get('id')}.",
                    created_by_id=current_user.id,
                )
            )

            for line_item in payload.get("line_items", []):
                sku = (line_item.get("sku") or "").strip() or None
                product = None
                if sku:
                    product = (await db.execute(select(Product).where(Product.sku == sku))).scalar_one_or_none()
                quantity = max(int(line_item.get("quantity") or 1), 1)
                line_total = _to_decimal(line_item.get("total"))
                unit_price = line_total / quantity if quantity else line_total
                order.items.append(
                    OrderItem(
                        product_id=product.id if product else None,
                        variant_id=None,
                        product_name=line_item.get("name") or "WooCommerce Item",
                        sku=sku,
                        quantity=quantity,
                        unit_price=unit_price,
                        total_price=line_total,
                    )
                )

            db.add(order)
            await db.flush()
            imported += 1
            message = f"Imported WooCommerce order {external_id}."
            rows.append({"external_id": external_id, "status": "imported", "local_entity_id": order.id, "message": message})
            await _create_sync_log(
                db,
                sync_type="order_import",
                status_value="success",
                external_id=external_id,
                local_entity_type="order",
                local_entity_id=str(order.id),
                message=message,
                payload_snapshot={"order_number": order.order_number, "status": order.status},
                created_by_id=current_user.id,
            )
        except Exception as exc:
            failed += 1
            message = f"Order {external_id} failed: {exc}"
            rows.append({"external_id": external_id, "status": "failed", "local_entity_id": None, "message": message})
            await _create_sync_log(db, sync_type="order_import", status_value="failed", external_id=external_id, message=message, created_by_id=current_user.id)

    return {"imported_count": imported, "skipped_count": skipped, "failed_count": failed, "rows": rows}
