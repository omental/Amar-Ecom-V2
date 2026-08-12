from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.schemas.common import ORMBaseSchema

OwnerType = Literal["product", "product_variant", "collection", "page"]
ValueType = Literal["single_line_text", "multiline_text", "integer", "decimal", "boolean", "date", "url", "color", "image", "money", "reference"]


def _key(value: str) -> str:
    value = value.strip().lower().replace("-", "_")
    if not value or not value.replace("_", "").isalnum() or value[0].isdigit():
        raise ValueError("Use lowercase letters, numbers, and underscores")
    return value


class CustomFieldDefinitionCreate(BaseModel):
    namespace: str = "custom"
    key: str
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    owner_type: OwnerType
    value_type: ValueType
    validation: dict[str, Any] = Field(default_factory=dict)
    is_required: bool = False
    is_public: bool = True

    _normalize_namespace = field_validator("namespace")(_key)
    _normalize_key = field_validator("key")(_key)


class CustomFieldDefinitionUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    value_type: ValueType | None = None
    validation: dict[str, Any] | None = None
    is_required: bool | None = None
    is_public: bool | None = None


class CustomFieldDefinitionRead(ORMBaseSchema):
    id: UUID
    namespace: str
    key: str
    name: str
    description: str | None
    owner_type: OwnerType
    value_type: ValueType
    validation: dict[str, Any]
    is_required: bool
    is_public: bool
    created_at: datetime
    updated_at: datetime


class CustomFieldValueWrite(BaseModel):
    definition_id: UUID
    value: Any = None


class CustomFieldValueRead(ORMBaseSchema):
    id: UUID
    definition_id: UUID
    owner_type: OwnerType
    owner_id: UUID
    value: Any = None


class ContentFieldCreate(BaseModel):
    key: str
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    value_type: ValueType
    validation: dict[str, Any] = Field(default_factory=dict)
    is_required: bool = False
    sort_order: int = 0

    _normalize_key = field_validator("key")(_key)


class ContentFieldRead(ORMBaseSchema):
    id: UUID
    model_id: UUID
    key: str
    name: str
    description: str | None
    value_type: ValueType
    validation: dict[str, Any]
    is_required: bool
    sort_order: int


class ContentModelCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    key: str
    description: str | None = None
    fields: list[ContentFieldCreate] = Field(default_factory=list)

    _normalize_key = field_validator("key")(_key)


class ContentModelUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None


class ContentModelRead(ORMBaseSchema):
    id: UUID
    name: str
    key: str
    description: str | None
    fields: list[ContentFieldRead] = []
    created_at: datetime
    updated_at: datetime


class ContentEntryCreate(BaseModel):
    handle: str
    values: dict[str, Any] = Field(default_factory=dict)
    status: Literal["active", "draft"] = "active"

    _normalize_handle = field_validator("handle")(_key)


class ContentEntryUpdate(BaseModel):
    handle: str | None = None
    values: dict[str, Any] | None = None
    status: Literal["active", "draft"] | None = None

    @field_validator("handle")
    @classmethod
    def normalize_handle(cls, value: str | None) -> str | None:
        return _key(value) if value is not None else None


class ContentEntryRead(ORMBaseSchema):
    id: UUID
    model_id: UUID
    handle: str
    values: dict[str, Any]
    status: str
    created_at: datetime
    updated_at: datetime
