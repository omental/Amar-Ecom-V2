from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import AliasChoices, BaseModel, ConfigDict, EmailStr, Field

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
    companyName: str | None = None
    businessName: str | None = None
    businessEmail: EmailStr | None = None
    businessPhone: str | None = None
    businessAddress: str | None = None
    logoUrl: str | None = None
    invoicePrefix: str | None = None
    orderPrefix: str | None = None
    invoiceTitle: str | None = None
    invoiceFooterNote: str | None = None
    invoiceTerms: str | None = None
    paymentInstructions: str | None = None
    taxRate: Decimal | None = None
    lowStockDefaultThreshold: int | None = None
    createdAt: datetime | None = None
    updatedAt: datetime | None = None


class SettingsCenterSummaryRead(BaseModel):
    business_profile_completeness: int
    invoice_settings_configured: bool
    default_invoice_template_configured: bool
    active_users: int
    pending_users: int
    inactive_users: int
    roles_count: int
    permissions_count: int
    recent_activity_count: int
    has_active_admin: bool
    permissions_seeded: bool
    backup_guidance_available: bool
    maintenance_checklist_available: bool
    system_health_status: str


class BusinessSettingsUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    company_name: str | None = Field(
        default=None,
        validation_alias=AliasChoices("company_name", "companyName", "businessName"),
    )
    business_email: EmailStr | None = Field(
        default=None,
        validation_alias=AliasChoices("business_email", "businessEmail", "companyEmail"),
    )
    business_phone: str | None = Field(
        default=None,
        validation_alias=AliasChoices("business_phone", "businessPhone", "companyPhone", "companyMobile"),
    )
    business_address: str | None = Field(
        default=None,
        validation_alias=AliasChoices("business_address", "businessAddress", "companyAddress"),
    )
    website: str | None = None
    currency: str | None = None
    timezone: str | None = None
    invoice_prefix: str | None = Field(
        default=None,
        min_length=1,
        max_length=20,
        validation_alias=AliasChoices("invoice_prefix", "invoicePrefix"),
    )
    order_prefix: str | None = Field(
        default=None,
        min_length=1,
        max_length=20,
        validation_alias=AliasChoices("order_prefix", "orderPrefix"),
    )
    invoice_title: str | None = Field(
        default=None,
        min_length=1,
        max_length=255,
        validation_alias=AliasChoices("invoice_title", "invoiceTitle"),
    )
    invoice_footer_note: str | None = Field(
        default=None,
        validation_alias=AliasChoices("invoice_footer_note", "invoiceFooterNote"),
    )
    invoice_terms: str | None = Field(
        default=None,
        validation_alias=AliasChoices("invoice_terms", "invoiceTerms"),
    )
    payment_instructions: str | None = Field(
        default=None,
        validation_alias=AliasChoices("payment_instructions", "paymentInstructions"),
    )
    show_logo_on_invoice: bool | None = None
    show_business_address_on_invoice: bool | None = None
    show_customer_phone_on_invoice: bool | None = None
    show_payment_status_on_invoice: bool | None = None
    show_warehouse_on_invoice: bool | None = None
    invoice_template: str | None = Field(default=None, min_length=1, max_length=100)
    invoice_accent_color: str | None = Field(default=None, max_length=50)
    invoice_signature_label: str | None = Field(default=None, max_length=255)
    low_stock_default_threshold: int | None = Field(
        default=None,
        ge=0,
        validation_alias=AliasChoices("low_stock_default_threshold", "lowStockDefaultThreshold"),
    )
    tax_rate: Decimal | None = Field(
        default=None,
        ge=0,
        validation_alias=AliasChoices("tax_rate", "taxRate"),
    )
    logo_url: str | None = Field(
        default=None,
        validation_alias=AliasChoices("logo_url", "logoUrl", "companyLogo"),
    )
