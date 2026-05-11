from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import ORMBaseSchema


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
    tracking_number: str | None = None
    status: str = "pending"
    delivery_charge: Decimal = Decimal("0.00")
    cod_amount: Decimal = Decimal("0.00")
    notes: str | None = None


class ShipmentUpdate(BaseModel):
    courier_id: UUID | None = None
    tracking_number: str | None = None
    status: str | None = None
    delivery_charge: Decimal | None = Field(default=None, ge=0)
    cod_amount: Decimal | None = Field(default=None, ge=0)
    notes: str | None = None


class ShipmentOrderSummary(ORMBaseSchema):
    id: UUID
    order_number: str


class ShipmentRead(ORMBaseSchema):
    id: UUID
    shipment_number: str
    order_id: UUID
    courier_id: UUID | None
    tracking_number: str | None
    status: str
    delivery_charge: Decimal
    cod_amount: Decimal
    shipped_at: datetime | None
    delivered_at: datetime | None
    notes: str | None
    created_at: datetime
    updated_at: datetime
    order: ShipmentOrderSummary | None = None
    courier: CourierRead | None = None
