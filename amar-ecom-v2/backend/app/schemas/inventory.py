from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import ORMBaseSchema


class InventoryItemCreate(BaseModel):
    product_id: UUID | None = None
    variant_id: UUID | None = None
    warehouse_id: UUID
    quantity: int = Field(default=0, ge=0)
    low_stock_threshold: int = Field(default=5, ge=0)


class InventoryItemUpdate(BaseModel):
    quantity: int | None = Field(default=None, ge=0)
    low_stock_threshold: int | None = Field(default=None, ge=0)


class InventoryItemRead(ORMBaseSchema):
    id: UUID
    product_id: UUID | None
    variant_id: UUID | None
    warehouse_id: UUID
    quantity: int
    low_stock_threshold: int
    created_at: datetime
    updated_at: datetime
