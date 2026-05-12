from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class SalesSummaryRead(BaseModel):
    total_orders: int
    total_sales: Decimal
    total_discount: Decimal
    total_delivery_charge: Decimal
    average_order_value: Decimal
    paid_orders: int
    unpaid_orders: int
    cancelled_orders: int
    returned_orders: int


class OrderStatusReportItemRead(BaseModel):
    status: str
    count: int
    total_amount: Decimal


class PaymentStatusReportItemRead(BaseModel):
    payment_status: str
    count: int
    total_amount: Decimal


class InventoryReportRead(BaseModel):
    total_products: int
    total_inventory_items: int
    total_stock_units: int
    low_stock_count: int
    out_of_stock_count: int
    inventory_value_at_cost: Decimal


class StockMovementSummaryItemRead(BaseModel):
    movement_type: str
    movement_count: int
    total_quantity: int


class CustomerReportRead(BaseModel):
    total_customers: int
    customers_with_follow_up: int
    vip_customers: int
    wholesale_customers: int
    reseller_customers: int
    blocked_customers: int


class LogisticsReportRead(BaseModel):
    total_shipments: int
    pending_shipments: int
    shipped_shipments: int
    delivered_shipments: int
    failed_shipments: int
    unsettled_reconciliations: int
    total_cod_amount: Decimal
    total_collected_amount: Decimal
    total_courier_charge: Decimal


class TopProductReportItemRead(BaseModel):
    product_id: UUID | None
    product_name: str
    sku: str | None
    total_quantity: int
    total_revenue: Decimal


class LowStockProductReportItemRead(BaseModel):
    inventory_item_id: UUID
    product_id: UUID | None
    warehouse_id: UUID
    product_name: str
    sku: str | None
    warehouse_name: str | None
    quantity: int
    low_stock_threshold: int
    stock_status: str


class RevenueByDateReportItemRead(BaseModel):
    report_date: datetime
    order_count: int
    total_sales: Decimal


class RecentOrderActivityItemRead(BaseModel):
    order_id: UUID
    order_number: str
    status: str
    payment_status: str
    total: Decimal
    customer_name: str | None
    created_at: datetime
