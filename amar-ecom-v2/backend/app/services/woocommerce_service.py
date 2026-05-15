import json
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Any
from urllib.parse import urlparse

import httpx
from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

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


def _build_local_order_number(order_payload: dict[str, Any]) -> str:
    return f"WC-{order_payload.get('number') or order_payload.get('id')}"


def _build_external_snapshot(order_payload: dict[str, Any], warnings: list[str] | None = None) -> str:
    payload: dict[str, Any] = {"woo_order": order_payload}
    if warnings:
        payload["sync_warnings"] = warnings
    return _safe_payload_snapshot(payload)


def _build_product_external_snapshot(product_payload: dict[str, Any], warnings: list[str] | None = None) -> str:
    payload: dict[str, Any] = {"woo_product": product_payload}
    if warnings:
        payload["sync_warnings"] = warnings
    return _safe_payload_snapshot(payload)


def _map_woo_product_status(status_value: str | None) -> str:
    return "active" if (status_value or "").lower() in {"publish", "published", "active"} else "inactive"


def _extract_external_stock_quantity(product_payload: dict[str, Any]) -> int | None:
    stock_quantity = product_payload.get("stock_quantity")
    if stock_quantity in (None, ""):
        return None
    try:
        return int(stock_quantity)
    except (TypeError, ValueError):
        return None


def _parse_snapshot_text(snapshot_text: str | None) -> dict[str, Any] | None:
    if not snapshot_text:
        return None
    try:
        parsed = json.loads(snapshot_text)
    except (TypeError, ValueError):
        return None
    return parsed if isinstance(parsed, dict) else None


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


def _build_product_preview_params(
    *,
    page: int,
    per_page: int,
    search: str | None = None,
    modified_after: datetime | None = None,
) -> dict[str, Any]:
    params: dict[str, Any] = {"page": page, "per_page": per_page}
    if search:
        params["search"] = search
    if modified_after:
        params["modified_after"] = modified_after.isoformat()
    return params


def _build_order_preview_params(
    *,
    page: int,
    per_page: int,
    status_value: str | None = None,
    after: datetime | None = None,
) -> dict[str, Any]:
    params: dict[str, Any] = {"page": page, "per_page": per_page}
    if status_value:
        params["status"] = status_value
    if after:
        params["after"] = after.isoformat()
    return params


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
                "external_stock_quantity": _extract_external_stock_quantity(item),
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
    modified_after: datetime | None = None,
    current_user: User,
) -> dict[str, Any]:
    settings = await get_active_woocommerce_settings(db)
    params = _build_product_preview_params(page=page, per_page=per_page, search=search, modified_after=modified_after)
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
        payload_snapshot={"page": page, "per_page": per_page, "search": search, "modified_after": params.get("modified_after")},
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
    after: datetime | None = None,
    current_user: User,
) -> dict[str, Any]:
    settings = await get_active_woocommerce_settings(db)
    params = _build_order_preview_params(page=page, per_page=per_page, status_value=status_value, after=after)
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
        payload_snapshot={"page": page, "per_page": per_page, "status": status_value, "after": params.get("after")},
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


async def _find_existing_woocommerce_product(db: AsyncSession, product_payload: dict[str, Any]):
    external_id = str(product_payload.get("id"))
    incoming_sku = (product_payload.get("sku") or "").strip() or None
    incoming_slug = _safe_slug(
        product_payload.get("slug") or product_payload.get("name") or f"woo-product-{external_id}",
        f"woo-product-{external_id}",
    )

    existing_product = (
        await db.execute(select(Product).where((Product.source == "woocommerce") & (Product.external_id == external_id)))
    ).scalar_one_or_none()
    if existing_product is not None:
        return existing_product

    if incoming_sku:
        existing_product = (await db.execute(select(Product).where(Product.sku == incoming_sku))).scalar_one_or_none()
        if existing_product is not None:
            return existing_product

    return (await db.execute(select(Product).where(Product.slug == incoming_slug))).scalar_one_or_none()


async def _create_local_product_from_woo_payload(
    db: AsyncSession,
    *,
    product_payload: dict[str, Any],
    current_user: User,
) -> tuple[Product, list[str]]:
    external_id = str(product_payload.get("id"))
    incoming_sku = (product_payload.get("sku") or "").strip() or f"WC-PROD-{external_id}"
    incoming_slug = _safe_slug(
        product_payload.get("slug") or product_payload.get("name") or f"woo-product-{external_id}",
        f"woo-product-{external_id}",
    )
    category = await _find_or_create_category(db, (product_payload.get("categories") or [None])[0])
    warnings: list[str] = []
    if not (product_payload.get("sku") or "").strip():
        warnings.append("WooCommerce product is missing a SKU, so a local fallback SKU was used.")

    product = Product(
        name=product_payload.get("name") or f"Woo Product {external_id}",
        slug=incoming_slug,
        sku=incoming_sku,
        description=product_payload.get("description") or product_payload.get("short_description"),
        source="woocommerce",
        external_id=external_id,
        external_slug=product_payload.get("slug") or incoming_slug,
        external_status=product_payload.get("status"),
        external_synced_at=_now(),
        category_id=category.id if category else None,
        brand_id=None,
        price=_to_decimal(product_payload.get("regular_price") or product_payload.get("price")),
        cost_price=Decimal("0.00"),
        image_url=(product_payload.get("images") or [{}])[0].get("src"),
        status=_map_woo_product_status(product_payload.get("status")),
    )
    product.external_payload_snapshot = _build_product_external_snapshot(product_payload, warnings)
    db.add(product)
    await db.flush()
    return product, warnings


def _build_product_refresh_row(*, external_id: str, status_value: str, local_product_id, message: str) -> dict[str, Any]:
    return {
        "external_id": external_id,
        "status": status_value,
        "local_product_id": local_product_id,
        "message": message,
    }


async def _refresh_local_product_from_woo_payload(
    db: AsyncSession,
    *,
    product: Product,
    product_payload: dict[str, Any],
    current_user: User,
) -> tuple[Product, list[str]]:
    del db, current_user
    warnings: list[str] = []
    external_id = str(product_payload.get("id"))
    incoming_slug = _safe_slug(
        product_payload.get("slug") or product_payload.get("name") or f"woo-product-{external_id}",
        f"woo-product-{external_id}",
    )
    incoming_sku = (product_payload.get("sku") or "").strip() or None
    incoming_price = _to_decimal(product_payload.get("regular_price") or product_payload.get("price"))
    incoming_status = product_payload.get("status")
    incoming_image = (product_payload.get("images") or [{}])[0].get("src")
    incoming_name = (product_payload.get("name") or "").strip()
    incoming_category_name = (product_payload.get("categories") or [{}])[0].get("name") if product_payload.get("categories") else None
    previous_snapshot = _parse_snapshot_text(product.external_payload_snapshot)
    previous_woo_product = previous_snapshot.get("woo_product") if previous_snapshot else {}
    previous_woo_name = (previous_woo_product.get("name") or "").strip() if isinstance(previous_woo_product, dict) else ""
    previous_woo_price = _to_decimal(previous_woo_product.get("regular_price") or previous_woo_product.get("price")) if isinstance(previous_woo_product, dict) else Decimal("0.00")
    previous_mapped_status = _map_woo_product_status(previous_woo_product.get("status")) if isinstance(previous_woo_product, dict) else None

    product.source = product.source or "woocommerce"
    product.external_id = external_id
    product.external_slug = product_payload.get("slug") or incoming_slug
    product.external_status = incoming_status
    product.external_synced_at = _now()

    if not incoming_sku:
        warnings.append("WooCommerce product is missing a SKU.")
    elif product.sku != incoming_sku:
        warnings.append(f"WooCommerce SKU {incoming_sku} differs from local SKU {product.sku}.")

    if incoming_name:
        if not (product.name or "").strip() or ((product.name or "").strip() == previous_woo_name and previous_woo_name):
            product.name = incoming_name
        elif product.name != incoming_name:
            warnings.append("WooCommerce product name differs from local name. Local name was preserved.")

    if product.price <= 0 or (previous_woo_price > 0 and product.price == previous_woo_price):
        product.price = incoming_price
    elif product.price != incoming_price:
        warnings.append(f"WooCommerce price {incoming_price} differs from local price {product.price}. Local price was preserved.")

    if not (product.image_url or "").strip() and incoming_image:
        product.image_url = incoming_image
    elif incoming_image and product.image_url != incoming_image:
        warnings.append("WooCommerce image differs from the local image. Local image was preserved.")

    mapped_status = _map_woo_product_status(incoming_status)
    if not (product.status or "").strip() or (previous_mapped_status and product.status == previous_mapped_status):
        product.status = mapped_status
    elif product.status != mapped_status:
        warnings.append(f"WooCommerce status {mapped_status} differs from local status {product.status}. Local status was preserved.")

    if product.description and (product_payload.get("description") or product_payload.get("short_description")) and product.description != (
        product_payload.get("description") or product_payload.get("short_description")
    ):
        warnings.append("WooCommerce description differs from local description. Local description was preserved.")

    if incoming_category_name:
        if product.category and product.category.name != incoming_category_name:
            warnings.append(f"WooCommerce category {incoming_category_name} differs from local category {product.category.name}.")
    elif not incoming_category_name:
        warnings.append("WooCommerce product is missing category information.")

    product.external_payload_snapshot = _build_product_external_snapshot(product_payload, warnings)
    await db.flush()
    return product, warnings


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
            incoming_slug = _safe_slug(
                payload.get("slug") or payload.get("name") or f"woo-product-{external_id}",
                f"woo-product-{external_id}",
            )
            existing_product = await _find_existing_woocommerce_product(db, payload)
            if existing_product is not None:
                skipped += 1
                if existing_product.source == "woocommerce" and existing_product.external_id == str(payload.get("id")):
                    existing_product.source = "woocommerce"
                    existing_product.external_id = str(payload.get("id"))
                    existing_product.external_slug = payload.get("slug") or incoming_slug
                    existing_product.external_status = payload.get("status")
                    existing_product.external_synced_at = _now()
                    existing_product.external_payload_snapshot = _build_product_external_snapshot(payload)
                    message = f"Product {external_id} matched the existing WooCommerce-linked local product {existing_product.sku} and external metadata was refreshed."
                elif existing_product.sku == incoming_sku:
                    if existing_product.source == "woocommerce" or existing_product.external_id is None:
                        existing_product.source = existing_product.source or "woocommerce"
                        existing_product.external_id = existing_product.external_id or str(payload.get("id"))
                        existing_product.external_slug = payload.get("slug") or incoming_slug
                        existing_product.external_status = payload.get("status")
                        existing_product.external_synced_at = _now()
                        existing_product.external_payload_snapshot = _build_product_external_snapshot(payload, ["Matched by SKU during WooCommerce import."])
                    message = f"Product {external_id} skipped because SKU {incoming_sku} already exists locally."
                else:
                    if existing_product.source == "woocommerce" or existing_product.external_id is None:
                        existing_product.source = existing_product.source or "woocommerce"
                        existing_product.external_id = existing_product.external_id or str(payload.get("id"))
                        existing_product.external_slug = payload.get("slug") or incoming_slug
                        existing_product.external_status = payload.get("status")
                        existing_product.external_synced_at = _now()
                        existing_product.external_payload_snapshot = _build_product_external_snapshot(payload, ["Matched by slug during WooCommerce import."])
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

            product, warnings = await _create_local_product_from_woo_payload(db, product_payload=payload, current_user=current_user)
            imported += 1
            warning_suffix = f" Warnings: {'; '.join(warnings)}" if warnings else ""
            message = f"Imported WooCommerce product {external_id}.{warning_suffix}"
            rows.append({"external_id": external_id, "status": "imported", "local_entity_id": product.id, "message": message})
            await _create_sync_log(
                db,
                sync_type="product_import",
                status_value="success",
                external_id=external_id,
                local_entity_type="product",
                local_entity_id=str(product.id),
                message=message,
                payload_snapshot={"sku": product.sku, "slug": product.slug, "warnings": warnings, "external_stock_quantity": _extract_external_stock_quantity(payload)},
                created_by_id=current_user.id,
            )
        except Exception as exc:
            failed += 1
            message = f"Product {external_id} failed: {exc}"
            rows.append({"external_id": external_id, "status": "failed", "local_entity_id": None, "message": message})
            await _create_sync_log(db, sync_type="product_import", status_value="failed", external_id=external_id, message=message, created_by_id=current_user.id)

    return {"imported_count": imported, "skipped_count": skipped, "failed_count": failed, "rows": rows}


async def refresh_imported_product_from_woocommerce(
    db: AsyncSession,
    local_product_id,
    current_user: User,
) -> dict[str, Any]:
    product = (await db.execute(select(Product).options(selectinload(Product.category)).where(Product.id == local_product_id))).scalar_one_or_none()
    if product is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Local WooCommerce product not found.")
    if product.source != "woocommerce" and not product.external_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only WooCommerce-linked products can be refreshed from WooCommerce.")
    if not product.external_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This WooCommerce product is missing an external reference ID.")

    settings = await get_active_woocommerce_settings(db)
    external_id = product.external_id
    try:
        response = await _request_woo(settings, f"/products/{external_id}")
        if response.status_code != 200:
            if response.status_code in {401, 403}:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"WooCommerce credentials were rejected while refreshing product {external_id}.",
                )
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"WooCommerce returned status {response.status_code} while refreshing product {external_id}.",
            )

        payload = _parse_woocommerce_json(response, "product")
        product, warnings = await _refresh_local_product_from_woo_payload(
            db,
            product=product,
            product_payload=payload,
            current_user=current_user,
        )
        warning_suffix = f" Warnings: {'; '.join(warnings)}" if warnings else ""
        message = f"Refreshed WooCommerce product {external_id}.{warning_suffix}"
        await _create_sync_log(
            db,
            sync_type="product_refresh",
            status_value="success",
            external_id=external_id,
            local_entity_type="product",
            local_entity_id=str(product.id),
            message=message,
            payload_snapshot={
                "external_id": external_id,
                "warnings": warnings,
                "status": product.external_status,
                "external_stock_quantity": _extract_external_stock_quantity(payload),
            },
            created_by_id=current_user.id,
        )
        return {
            "refreshed_count": 1,
            "imported_count": 0,
            "skipped_count": 0,
            "failed_count": 0,
            "rows": [_build_product_refresh_row(external_id=external_id, status_value="refreshed", local_product_id=product.id, message=message)],
        }
    except HTTPException as exc:
        await _create_sync_log(
            db,
            sync_type="product_refresh",
            status_value="failed",
            external_id=external_id,
            local_entity_type="product",
            local_entity_id=str(product.id),
            message=str(exc.detail),
            created_by_id=current_user.id,
        )
        raise


async def refresh_imported_products_since_last_sync(
    db: AsyncSession,
    current_user: User,
    *,
    per_page: int = 20,
    since_last_sync: bool = True,
    search: str | None = None,
) -> dict[str, Any]:
    settings = await get_active_woocommerce_settings(db)
    settings.last_sync_started_at = _now()
    settings.last_sync_finished_at = None
    settings.last_sync_status = "pending"
    settings.last_sync_message = "WooCommerce bulk product refresh started."
    modified_after = settings.last_product_sync_at if since_last_sync else None
    root_log = await _create_sync_log(
        db,
        sync_type="products_bulk_refresh",
        created_by_id=current_user.id,
        message="WooCommerce bulk product refresh started.",
        payload_snapshot={"since_last_sync": since_last_sync, "modified_after": modified_after.isoformat() if modified_after else None, "search": search, "per_page": per_page},
    )

    refreshed_count = 0
    imported_count = 0
    skipped_count = 0
    failed_count = 0
    rows: list[dict[str, Any]] = []

    params = _build_product_preview_params(page=1, per_page=per_page, search=search, modified_after=modified_after)
    response = await _request_woo(settings, "/products", params=params)
    if response.status_code != 200:
        if response.status_code in {401, 403}:
            detail = "WooCommerce credentials were rejected while loading product refresh changes."
        else:
            detail = f"WooCommerce returned status {response.status_code} while loading product refresh changes."
        settings.last_sync_finished_at = _now()
        settings.last_sync_status = "failed"
        settings.last_sync_message = detail
        root_log.status = "failed"
        root_log.message = detail
        root_log.finished_at = _now()
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=detail)

    payload = _parse_woocommerce_json(response, "product refresh list")
    for product_payload in payload:
        external_id = str(product_payload.get("id"))
        try:
            existing_product = await _find_existing_woocommerce_product(db, product_payload)
            if existing_product is not None:
                if existing_product.source == "woocommerce" or existing_product.external_id:
                    refreshed_product, warnings = await _refresh_local_product_from_woo_payload(
                        db,
                        product=existing_product,
                        product_payload=product_payload,
                        current_user=current_user,
                    )
                    refreshed_count += 1
                    warning_suffix = f" Warnings: {'; '.join(warnings)}" if warnings else ""
                    message = f"Refreshed WooCommerce product {external_id}.{warning_suffix}"
                    rows.append(_build_product_refresh_row(external_id=external_id, status_value="refreshed", local_product_id=refreshed_product.id, message=message))
                    await _create_sync_log(
                        db,
                        sync_type="product_refresh",
                        status_value="success",
                        external_id=external_id,
                        local_entity_type="product",
                        local_entity_id=str(refreshed_product.id),
                        message=message,
                        payload_snapshot={
                            "external_id": external_id,
                            "warnings": warnings,
                            "status": refreshed_product.external_status,
                            "external_stock_quantity": _extract_external_stock_quantity(product_payload),
                        },
                        created_by_id=current_user.id,
                    )
                else:
                    skipped_count += 1
                    message = f"Product {external_id} matched an existing local product by SKU or slug and was not overwritten."
                    rows.append(_build_product_refresh_row(external_id=external_id, status_value="skipped", local_product_id=existing_product.id, message=message))
                    await _create_sync_log(
                        db,
                        sync_type="products_bulk_refresh",
                        status_value="skipped",
                        external_id=external_id,
                        local_entity_type="product",
                        local_entity_id=str(existing_product.id),
                        message=message,
                        created_by_id=current_user.id,
                    )
            else:
                imported_product, warnings = await _create_local_product_from_woo_payload(db, product_payload=product_payload, current_user=current_user)
                imported_count += 1
                warning_suffix = f" Warnings: {'; '.join(warnings)}" if warnings else ""
                message = f"Imported new WooCommerce product {external_id}.{warning_suffix}"
                rows.append(_build_product_refresh_row(external_id=external_id, status_value="imported", local_product_id=imported_product.id, message=message))
                await _create_sync_log(
                    db,
                    sync_type="products_bulk_refresh",
                    status_value="success",
                    external_id=external_id,
                    local_entity_type="product",
                    local_entity_id=str(imported_product.id),
                    message=message,
                    payload_snapshot={
                        "external_id": external_id,
                        "warnings": warnings,
                        "status": imported_product.external_status,
                        "external_stock_quantity": _extract_external_stock_quantity(product_payload),
                    },
                    created_by_id=current_user.id,
                )
        except Exception as exc:
            failed_count += 1
            message = f"Product {external_id} refresh failed: {exc}"
            rows.append(_build_product_refresh_row(external_id=external_id, status_value="failed", local_product_id=None, message=message))
            await _create_sync_log(
                db,
                sync_type="product_refresh",
                status_value="failed",
                external_id=external_id,
                message=message,
                created_by_id=current_user.id,
            )

    finished_at = _now()
    summary_message = (
        f"Bulk WooCommerce product refresh complete: {refreshed_count} refreshed, "
        f"{imported_count} imported, {skipped_count} skipped, {failed_count} failed."
    )
    settings.last_product_sync_at = finished_at
    settings.last_sync_finished_at = finished_at
    settings.last_sync_status = "success" if failed_count == 0 else "failed"
    settings.last_sync_message = summary_message
    root_log.status = "success" if failed_count == 0 else "failed"
    root_log.message = summary_message
    root_log.finished_at = finished_at
    return {
        "refreshed_count": refreshed_count,
        "imported_count": imported_count,
        "skipped_count": skipped_count,
        "failed_count": failed_count,
        "rows": rows,
    }


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


async def _find_existing_woocommerce_order(db: AsyncSession, order_payload: dict[str, Any]):
    external_id = str(order_payload.get("id"))
    external_number = str(order_payload.get("number") or order_payload.get("id"))
    local_order_number = _build_local_order_number(order_payload)

    result = await db.execute(
        select(Order).where(
            (Order.source == "woocommerce") & (Order.external_id == external_id)
        )
    )
    existing_order = result.scalar_one_or_none()
    if existing_order is not None:
        return existing_order

    result = await db.execute(
        select(Order).where(
            (Order.source == "woocommerce") & (Order.external_number == external_number)
        )
    )
    existing_order = result.scalar_one_or_none()
    if existing_order is not None:
        return existing_order

    result = await db.execute(select(Order).where(Order.order_number == local_order_number))
    return result.scalar_one_or_none()


async def _create_order_items_from_woo_payload(db: AsyncSession, order: Order, order_payload: dict[str, Any]) -> None:
    for line_item in order_payload.get("line_items", []):
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


async def _create_local_order_from_woo_payload(
    db: AsyncSession,
    *,
    order_payload: dict[str, Any],
    current_user: User,
) -> tuple[Order, list[str]]:
    customer = await _find_or_create_customer_from_woo(db, order_payload)
    subtotal = sum(_to_decimal(item.get("subtotal")) for item in order_payload.get("line_items", []))
    total = _to_decimal(order_payload.get("total"))
    delivery_charge = _to_decimal(order_payload.get("shipping_total"))
    paid_amount = total if _map_payment_status(order_payload) == "paid" else Decimal("0.00")
    billing = order_payload.get("billing") or {}
    customer_name = " ".join(part for part in [billing.get("first_name"), billing.get("last_name")] if part).strip() or None
    warnings: list[str] = []
    if not (billing.get("phone") or "").strip():
        warnings.append("WooCommerce order is missing a customer phone number.")
    if not _shipping_address_from_order_payload(order_payload):
        warnings.append("WooCommerce order is missing a shipping address.")

    order = Order(
        order_number=_build_local_order_number(order_payload),
        customer_id=customer.id if customer else None,
        warehouse_id=None,
        customer_name=customer_name,
        customer_phone=billing.get("phone") or None,
        shipping_address=_shipping_address_from_order_payload(order_payload),
        notes=f"Imported from WooCommerce order {order_payload.get('id')}.",
        tags="woocommerce-import",
        status=_map_woo_status(order_payload.get("status")),
        payment_status=_map_payment_status(order_payload),
        payment_method=order_payload.get("payment_method_title") or order_payload.get("payment_method") or None,
        source="woocommerce",
        external_id=str(order_payload.get("id")),
        external_number=str(order_payload.get("number") or order_payload.get("id")),
        external_status=order_payload.get("status"),
        external_synced_at=_now(),
        subtotal=subtotal,
        discount=Decimal("0.00"),
        delivery_charge=delivery_charge,
        paid_amount=paid_amount,
        total=total,
        stock_deducted=False,
    )
    await _create_order_items_from_woo_payload(db, order, order_payload)
    order.external_payload_snapshot = _build_external_snapshot(order_payload, warnings)
    order.events.append(
        OrderEvent(
            event_type="woo_order_imported",
            message=f"Imported from WooCommerce order {order_payload.get('id')}.",
            created_by_id=current_user.id,
        )
    )
    db.add(order)
    await db.flush()
    return order, warnings


def _collect_line_item_signature(order: Order) -> list[tuple[str | None, str, int, str]]:
    return sorted(
        (
            item.sku,
            item.product_name,
            int(item.quantity or 0),
            str(_to_decimal(item.total_price)),
        )
        for item in order.items
    )


def _collect_woo_line_item_signature(order_payload: dict[str, Any]) -> list[tuple[str | None, str, int, str]]:
    return sorted(
        (
            ((item.get("sku") or "").strip() or None),
            item.get("name") or "WooCommerce Item",
            max(int(item.get("quantity") or 1), 1),
            str(_to_decimal(item.get("total"))),
        )
        for item in order_payload.get("line_items", [])
    )


async def _refresh_local_order_from_woo_payload(
    db: AsyncSession,
    *,
    order: Order,
    order_payload: dict[str, Any],
    current_user: User,
) -> tuple[Order, list[str]]:
    warnings: list[str] = []
    previous_status = order.status

    order.external_id = str(order_payload.get("id"))
    order.external_number = str(order_payload.get("number") or order_payload.get("id"))
    order.external_status = order_payload.get("status")
    order.external_synced_at = _now()
    order.order_number = order.order_number or _build_local_order_number(order_payload)
    order.status = _map_woo_status(order_payload.get("status"))
    order.payment_status = _map_payment_status(order_payload)
    order.payment_method = order_payload.get("payment_method_title") or order_payload.get("payment_method") or order.payment_method

    billing = order_payload.get("billing") or {}
    incoming_phone = (billing.get("phone") or "").strip() or None
    incoming_shipping_address = _shipping_address_from_order_payload(order_payload)
    incoming_subtotal = sum(_to_decimal(item.get("subtotal")) for item in order_payload.get("line_items", []))
    incoming_total = _to_decimal(order_payload.get("total"))
    incoming_delivery_charge = _to_decimal(order_payload.get("shipping_total"))

    if incoming_phone:
        order.customer_phone = incoming_phone
    else:
        warnings.append("WooCommerce order is missing a customer phone number.")

    if incoming_shipping_address:
        order.shipping_address = incoming_shipping_address
    else:
        warnings.append("WooCommerce order is missing a shipping address.")

    if order.stock_deducted and previous_status != order.status and order.status in {"cancelled", "returned"}:
        warnings.append("Local stock was already deducted before WooCommerce changed the order to a non-fulfillment status.")

    if order.stock_deducted and any(
        value != current
        for value, current in [
            (incoming_total, order.total),
            (incoming_subtotal, order.subtotal),
            (incoming_delivery_charge, order.delivery_charge),
        ]
    ):
        warnings.append("WooCommerce totals changed after local fulfillment activity. Financial fields were left unchanged.")
    else:
        order.subtotal = incoming_subtotal
        order.total = incoming_total
        order.delivery_charge = incoming_delivery_charge
        order.discount = Decimal("0.00")
        order.paid_amount = incoming_total if order.payment_status == "paid" else Decimal("0.00")

    if not order.notes:
        order.notes = f"Imported from WooCommerce order {order_payload.get('id')}."
    elif order.notes.strip() != f"Imported from WooCommerce order {order_payload.get('id')}." and order_payload.get("customer_note"):
        warnings.append("Local staff notes were preserved instead of being overwritten by WooCommerce notes.")

    if order.items:
        local_signature = _collect_line_item_signature(order)
        woo_signature = _collect_woo_line_item_signature(order_payload)
        if local_signature != woo_signature:
            warnings.append("WooCommerce line items differ from local order items. Local items were preserved.")
    else:
        await _create_order_items_from_woo_payload(db, order, order_payload)

    order.external_payload_snapshot = _build_external_snapshot(order_payload, warnings)

    status_fragment = f"Status changed from {previous_status} to {order.status}." if previous_status != order.status else f"Status remains {order.status}."
    warning_fragment = f" Warnings: {'; '.join(warnings)}" if warnings else ""
    order.events.append(
        OrderEvent(
            event_type="woocommerce_order_refreshed",
            message=f"Refreshed from WooCommerce. {status_fragment}{warning_fragment}",
            created_by_id=current_user.id,
        )
    )
    await db.flush()
    return order, warnings


def _build_refresh_row(*, external_id: str, status_value: str, local_order_id, message: str) -> dict[str, Any]:
    return {
        "external_id": external_id,
        "status": status_value,
        "local_order_id": local_order_id,
        "message": message,
    }


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
            existing_order = await _find_existing_woocommerce_order(db, payload)
            if existing_order is not None:
                skipped += 1
                if existing_order.source == "woocommerce" and existing_order.external_id == str(payload.get("id")):
                    message = f"Order {external_id} skipped because it is already linked to local WooCommerce order {existing_order.order_number}."
                else:
                    message = f"Order {external_id} skipped because {_build_local_order_number(payload)} already exists locally."
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

            order, warnings = await _create_local_order_from_woo_payload(db, order_payload=payload, current_user=current_user)
            imported += 1
            warning_suffix = f" Warnings: {'; '.join(warnings)}" if warnings else ""
            message = f"Imported WooCommerce order {external_id}.{warning_suffix}"
            rows.append({"external_id": external_id, "status": "imported", "local_entity_id": order.id, "message": message})
            await _create_sync_log(
                db,
                sync_type="order_import",
                status_value="success",
                external_id=external_id,
                local_entity_type="order",
                local_entity_id=str(order.id),
                message=message,
                payload_snapshot={"order_number": order.order_number, "status": order.status, "warnings": warnings},
                created_by_id=current_user.id,
            )
        except Exception as exc:
            failed += 1
            message = f"Order {external_id} failed: {exc}"
            rows.append({"external_id": external_id, "status": "failed", "local_entity_id": None, "message": message})
            await _create_sync_log(db, sync_type="order_import", status_value="failed", external_id=external_id, message=message, created_by_id=current_user.id)

    return {"imported_count": imported, "skipped_count": skipped, "failed_count": failed, "rows": rows}


async def refresh_imported_order_from_woocommerce(
    db: AsyncSession,
    local_order_id,
    current_user: User,
) -> dict[str, Any]:
    order = (await db.execute(select(Order).where(Order.id == local_order_id))).scalar_one_or_none()
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Local WooCommerce order not found.")
    if order.source != "woocommerce":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only WooCommerce orders can be refreshed from WooCommerce.")
    if not order.external_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This WooCommerce order is missing an external reference ID.")

    settings = await get_active_woocommerce_settings(db)
    external_id = order.external_id
    try:
        response = await _request_woo(settings, f"/orders/{external_id}")
        if response.status_code != 200:
            if response.status_code in {401, 403}:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"WooCommerce credentials were rejected while refreshing order {external_id}.",
                )
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"WooCommerce returned status {response.status_code} while refreshing order {external_id}.",
            )

        payload = _parse_woocommerce_json(response, "order")
        order, warnings = await _refresh_local_order_from_woo_payload(
            db,
            order=order,
            order_payload=payload,
            current_user=current_user,
        )
        warning_suffix = f" Warnings: {'; '.join(warnings)}" if warnings else ""
        message = f"Refreshed WooCommerce order {external_id}.{warning_suffix}"
        await _create_sync_log(
            db,
            sync_type="order_refresh",
            status_value="success",
            external_id=external_id,
            local_entity_type="order",
            local_entity_id=str(order.id),
            message=message,
            payload_snapshot={"external_id": external_id, "warnings": warnings, "status": order.external_status},
            created_by_id=current_user.id,
        )
        return {
            "refreshed_count": 1,
            "imported_count": 0,
            "skipped_count": 0,
            "failed_count": 0,
            "rows": [_build_refresh_row(external_id=external_id, status_value="refreshed", local_order_id=order.id, message=message)],
        }
    except HTTPException as exc:
        await _create_sync_log(
            db,
            sync_type="order_refresh",
            status_value="failed",
            external_id=external_id,
            local_entity_type="order",
            local_entity_id=str(order.id),
            message=str(exc.detail),
            created_by_id=current_user.id,
        )
        raise


async def refresh_imported_orders_since_last_sync(
    db: AsyncSession,
    current_user: User,
    *,
    per_page: int = 20,
    since_last_sync: bool = True,
    status_value: str | None = None,
) -> dict[str, Any]:
    settings = await get_active_woocommerce_settings(db)
    settings.last_sync_started_at = _now()
    settings.last_sync_finished_at = None
    settings.last_sync_status = "pending"
    settings.last_sync_message = "WooCommerce bulk order refresh started."
    after_value = settings.last_order_sync_at if since_last_sync else None
    root_log = await _create_sync_log(
        db,
        sync_type="orders_bulk_refresh",
        created_by_id=current_user.id,
        message="WooCommerce bulk order refresh started.",
        payload_snapshot={"since_last_sync": since_last_sync, "after": after_value.isoformat() if after_value else None, "status": status_value, "per_page": per_page},
    )

    refreshed_count = 0
    imported_count = 0
    skipped_count = 0
    failed_count = 0
    rows: list[dict[str, Any]] = []

    params = _build_order_preview_params(page=1, per_page=per_page, status_value=status_value, after=after_value)
    response = await _request_woo(settings, "/orders", params=params)
    if response.status_code != 200:
        if response.status_code in {401, 403}:
            detail = "WooCommerce credentials were rejected while loading order refresh changes."
        else:
            detail = f"WooCommerce returned status {response.status_code} while loading order refresh changes."
        settings.last_sync_finished_at = _now()
        settings.last_sync_status = "failed"
        settings.last_sync_message = detail
        root_log.status = "failed"
        root_log.message = detail
        root_log.finished_at = _now()
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=detail)

    payload = _parse_woocommerce_json(response, "order refresh list")
    for order_payload in payload:
        external_id = str(order_payload.get("id"))
        try:
            existing_order = await _find_existing_woocommerce_order(db, order_payload)
            if existing_order is not None:
                if existing_order.source != "woocommerce":
                    skipped_count += 1
                    message = f"Order {external_id} matched a non-WooCommerce local order and was skipped."
                    rows.append(_build_refresh_row(external_id=external_id, status_value="skipped", local_order_id=existing_order.id, message=message))
                    await _create_sync_log(
                        db,
                        sync_type="orders_bulk_refresh",
                        status_value="skipped",
                        external_id=external_id,
                        local_entity_type="order",
                        local_entity_id=str(existing_order.id),
                        message=message,
                        created_by_id=current_user.id,
                    )
                    continue

                refreshed_order, warnings = await _refresh_local_order_from_woo_payload(
                    db,
                    order=existing_order,
                    order_payload=order_payload,
                    current_user=current_user,
                )
                refreshed_count += 1
                warning_suffix = f" Warnings: {'; '.join(warnings)}" if warnings else ""
                message = f"Refreshed WooCommerce order {external_id}.{warning_suffix}"
                rows.append(_build_refresh_row(external_id=external_id, status_value="refreshed", local_order_id=refreshed_order.id, message=message))
                await _create_sync_log(
                    db,
                    sync_type="order_refresh",
                    status_value="success",
                    external_id=external_id,
                    local_entity_type="order",
                    local_entity_id=str(refreshed_order.id),
                    message=message,
                    payload_snapshot={"external_id": external_id, "warnings": warnings, "status": refreshed_order.external_status},
                    created_by_id=current_user.id,
                )
            else:
                imported_order, warnings = await _create_local_order_from_woo_payload(db, order_payload=order_payload, current_user=current_user)
                imported_count += 1
                warning_suffix = f" Warnings: {'; '.join(warnings)}" if warnings else ""
                message = f"Imported new WooCommerce order {external_id}.{warning_suffix}"
                rows.append(_build_refresh_row(external_id=external_id, status_value="imported", local_order_id=imported_order.id, message=message))
                await _create_sync_log(
                    db,
                    sync_type="orders_bulk_refresh",
                    status_value="success",
                    external_id=external_id,
                    local_entity_type="order",
                    local_entity_id=str(imported_order.id),
                    message=message,
                    payload_snapshot={"external_id": external_id, "warnings": warnings, "status": imported_order.external_status},
                    created_by_id=current_user.id,
                )
        except Exception as exc:
            failed_count += 1
            message = f"Order {external_id} refresh failed: {exc}"
            rows.append(_build_refresh_row(external_id=external_id, status_value="failed", local_order_id=None, message=message))
            await _create_sync_log(
                db,
                sync_type="order_refresh",
                status_value="failed",
                external_id=external_id,
                message=message,
                created_by_id=current_user.id,
            )

    finished_at = _now()
    summary_message = (
        f"Bulk WooCommerce order refresh complete: {refreshed_count} refreshed, "
        f"{imported_count} imported, {skipped_count} skipped, {failed_count} failed."
    )
    settings.last_order_sync_at = finished_at
    settings.last_sync_finished_at = finished_at
    settings.last_sync_status = "success" if failed_count == 0 else "failed"
    settings.last_sync_message = summary_message
    root_log.status = "success" if failed_count == 0 else "failed"
    root_log.message = summary_message
    root_log.finished_at = finished_at
    return {
        "refreshed_count": refreshed_count,
        "imported_count": imported_count,
        "skipped_count": skipped_count,
        "failed_count": failed_count,
        "rows": rows,
    }


def _summarize_import_result(entity_label: str, result: dict[str, Any]) -> str:
    return (
        f"{entity_label} sync: {result['imported_count']} imported, "
        f"{result['skipped_count']} skipped, {result['failed_count']} failed."
    )


async def get_sync_status_summary(
    db: AsyncSession,
    *,
    recent_limit: int = 10,
) -> dict[str, Any]:
    settings_result = await db.execute(select(WooCommerceSetting).order_by(WooCommerceSetting.created_at.asc()).limit(1))
    settings = settings_result.scalar_one_or_none()
    if settings is None:
        settings = WooCommerceSetting()
        db.add(settings)
        await db.flush()

    recent_logs_result = await db.execute(
        select(WooCommerceSyncLog)
        .options(selectinload(WooCommerceSyncLog.created_by))
        .where(
            WooCommerceSyncLog.sync_type.in_(
                [
                    "manual_sync",
                    "scheduled_sync",
                    "product_scheduled_import",
                    "order_scheduled_import",
                    "product_refresh",
                    "products_bulk_refresh",
                    "order_refresh",
                    "orders_bulk_refresh",
                ]
            )
        )
        .order_by(WooCommerceSyncLog.created_at.desc())
        .limit(recent_limit)
    )
    recent_logs = list(recent_logs_result.scalars().all())
    failed_sync_count = int(
        await db.scalar(
            select(func.count())
            .select_from(WooCommerceSyncLog)
            .where(
                WooCommerceSyncLog.status == "failed",
                WooCommerceSyncLog.sync_type.in_(
                    [
                        "manual_sync",
                        "scheduled_sync",
                        "product_scheduled_import",
                        "order_scheduled_import",
                        "product_refresh",
                        "products_bulk_refresh",
                        "order_refresh",
                        "orders_bulk_refresh",
                    ]
                ),
            )
        )
        or 0
    )
    recent_product_refresh_failures_count = int(
        await db.scalar(
            select(func.count())
            .select_from(WooCommerceSyncLog)
            .where(WooCommerceSyncLog.status == "failed", WooCommerceSyncLog.sync_type.in_(["product_refresh", "products_bulk_refresh"]))
        )
        or 0
    )
    recent_order_refresh_failures_count = int(
        await db.scalar(
            select(func.count())
            .select_from(WooCommerceSyncLog)
            .where(WooCommerceSyncLog.status == "failed", WooCommerceSyncLog.sync_type.in_(["order_refresh", "orders_bulk_refresh"]))
        )
        or 0
    )
    imported_woocommerce_orders_count = int(
        await db.scalar(select(func.count()).select_from(Order).where(Order.source == "woocommerce")) or 0
    )
    imported_woocommerce_products_count = int(
        await db.scalar(select(func.count()).select_from(Product).where(Product.source == "woocommerce")) or 0
    )

    warnings: list[str] = []
    if not settings.is_active:
        warnings.append("WooCommerce integration is inactive.")
    if not (settings.store_url or "").strip():
        warnings.append("WooCommerce store URL is missing.")
    if not settings.consumer_key_encrypted or not settings.consumer_secret_encrypted:
        warnings.append("WooCommerce credentials are missing.")
    if not settings.last_tested_at:
        warnings.append("WooCommerce connection has not been tested yet.")
    elif not settings.last_test_success:
        warnings.append("The last WooCommerce connection test did not succeed.")
    if settings.auto_sync_enabled:
        warnings.append("Auto-sync is configuration-only right now. No background worker is running in this deployment by default.")
    if not settings.sync_products_enabled and not settings.sync_orders_enabled:
        warnings.append("Both product and order sync toggles are disabled.")

    ready_to_sync = (
        settings.is_active
        and bool((settings.store_url or "").strip())
        and bool(settings.consumer_key_encrypted and settings.consumer_secret_encrypted)
        and bool(settings.last_test_success)
    )
    return {
        "settings": settings,
        "recent_sync_logs": recent_logs,
        "failed_sync_count": failed_sync_count,
        "recent_product_refresh_failures_count": recent_product_refresh_failures_count,
        "recent_order_refresh_failures_count": recent_order_refresh_failures_count,
        "imported_woocommerce_products_count": imported_woocommerce_products_count,
        "imported_woocommerce_orders_count": imported_woocommerce_orders_count,
        "last_product_refresh_at": settings.last_product_sync_at,
        "last_order_refresh_at": settings.last_order_sync_at,
        "ready_to_sync": ready_to_sync,
        "readiness_warnings": warnings,
    }


async def run_manual_sync(
    db: AsyncSession,
    current_user: User,
    *,
    sync_products: bool = True,
    sync_orders: bool = True,
    since_last_sync: bool = True,
    per_page: int = 20,
) -> dict[str, Any]:
    settings = await get_active_woocommerce_settings(db)
    started_at = _now()
    settings.last_sync_started_at = started_at
    settings.last_sync_finished_at = None
    settings.last_sync_status = "pending"
    settings.last_sync_message = "WooCommerce manual sync started."

    root_log = await _create_sync_log(
        db,
        sync_type="manual_sync",
        created_by_id=current_user.id,
        message="WooCommerce manual sync started.",
        payload_snapshot={
            "sync_products": sync_products,
            "sync_orders": sync_orders,
            "since_last_sync": since_last_sync,
            "per_page": per_page,
            "product_since": settings.last_product_sync_at.isoformat() if since_last_sync and settings.last_product_sync_at else None,
            "order_since": settings.last_order_sync_at.isoformat() if since_last_sync and settings.last_order_sync_at else None,
        },
    )

    if not sync_products and not sync_orders:
        finished_at = _now()
        message = "Nothing to sync. Enable products or orders before running manual sync."
        settings.last_sync_finished_at = finished_at
        settings.last_sync_status = "skipped"
        settings.last_sync_message = message
        root_log.status = "skipped"
        root_log.message = message
        root_log.finished_at = finished_at
        return {
            "status": "skipped",
            "started_at": started_at,
            "finished_at": finished_at,
            "product_result": None,
            "order_result": None,
            "message": message,
        }

    product_result: dict[str, Any] | None = None
    order_result: dict[str, Any] | None = None
    messages: list[str] = []
    failed_sections = 0

    try:
        if sync_products:
            product_refresh_result = await refresh_imported_products_since_last_sync(
                db,
                current_user=current_user,
                per_page=per_page,
                since_last_sync=since_last_sync,
                search=None,
            )
            product_result = {
                "imported_count": product_refresh_result["imported_count"],
                "skipped_count": product_refresh_result["skipped_count"],
                "failed_count": product_refresh_result["failed_count"],
                "rows": [
                    {
                        "external_id": row["external_id"],
                        "status": "imported" if row["status"] == "imported" else ("failed" if row["status"] == "failed" else "skipped"),
                        "local_entity_id": row["local_product_id"],
                        "message": row["message"],
                    }
                    for row in product_refresh_result["rows"]
                ],
            }
            product_message = (
                f"Product sync: {product_refresh_result['refreshed_count']} refreshed, {product_refresh_result['imported_count']} imported, "
                f"{product_refresh_result['skipped_count']} skipped, {product_refresh_result['failed_count']} failed."
            )
            messages.append(product_message)
            await _create_sync_log(
                db,
                sync_type="product_scheduled_import",
                status_value="failed" if product_refresh_result["failed_count"] else "success",
                message=product_message,
                payload_snapshot={
                    "since_last_sync": since_last_sync,
                    "per_page": per_page,
                    "row_count": len(product_refresh_result["rows"]),
                    "search": None,
                },
                created_by_id=current_user.id,
            )
            if product_refresh_result["failed_count"] != 0:
                failed_sections += 1

        if sync_orders:
            order_refresh_result = await refresh_imported_orders_since_last_sync(
                db,
                current_user,
                per_page=per_page,
                since_last_sync=since_last_sync,
                status_value=None,
            )
            order_result = {
                "imported_count": order_refresh_result["imported_count"],
                "skipped_count": order_refresh_result["skipped_count"],
                "failed_count": order_refresh_result["failed_count"],
                "rows": [
                    {
                        "external_id": row["external_id"],
                        "status": "imported" if row["status"] == "imported" else ("failed" if row["status"] == "failed" else "skipped"),
                        "local_entity_id": row["local_order_id"],
                        "message": row["message"],
                    }
                    for row in order_refresh_result["rows"]
                ],
            }
            order_message = (
                f"Order sync: {order_refresh_result['refreshed_count']} refreshed, {order_refresh_result['imported_count']} imported, "
                f"{order_refresh_result['skipped_count']} skipped, {order_refresh_result['failed_count']} failed."
            )
            messages.append(order_message)
            if order_refresh_result["failed_count"] != 0:
                failed_sections += 1

        finished_at = _now()
        overall_status = "success" if failed_sections == 0 else "failed"
        message = " ".join(messages) if messages else "WooCommerce manual sync finished."
        settings.last_sync_finished_at = finished_at
        settings.last_sync_status = overall_status
        settings.last_sync_message = message
        root_log.status = overall_status
        root_log.message = message
        root_log.finished_at = finished_at
        return {
            "status": overall_status,
            "started_at": started_at,
            "finished_at": finished_at,
            "product_result": product_result,
            "order_result": order_result,
            "message": message,
        }
    except HTTPException as exc:
        finished_at = _now()
        settings.last_sync_finished_at = finished_at
        settings.last_sync_status = "failed"
        settings.last_sync_message = str(exc.detail)
        root_log.status = "failed"
        root_log.message = str(exc.detail)
        root_log.finished_at = finished_at
        raise
