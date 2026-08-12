from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field, computed_field, field_validator, model_validator

from app.schemas.brand import BrandRead
from app.schemas.category import CategoryRead
from app.schemas.common import ORMBaseSchema


class ProductVariantCreate(BaseModel):
    name: str
    sku: str
    price: Decimal
    stock_quantity: int = 0


class ProductVariantUpdate(BaseModel):
    name: str | None = None
    sku: str | None = None
    price: Decimal | None = None
    stock_quantity: int | None = None


class ProductVariantRead(ORMBaseSchema):
    id: UUID
    product_id: UUID
    name: str
    sku: str
    price: Decimal
    stock_quantity: int
    created_at: datetime
    updated_at: datetime

    @computed_field(return_type=str | None)
    @property
    def barcode(self) -> str | None:
        return self.sku

    @computed_field(return_type=datetime)
    @property
    def createdAt(self) -> datetime:
        return self.created_at

    @computed_field(return_type=datetime)
    @property
    def updatedAt(self) -> datetime:
        return self.updated_at


class ProductCreate(BaseModel):
    name: str
    slug: str
    sku: str
    description: str | None = None
    category_id: UUID | None = None
    brand_id: UUID | None = None
    price: Decimal
    cost_price: Decimal
    image_url: str | None = None
    gallery_image_urls: list[str] = Field(default_factory=list)
    size_guide_image_url: str | None = None
    status: str = "active"
    variants: list[ProductVariantCreate] = Field(default_factory=list)
    storefront_template_id: UUID | None = None

    @field_validator("gallery_image_urls")
    @classmethod
    def normalize_gallery_urls(cls, value: list[str]) -> list[str]:
        return [url.strip() for url in value if url.strip()]


class ProductUpdate(BaseModel):
    name: str | None = None
    slug: str | None = None
    sku: str | None = None
    description: str | None = None
    category_id: UUID | None = None
    brand_id: UUID | None = None
    price: Decimal | None = None
    cost_price: Decimal | None = None
    image_url: str | None = None
    gallery_image_urls: list[str] | None = None
    size_guide_image_url: str | None = None
    status: str | None = None
    storefront_template_id: UUID | None = None

    @field_validator("gallery_image_urls")
    @classmethod
    def normalize_gallery_urls(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return []
        return [url.strip() for url in value if url.strip()]


class ProductRead(ORMBaseSchema):
    id: UUID
    name: str
    slug: str
    sku: str
    description: str | None
    source: str | None = None
    external_id: str | None = None
    external_slug: str | None = None
    external_status: str | None = None
    external_synced_at: datetime | None = None
    external_payload_snapshot: str | None = None
    external_stock_quantity: int | None = None
    category_id: UUID | None
    brand_id: UUID | None
    price: Decimal
    cost_price: Decimal
    image_url: str | None
    gallery_image_urls: list[str] = Field(default_factory=list)
    size_guide_image_url: str | None = None
    status: str
    storefront_template_id: UUID | None = None
    created_at: datetime
    updated_at: datetime
    category: CategoryRead | None = None
    brand: BrandRead | None = None
    variants: list[ProductVariantRead] = Field(default_factory=list)
    productName: str | None = None
    barcode: str | None = None
    categoryName: str | None = None
    brandName: str | None = None
    salePrice: Decimal | None = None
    costPrice: Decimal | None = None
    stockLevel: int = 0
    reorderPoint: int = 5
    lowStockThreshold: int = 5
    image: str | None = None
    imageUrl: str | None = None
    hasVariants: bool = False
    variantsCount: int = 0
    createdAt: datetime | None = None
    updatedAt: datetime | None = None

    @model_validator(mode="before")
    @classmethod
    def populate_compat_fields(cls, value):
        if isinstance(value, dict):
            return value

        inventory_items = getattr(value, "inventory_items", []) or []
        category = getattr(value, "category", None)
        brand = getattr(value, "brand", None)
        variants = getattr(value, "variants", []) or []
        thresholds = [item.low_stock_threshold for item in inventory_items]
        reorder_point = min(thresholds) if thresholds else 5

        return {
            "id": value.id,
            "name": value.name,
            "slug": value.slug,
            "sku": value.sku,
            "description": value.description,
            "source": value.source,
            "external_id": value.external_id,
            "external_slug": value.external_slug,
            "external_status": value.external_status,
            "external_synced_at": value.external_synced_at,
            "external_payload_snapshot": value.external_payload_snapshot,
            "external_stock_quantity": value.external_stock_quantity,
            "category_id": value.category_id,
            "brand_id": value.brand_id,
            "price": value.price,
            "cost_price": value.cost_price,
            "image_url": value.image_url,
            "gallery_image_urls": value.gallery_image_urls or [],
            "size_guide_image_url": value.size_guide_image_url,
            "status": value.status,
            "created_at": value.created_at,
            "updated_at": value.updated_at,
            "category": category,
            "brand": brand,
            "variants": variants,
            "productName": value.name,
            "barcode": value.sku,
            "categoryName": getattr(category, "name", None),
            "brandName": getattr(brand, "name", None),
            "salePrice": value.price,
            "costPrice": value.cost_price,
            "stockLevel": sum(item.quantity for item in inventory_items),
            "reorderPoint": reorder_point,
            "lowStockThreshold": reorder_point,
            "image": value.image_url,
            "imageUrl": value.image_url,
            "hasVariants": len(variants) > 0,
            "variantsCount": len(variants),
            "createdAt": value.created_at,
            "updatedAt": value.updated_at,
        }
