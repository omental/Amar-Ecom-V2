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


class PublicBrandRead(ORMBaseSchema):
    id: UUID
    name: str
    slug: str
    description: str | None = None


class PublicProductRead(ORMBaseSchema):
    id: UUID
    name: str
    slug: str
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


class PublicProductListResponse(BaseModel):
    items: list[PublicProductRead]
    total: int
    skip: int
    limit: int
    generated_at: datetime
