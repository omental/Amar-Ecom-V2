from datetime import datetime
from uuid import UUID

from pydantic import AliasChoices, BaseModel, ConfigDict, EmailStr, Field

from app.schemas.common import ORMBaseSchema


class UserCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    full_name: str = Field(validation_alias=AliasChoices("full_name", "fullName", "displayName", "name"))
    email: EmailStr
    password: str = Field(max_length=72)
    role: str = "admin"
    is_active: bool = Field(default=True, validation_alias=AliasChoices("is_active", "isActive", "active"))
    permissions: list[str] | dict[str, bool] | None = Field(
        default=None,
        validation_alias=AliasChoices("permissions", "legacyPermissions", "legacy_permissions"),
    )
    photo_url: str | None = Field(default=None, validation_alias=AliasChoices("photo_url", "photoURL"))


class UserUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    full_name: str | None = Field(
        default=None,
        validation_alias=AliasChoices("full_name", "fullName", "displayName", "name"),
    )
    email: EmailStr | None = None
    password: str | None = Field(default=None, max_length=72)
    role: str | None = None
    is_active: bool | None = Field(
        default=None,
        validation_alias=AliasChoices("is_active", "isActive", "active"),
    )
    permissions: list[str] | dict[str, bool] | None = Field(
        default=None,
        validation_alias=AliasChoices("permissions", "legacyPermissions", "legacy_permissions"),
    )
    photo_url: str | None = Field(default=None, validation_alias=AliasChoices("photo_url", "photoURL"))


class UserRead(ORMBaseSchema):
    id: UUID
    full_name: str
    email: EmailStr
    role: str
    is_active: bool
    last_login: datetime | None = None
    created_at: datetime
    updated_at: datetime
    uid: str | None = None
    name: str | None = None
    fullName: str | None = None
    displayName: str | None = None
    active: bool | None = None
    isActive: bool | None = None
    status: str | None = None
    permissions: list[str] = []
    legacy_permissions: dict[str, bool] = {}
    legacyPermissions: dict[str, bool] = {}
    has_full_access: bool = False
    hasFullAccess: bool = False
    pendingApproval: bool = False
    lastLogin: datetime | None = None
    photo_url: str | None = None
    photoURL: str | None = None
    createdAt: datetime | None = None
    updatedAt: datetime | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(max_length=72)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead
    permissions: list[str] = []

    model_config = ConfigDict(from_attributes=True)


class AuthMeResponse(BaseModel):
    id: UUID
    uid: str
    name: str
    full_name: str
    email: EmailStr
    role: str
    active: bool
    is_active: bool
    permissions: list[str]
    legacy_permissions: dict[str, bool]
    has_full_access: bool
    last_login: datetime | None
    lastLogin: datetime | None
    created_at: datetime
    createdAt: datetime
    display_name: str | None
    photo_url: str | None
    photoURL: str | None
