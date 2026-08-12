from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.services.commercial_registry import FEATURE_REGISTRY, FeatureValue, validate_feature_value


class FeatureDefinitionRead(BaseModel):
    key: str
    name: str
    description: str | None
    category: str
    value_type: str
    default_value: FeatureValue
    enforcement_type: str


class PlanRead(BaseModel):
    id: UUID
    key: str
    version: int
    name: str
    description: str | None
    status: str
    sort_order: int
    is_public: bool
    monthly_price_display: str | None
    annual_price_display: str | None
    trial_days: int
    entitlements: dict[str, FeatureValue]


class UsageRead(BaseModel):
    feature: str
    usage: int | float
    limit: int | float | None
    remaining: int | float | None
    over_limit: bool


class TrialRead(BaseModel):
    started_at: datetime | None
    ends_at: datetime | None
    days_remaining: int | None


class CommercialSummaryRead(BaseModel):
    store_id: UUID
    plan: PlanRead
    status: str
    trial: TrialRead
    entitlements: dict[str, FeatureValue]
    usage: dict[str, UsageRead]


class PlatformPlanCreate(BaseModel):
    key: str = Field(pattern=r"^[a-z][a-z0-9_]{1,99}$")
    version: int = Field(default=1, ge=1)
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    status: str = Field(default="active", pattern=r"^(active|hidden|archived)$")
    sort_order: int = 0
    is_public: bool = True
    monthly_price_display: str | None = Field(default=None, max_length=100)
    annual_price_display: str | None = Field(default=None, max_length=100)
    trial_days: int = Field(default=0, ge=0, le=365)
    entitlements: dict[str, FeatureValue] = Field(default_factory=dict)

    @field_validator("entitlements")
    @classmethod
    def validate_entitlements(cls, values: dict[str, FeatureValue]) -> dict[str, FeatureValue]:
        return {key: validate_feature_value(key, value) for key, value in values.items()}


class PlatformPlanUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    status: str | None = Field(default=None, pattern=r"^(active|hidden|archived)$")
    sort_order: int | None = None
    is_public: bool | None = None
    monthly_price_display: str | None = Field(default=None, max_length=100)
    annual_price_display: str | None = Field(default=None, max_length=100)


class PlanEntitlementsUpdate(BaseModel):
    entitlements: dict[str, FeatureValue]

    @field_validator("entitlements")
    @classmethod
    def validate_entitlements(cls, values: dict[str, FeatureValue]) -> dict[str, FeatureValue]:
        return {key: validate_feature_value(key, value) for key, value in values.items()}


class StorePlanAssignInput(BaseModel):
    plan_id: UUID
    start_trial: bool = False


class TrialExtendInput(BaseModel):
    days: int = Field(ge=1, le=365)
    reason: str = Field(min_length=3, max_length=2000)


class StoreOverrideCreate(BaseModel):
    feature_key: str
    value: FeatureValue
    reason: str = Field(min_length=3, max_length=2000)
    starts_at: datetime | None = None
    ends_at: datetime | None = None

    @field_validator("feature_key")
    @classmethod
    def known_feature(cls, value: str) -> str:
        if value not in FEATURE_REGISTRY:
            raise ValueError("Unknown feature")
        return value

    def validated_value(self) -> FeatureValue:
        return validate_feature_value(self.feature_key, self.value)


class StoreOverrideRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    store_id: UUID
    feature_key: str
    value: FeatureValue
    reason: str
    starts_at: datetime
    ends_at: datetime | None
    created_by_id: UUID | None
    created_at: datetime
