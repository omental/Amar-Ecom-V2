from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, computed_field

from app.schemas.common import ORMBaseSchema


class CategoryCreate(BaseModel):
    name: str
    slug: str
    description: str | None = None
    storefront_template_id: UUID | None = None


class CategoryUpdate(BaseModel):
    name: str | None = None
    slug: str | None = None
    description: str | None = None
    storefront_template_id: UUID | None = None


class CategoryRead(ORMBaseSchema):
    id: UUID
    name: str
    slug: str
    description: str | None
    storefront_template_id: UUID | None = None
    created_at: datetime
    updated_at: datetime

    @computed_field(return_type=datetime)
    @property
    def createdAt(self) -> datetime:
        return self.created_at

    @computed_field(return_type=datetime)
    @property
    def updatedAt(self) -> datetime:
        return self.updated_at
