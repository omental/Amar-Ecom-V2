from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import ORMBaseSchema


class StockMovementCreate(BaseModel):
    product_id: UUID | None = None
    variant_id: UUID | None = None
    warehouse_id: UUID
    order_id: UUID | None = None
    movement_type: str
    quantity: int = Field(ge=0)
    previous_quantity: int = Field(ge=0)
    new_quantity: int = Field(ge=0)
    note: str | None = None


class StockMovementRead(ORMBaseSchema):
    id: UUID
    product_id: UUID | None
    variant_id: UUID | None
    warehouse_id: UUID
    order_id: UUID | None
    movement_type: str
    quantity: int
    previous_quantity: int
    new_quantity: int
    note: str | None
    created_at: datetime
