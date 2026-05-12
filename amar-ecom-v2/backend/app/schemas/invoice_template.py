from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import TimestampedSchema


class InvoiceTemplateCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    slug: str = Field(min_length=1, max_length=100)
    description: str | None = None
    template_type: str = Field(default="invoice", min_length=1, max_length=50)
    is_default: bool = False
    is_active: bool = True
    accent_color: str | None = Field(default=None, max_length=50)
    header_text: str | None = None
    footer_text: str | None = None
    terms_text: str | None = None
    payment_instructions: str | None = None


class InvoiceTemplateUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    slug: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = None
    template_type: str | None = Field(default=None, min_length=1, max_length=50)
    is_default: bool | None = None
    is_active: bool | None = None
    accent_color: str | None = Field(default=None, max_length=50)
    header_text: str | None = None
    footer_text: str | None = None
    terms_text: str | None = None
    payment_instructions: str | None = None


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
