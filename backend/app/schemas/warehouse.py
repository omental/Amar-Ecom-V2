from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, computed_field

from app.schemas.common import ORMBaseSchema


class WarehouseCreate(BaseModel):
    name: str
    code: str
    address: str | None = None
    is_active: bool = True


class WarehouseUpdate(BaseModel):
    name: str | None = None
    code: str | None = None
    address: str | None = None
    is_active: bool | None = None


class WarehouseRead(ORMBaseSchema):
    id: UUID
    name: str
    code: str
    address: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    @computed_field(return_type=str | None)
    @property
    def location(self) -> str | None:
        return self.address

    @computed_field(return_type=str)
    @property
    def status(self) -> str:
        return "Active" if self.is_active else "Inactive"

    @computed_field(return_type=datetime)
    @property
    def createdAt(self) -> datetime:
        return self.created_at

    @computed_field(return_type=datetime)
    @property
    def updatedAt(self) -> datetime:
        return self.updated_at
