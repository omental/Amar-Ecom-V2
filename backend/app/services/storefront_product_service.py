import json
from decimal import Decimal, InvalidOperation
from typing import Any
from uuid import UUID

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.category import Category
from app.models.order import OrderItem
from app.models.product import Product


PUBLIC_PRODUCT_STATUSES = {"active", "public", "published"}
PRODUCT_SECTION_TYPES = {"new_arrivals", "product_grid", "featured_collection", "best_selling", "flash_sale"}


def _parse_price(value: object) -> Decimal | None:
    if value in (None, ""):
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return None


def _snapshot_payload(product: Product) -> dict[str, Any]:
    if not product.external_payload_snapshot:
        return {}
    try:
        snapshot = json.loads(product.external_payload_snapshot)
    except (TypeError, ValueError):
        return {}
    return snapshot if isinstance(snapshot, dict) else {}


def _snapshot_prices(product: Product) -> tuple[Decimal | None, Decimal | None]:
    snapshot = _snapshot_payload(product)
    woo_product = snapshot.get("woo_product")
    if not isinstance(woo_product, dict):
        return None, None

    regular_price = _parse_price(woo_product.get("regular_price"))
    sale_price = _parse_price(woo_product.get("sale_price"))
    current_price = _parse_price(woo_product.get("price"))
    return regular_price or current_price, sale_price or current_price


def _stock_status(product: Product) -> str:
    inventory_quantity = sum(item.quantity for item in (product.inventory_items or []))
    variant_quantity = sum(variant.stock_quantity for variant in (product.variants or []))
    external_quantity = product.external_stock_quantity or 0
    total_quantity = max(inventory_quantity, variant_quantity, external_quantity)
    if total_quantity <= 0:
        return "out_of_stock"
    if total_quantity <= 5:
        return "low_stock"
    return "in_stock"


def _product_card_payload(product: Product) -> dict[str, Any]:
    regular_price, sale_price = _snapshot_prices(product)
    current_price = sale_price or product.price
    compare_price = regular_price or product.price

    if current_price > compare_price:
        compare_price = current_price

    badge = None
    if compare_price and current_price and compare_price > current_price:
        discount = ((compare_price - current_price) / compare_price) * Decimal("100")
        badge = f"{int(discount.quantize(Decimal('1')))}% OFF"

    return {
        "id": str(product.id),
        "slug": product.slug,
        "name": product.name,
        "image_url": product.image_url,
        "price": float(current_price),
        "old_price": float(compare_price) if compare_price > current_price else None,
        "category": product.category.name if product.category else None,
        "badge": badge,
        "stock_status": _stock_status(product),
    }


def _base_public_product_query():
    return (
        select(Product)
        .options(
            selectinload(Product.category),
            selectinload(Product.inventory_items),
            selectinload(Product.variants),
        )
        .where(func.lower(Product.status).in_(PUBLIC_PRODUCT_STATUSES))
    )


async def resolve_storefront_section_products(
    db: AsyncSession,
    *,
    section_type: str,
    settings: dict[str, Any] | None,
) -> list[dict[str, Any]]:
    if section_type not in PRODUCT_SECTION_TYPES:
        return []

    payload = settings or {}
    source = str(payload.get("source") or section_type)
    limit = max(1, min(int(payload.get("limit") or 8), 24))

    if source == "manual":
        raw_ids = payload.get("product_ids") or []
        product_ids: list[UUID] = []
        for raw_id in raw_ids:
            try:
                product_ids.append(UUID(str(raw_id)))
            except (TypeError, ValueError):
                continue
        if not product_ids:
            return []

        result = await db.execute(_base_public_product_query().where(Product.id.in_(product_ids)))
        products = list(result.scalars().unique().all())
        ordering = {str(product_id): index for index, product_id in enumerate(product_ids)}
        products.sort(key=lambda item: ordering.get(str(item.id), len(ordering)))
        return [_product_card_payload(product) for product in products[:limit]]

    stmt = _base_public_product_query()

    if source == "category":
        category_slug = str(payload.get("category_slug") or "").strip().lower()
        if not category_slug:
            return []
        stmt = (
            stmt.join(Category, Product.category_id == Category.id)
            .where(func.lower(Category.slug) == category_slug)
            .order_by(Product.created_at.desc())
            .limit(limit)
        )
        result = await db.execute(stmt)
        return [_product_card_payload(product) for product in result.scalars().unique().all()]

    if source == "best_selling":
        sales_subquery = (
            select(
                OrderItem.product_id.label("product_id"),
                func.coalesce(func.sum(OrderItem.quantity), 0).label("units_sold"),
            )
            .where(OrderItem.product_id.is_not(None))
            .group_by(OrderItem.product_id)
            .subquery()
        )
        stmt = (
            stmt.outerjoin(sales_subquery, Product.id == sales_subquery.c.product_id)
            .order_by(
                func.coalesce(sales_subquery.c.units_sold, 0).desc(),
                Product.created_at.desc(),
            )
            .limit(limit)
        )
        result = await db.execute(stmt)
        return [_product_card_payload(product) for product in result.scalars().unique().all()]

    if source == "flash_sale":
        discounted_rank = case(
            (Product.external_payload_snapshot.is_not(None), 0),
            else_=1,
        )
        stmt = stmt.order_by(discounted_rank.asc(), Product.created_at.desc()).limit(limit)
        result = await db.execute(stmt)
        products = list(result.scalars().unique().all())
        discounted_products = [
            product
            for product in products
            if (_snapshot_prices(product)[0] or product.price) > (_snapshot_prices(product)[1] or product.price)
        ]
        selected = discounted_products or products
        return [_product_card_payload(product) for product in selected[:limit]]

    stmt = stmt.order_by(Product.created_at.desc()).limit(limit)
    result = await db.execute(stmt)
    return [_product_card_payload(product) for product in result.scalars().unique().all()]
