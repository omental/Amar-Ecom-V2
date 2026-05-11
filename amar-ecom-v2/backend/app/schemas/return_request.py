from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.customer import CustomerListRead
from app.schemas.order import OrderItemRead, OrderRead
from app.schemas.common import ORMBaseSchema
from app.schemas.warehouse import WarehouseRead


class ReturnItemCreate(BaseModel):
    order_item_id: UUID | None = None
    product_id: UUID | None = None
    variant_id: UUID | None = None
    product_name: str
    sku: str | None = None
    quantity: int = Field(ge=1)
    condition: str | None = None


class ReturnItemRead(ORMBaseSchema):
    id: UUID
    return_request_id: UUID
    order_item_id: UUID | None
    product_id: UUID | None
    variant_id: UUID | None
    product_name: str
    sku: str | None
    quantity: int
    condition: str | None
    restocked_quantity: int
    created_at: datetime


class ReturnRequestCreate(BaseModel):
    return_number: str | None = None
    order_id: UUID
    customer_id: UUID | None = None
    warehouse_id: UUID | None = None
    status: str = "requested"
    reason: str | None = None
    resolution: str | None = None
    refund_amount: Decimal = Decimal("0.00")
    restock_items: bool = False
    items: list[ReturnItemCreate] = []


class ReturnRequestUpdate(BaseModel):
    warehouse_id: UUID | None = None
    status: str | None = None
    reason: str | None = None
    resolution: str | None = None
    refund_amount: Decimal | None = Field(default=None, ge=0)
    restock_items: bool | None = None


class ReturnRequestRead(ORMBaseSchema):
    id: UUID
    return_number: str
    order_id: UUID
    customer_id: UUID | None
    warehouse_id: UUID | None
    status: str
    reason: str | None
    resolution: str | None
    refund_amount: Decimal
    restock_items: bool
    stock_restocked: bool
    created_at: datetime
    updated_at: datetime
    order: OrderRead | None = None
    customer: CustomerListRead | None = None
    warehouse: WarehouseRead | None = None
    items: list[ReturnItemRead] = []
