from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.tenant import is_valid_store_slug


class OrganizationSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    name: str
    slug: str
    status: str


class StoreSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    organization_id: UUID
    name: str
    slug: str
    status: str
    timezone: str
    locale: str
    default_currency: str
    is_primary: bool


class CurrentTenantResponse(BaseModel):
    organization: OrganizationSummary
    store: StoreSummary
    stores: list[StoreSummary]
    organization_role: str
    store_role: str | None


class StoreUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    slug: str | None = Field(default=None, min_length=1, max_length=100)
    timezone: str | None = Field(default=None, min_length=1, max_length=100)
    locale: str | None = Field(default=None, min_length=2, max_length=20)
    default_currency: str | None = Field(default=None, min_length=3, max_length=10)

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, value: str | None) -> str | None:
        if value is not None and not is_valid_store_slug(value):
            raise ValueError("Use lowercase letters, numbers, or hyphens; reserved platform slugs are not allowed")
        return value


class StoreCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    slug: str = Field(min_length=1, max_length=100)
    timezone: str = Field(default="Asia/Dhaka", min_length=1, max_length=100)
    locale: str = Field(default="en-BD", min_length=2, max_length=20)
    default_currency: str = Field(default="BDT", min_length=3, max_length=10)

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, value: str) -> str:
        if not is_valid_store_slug(value):
            raise ValueError("Use lowercase letters, numbers, or hyphens; reserved platform slugs are not allowed")
        return value


class StoreSwitchResponse(BaseModel):
    store: StoreSummary
    selected_at: datetime
