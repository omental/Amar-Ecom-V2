from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr

from app.schemas.common import ORMBaseSchema


class UserCreate(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    role: str = "admin"
    is_active: bool = True


class UserUpdate(BaseModel):
    full_name: str | None = None
    email: EmailStr | None = None
    password: str | None = None
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
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead
    permissions: list[str] = []

    model_config = ConfigDict(from_attributes=True)
