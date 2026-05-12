from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.order import OrderRead


class PosCartItem(BaseModel):
    product_id: UUID | None = None
    variant_id: UUID | None = None
    product_name: str = Field(min_length=1, max_length=255)
    sku: str | None = Field(default=None, max_length=100)
    quantity: int = Field(ge=1)
    unit_price: Decimal = Field(ge=0)
    total_price: Decimal = Field(ge=0)


class PosCheckoutCreate(BaseModel):
    customer_id: UUID | None = None
    customer_name: str | None = Field(default=None, max_length=255)
    customer_phone: str | None = Field(default=None, max_length=50)
    warehouse_id: UUID
    payment_method: str = Field(default="cash", min_length=1, max_length=50)
    account_id: UUID | None = None
    discount: Decimal = Field(default=Decimal("0.00"), ge=0)
    paid_amount: Decimal = Field(default=Decimal("0.00"), ge=0)
    notes: str | None = None
    items: list[PosCartItem] = Field(default_factory=list, min_length=1)


class PosCheckoutRead(BaseModel):
    order: OrderRead
    payment_status: str
    change_amount: Decimal
    due_amount: Decimal
    receipt_url: str | None = None
    order_id: UUID


class PosProductRead(BaseModel):
    product_id: UUID | None = None
    variant_id: UUID | None = None
    name: str
    sku: str | None = None
    price: Decimal
    stock_quantity: int
    image_url: str | None = None


class PosSummaryRead(BaseModel):
    today_pos_orders: int
    today_pos_sales: Decimal
    today_paid_amount: Decimal
    today_due_amount: Decimal
