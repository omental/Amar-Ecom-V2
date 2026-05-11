from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from app.schemas.common import ORMBaseSchema


class BusinessSettingsRead(ORMBaseSchema):
    id: UUID
    company_name: str
    business_email: EmailStr | None
    business_phone: str | None
    business_address: str | None
    website: str | None
    currency: str
    timezone: str
    invoice_prefix: str
    order_prefix: str
    low_stock_default_threshold: int
    tax_rate: Decimal
    logo_url: str | None
    created_at: datetime
    updated_at: datetime


class BusinessSettingsUpdate(BaseModel):
    company_name: str | None = None
    business_email: EmailStr | None = None
    business_phone: str | None = None
    business_address: str | None = None
    website: str | None = None
    currency: str | None = None
    timezone: str | None = None
    invoice_prefix: str | None = Field(default=None, min_length=1, max_length=20)
    order_prefix: str | None = Field(default=None, min_length=1, max_length=20)
    low_stock_default_threshold: int | None = Field(default=None, ge=0)
    tax_rate: Decimal | None = Field(default=None, ge=0)
    logo_url: str | None = None
