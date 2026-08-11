from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.schemas.common import ORMBaseSchema


class MediaAssetUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=255)
    alt_text: str | None = Field(default=None, max_length=500)
    caption: str | None = Field(default=None, max_length=5000)

    @field_validator("title", "alt_text", "caption")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None


class MediaAssetRead(ORMBaseSchema):
    id: UUID
    filename: str
    original_filename: str
    mime_type: str
    file_size: int
    width: int | None
    height: int | None
    title: str | None
    alt_text: str | None
    caption: str | None
    uploaded_by_id: UUID | None
    created_at: datetime
    updated_at: datetime
    public_url: str


class MediaAssetPage(BaseModel):
    items: list[MediaAssetRead]
    total: int
    skip: int
    limit: int
    has_more: bool


class MediaUsageRecord(BaseModel):
    type: str
    entity_id: UUID
    label: str


class MediaUsageConflict(BaseModel):
    message: str
    product_count: int
    usages: list[MediaUsageRecord]
