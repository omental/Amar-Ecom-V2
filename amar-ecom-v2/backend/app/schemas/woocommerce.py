from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import ORMBaseSchema
from app.schemas.user import UserRead


class WooCommerceSettingCreate(BaseModel):
    store_url: str | None = None
    consumer_key: str | None = None
    consumer_secret: str | None = None
    api_version: str = "wc/v3"
    is_active: bool = True


class WooCommerceSettingUpdate(BaseModel):
    store_url: str | None = None
    consumer_key: str | None = None
    consumer_secret: str | None = None
    api_version: str | None = None
    is_active: bool | None = None


class WooCommerceSettingRead(ORMBaseSchema):
    id: UUID
    store_url: str | None
    api_version: str
    is_active: bool
    has_consumer_key: bool
    has_consumer_secret: bool
    last_tested_at: datetime | None
    last_test_success: bool
    last_test_message: str | None
    created_at: datetime
    updated_at: datetime


class WooCommerceConnectionTestRead(BaseModel):
    success: bool
    message: str
    tested_at: datetime


class WooCommerceProductPreviewRead(BaseModel):
    external_id: str
    name: str
    slug: str | None = None
    sku: str | None = None
    price: Decimal = Decimal("0.00")
    status: str | None = None
    category: str | None = None
    image_url: str | None = None


class WooCommerceProductPreviewListRead(BaseModel):
    items: list[WooCommerceProductPreviewRead]
    page: int
    per_page: int
    total: int | None = None
    total_pages: int | None = None


class WooCommerceOrderPreviewRead(BaseModel):
    external_id: str
    number: str
    customer: str | None = None
    status: str | None = None
    total: Decimal = Decimal("0.00")
    currency: str | None = None
    created_at: datetime | None = None


class WooCommerceOrderPreviewListRead(BaseModel):
    items: list[WooCommerceOrderPreviewRead]
    page: int
    per_page: int
    total: int | None = None
    total_pages: int | None = None


class WooCommerceImportRequest(BaseModel):
    external_ids: list[str] = Field(default_factory=list, min_length=1)


class WooCommerceImportResult(BaseModel):
    imported: int
    skipped: int
    failed: int
    messages: list[str] = Field(default_factory=list)


class WooCommerceSyncLogRead(ORMBaseSchema):
    id: UUID
    sync_type: str
    direction: str
    status: str
    external_id: str | None
    local_entity_type: str | None
    local_entity_id: str | None
    message: str | None
    payload_snapshot: str | None
    created_by_id: UUID | None
    started_at: datetime | None
    finished_at: datetime | None
    created_at: datetime
    created_by: UserRead | None = None
