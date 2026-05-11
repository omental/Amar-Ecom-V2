from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.schemas.common import ORMBaseSchema


class CategoryCreate(BaseModel):
    name: str
    slug: str
    description: str | None = None


class CategoryUpdate(BaseModel):
    name: str | None = None
    slug: str | None = None
    description: str | None = None


class CategoryRead(ORMBaseSchema):
    id: UUID
    name: str
    slug: str
    description: str | None
    created_at: datetime
    updated_at: datetime
