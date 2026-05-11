from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

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
