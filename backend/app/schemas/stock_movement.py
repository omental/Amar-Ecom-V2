from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

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
    order_number: str | None = None
    movement_type: str
    quantity: int
    previous_quantity: int
    new_quantity: int
    note: str | None
    created_at: datetime
    productName: str | None = None
    warehouseName: str | None = None
    warehouseCode: str | None = None
    sku: str | None = None
    reason: str | None = None
    user: str | None = None
    createdAt: datetime | None = None

    @model_validator(mode="before")
    @classmethod
    def populate_compat_fields(cls, value):
        if isinstance(value, dict):
            return value

        product = getattr(value, "product", None)
        variant = getattr(value, "variant", None)
        warehouse = getattr(value, "warehouse", None)
        return {
            "id": value.id,
            "product_id": value.product_id,
            "variant_id": value.variant_id,
            "warehouse_id": value.warehouse_id,
            "order_id": value.order_id,
            "order_number": getattr(getattr(value, "order", None), "order_number", None),
            "movement_type": value.movement_type,
            "quantity": value.quantity,
            "previous_quantity": value.previous_quantity,
            "new_quantity": value.new_quantity,
            "note": value.note,
            "created_at": value.created_at,
            "productName": getattr(product, "name", None),
            "warehouseName": getattr(warehouse, "name", None),
            "warehouseCode": getattr(warehouse, "code", None),
            "sku": getattr(variant, "sku", None) or getattr(product, "sku", None),
            "reason": value.note,
            "user": None,
            "createdAt": value.created_at,
        }
