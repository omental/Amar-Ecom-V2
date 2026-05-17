from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import AliasChoices, BaseModel, Field, model_validator

from app.schemas.common import ORMBaseSchema
from app.schemas.business_settings import BusinessSettingsRead
from app.schemas.customer import CustomerListRead
from app.schemas.invoice_template import InvoiceTemplateRead
from app.schemas.user import UserRead
from app.schemas.warehouse import WarehouseRead


class OrderItemCreate(BaseModel):
    product_id: UUID | None = Field(default=None, validation_alias=AliasChoices("product_id", "productId"))
    variant_id: UUID | None = Field(default=None, validation_alias=AliasChoices("variant_id", "variantId"))
    product_name: str = Field(validation_alias=AliasChoices("product_name", "productName", "name"))
    sku: str | None = None
    quantity: int = Field(ge=1)
    unit_price: Decimal = Field(validation_alias=AliasChoices("unit_price", "unitPrice", "price"))
    total_price: Decimal | None = Field(
        default=None,
        validation_alias=AliasChoices("total_price", "totalPrice"),
    )

    @model_validator(mode="after")
    def populate_total_price(self):
        if self.total_price is None:
            self.total_price = self.unit_price * self.quantity
        return self


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
    orderNumber: str
    status: str
    source: str
    customer_name: str | None = None
    customerName: str | None = None
    customer_phone: str | None
    customerPhone: str | None = None
    customer_address: str | None = None
    customerAddress: str | None = None
    total: Decimal
    created_at: datetime
    createdAt: datetime
    customer: CustomerListRead | None = None


class OrderCreate(BaseModel):
    order_number: str | None = Field(default=None, validation_alias=AliasChoices("order_number", "orderNumber"))
    customer_id: UUID | None = Field(default=None, validation_alias=AliasChoices("customer_id", "customerId"))
    warehouse_id: UUID | None = Field(default=None, validation_alias=AliasChoices("warehouse_id", "warehouseId"))
    customer_name: str | None = Field(default=None, validation_alias=AliasChoices("customer_name", "customerName"))
    customer_phone: str | None = Field(default=None, validation_alias=AliasChoices("customer_phone", "customerPhone"))
    shipping_address: str | None = Field(
        default=None,
        validation_alias=AliasChoices("shipping_address", "customerAddress", "address"),
    )
    notes: str | None = None
    tags: str | None = None
    status: str = "pending"
    payment_status: str = "unpaid"
    payment_method: str | None = Field(default=None, validation_alias=AliasChoices("payment_method", "paymentMethod"))
    source: str = Field(default="manual", validation_alias=AliasChoices("source", "channel"))
    subtotal: Decimal = Decimal("0.00")
    discount: Decimal = Field(default=Decimal("0.00"), validation_alias=AliasChoices("discount", "discountAmount"))
    delivery_charge: Decimal = Field(
        default=Decimal("0.00"),
        validation_alias=AliasChoices("delivery_charge", "deliveryCharge"),
    )
    paid_amount: Decimal = Field(
        default=Decimal("0.00"),
        validation_alias=AliasChoices("paid_amount", "paidAmount", "advanceAmount"),
    )
    total: Decimal = Field(default=Decimal("0.00"), validation_alias=AliasChoices("total", "totalAmount"))
    items: list[OrderItemCreate] = []

    customer_city: str | None = None
    customer_zone: str | None = None
    district: str | None = None
    division: str | None = None
    area: str | None = None
    landmark: str | None = None
    courier_name: str | None = None
    tracking_number: str | None = None
    custom_shipment_number: str | None = None
    is_exchange: bool | None = None


class OrderUpdate(BaseModel):
    warehouse_id: UUID | None = Field(default=None, validation_alias=AliasChoices("warehouse_id", "warehouseId"))
    customer_name: str | None = Field(default=None, validation_alias=AliasChoices("customer_name", "customerName"))
    customer_phone: str | None = Field(default=None, validation_alias=AliasChoices("customer_phone", "customerPhone"))
    shipping_address: str | None = Field(
        default=None,
        validation_alias=AliasChoices("shipping_address", "customerAddress", "address"),
    )
    notes: str | None = None
    tags: str | None = None
    status: str | None = None
    payment_status: str | None = None
    payment_method: str | None = Field(default=None, validation_alias=AliasChoices("payment_method", "paymentMethod"))
    discount: Decimal | None = None
    delivery_charge: Decimal | None = Field(
        default=None,
        validation_alias=AliasChoices("delivery_charge", "deliveryCharge"),
    )
    paid_amount: Decimal | None = Field(
        default=None,
        validation_alias=AliasChoices("paid_amount", "paidAmount", "advanceAmount"),
    )


class OrderFirstItemSummaryRead(BaseModel):
    product_id: UUID | None = None
    variant_id: UUID | None = None
    product_name: str
    sku: str | None = None
    quantity: int
    unit_price: Decimal
    total_price: Decimal


class OrderWarehouseSummaryRead(BaseModel):
    id: UUID
    name: str
    code: str
    address: str | None = None
    is_active: bool | None = None


class OrderShipmentSummaryRead(BaseModel):
    id: UUID
    shipment_number: str
    status: str
    tracking_number: str | None = None
    external_tracking_number: str | None = None
    external_consignment_id: str | None = None
    external_status: str | None = None
    courier_id: UUID | None = None
    courier_name: str | None = None
    delivery_charge: Decimal
    courier_charge: Decimal
    cod_amount: Decimal
    collected_amount: Decimal
    reconciliation_status: str
    sent_to_courier_at: datetime | None = None
    shipped_at: datetime | None = None
    delivered_at: datetime | None = None


class OrderCustomerSummaryRead(BaseModel):
    id: UUID | None = None
    name: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    city: str | None = None
    customer_type: str | None = None
    tags: str | None = None
    notes: str | None = None


class OrderShippingSummaryRead(BaseModel):
    recipient_name: str | None = None
    recipient_phone: str | None = None
    address: str | None = None
    shipping_address: str | None = None
    warehouse_id: UUID | None = None


class OrderTotalsSummaryRead(BaseModel):
    subtotal: Decimal
    discount: Decimal
    delivery_charge: Decimal
    total: Decimal
    paid_amount: Decimal
    due_amount: Decimal


class OrderLogEntryRead(BaseModel):
    id: UUID
    action: str
    details: str
    user: str | None = None
    timestamp: datetime


class OrderActionFlagsRead(BaseModel):
    can_print: bool
    can_edit: bool
    can_create_shipment: bool
    can_refresh_woo: bool
    can_deduct_stock_by_status: bool
    can_cancel: bool
    can_mark_delivered: bool


class OrderListRead(ORMBaseSchema):
    id: UUID
    order_number: str
    orderNumber: str
    customer_id: UUID | None
    warehouse_id: UUID | None
    customer_name: str | None
    customerName: str | None = None
    customer_phone: str | None
    customerPhone: str | None = None
    shipping_address: str | None
    customer_address: str | None = None
    customerAddress: str | None = None
    notes: str | None
    tags: str | None
    status: str
    payment_status: str
    payment_method: str | None
    paymentMethod: str | None = None
    source: str
    external_id: str | None = None
    external_number: str | None = None
    external_status: str | None = None
    external_synced_at: datetime | None = None
    subtotal: Decimal
    discount: Decimal
    delivery_charge: Decimal
    deliveryCharge: Decimal | None = None
    paid_amount: Decimal
    paidAmount: Decimal | None = None
    total: Decimal
    totalAmount: Decimal | None = None
    due_amount: Decimal | None = None
    dueAmount: Decimal | None = None
    stock_deducted: bool
    printed_count: int
    last_printed_at: datetime | None
    lastPrintedAt: datetime | None = None
    created_at: datetime
    createdAt: datetime
    updated_at: datetime
    updatedAt: datetime
    item_count: int = 0
    first_item_summary: OrderFirstItemSummaryRead | None = None
    warehouse_summary: OrderWarehouseSummaryRead | None = None
    shipment_summary: OrderShipmentSummaryRead | None = None
    courierName: str | None = None
    trackingNumber: str | None = None
    customer: CustomerListRead | None = None
    warehouse: WarehouseRead | None = None
    items: list[OrderItemRead] = []


class OrderRead(OrderListRead):
    external_payload_snapshot: str | None = None
    events: list[OrderEventRead] = []
    logs: list[OrderLogEntryRead] = []
    customer_summary: OrderCustomerSummaryRead | None = None
    shipping_summary: OrderShippingSummaryRead | None = None
    totals_summary: OrderTotalsSummaryRead | None = None
    action_flags: OrderActionFlagsRead


class OrderOperationsSummaryRead(BaseModel):
    total_orders: int = 0
    pending_orders: int = 0
    confirmed_orders: int = 0
    processing_orders: int = 0
    ready_to_ship_orders_count: int = 0
    shipped_orders_count: int = 0
    delivered_orders_count: int = 0
    cancelled_orders_count: int = 0
    returned_orders_count: int = 0
    partial_delivered_orders: int = 0
    urgent_orders: int = 0
    hold_orders: int = 0
    total_open_orders: int
    ready_to_ship_orders: int
    shipped_orders: int
    delivered_orders: int
    cancelled_orders: int
    orders_with_woo_source: int
    orders_needing_woo_refresh: int
    orders_with_shipments: int
    orders_without_shipments_ready_to_ship: int
    orders_stock_not_deducted: int
    orders_printed_count: int
    orders_unprinted_count: int


class OrderBatchActionOptions(BaseModel):
    status: str | None = None


class OrderBatchActionRequest(BaseModel):
    action: str
    order_ids: list[UUID]
    options: OrderBatchActionOptions | None = None


class OrderBatchActionRowRead(BaseModel):
    order_id: UUID
    status: str
    message: str


class OrderBatchActionResultRead(BaseModel):
    action: str
    success_count: int
    skipped_count: int
    failed_count: int
    rows: list[OrderBatchActionRowRead]


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
