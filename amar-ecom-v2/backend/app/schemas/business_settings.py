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
    invoice_title: str
    invoice_footer_note: str | None
    invoice_terms: str | None
    payment_instructions: str | None
    show_logo_on_invoice: bool
    show_business_address_on_invoice: bool
    show_customer_phone_on_invoice: bool
    show_payment_status_on_invoice: bool
    show_warehouse_on_invoice: bool
    invoice_template: str
    invoice_accent_color: str | None
    invoice_signature_label: str | None
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
    invoice_title: str | None = Field(default=None, min_length=1, max_length=255)
    invoice_footer_note: str | None = None
    invoice_terms: str | None = None
    payment_instructions: str | None = None
    show_logo_on_invoice: bool | None = None
    show_business_address_on_invoice: bool | None = None
    show_customer_phone_on_invoice: bool | None = None
    show_payment_status_on_invoice: bool | None = None
    show_warehouse_on_invoice: bool | None = None
    invoice_template: str | None = Field(default=None, min_length=1, max_length=100)
    invoice_accent_color: str | None = Field(default=None, max_length=50)
    invoice_signature_label: str | None = Field(default=None, max_length=255)
    low_stock_default_threshold: int | None = Field(default=None, ge=0)
    tax_rate: Decimal | None = Field(default=None, ge=0)
    logo_url: str | None = None
