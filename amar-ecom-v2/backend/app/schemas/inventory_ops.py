from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, computed_field

from app.schemas.common import ORMBaseSchema
from app.schemas.warehouse import WarehouseRead


class StockTransferItemCreate(BaseModel):
    product_id: UUID | None = None
    variant_id: UUID | None = None
    product_name: str
    sku: str | None = None
    quantity: int = Field(ge=1)


class StockTransferItemRead(ORMBaseSchema):
    id: UUID
    stock_transfer_id: UUID
    product_id: UUID | None
    variant_id: UUID | None
    product_name: str
    sku: str | None
    quantity: int
    created_at: datetime


class StockTransferCreate(BaseModel):
    transfer_number: str
    from_warehouse_id: UUID
    to_warehouse_id: UUID
    status: str = "draft"
    notes: str | None = None
    items: list[StockTransferItemCreate] = []


class StockTransferUpdate(BaseModel):
    status: str | None = None
    notes: str | None = None


class StockTransferRead(ORMBaseSchema):
    id: UUID
    transfer_number: str
    from_warehouse_id: UUID
    to_warehouse_id: UUID
    status: str
    notes: str | None
    stock_moved: bool
    created_at: datetime
    updated_at: datetime
    from_warehouse: WarehouseRead | None = None
    to_warehouse: WarehouseRead | None = None
    items: list[StockTransferItemRead] = []

    @computed_field(return_type=str)
    @property
    def transferNumber(self) -> str:
        return self.transfer_number

    @computed_field(return_type=str | None)
    @property
    def fromWarehouseName(self) -> str | None:
        return self.from_warehouse.name if self.from_warehouse else None

    @computed_field(return_type=str | None)
    @property
    def toWarehouseName(self) -> str | None:
        return self.to_warehouse.name if self.to_warehouse else None

    @computed_field(return_type=datetime)
    @property
    def createdAt(self) -> datetime:
        return self.created_at

    @computed_field(return_type=datetime)
    @property
    def updatedAt(self) -> datetime:
        return self.updated_at


class WastageLogCreate(BaseModel):
    wastage_number: str
    product_id: UUID | None = None
    variant_id: UUID | None = None
    warehouse_id: UUID
    quantity: int = Field(ge=1)
    reason: str | None = None
    note: str | None = None


class WastageLogRead(ORMBaseSchema):
    id: UUID
    wastage_number: str
    product_id: UUID | None
    variant_id: UUID | None
    warehouse_id: UUID
    quantity: int
    reason: str | None
    note: str | None
    stock_deducted: bool
    created_at: datetime
    updated_at: datetime
    warehouse: WarehouseRead | None = None

    @computed_field(return_type=str)
    @property
    def wastageNumber(self) -> str:
        return self.wastage_number

    @computed_field(return_type=str | None)
    @property
    def warehouseName(self) -> str | None:
        return self.warehouse.name if self.warehouse else None

    @computed_field(return_type=datetime)
    @property
    def createdAt(self) -> datetime:
        return self.created_at

    @computed_field(return_type=datetime)
    @property
    def updatedAt(self) -> datetime:
        return self.updated_at
