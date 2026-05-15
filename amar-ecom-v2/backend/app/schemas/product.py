from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel

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
    status: str = "active"
    variants: list[ProductVariantCreate] = []


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
    status: str | None = None


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
    status: str
    created_at: datetime
    updated_at: datetime
    category: CategoryRead | None = None
    brand: BrandRead | None = None
    variants: list[ProductVariantRead] = []
