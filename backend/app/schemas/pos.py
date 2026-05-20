from decimal import Decimal
from uuid import UUID

from pydantic import AliasChoices, BaseModel, Field, computed_field

from app.schemas.order import OrderRead


class PosCartItem(BaseModel):
    product_id: UUID | None = None
    variant_id: UUID | None = None
    product_name: str = Field(min_length=1, max_length=255, validation_alias=AliasChoices("product_name", "productName", "name"))
    sku: str | None = Field(default=None, max_length=100)
    quantity: int = Field(ge=1)
    unit_price: Decimal = Field(ge=0, validation_alias=AliasChoices("unit_price", "unitPrice", "price"))
    total_price: Decimal = Field(ge=0, validation_alias=AliasChoices("total_price", "totalPrice"))


class PosCheckoutCreate(BaseModel):
    customer_id: UUID | None = Field(default=None, validation_alias=AliasChoices("customer_id", "customerId"))
    customer_name: str | None = Field(default=None, max_length=255, validation_alias=AliasChoices("customer_name", "customerName"))
    customer_phone: str | None = Field(default=None, max_length=50, validation_alias=AliasChoices("customer_phone", "customerPhone"))
    warehouse_id: UUID = Field(validation_alias=AliasChoices("warehouse_id", "warehouseId"))
    payment_method: str = Field(default="cash", min_length=1, max_length=50, validation_alias=AliasChoices("payment_method", "paymentMethod"))
    account_id: UUID | None = Field(default=None, validation_alias=AliasChoices("account_id", "accountId"))
    discount: Decimal = Field(default=Decimal("0.00"), ge=0)
    paid_amount: Decimal = Field(default=Decimal("0.00"), ge=0, validation_alias=AliasChoices("paid_amount", "paidAmount"))
    notes: str | None = None
    items: list[PosCartItem] = Field(default_factory=list, min_length=1)


class PosCheckoutRead(BaseModel):
    order: OrderRead
    payment_status: str
    change_amount: Decimal
    due_amount: Decimal
    receipt_url: str | None = None
    order_id: UUID

    @computed_field(return_type=str)
    @property
    def paymentStatus(self) -> str:
        return self.payment_status

    @computed_field(return_type=Decimal)
    @property
    def changeAmount(self) -> Decimal:
        return self.change_amount

    @computed_field(return_type=Decimal)
    @property
    def dueAmount(self) -> Decimal:
        return self.due_amount

    @computed_field(return_type=str | None)
    @property
    def receiptUrl(self) -> str | None:
        return self.receipt_url

    @computed_field(return_type=UUID)
    @property
    def orderId(self) -> UUID:
        return self.order_id

    @computed_field(return_type=str)
    @property
    def orderNumber(self) -> str:
        return self.order.order_number


class PosProductRead(BaseModel):
    product_id: UUID | None = None
    variant_id: UUID | None = None
    name: str
    sku: str | None = None
    price: Decimal
    stock_quantity: int
    image_url: str | None = None

    @computed_field(return_type=str)
    @property
    def productName(self) -> str:
        return self.name

    @computed_field(return_type=Decimal)
    @property
    def salePrice(self) -> Decimal:
        return self.price

    @computed_field(return_type=int)
    @property
    def stockLevel(self) -> int:
        return self.stock_quantity

    @computed_field(return_type=int)
    @property
    def availableStock(self) -> int:
        return self.stock_quantity

    @computed_field(return_type=str | None)
    @property
    def image(self) -> str | None:
        return self.image_url

    @computed_field(return_type=str | None)
    @property
    def imageUrl(self) -> str | None:
        return self.image_url

    @computed_field(return_type=str | None)
    @property
    def barcode(self) -> str | None:
        return self.sku


class PosSummaryRead(BaseModel):
    today_pos_orders: int
    today_pos_sales: Decimal
    today_paid_amount: Decimal
    today_due_amount: Decimal

    @computed_field(return_type=int)
    @property
    def todayPosOrders(self) -> int:
        return self.today_pos_orders

    @computed_field(return_type=Decimal)
    @property
    def todayPosSales(self) -> Decimal:
        return self.today_pos_sales

    @computed_field(return_type=Decimal)
    @property
    def todayPaidAmount(self) -> Decimal:
        return self.today_paid_amount

    @computed_field(return_type=Decimal)
    @property
    def todayDueAmount(self) -> Decimal:
        return self.today_due_amount
