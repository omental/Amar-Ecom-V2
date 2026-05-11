from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from app.schemas.common import ORMBaseSchema
from app.schemas.warehouse import WarehouseRead


class SupplierCreate(BaseModel):
    name: str
    contact_person: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    address: str | None = None
    notes: str | None = None
    is_active: bool = True


class SupplierUpdate(BaseModel):
    name: str | None = None
    contact_person: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    address: str | None = None
    notes: str | None = None
    is_active: bool | None = None


class SupplierRead(ORMBaseSchema):
    id: UUID
    name: str
    contact_person: str | None
    phone: str | None
    email: EmailStr | None
    address: str | None
    notes: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class PurchaseOrderItemCreate(BaseModel):
    product_id: UUID | None = None
    variant_id: UUID | None = None
    product_name: str
    sku: str | None = None
    quantity: int = Field(ge=1)
    received_quantity: int = Field(default=0, ge=0)
    unit_cost: Decimal = Decimal("0.00")
    total_cost: Decimal = Decimal("0.00")


class PurchaseOrderItemRead(ORMBaseSchema):
    id: UUID
    purchase_order_id: UUID
    product_id: UUID | None
    variant_id: UUID | None
    product_name: str
    sku: str | None
    quantity: int
    received_quantity: int
    unit_cost: Decimal
    total_cost: Decimal
    created_at: datetime


class PurchaseOrderCreate(BaseModel):
    po_number: str
    supplier_id: UUID | None = None
    warehouse_id: UUID | None = None
    status: str = "draft"
    order_date: date | None = None
    expected_date: date | None = None
    discount: Decimal = Decimal("0.00")
    notes: str | None = None
    items: list[PurchaseOrderItemCreate] = []


class PurchaseOrderUpdate(BaseModel):
    supplier_id: UUID | None = None
    warehouse_id: UUID | None = None
    status: str | None = None
    order_date: date | None = None
    expected_date: date | None = None
    received_date: date | None = None
    subtotal: Decimal | None = None
    discount: Decimal | None = None
    total: Decimal | None = None
    notes: str | None = None


class PurchaseOrderRead(ORMBaseSchema):
    id: UUID
    po_number: str
    supplier_id: UUID | None
    warehouse_id: UUID | None
    status: str
    order_date: date | None
    expected_date: date | None
    received_date: date | None
    subtotal: Decimal
    discount: Decimal
    total: Decimal
    notes: str | None
    stock_received: bool
    created_at: datetime
    updated_at: datetime
    supplier: SupplierRead | None = None
    warehouse: WarehouseRead | None = None
    items: list[PurchaseOrderItemRead] = []
