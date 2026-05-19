from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, computed_field


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

    @computed_field(return_type=int)
    @property
    def totalOrders(self) -> int:
        return self.total_orders

    @computed_field(return_type=Decimal)
    @property
    def totalSales(self) -> Decimal:
        return self.total_sales

    @computed_field(return_type=Decimal)
    @property
    def totalDiscount(self) -> Decimal:
        return self.total_discount

    @computed_field(return_type=Decimal)
    @property
    def totalDeliveryCharge(self) -> Decimal:
        return self.total_delivery_charge

    @computed_field(return_type=Decimal)
    @property
    def averageOrderValue(self) -> Decimal:
        return self.average_order_value

    @computed_field(return_type=int)
    @property
    def paidOrders(self) -> int:
        return self.paid_orders

    @computed_field(return_type=int)
    @property
    def unpaidOrders(self) -> int:
        return self.unpaid_orders

    @computed_field(return_type=int)
    @property
    def cancelledOrders(self) -> int:
        return self.cancelled_orders

    @computed_field(return_type=int)
    @property
    def returnedOrders(self) -> int:
        return self.returned_orders


class OrderStatusReportItemRead(BaseModel):
    status: str
    count: int
    total_amount: Decimal

    @computed_field(return_type=str)
    @property
    def statusLabel(self) -> str:
        return self.status.replace("_", " ").title()

    @computed_field(return_type=Decimal)
    @property
    def totalAmount(self) -> Decimal:
        return self.total_amount


class PaymentStatusReportItemRead(BaseModel):
    payment_status: str
    count: int
    total_amount: Decimal

    @computed_field(return_type=str)
    @property
    def paymentStatus(self) -> str:
        return self.payment_status

    @computed_field(return_type=str)
    @property
    def paymentStatusLabel(self) -> str:
        return self.payment_status.replace("_", " ").title()

    @computed_field(return_type=Decimal)
    @property
    def totalAmount(self) -> Decimal:
        return self.total_amount


class InventoryReportRead(BaseModel):
    total_products: int
    total_inventory_items: int
    total_stock_units: int
    low_stock_count: int
    out_of_stock_count: int
    inventory_value_at_cost: Decimal

    @computed_field(return_type=int)
    @property
    def totalProducts(self) -> int:
        return self.total_products

    @computed_field(return_type=int)
    @property
    def totalInventoryItems(self) -> int:
        return self.total_inventory_items

    @computed_field(return_type=int)
    @property
    def totalStockUnits(self) -> int:
        return self.total_stock_units

    @computed_field(return_type=int)
    @property
    def lowStockCount(self) -> int:
        return self.low_stock_count

    @computed_field(return_type=int)
    @property
    def outOfStockCount(self) -> int:
        return self.out_of_stock_count

    @computed_field(return_type=Decimal)
    @property
    def inventoryValueAtCost(self) -> Decimal:
        return self.inventory_value_at_cost


class StockMovementSummaryItemRead(BaseModel):
    movement_type: str
    movement_count: int
    total_quantity: int

    @computed_field(return_type=str)
    @property
    def movementType(self) -> str:
        return self.movement_type

    @computed_field(return_type=int)
    @property
    def movementCount(self) -> int:
        return self.movement_count

    @computed_field(return_type=int)
    @property
    def totalQuantity(self) -> int:
        return self.total_quantity


class CustomerReportRead(BaseModel):
    total_customers: int
    customers_with_follow_up: int
    vip_customers: int
    wholesale_customers: int
    reseller_customers: int
    blocked_customers: int

    @computed_field(return_type=int)
    @property
    def totalCustomers(self) -> int:
        return self.total_customers

    @computed_field(return_type=int)
    @property
    def customersWithFollowUp(self) -> int:
        return self.customers_with_follow_up

    @computed_field(return_type=int)
    @property
    def vipCustomers(self) -> int:
        return self.vip_customers

    @computed_field(return_type=int)
    @property
    def wholesaleCustomers(self) -> int:
        return self.wholesale_customers

    @computed_field(return_type=int)
    @property
    def resellerCustomers(self) -> int:
        return self.reseller_customers

    @computed_field(return_type=int)
    @property
    def blockedCustomers(self) -> int:
        return self.blocked_customers


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

    @computed_field(return_type=int)
    @property
    def totalShipments(self) -> int:
        return self.total_shipments

    @computed_field(return_type=int)
    @property
    def pendingShipments(self) -> int:
        return self.pending_shipments

    @computed_field(return_type=int)
    @property
    def shippedShipments(self) -> int:
        return self.shipped_shipments

    @computed_field(return_type=int)
    @property
    def deliveredShipments(self) -> int:
        return self.delivered_shipments

    @computed_field(return_type=int)
    @property
    def failedShipments(self) -> int:
        return self.failed_shipments

    @computed_field(return_type=int)
    @property
    def unsettledReconciliations(self) -> int:
        return self.unsettled_reconciliations

    @computed_field(return_type=Decimal)
    @property
    def totalCodAmount(self) -> Decimal:
        return self.total_cod_amount

    @computed_field(return_type=Decimal)
    @property
    def totalCollectedAmount(self) -> Decimal:
        return self.total_collected_amount

    @computed_field(return_type=Decimal)
    @property
    def totalCourierCharge(self) -> Decimal:
        return self.total_courier_charge


class TopProductReportItemRead(BaseModel):
    product_id: UUID | None
    product_name: str
    sku: str | None
    total_quantity: int
    total_revenue: Decimal

    @computed_field(return_type=UUID | None)
    @property
    def productId(self) -> UUID | None:
        return self.product_id

    @computed_field(return_type=str)
    @property
    def productName(self) -> str:
        return self.product_name

    @computed_field(return_type=int)
    @property
    def totalQuantity(self) -> int:
        return self.total_quantity

    @computed_field(return_type=Decimal)
    @property
    def totalRevenue(self) -> Decimal:
        return self.total_revenue


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

    @computed_field(return_type=UUID)
    @property
    def inventoryItemId(self) -> UUID:
        return self.inventory_item_id

    @computed_field(return_type=UUID | None)
    @property
    def productId(self) -> UUID | None:
        return self.product_id

    @computed_field(return_type=UUID)
    @property
    def warehouseId(self) -> UUID:
        return self.warehouse_id

    @computed_field(return_type=str)
    @property
    def productName(self) -> str:
        return self.product_name

    @computed_field(return_type=str | None)
    @property
    def warehouseName(self) -> str | None:
        return self.warehouse_name

    @computed_field(return_type=int)
    @property
    def lowStockThreshold(self) -> int:
        return self.low_stock_threshold

    @computed_field(return_type=str)
    @property
    def stockStatus(self) -> str:
        return self.stock_status


class RevenueByDateReportItemRead(BaseModel):
    report_date: datetime
    order_count: int
    total_sales: Decimal

    @computed_field(return_type=datetime)
    @property
    def reportDate(self) -> datetime:
        return self.report_date

    @computed_field(return_type=int)
    @property
    def orderCount(self) -> int:
        return self.order_count

    @computed_field(return_type=Decimal)
    @property
    def totalSales(self) -> Decimal:
        return self.total_sales


class RecentOrderActivityItemRead(BaseModel):
    order_id: UUID
    order_number: str
    status: str
    payment_status: str
    total: Decimal
    customer_name: str | None
    created_at: datetime

    @computed_field(return_type=UUID)
    @property
    def orderId(self) -> UUID:
        return self.order_id

    @computed_field(return_type=str)
    @property
    def orderNumber(self) -> str:
        return self.order_number

    @computed_field(return_type=str)
    @property
    def paymentStatus(self) -> str:
        return self.payment_status

    @computed_field(return_type=str | None)
    @property
    def customerName(self) -> str | None:
        return self.customer_name

    @computed_field(return_type=datetime)
    @property
    def createdAt(self) -> datetime:
        return self.created_at


class FinanceReportSummaryRead(BaseModel):
    total_cash_bank_balance: Decimal
    total_income: Decimal
    total_expense: Decimal
    net_cash_flow: Decimal
    supplier_payments_total: Decimal

    @computed_field(return_type=Decimal)
    @property
    def totalCashBankBalance(self) -> Decimal:
        return self.total_cash_bank_balance

    @computed_field(return_type=Decimal)
    @property
    def totalIncome(self) -> Decimal:
        return self.total_income

    @computed_field(return_type=Decimal)
    @property
    def totalExpense(self) -> Decimal:
        return self.total_expense

    @computed_field(return_type=Decimal)
    @property
    def netCashFlow(self) -> Decimal:
        return self.net_cash_flow

    @computed_field(return_type=Decimal)
    @property
    def supplierPaymentsTotal(self) -> Decimal:
        return self.supplier_payments_total


class IntegrationSummaryRead(BaseModel):
    woocommerce_orders_count: int
    woocommerce_products_count: int
    woo_recent_sync_failures: int
    woo_last_product_sync_at: datetime | None
    woo_last_order_sync_at: datetime | None
    courier_sent_count: int
    courier_recent_failures: int
    courier_external_delivered_count: int
    courier_external_failed_returned_count: int
    pending_integration_actions: int

    @computed_field(return_type=int)
    @property
    def woocommerceOrdersCount(self) -> int:
        return self.woocommerce_orders_count

    @computed_field(return_type=int)
    @property
    def woocommerceProductsCount(self) -> int:
        return self.woocommerce_products_count

    @computed_field(return_type=int)
    @property
    def wooRecentSyncFailures(self) -> int:
        return self.woo_recent_sync_failures

    @computed_field(return_type=datetime | None)
    @property
    def wooLastProductSyncAt(self) -> datetime | None:
        return self.woo_last_product_sync_at

    @computed_field(return_type=datetime | None)
    @property
    def wooLastOrderSyncAt(self) -> datetime | None:
        return self.woo_last_order_sync_at

    @computed_field(return_type=int)
    @property
    def courierSentCount(self) -> int:
        return self.courier_sent_count

    @computed_field(return_type=int)
    @property
    def courierRecentFailures(self) -> int:
        return self.courier_recent_failures

    @computed_field(return_type=int)
    @property
    def courierExternalDeliveredCount(self) -> int:
        return self.courier_external_delivered_count

    @computed_field(return_type=int)
    @property
    def courierExternalFailedReturnedCount(self) -> int:
        return self.courier_external_failed_returned_count

    @computed_field(return_type=int)
    @property
    def pendingIntegrationActions(self) -> int:
        return self.pending_integration_actions
