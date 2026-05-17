from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.schemas.common import ORMBaseSchema


class UserCreate(BaseModel):
    full_name: str
    email: EmailStr
    password: str = Field(max_length=72)
    role: str = "admin"
    is_active: bool = True


class UserUpdate(BaseModel):
    full_name: str | None = None
    email: EmailStr | None = None
    password: str | None = Field(default=None, max_length=72)
    role: str | None = None
    is_active: bool | None = None


class UserRead(ORMBaseSchema):
    id: UUID
    full_name: str
    email: EmailStr
    role: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


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
