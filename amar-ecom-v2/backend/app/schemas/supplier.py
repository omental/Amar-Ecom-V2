from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, computed_field

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

    @computed_field(return_type=str | None)
    @property
    def contactPerson(self) -> str | None:
        return self.contact_person

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

    @computed_field(return_type=str)
    @property
    def poNumber(self) -> str:
        return self.po_number

    @computed_field(return_type=str | None)
    @property
    def supplierName(self) -> str | None:
        return self.supplier.name if self.supplier else None

    @computed_field(return_type=str | None)
    @property
    def warehouseName(self) -> str | None:
        return self.warehouse.name if self.warehouse else None

    @computed_field(return_type=bool)
    @property
    def receivedState(self) -> bool:
        return self.stock_received

    @computed_field(return_type=datetime)
    @property
    def createdAt(self) -> datetime:
        return self.created_at

    @computed_field(return_type=datetime)
    @property
    def updatedAt(self) -> datetime:
        return self.updated_at
