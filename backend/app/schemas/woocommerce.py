from typing import Any
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
    auto_sync_enabled: bool | None = None
    sync_products_enabled: bool | None = None
    sync_orders_enabled: bool | None = None
    sync_interval_minutes: int | None = Field(default=None, ge=1, le=10080)


class WooCommerceSettingRead(ORMBaseSchema):
    id: UUID
    store_url: str | None
    api_version: str
    is_active: bool
    has_consumer_key: bool
    has_consumer_secret: bool
    consumer_key_masked: str | None = None
    credentials_encrypted: bool
    encryption_key_configured: bool
    encryption_warning: str | None = None
    last_tested_at: datetime | None
    last_test_success: bool
    last_test_message: str | None
    auto_sync_enabled: bool
    sync_products_enabled: bool
    sync_orders_enabled: bool
    sync_interval_minutes: int
    last_product_sync_at: datetime | None
    last_order_sync_at: datetime | None
    last_sync_started_at: datetime | None
    last_sync_finished_at: datetime | None
    last_sync_status: str | None
    last_sync_message: str | None
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
    external_stock_quantity: int | None = None
    duplicate_status: str
    local_product_id: UUID | None = None


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
    duplicate_status: str
    local_order_id: UUID | None = None


class WooCommerceOrderPreviewListRead(BaseModel):
    items: list[WooCommerceOrderPreviewRead]
    page: int
    per_page: int
    total: int | None = None
    total_pages: int | None = None


class WooCommerceImportRequest(BaseModel):
    external_ids: list[str] = Field(default_factory=list, min_length=1)


class WooCommerceImportResultRow(BaseModel):
    external_id: str
    status: str
    local_entity_id: UUID | None = None
    message: str


class WooCommerceImportResult(BaseModel):
    imported_count: int
    skipped_count: int
    failed_count: int
    rows: list[WooCommerceImportResultRow] = Field(default_factory=list)


class WooCommerceOrderRefreshRequest(BaseModel):
    status: str | None = None


class WooCommerceOrderRefreshResultRow(BaseModel):
    external_id: str
    status: str
    local_order_id: UUID | None = None
    message: str


class WooCommerceOrderRefreshResult(BaseModel):
    refreshed_count: int = 0
    imported_count: int = 0
    skipped_count: int = 0
    failed_count: int = 0
    rows: list[WooCommerceOrderRefreshResultRow] = Field(default_factory=list)


class WooCommerceProductRefreshRequest(BaseModel):
    search: str | None = None


class WooCommerceProductRefreshResultRow(BaseModel):
    external_id: str
    status: str
    local_product_id: UUID | None = None
    message: str


class WooCommerceProductRefreshResult(BaseModel):
    refreshed_count: int = 0
    imported_count: int = 0
    skipped_count: int = 0
    failed_count: int = 0
    rows: list[WooCommerceProductRefreshResultRow] = Field(default_factory=list)


class WooCommerceBulkProductRefreshRequest(BaseModel):
    since_last_sync: bool = True
    per_page: int = Field(default=20, ge=1, le=100)
    search: str | None = None


class WooCommerceBulkOrderRefreshRequest(BaseModel):
    since_last_sync: bool = True
    per_page: int = Field(default=20, ge=1, le=100)
    status: str | None = None


class WooCommerceSyncLogRead(ORMBaseSchema):
    id: UUID
    sync_type: str
    direction: str
    status: str
    external_id: str | None
    local_entity_type: str | None
    local_entity_id: str | None
    message: str | None
    payload_snapshot: Any | None = None
    created_by_id: UUID | None
    started_at: datetime | None
    finished_at: datetime | None
    created_at: datetime
    created_by: UserRead | None = None


class WooCommerceRunSyncRequest(BaseModel):
    sync_products: bool = True
    sync_orders: bool = True
    since_last_sync: bool = True
    per_page: int = Field(default=20, ge=1, le=100)


class WooCommerceRunSyncResult(BaseModel):
    status: str
    started_at: datetime
    finished_at: datetime
    product_result: WooCommerceImportResult | None = None
    order_result: WooCommerceImportResult | None = None
    message: str


class WooCommerceSyncStatusRead(BaseModel):
    settings: WooCommerceSettingRead
    recent_sync_logs: list[WooCommerceSyncLogRead] = Field(default_factory=list)
    failed_sync_count: int
    recent_product_refresh_failures_count: int
    recent_order_refresh_failures_count: int
    imported_woocommerce_products_count: int
    imported_woocommerce_orders_count: int
    last_product_refresh_at: datetime | None = None
    last_order_refresh_at: datetime | None = None
    ready_to_sync: bool
    readiness_warnings: list[str] = Field(default_factory=list)
