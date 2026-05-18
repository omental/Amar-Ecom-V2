from datetime import datetime
from uuid import UUID

from pydantic import AliasChoices, BaseModel, ConfigDict, Field

from app.schemas.common import TimestampedSchema


class InvoiceTemplateCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str = Field(min_length=1, max_length=255, validation_alias=AliasChoices("name", "templateName"))
    slug: str = Field(min_length=1, max_length=100)
    description: str | None = None
    template_type: str = Field(default="invoice", min_length=1, max_length=50)
    is_default: bool = Field(default=False, validation_alias=AliasChoices("is_default", "isDefault"))
    is_active: bool = Field(default=True, validation_alias=AliasChoices("is_active", "isActive"))
    accent_color: str | None = Field(
        default=None,
        max_length=50,
        validation_alias=AliasChoices("accent_color", "accentColor"),
    )
    header_text: str | None = Field(default=None, validation_alias=AliasChoices("header_text", "headerText"))
    footer_text: str | None = Field(default=None, validation_alias=AliasChoices("footer_text", "footerText"))
    terms_text: str | None = Field(default=None, validation_alias=AliasChoices("terms_text", "termsText"))
    payment_instructions: str | None = Field(
        default=None,
        validation_alias=AliasChoices("payment_instructions", "paymentInstructions"),
    )


class InvoiceTemplateUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: str | None = Field(
        default=None,
        min_length=1,
        max_length=255,
        validation_alias=AliasChoices("name", "templateName"),
    )
    slug: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = None
    template_type: str | None = Field(default=None, min_length=1, max_length=50)
    is_default: bool | None = Field(default=None, validation_alias=AliasChoices("is_default", "isDefault"))
    is_active: bool | None = Field(default=None, validation_alias=AliasChoices("is_active", "isActive"))
    accent_color: str | None = Field(
        default=None,
        max_length=50,
        validation_alias=AliasChoices("accent_color", "accentColor"),
    )
    header_text: str | None = Field(default=None, validation_alias=AliasChoices("header_text", "headerText"))
    footer_text: str | None = Field(default=None, validation_alias=AliasChoices("footer_text", "footerText"))
    terms_text: str | None = Field(default=None, validation_alias=AliasChoices("terms_text", "termsText"))
    payment_instructions: str | None = Field(
        default=None,
        validation_alias=AliasChoices("payment_instructions", "paymentInstructions"),
    )


class InvoiceTemplateRead(TimestampedSchema):
    id: UUID
    name: str
    slug: str
    description: str | None
    template_type: str
    is_default: bool
    is_active: bool
    accent_color: str | None
    header_text: str | None
    footer_text: str | None
    terms_text: str | None
    payment_instructions: str | None
    templateName: str | None = None
    accentColor: str | None = None
    headerText: str | None = None
    footerText: str | None = None
    termsText: str | None = None
    paymentInstructions: str | None = None
    isDefault: bool | None = None
    isActive: bool | None = None
    createdAt: datetime | None = None
    updatedAt: datetime | None = None
