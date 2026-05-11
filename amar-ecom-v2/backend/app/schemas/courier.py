from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import ORMBaseSchema
from app.schemas.customer import CustomerListRead
from app.schemas.user import UserRead
from app.schemas.warehouse import WarehouseRead


class CourierCreate(BaseModel):
    name: str
    code: str
    contact_phone: str | None = None
    website: str | None = None
    is_active: bool = True


class CourierUpdate(BaseModel):
    name: str | None = None
    code: str | None = None
    contact_phone: str | None = None
    website: str | None = None
    is_active: bool | None = None


class CourierRead(ORMBaseSchema):
    id: UUID
    name: str
    code: str
    contact_phone: str | None
    website: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class ShipmentCreate(BaseModel):
    shipment_number: str
    order_id: UUID
    courier_id: UUID | None = None
    recipient_name: str | None = None
    recipient_phone: str | None = None
    delivery_address: str | None = None
    tracking_number: str | None = None
    status: str = "pending"
    delivery_charge: Decimal = Decimal("0.00")
    courier_charge: Decimal = Decimal("0.00")
    cod_amount: Decimal = Decimal("0.00")
    collected_amount: Decimal = Decimal("0.00")
    reconciliation_status: str = "pending"
    notes: str | None = None


class ShipmentUpdate(BaseModel):
    courier_id: UUID | None = None
    recipient_name: str | None = None
    recipient_phone: str | None = None
    delivery_address: str | None = None
    tracking_number: str | None = None
    status: str | None = None
    delivery_charge: Decimal | None = Field(default=None, ge=0)
    courier_charge: Decimal | None = Field(default=None, ge=0)
    cod_amount: Decimal | None = Field(default=None, ge=0)
    collected_amount: Decimal | None = Field(default=None, ge=0)
    reconciliation_status: str | None = None
    notes: str | None = None


class ShipmentOrderSummary(ORMBaseSchema):
    id: UUID
    order_number: str
    customer_phone: str | None = None
    shipping_address: str | None = None
    total: Decimal | None = None
    customer: CustomerListRead | None = None
    warehouse: WarehouseRead | None = None


class ShipmentEventRead(ORMBaseSchema):
    id: UUID
    shipment_id: UUID
    event_type: str
    message: str
    created_by_id: UUID | None
    created_at: datetime
    created_by: UserRead | None = None


class ShipmentCreateFromOrder(BaseModel):
    courier_id: UUID | None = None
    tracking_number: str | None = None
    shipment_number: str | None = None
    delivery_charge: Decimal = Decimal("0.00")
    courier_charge: Decimal = Decimal("0.00")
    cod_amount: Decimal = Decimal("0.00")
    collected_amount: Decimal = Decimal("0.00")
    notes: str | None = None
    order_status: str | None = None


class PendingDispatchOrderRead(ORMBaseSchema):
    id: UUID
    order_number: str
    customer_id: UUID | None
    warehouse_id: UUID | None
    customer_phone: str | None
    shipping_address: str | None
    status: str
    total: Decimal
    created_at: datetime
    customer: CustomerListRead | None = None
    warehouse: WarehouseRead | None = None


class ShipmentListRead(ORMBaseSchema):
    id: UUID
    shipment_number: str
    order_id: UUID
    courier_id: UUID | None
    recipient_name: str | None
    recipient_phone: str | None
    delivery_address: str | None
    tracking_number: str | None
    status: str
    delivery_charge: Decimal
    courier_charge: Decimal
    cod_amount: Decimal
    collected_amount: Decimal
    reconciliation_status: str
    reconciled_at: datetime | None
    shipped_at: datetime | None
    delivered_at: datetime | None
    notes: str | None
    created_at: datetime
    updated_at: datetime
    order: ShipmentOrderSummary | None = None
    courier: CourierRead | None = None


class ShipmentRead(ShipmentListRead):
    events: list[ShipmentEventRead] = []
