from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import DBSession, get_current_user, get_entitlement_context, require_permission
from app.api.utils import (
    commit_or_409,
    ensure_no_duplicates,
    ensure_unique,
    fetch_one_or_404,
    normalize_pagination,
)
from app.models.product import Product, ProductVariant
from app.models.category import Category
from app.models.brand import Brand
from app.schemas.product import (
    ProductCreate,
    ProductRead,
    ProductUpdate,
    ProductVariantCreate,
    ProductVariantRead,
    ProductVariantUpdate,
)
from app.services.storefront_theme_service import validate_template_assignment
from app.services.commercial_access_service import EntitlementService


router = APIRouter(dependencies=[Depends(get_current_user)])


def _product_query():
    return select(Product).options(
        selectinload(Product.category),
        selectinload(Product.brand),
        selectinload(Product.variants),
        selectinload(Product.inventory_items),
    )


@router.get("", response_model=list[ProductRead])
async def list_products(
    db: DBSession,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
) -> list[Product]:
    skip, limit = normalize_pagination(skip, limit)
    result = await db.execute(
        _product_query().order_by(Product.created_at.desc()).offset(skip)
        .limit(limit)
    )
    return list(result.scalars().unique().all())


@router.get("/{product_id}", response_model=ProductRead)
async def get_product(product_id: UUID, db: DBSession) -> Product:
    return await fetch_one_or_404(db, _product_query().where(Product.id == product_id), "Product not found")


@router.post("", response_model=ProductRead, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_permission("products", "create"))])
async def create_product(product_in: ProductCreate, db: DBSession, access: EntitlementService = Depends(get_entitlement_context)) -> Product:
    await access.require_capacity("product_limit")
    if product_in.category_id:
        await fetch_one_or_404(db, select(Category).where(Category.id == product_in.category_id), "Category not found")
    if product_in.brand_id:
        await fetch_one_or_404(db, select(Brand).where(Brand.id == product_in.brand_id), "Brand not found")
    await validate_template_assignment(db, product_in.storefront_template_id, "product")
    await ensure_unique(db, Product, "slug", product_in.slug, "Product slug already exists")
    await ensure_unique(db, Product, "sku", product_in.sku, "Product SKU already exists")
    ensure_no_duplicates([variant.sku for variant in product_in.variants], "Duplicate variant SKU in request")

    for variant in product_in.variants:
        await ensure_unique(db, ProductVariant, "sku", variant.sku, "Product variant SKU already exists")

    payload = product_in.model_dump(exclude={"variants"})
    product = Product(**payload)
    for variant_in in product_in.variants:
        product.variants.append(ProductVariant(**variant_in.model_dump()))

    db.add(product)
    await commit_or_409(db, "Could not create product")
    await db.refresh(product)

    return await fetch_one_or_404(db, _product_query().where(Product.id == product.id), "Product not found")


@router.patch("/{product_id}", response_model=ProductRead, dependencies=[Depends(require_permission("products", "update"))])
async def update_product(product_id: UUID, product_in: ProductUpdate, db: DBSession) -> Product:
    product = await fetch_one_or_404(db, select(Product).where(Product.id == product_id), "Product not found")
    payload = product_in.model_dump(exclude_unset=True)
    if "storefront_template_id" in payload:
        await validate_template_assignment(db, payload["storefront_template_id"], "product")
    if payload.get("category_id"):
        await fetch_one_or_404(db, select(Category).where(Category.id == payload["category_id"]), "Category not found")
    if payload.get("brand_id"):
        await fetch_one_or_404(db, select(Brand).where(Brand.id == payload["brand_id"]), "Brand not found")

    if "slug" in payload:
        await ensure_unique(db, Product, "slug", payload["slug"], "Product slug already exists", exclude_id=product.id)
    if "sku" in payload:
        await ensure_unique(db, Product, "sku", payload["sku"], "Product SKU already exists", exclude_id=product.id)

    for field, value in payload.items():
        setattr(product, field, value)

    await commit_or_409(db, "Could not update product")
    await db.refresh(product)
    return await fetch_one_or_404(db, _product_query().where(Product.id == product.id), "Product not found")


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_permission("products", "delete"))])
async def delete_product(product_id: UUID, db: DBSession) -> Response:
    product = await fetch_one_or_404(db, select(Product).where(Product.id == product_id), "Product not found")
    await db.delete(product)
    await commit_or_409(db, "Product cannot be deleted because it is in use")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{product_id}/variants", response_model=list[ProductVariantRead])
async def list_product_variants(product_id: UUID, db: DBSession) -> list[ProductVariant]:
    await fetch_one_or_404(db, select(Product).where(Product.id == product_id), "Product not found")
    result = await db.execute(
        select(ProductVariant)
        .where(ProductVariant.product_id == product_id)
        .order_by(ProductVariant.created_at.asc())
    )
    return list(result.scalars().all())


@router.post(
    "/{product_id}/variants",
    response_model=ProductVariantRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("products", "update"))],
)
async def create_product_variant(
    product_id: UUID,
    variant_in: ProductVariantCreate,
    db: DBSession,
) -> ProductVariant:
    await fetch_one_or_404(db, select(Product).where(Product.id == product_id), "Product not found")
    await ensure_unique(db, ProductVariant, "sku", variant_in.sku, "Product variant SKU already exists")

    variant = ProductVariant(product_id=product_id, **variant_in.model_dump())
    db.add(variant)
    await commit_or_409(db, "Could not create product variant")
    await db.refresh(variant)
    return variant


@router.patch("/{product_id}/variants/{variant_id}", response_model=ProductVariantRead, dependencies=[Depends(require_permission("products", "update"))])
async def update_product_variant(
    product_id: UUID,
    variant_id: UUID,
    variant_in: ProductVariantUpdate,
    db: DBSession,
) -> ProductVariant:
    variant = await fetch_one_or_404(
        db,
        select(ProductVariant).where(
            ProductVariant.id == variant_id,
            ProductVariant.product_id == product_id,
        ),
        "Product variant not found",
    )
    payload = variant_in.model_dump(exclude_unset=True)

    if "sku" in payload:
        await ensure_unique(
            db,
            ProductVariant,
            "sku",
            payload["sku"],
            "Product variant SKU already exists",
            exclude_id=variant.id,
        )

    for field, value in payload.items():
        setattr(variant, field, value)

    await commit_or_409(db, "Could not update product variant")
    await db.refresh(variant)
    return variant


@router.delete("/{product_id}/variants/{variant_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_permission("products", "update"))])
async def delete_product_variant(product_id: UUID, variant_id: UUID, db: DBSession) -> Response:
    variant = await fetch_one_or_404(
        db,
        select(ProductVariant).where(
            ProductVariant.id == variant_id,
            ProductVariant.product_id == product_id,
        ),
        "Product variant not found",
    )
    await db.delete(variant)
    await commit_or_409(db, "Product variant cannot be deleted because it is in use")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
