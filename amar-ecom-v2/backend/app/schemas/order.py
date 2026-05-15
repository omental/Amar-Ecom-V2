from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import ORMBaseSchema
from app.schemas.business_settings import BusinessSettingsRead
from app.schemas.customer import CustomerListRead
from app.schemas.invoice_template import InvoiceTemplateRead
from app.schemas.user import UserRead
from app.schemas.warehouse import WarehouseRead


class OrderItemCreate(BaseModel):
    product_id: UUID | None = None
    variant_id: UUID | None = None
    product_name: str
    sku: str | None = None
    quantity: int = Field(ge=1)
    unit_price: Decimal
    total_price: Decimal


class OrderItemRead(ORMBaseSchema):
    id: UUID
    order_id: UUID
    product_id: UUID | None
    variant_id: UUID | None
    product_name: str
    sku: str | None
    quantity: int
    unit_price: Decimal
    total_price: Decimal
    created_at: datetime


class OrderEventRead(ORMBaseSchema):
    id: UUID
    order_id: UUID
    event_type: str
    message: str
    created_by_id: UUID | None
    created_at: datetime
    created_by: UserRead | None = None


class OrderDuplicateRead(ORMBaseSchema):
    id: UUID
    order_number: str
    status: str
    source: str
    customer_phone: str | None
    total: Decimal
    created_at: datetime
    customer: CustomerListRead | None = None


class OrderCreate(BaseModel):
    order_number: str | None = None
    customer_id: UUID | None = None
    warehouse_id: UUID | None = None
    customer_name: str | None = None
    customer_phone: str | None = None
    shipping_address: str | None = None
    notes: str | None = None
    tags: str | None = None
    status: str = "pending"
    payment_status: str = "unpaid"
    payment_method: str | None = None
    source: str = "manual"
    subtotal: Decimal = Decimal("0.00")
    discount: Decimal = Decimal("0.00")
    delivery_charge: Decimal = Decimal("0.00")
    paid_amount: Decimal = Decimal("0.00")
    total: Decimal = Decimal("0.00")
    items: list[OrderItemCreate] = []


class OrderUpdate(BaseModel):
    warehouse_id: UUID | None = None
    customer_name: str | None = None
    customer_phone: str | None = None
    shipping_address: str | None = None
    notes: str | None = None
    tags: str | None = None
    status: str | None = None
    payment_status: str | None = None
    payment_method: str | None = None
    discount: Decimal | None = None
    delivery_charge: Decimal | None = None
    paid_amount: Decimal | None = None


class OrderListRead(ORMBaseSchema):
    id: UUID
    order_number: str
    customer_id: UUID | None
    warehouse_id: UUID | None
    customer_name: str | None
    customer_phone: str | None
    shipping_address: str | None
    notes: str | None
    tags: str | None
    status: str
    payment_status: str
    payment_method: str | None
    source: str
    external_id: str | None = None
    external_number: str | None = None
    external_status: str | None = None
    external_synced_at: datetime | None = None
    subtotal: Decimal
    discount: Decimal
    delivery_charge: Decimal
    paid_amount: Decimal
    total: Decimal
    stock_deducted: bool
    printed_count: int
    last_printed_at: datetime | None
    created_at: datetime
    updated_at: datetime
    customer: CustomerListRead | None = None
    warehouse: WarehouseRead | None = None
    items: list[OrderItemRead] = []


class OrderRead(OrderListRead):
    external_payload_snapshot: str | None = None
    events: list[OrderEventRead] = []


class InvoiceMetadataRead(BaseModel):
    invoice_number: str
    invoice_title: str
    accent_color: str | None = None
    footer_note: str | None = None
    terms: str | None = None
    payment_instructions: str | None = None
    signature_label: str | None = None
    show_logo: bool
    show_business_address: bool
    show_customer_phone: bool
    show_payment_status: bool
    show_warehouse: bool
    selected_template_slug: str | None = None
    selected_template_name: str | None = None
    template_source: str | None = None


class InvoiceDataRead(BaseModel):
    order: OrderRead
    business_settings: BusinessSettingsRead
    default_invoice_template: InvoiceTemplateRead | None = None
    computed_invoice_metadata: InvoiceMetadataRead
