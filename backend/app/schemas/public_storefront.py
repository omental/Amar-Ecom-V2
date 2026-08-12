from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel

from app.schemas.common import ORMBaseSchema


class PublicCategoryRead(ORMBaseSchema):
    id: UUID
    name: str
    slug: str
    description: str | None = None
    image: str | None = None
    custom_fields: dict[str, object] = {}


class PublicBrandRead(ORMBaseSchema):
    id: UUID
    name: str
    slug: str
    description: str | None = None


class PublicProductRead(ORMBaseSchema):
    id: UUID
    name: str
    slug: str
    sku: str | None = None
    price: Decimal
    sale_price: Decimal
    image: str | None = None
    thumbnail: str | None = None
    gallery: list[str] = []
    category: PublicCategoryRead | None = None
    brand: PublicBrandRead | None = None
    stock_status: str
    short_description: str | None = None
    description: str | None = None
    colors: list[str] = []
    sizes: list[str] = []
    support_notes: list[str] = []
    is_demo_reference: bool = False
    demo_notice: str | None = None
    is_active: bool
    is_public: bool
    variants: list["PublicProductVariantRead"] = []
    custom_fields: dict[str, object] = {}


class PublicProductVariantRead(ORMBaseSchema):
    id: UUID
    name: str
    sku: str
    price: Decimal
    stock_quantity: int


class PublicProductListResponse(BaseModel):
    items: list[PublicProductRead]
    total: int
    skip: int
    limit: int
    generated_at: datetime
