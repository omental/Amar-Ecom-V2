import json
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from uuid import UUID

from fastapi import APIRouter, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload

from app.api.deps import DBSession
from app.api.utils import fetch_one_or_404, normalize_pagination
from app.models.brand import Brand
from app.models.category import Category
from app.models.product import Product
from app.models.storefront import StorefrontContentEntry, StorefrontContentModel, StorefrontCustomFieldDefinition, StorefrontCustomFieldValue
from app.schemas.public_storefront import (
    PublicBrandRead,
    PublicCategoryRead,
    PublicProductListResponse,
    PublicProductRead,
    PublicProductVariantRead,
)


router = APIRouter()

PUBLIC_PRODUCT_STATUSES = {"active", "public", "published"}


def _public_product_query():
    return select(Product).options(
        selectinload(Product.category),
        selectinload(Product.brand),
        selectinload(Product.inventory_items),
        selectinload(Product.variants),
    )


def _parse_price(value: object) -> Decimal | None:
    if value in (None, ""):
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return None


def _snapshot_prices(product: Product) -> tuple[Decimal | None, Decimal | None]:
    if not product.external_payload_snapshot:
        return None, None

    try:
        snapshot = json.loads(product.external_payload_snapshot)
    except (TypeError, ValueError):
        return None, None

    if not isinstance(snapshot, dict):
        return None, None

    woo_product = snapshot.get("woo_product")
    if not isinstance(woo_product, dict):
        return None, None

    regular_price = _parse_price(woo_product.get("regular_price"))
    sale_price = _parse_price(woo_product.get("sale_price"))
    current_price = _parse_price(woo_product.get("price"))

    return regular_price or current_price, sale_price or current_price


def _snapshot_payload(product: Product) -> dict:
    if not product.external_payload_snapshot:
        return {}

    try:
        snapshot = json.loads(product.external_payload_snapshot)
    except (TypeError, ValueError):
        return {}

    return snapshot if isinstance(snapshot, dict) else {}


def _short_description(description: str | None) -> str | None:
    if not description:
        return None
    collapsed = " ".join(description.split())
    if len(collapsed) <= 140:
        return collapsed
    return f"{collapsed[:137].rstrip()}..."


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


def _serialize_product(product: Product) -> PublicProductRead:
    snapshot = _snapshot_payload(product)
    regular_price, snapshot_sale_price = _snapshot_prices(product)
    base_price = regular_price or product.price
    sale_price = snapshot_sale_price or product.price

    if sale_price > base_price:
        base_price = sale_price

    is_public = product.status.lower() in PUBLIC_PRODUCT_STATUSES
    storefront_demo = snapshot.get("storefront_demo")
    if not isinstance(storefront_demo, dict):
        storefront_demo = {}

    gallery = storefront_demo.get("gallery")
    if not isinstance(gallery, list):
        gallery = []

    colors = storefront_demo.get("colors")
    if not isinstance(colors, list):
        colors = []

    sizes = storefront_demo.get("sizes")
    if not isinstance(sizes, list):
        sizes = []

    support_notes = storefront_demo.get("support_notes")
    if not isinstance(support_notes, list):
        support_notes = []

    return PublicProductRead(
        id=product.id,
        name=product.name,
        slug=product.slug,
        sku=product.sku,
        price=base_price,
        sale_price=sale_price,
        image=product.image_url,
        thumbnail=product.image_url,
        gallery=[str(item) for item in gallery if isinstance(item, str)],
        category=PublicCategoryRead.model_validate(product.category) if product.category else None,
        brand=PublicBrandRead.model_validate(product.brand) if product.brand else None,
        stock_status=_stock_status(product),
        short_description=_short_description(product.description),
        description=product.description,
        colors=[str(item) for item in colors if isinstance(item, str)],
        sizes=[str(item) for item in sizes if isinstance(item, str)],
        support_notes=[str(item) for item in support_notes if isinstance(item, str)],
        is_demo_reference=bool(storefront_demo.get("is_demo_reference")),
        demo_notice=(
            str(storefront_demo.get("demo_notice"))
            if storefront_demo.get("demo_notice") is not None
            else None
        ),
        is_active=is_public,
        is_public=is_public,
        variants=[PublicProductVariantRead.model_validate(variant) for variant in product.variants],
    )


async def _public_custom_fields(db: DBSession, owner_type: str, owner_ids: list[UUID]) -> dict[UUID, dict[str, object]]:
    if not owner_ids: return {}
    rows = (await db.execute(
        select(StorefrontCustomFieldValue, StorefrontCustomFieldDefinition)
        .join(StorefrontCustomFieldDefinition, StorefrontCustomFieldDefinition.id == StorefrontCustomFieldValue.definition_id)
        .where(StorefrontCustomFieldValue.owner_type == owner_type, StorefrontCustomFieldValue.owner_id.in_(owner_ids), StorefrontCustomFieldDefinition.is_public.is_(True))
    )).all()
    references = [value.value for value, definition in rows if definition.value_type == "reference" and isinstance(value.value, dict)]
    model_keys = {item.get("model_key") for item in references if isinstance(item.get("model_key"), str)}
    handles = {item.get("entry_handle") for item in references if isinstance(item.get("entry_handle"), str)}
    entry_map: dict[tuple[str, str], dict] = {}
    if model_keys and handles:
        entries = (await db.execute(select(StorefrontContentEntry, StorefrontContentModel.key).join(StorefrontContentModel).where(StorefrontContentModel.key.in_(model_keys), StorefrontContentEntry.handle.in_(handles), StorefrontContentEntry.status == "active"))).all()
        entry_map = {(model_key, entry.handle): entry.values for entry, model_key in entries}
    result: dict[UUID, dict[str, object]] = {}
    for value, definition in rows:
        resolved = value.value
        if definition.value_type == "reference" and isinstance(resolved, dict):
            expanded = entry_map.get((str(resolved.get("model_key")), str(resolved.get("entry_handle"))))
            resolved = {**resolved, "values": expanded} if expanded is not None else resolved
        result.setdefault(value.owner_id, {})[f"{definition.namespace}.{definition.key}"] = resolved
    return result


@router.get("/products", response_model=PublicProductListResponse)
async def list_public_products(
    db: DBSession,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=24, ge=1, le=100),
    search: str | None = Query(default=None),
    category_slug: str | None = Query(default=None),
    brand_slug: str | None = Query(default=None),
) -> PublicProductListResponse:
    skip, limit = normalize_pagination(skip, limit)
    filters = [func.lower(Product.status).in_(PUBLIC_PRODUCT_STATUSES)]

    if search:
        term = f"%{search.strip()}%"
        filters.append(
            or_(
                Product.name.ilike(term),
                Product.slug.ilike(term),
                Product.description.ilike(term),
            )
        )

    if category_slug:
        filters.append(Category.slug == category_slug)

    if brand_slug:
        filters.append(Brand.slug == brand_slug)

    count_query = (
        select(func.count(Product.id))
        .select_from(Product)
        .join(Category, Product.category_id == Category.id, isouter=True)
        .join(Brand, Product.brand_id == Brand.id, isouter=True)
        .where(*filters)
    )
    total = int((await db.execute(count_query)).scalar_one())

    products_query = (
        _public_product_query()
        .join(Category, Product.category_id == Category.id, isouter=True)
        .join(Brand, Product.brand_id == Brand.id, isouter=True)
        .where(*filters)
        .order_by(Product.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(products_query)
    products = result.scalars().unique().all()
    custom = await _public_custom_fields(db, "product", [product.id for product in products])
    items = [_serialize_product(product).model_copy(update={"custom_fields": custom.get(product.id, {})}) for product in products]

    return PublicProductListResponse(
        items=items,
        total=total,
        skip=skip,
        limit=limit,
        generated_at=datetime.now(timezone.utc),
    )


@router.get("/products/{product_id}", response_model=PublicProductRead)
async def get_public_product(product_id: UUID, db: DBSession) -> PublicProductRead:
    product = await fetch_one_or_404(
        db,
        _public_product_query().where(
            Product.id == product_id,
            func.lower(Product.status).in_(PUBLIC_PRODUCT_STATUSES),
        ),
        "Public product not found",
    )
    custom = await _public_custom_fields(db, "product", [product.id])
    return _serialize_product(product).model_copy(update={"custom_fields": custom.get(product.id, {})})


@router.get("/products/slug/{slug}", response_model=PublicProductRead)
async def get_public_product_by_slug(slug: str, db: DBSession) -> PublicProductRead:
    product = await fetch_one_or_404(
        db,
        _public_product_query().where(
            Product.slug == slug,
            func.lower(Product.status).in_(PUBLIC_PRODUCT_STATUSES),
        ),
        "Public product not found",
    )
    custom = await _public_custom_fields(db, "product", [product.id])
    return _serialize_product(product).model_copy(update={"custom_fields": custom.get(product.id, {})})


@router.get("/categories", response_model=list[PublicCategoryRead])
async def list_public_categories(db: DBSession) -> list[PublicCategoryRead]:
    result = await db.execute(
        select(Category)
        .join(Product, Product.category_id == Category.id)
        .where(func.lower(Product.status).in_(PUBLIC_PRODUCT_STATUSES))
        .distinct()
        .order_by(Category.name.asc())
    )
    categories = list(result.scalars().all())
    custom = await _public_custom_fields(db, "collection", [item.id for item in categories])
    return [PublicCategoryRead.model_validate(item).model_copy(update={"custom_fields": custom.get(item.id, {})}) for item in categories]


@router.get("/brands", response_model=list[PublicBrandRead])
async def list_public_brands(db: DBSession) -> list[Brand]:
    result = await db.execute(
        select(Brand)
        .join(Product, Product.brand_id == Brand.id)
        .where(func.lower(Product.status).in_(PUBLIC_PRODUCT_STATUSES))
        .distinct()
        .order_by(Brand.name.asc())
    )
    return list(result.scalars().all())
