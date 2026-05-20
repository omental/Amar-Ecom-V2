from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

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


class InventoryAdjustmentCreate(BaseModel):
    new_quantity: int | None = Field(default=None, ge=0)
    quantity_delta: int | None = None
    note: str | None = None


class InventoryItemRead(ORMBaseSchema):
    id: UUID
    product_id: UUID | None
    variant_id: UUID | None
    warehouse_id: UUID
    quantity: int
    low_stock_threshold: int
    created_at: datetime
    updated_at: datetime
    productName: str | None = None
    sku: str | None = None
    image_url: str | None = None
    imageUrl: str | None = None
    categoryName: str | None = None
    brandName: str | None = None
    warehouseName: str | None = None
    warehouseCode: str | None = None
    variantSummary: str | None = None
    stockStatus: str | None = None
    costPrice: Decimal = Decimal("0.00")
    salePrice: Decimal = Decimal("0.00")
    inventoryValue: Decimal = Decimal("0.00")
    lastMovementSummary: str | None = None
    createdAt: datetime | None = None
    updatedAt: datetime | None = None

    @model_validator(mode="before")
    @classmethod
    def populate_compat_fields(cls, value):
        if isinstance(value, dict):
            return value

        product = getattr(value, "product", None)
        variant = getattr(value, "variant", None)
        warehouse = getattr(value, "warehouse", None)
        category = getattr(product, "category", None)
        brand = getattr(product, "brand", None)
        sale_price = getattr(variant, "price", None)
        if sale_price is None:
            sale_price = getattr(product, "price", Decimal("0.00")) or Decimal("0.00")
        cost_price = getattr(product, "cost_price", Decimal("0.00")) or Decimal("0.00")
        latest = getattr(value, "_latest_movement", None)
        last_movement_summary = None
        if latest is not None:
            last_movement_summary = f"{latest.movement_type}:{latest.quantity}"

        if value.quantity <= 0:
            stock_status = "Out of Stock"
        elif value.quantity <= value.low_stock_threshold:
            stock_status = "Low Stock"
        else:
            stock_status = "In Stock"

        return {
            "id": value.id,
            "product_id": value.product_id,
            "variant_id": value.variant_id,
            "warehouse_id": value.warehouse_id,
            "quantity": value.quantity,
            "low_stock_threshold": value.low_stock_threshold,
            "created_at": value.created_at,
            "updated_at": value.updated_at,
            "productName": getattr(product, "name", None),
            "sku": getattr(variant, "sku", None) or getattr(product, "sku", None),
            "image_url": getattr(product, "image_url", None),
            "imageUrl": getattr(product, "image_url", None),
            "categoryName": getattr(category, "name", None),
            "brandName": getattr(brand, "name", None),
            "warehouseName": getattr(warehouse, "name", None),
            "warehouseCode": getattr(warehouse, "code", None),
            "variantSummary": getattr(variant, "name", None),
            "stockStatus": stock_status,
            "costPrice": cost_price,
            "salePrice": sale_price,
            "inventoryValue": cost_price * value.quantity,
            "lastMovementSummary": last_movement_summary,
            "createdAt": value.created_at,
            "updatedAt": value.updated_at,
        }


class InventoryHubSummaryRead(BaseModel):
    total_products: int
    active_products: int
    categories: int
    brands: int
    warehouses: int
    stock_rows: int
    low_stock: int
    out_of_stock: int
    pending_transfers: int
    completed_transfers: int
    wastage_count: int
    purchase_orders: int
    suppliers: int
    returns: int
    stock_movement_count: int
    inventory_value: Decimal
