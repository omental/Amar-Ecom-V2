from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from app.models.tenant import is_valid_store_slug, normalize_store_slug
from app.schemas.tenant import StoreSummary


class MerchantSignupRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    full_name: str = Field(min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    confirm_password: str = Field(min_length=8, max_length=72)
    business_name: str = Field(min_length=2, max_length=255)
    store_name: str = Field(min_length=2, max_length=255)
    store_slug: str = Field(min_length=2, max_length=100)
    timezone: str = Field(default="Asia/Dhaka", min_length=1, max_length=100)
    locale: str = Field(default="en-BD", min_length=2, max_length=20)
    currency: str = Field(default="BDT", min_length=3, max_length=10)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).strip().lower()

    @field_validator("store_slug")
    @classmethod
    def normalize_and_validate_slug(cls, value: str) -> str:
        normalized = normalize_store_slug(value)
        if not is_valid_store_slug(normalized):
            raise ValueError("Use 2-63 lowercase letters, numbers, or hyphens; reserved platform slugs are not allowed")
        return normalized

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: str) -> str:
        return value.strip().upper()

    @model_validator(mode="after")
    def passwords_match(self):
        if self.password != self.confirm_password:
            raise ValueError("Passwords do not match")
        return self


class ExistingMerchantProvisionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    business_name: str = Field(min_length=2, max_length=255)
    store_name: str = Field(min_length=2, max_length=255)
    store_slug: str = Field(min_length=2, max_length=100)
    timezone: str = Field(default="Asia/Dhaka", min_length=1, max_length=100)
    locale: str = Field(default="en-BD", min_length=2, max_length=20)
    currency: str = Field(default="BDT", min_length=3, max_length=10)

    @field_validator("store_slug")
    @classmethod
    def normalize_and_validate_slug(cls, value: str) -> str:
        normalized = normalize_store_slug(value)
        if not is_valid_store_slug(normalized):
            raise ValueError("Use 2-63 lowercase letters, numbers, or hyphens; reserved platform slugs are not allowed")
        return normalized

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: str) -> str:
        return value.strip().upper()


class MerchantSignupResponse(BaseModel):
    message: str
    verification_required: bool = True
    verification_token: str | None = None
    store_name: str
    store_slug: str
    future_store_url: str
    storefront_url: str


class VerifyEmailRequest(BaseModel):
    token: str = Field(min_length=32, max_length=512)


class SlugAvailabilityResponse(BaseModel):
    slug: str
    available: bool


class AccountStateResponse(BaseModel):
    email_verified: bool
    has_store: bool
    requires_provisioning: bool


OnboardingStepKey = Literal[
    "add_product",
    "customize_storefront",
    "configure_delivery",
    "business_information",
    "preview_store",
    "publish_storefront",
]


class OnboardingStepRead(BaseModel):
    key: OnboardingStepKey
    label: str
    completed: bool
    derived: bool
    href: str


class OnboardingProgressRead(BaseModel):
    status: str
    current_step: str
    completed_steps: list[str]
    steps: list[OnboardingStepRead]
    dismissed_at: datetime | None
    completed_at: datetime | None
    completion_percent: int


class OnboardingProgressUpdate(BaseModel):
    step: OnboardingStepKey | None = None
    completed: bool = True
    dismissed: bool | None = None


class ProvisionedStoreResponse(BaseModel):
    organization_name: str
    store: StoreSummary
