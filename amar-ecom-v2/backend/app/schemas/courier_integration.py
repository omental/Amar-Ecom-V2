from typing import Any
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, computed_field

from app.schemas.common import ORMBaseSchema
from app.schemas.user import UserRead


class CourierProviderSettingCreate(BaseModel):
    display_name: str | None = None
    base_url: str | None = None
    api_key: str | None = None
    api_secret: str | None = None
    merchant_id: str | None = None
    username: str | None = None
    password: str | None = None
    is_active: bool = True
    is_sandbox: bool = True


class CourierProviderSettingUpdate(BaseModel):
    display_name: str | None = None
    base_url: str | None = None
    api_key: str | None = None
    api_secret: str | None = None
    merchant_id: str | None = None
    username: str | None = None
    password: str | None = None
    is_active: bool | None = None
    is_sandbox: bool | None = None


class CourierProviderSettingRead(ORMBaseSchema):
    id: UUID
    provider: str
    display_name: str
    base_url: str | None
    has_api_key: bool
    has_api_secret: bool
    has_merchant_id: bool
    has_username: bool
    has_password: bool
    api_key_masked: str | None = None
    api_secret_masked: str | None = None
    merchant_id_masked: str | None = None
    username_masked: str | None = None
    password_masked: str | None = None
    credentials_encrypted: bool
    encryption_key_configured: bool
    encryption_warning: str | None = None
    is_active: bool
    is_sandbox: bool
    last_tested_at: datetime | None
    last_test_success: bool
    last_test_message: str | None
    created_at: datetime
    updated_at: datetime


class CourierConnectionTestRead(BaseModel):
    provider: str
    success: bool
    message: str
    tested_at: datetime


class CourierApiLogRead(ORMBaseSchema):
    id: UUID
    provider: str
    action: str
    status: str
    shipment_id: UUID | None
    shipment_number: str | None = None
    order_number: str | None = None
    external_id: str | None
    request_snapshot: Any | None = None
    response_snapshot: Any | None = None
    response_summary: str | None = None
    message: str | None
    created_by_id: UUID | None
    started_at: datetime | None
    finished_at: datetime | None
    created_at: datetime
    created_by: UserRead | None = None

    @computed_field(return_type=datetime | None)
    @property
    def requestAt(self) -> datetime | None:
        return self.started_at or self.created_at

    @computed_field(return_type=datetime)
    @property
    def createdAt(self) -> datetime:
        return self.created_at


class CourierSendShipmentRequest(BaseModel):
    provider: str


class CourierSendShipmentResult(BaseModel):
    status: str
    provider: str
    shipment_id: UUID
    external_id: str | None = None
    external_tracking_number: str | None = None
    external_status: str | None = None
    sent_at: datetime | None = None
    message: str
    request_snapshot: Any | None = None
    response_snapshot: Any | None = None


class CourierStatusSyncRequest(BaseModel):
    provider: str | None = None
    apply_safe_status: bool = False


class CourierStatusSyncResult(BaseModel):
    status: str
    provider: str
    shipment_id: UUID
    shipment_number: str | None = None
    external_id: str | None = None
    external_tracking_number: str | None = None
    old_external_status: str | None = None
    external_status: str | None = None
    normalized_external_status: str | None = None
    internal_status: str | None = None
    suggested_internal_status: str | None = None
    internal_status_changed: bool = False
    severity: str | None = None
    warnings: list[str] = Field(default_factory=list)
    synced_at: datetime | None = None
    message: str
    request_snapshot: Any | None = None
    response_snapshot: Any | None = None


class CourierBulkStatusSyncRequest(BaseModel):
    provider: str | None = None
    status: str | None = None
    limit: int = Field(default=20, ge=1, le=100)
    apply_safe_status: bool = False


class CourierBulkStatusSyncRowResult(BaseModel):
    shipment_id: UUID
    shipment_number: str
    provider: str
    old_external_status: str | None = None
    new_external_status: str | None = None
    internal_status_changed: bool = False
    message: str
    warnings: list[str] = Field(default_factory=list)
    status: str


class CourierBulkStatusSyncResult(BaseModel):
    synced_count: int
    skipped_count: int
    failed_count: int
    rows: list[CourierBulkStatusSyncRowResult] = Field(default_factory=list)


class CourierLogListFilters(BaseModel):
    provider: str | None = None
    action: str | None = None
    status: str | None = None
    shipment_id: UUID | None = None
    external_id: str | None = None
    date_from: datetime | None = None
    date_to: datetime | None = None
    search: str | None = None
    skip: int = Field(default=0, ge=0)
    limit: int = Field(default=100, ge=1, le=200)
