from datetime import datetime, time
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import case, func, select

from app.api.deps import DBSession, get_current_user
from app.models.courier import Shipment
from app.models.customer import Customer
from app.models.inventory import InventoryItem
from app.models.order import Order, OrderItem
from app.models.product import Product
from app.models.stock_movement import StockMovement
from app.models.warehouse import Warehouse
from app.schemas.reports import (
    CustomerReportRead,
    InventoryReportRead,
    LowStockProductReportItemRead,
    LogisticsReportRead,
    OrderStatusReportItemRead,
    PaymentStatusReportItemRead,
    RecentOrderActivityItemRead,
    RevenueByDateReportItemRead,
    SalesSummaryRead,
    StockMovementSummaryItemRead,
    TopProductReportItemRead,
)


router = APIRouter(dependencies=[Depends(get_current_user)])


def _coalesce_date_filters(
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
) -> tuple[datetime | None, datetime | None]:
    return start_date or date_from, end_date or date_to


def _date_range_bounds(date_from: datetime | None, date_to: datetime | None) -> tuple[datetime | None, datetime | None]:
    start = date_from
    end = date_to
    if date_to is not None and date_to.time() == time.min:
        end = date_to.replace(hour=23, minute=59, second=59, microsecond=999999)
    return start, end


def _apply_created_at_filters(stmt, model, date_from: datetime | None, date_to: datetime | None):
    start, end = _date_range_bounds(date_from, date_to)
    if start is not None:
        stmt = stmt.where(model.created_at >= start)
    if end is not None:
        stmt = stmt.where(model.created_at <= end)
    return stmt


@router.get("/sales-summary", response_model=SalesSummaryRead)
async def get_sales_summary(
    db: DBSession,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
) -> SalesSummaryRead:
    effective_date_from, effective_date_to = _coalesce_date_filters(date_from, date_to, start_date, end_date)
    stmt = select(
        func.count(Order.id),
        func.coalesce(func.sum(Order.total), 0),
        func.coalesce(func.sum(Order.discount), 0),
        func.coalesce(func.sum(Order.delivery_charge), 0),
        func.coalesce(func.avg(Order.total), 0),
        func.coalesce(func.sum(case((Order.payment_status == "paid", 1), else_=0)), 0),
        func.coalesce(func.sum(case((Order.payment_status == "unpaid", 1), else_=0)), 0),
        func.coalesce(func.sum(case((Order.status == "cancelled", 1), else_=0)), 0),
        func.coalesce(func.sum(case((Order.status == "returned", 1), else_=0)), 0),
    )
    stmt = _apply_created_at_filters(stmt, Order, effective_date_from, effective_date_to)
    result = await db.execute(stmt)
    row = result.one()
    return SalesSummaryRead(
        total_orders=row[0] or 0,
        total_sales=row[1] or Decimal("0"),
        total_discount=row[2] or Decimal("0"),
        total_delivery_charge=row[3] or Decimal("0"),
        average_order_value=row[4] or Decimal("0"),
        paid_orders=row[5] or 0,
        unpaid_orders=row[6] or 0,
        cancelled_orders=row[7] or 0,
        returned_orders=row[8] or 0,
    )


@router.get("/order-status", response_model=list[OrderStatusReportItemRead])
async def get_order_status_report(
    db: DBSession,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
) -> list[OrderStatusReportItemRead]:
    effective_date_from, effective_date_to = _coalesce_date_filters(date_from, date_to, start_date, end_date)
    stmt = select(
        Order.status,
        func.count(Order.id).label("count"),
        func.coalesce(func.sum(Order.total), 0).label("total_amount"),
    )
    stmt = _apply_created_at_filters(stmt, Order, effective_date_from, effective_date_to)
    result = await db.execute(stmt.group_by(Order.status).order_by(Order.status.asc()))
    return [
        OrderStatusReportItemRead(
            status=row.status,
            count=row.count,
            total_amount=row.total_amount or Decimal("0"),
        )
        for row in result
    ]


@router.get("/payment-status", response_model=list[PaymentStatusReportItemRead])
async def get_payment_status_report(
    db: DBSession,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
) -> list[PaymentStatusReportItemRead]:
    effective_date_from, effective_date_to = _coalesce_date_filters(date_from, date_to, start_date, end_date)
    stmt = select(
        Order.payment_status,
        func.count(Order.id).label("count"),
        func.coalesce(func.sum(Order.total), 0).label("total_amount"),
    )
    stmt = _apply_created_at_filters(stmt, Order, effective_date_from, effective_date_to)
    result = await db.execute(stmt.group_by(Order.payment_status).order_by(Order.payment_status.asc()))
    return [
        PaymentStatusReportItemRead(
            payment_status=row.payment_status,
            count=row.count or 0,
            total_amount=row.total_amount or Decimal("0"),
        )
        for row in result
    ]


@router.get("/inventory", response_model=InventoryReportRead)
async def get_inventory_report(db: DBSession) -> InventoryReportRead:
    product_count_result = await db.execute(select(func.count(Product.id)))
    inventory_result = await db.execute(
        select(
            func.count(InventoryItem.id),
            func.coalesce(func.sum(InventoryItem.quantity), 0),
            func.coalesce(
                func.sum(
                    case(
                        (
                            (InventoryItem.quantity > 0)
                            & (InventoryItem.quantity <= InventoryItem.low_stock_threshold),
                            1,
                        ),
                        else_=0,
                    )
                ),
                0,
            ),
            func.coalesce(
                func.sum(case((InventoryItem.quantity <= 0, 1), else_=0)),
                0,
            ),
            func.coalesce(func.sum(Product.cost_price * InventoryItem.quantity), 0),
        )
        .select_from(InventoryItem)
        .join(Product, InventoryItem.product_id == Product.id, isouter=True)
    )
    total_products = product_count_result.scalar() or 0
    inventory_row = inventory_result.one()
    return InventoryReportRead(
        total_products=total_products,
        total_inventory_items=inventory_row[0] or 0,
        total_stock_units=inventory_row[1] or 0,
        low_stock_count=inventory_row[2] or 0,
        out_of_stock_count=inventory_row[3] or 0,
        inventory_value_at_cost=inventory_row[4] or Decimal("0"),
    )


@router.get("/stock-movements-summary", response_model=list[StockMovementSummaryItemRead])
async def get_stock_movements_summary(
    db: DBSession,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    movement_type: str | None = Query(default=None),
) -> list[StockMovementSummaryItemRead]:
    effective_date_from, effective_date_to = _coalesce_date_filters(date_from, date_to, start_date, end_date)
    stmt = select(
        StockMovement.movement_type,
        func.count(StockMovement.id).label("movement_count"),
        func.coalesce(func.sum(StockMovement.quantity), 0).label("total_quantity"),
    )
    stmt = _apply_created_at_filters(stmt, StockMovement, effective_date_from, effective_date_to)
    if movement_type:
        stmt = stmt.where(StockMovement.movement_type == movement_type)
    result = await db.execute(
        stmt.group_by(StockMovement.movement_type).order_by(StockMovement.movement_type.asc())
    )
    return [
        StockMovementSummaryItemRead(
            movement_type=row.movement_type,
            movement_count=row.movement_count or 0,
            total_quantity=row.total_quantity or 0,
        )
        for row in result
    ]


@router.get("/customers", response_model=CustomerReportRead)
async def get_customer_report(db: DBSession) -> CustomerReportRead:
    result = await db.execute(
        select(
            func.count(Customer.id),
            func.coalesce(func.sum(case((Customer.follow_up_date.is_not(None), 1), else_=0)), 0),
            func.coalesce(func.sum(case((Customer.customer_type == "vip", 1), else_=0)), 0),
            func.coalesce(func.sum(case((Customer.customer_type == "wholesale", 1), else_=0)), 0),
            func.coalesce(func.sum(case((Customer.customer_type == "reseller", 1), else_=0)), 0),
            func.coalesce(func.sum(case((Customer.customer_type == "blocked", 1), else_=0)), 0),
        )
    )
    row = result.one()
    return CustomerReportRead(
        total_customers=row[0] or 0,
        customers_with_follow_up=row[1] or 0,
        vip_customers=row[2] or 0,
        wholesale_customers=row[3] or 0,
        reseller_customers=row[4] or 0,
        blocked_customers=row[5] or 0,
    )


@router.get("/logistics", response_model=LogisticsReportRead)
async def get_logistics_report(db: DBSession) -> LogisticsReportRead:
    result = await db.execute(
        select(
            func.count(Shipment.id),
            func.coalesce(func.sum(case((Shipment.status == "pending", 1), else_=0)), 0),
            func.coalesce(func.sum(case((Shipment.status == "shipped", 1), else_=0)), 0),
            func.coalesce(func.sum(case((Shipment.status == "delivered", 1), else_=0)), 0),
            func.coalesce(func.sum(case((Shipment.status == "failed", 1), else_=0)), 0),
            func.coalesce(
                func.sum(
                    case(
                        (~Shipment.reconciliation_status.in_(["settled", "cancelled"]), 1),
                        else_=0,
                    )
                ),
                0,
            ),
            func.coalesce(func.sum(Shipment.cod_amount), 0),
            func.coalesce(func.sum(Shipment.collected_amount), 0),
            func.coalesce(func.sum(Shipment.courier_charge), 0),
        )
    )
    row = result.one()
    return LogisticsReportRead(
        total_shipments=row[0] or 0,
        pending_shipments=row[1] or 0,
        shipped_shipments=row[2] or 0,
        delivered_shipments=row[3] or 0,
        failed_shipments=row[4] or 0,
        unsettled_reconciliations=row[5] or 0,
        total_cod_amount=row[6] or Decimal("0"),
        total_collected_amount=row[7] or Decimal("0"),
        total_courier_charge=row[8] or Decimal("0"),
    )


@router.get("/top-products", response_model=list[TopProductReportItemRead])
async def get_top_products_report(
    db: DBSession,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    limit: int = Query(default=10, ge=1, le=50),
) -> list[TopProductReportItemRead]:
    effective_date_from, effective_date_to = _coalesce_date_filters(date_from, date_to, start_date, end_date)
    stmt = (
        select(
            OrderItem.product_id,
            OrderItem.product_name,
            OrderItem.sku,
            func.coalesce(func.sum(OrderItem.quantity), 0).label("total_quantity"),
            func.coalesce(func.sum(OrderItem.total_price), 0).label("total_revenue"),
        )
        .join(Order, Order.id == OrderItem.order_id)
    )
    stmt = _apply_created_at_filters(stmt, Order, effective_date_from, effective_date_to)
    result = await db.execute(
        stmt.group_by(OrderItem.product_id, OrderItem.product_name, OrderItem.sku)
        .order_by(func.sum(OrderItem.quantity).desc(), func.sum(OrderItem.total_price).desc())
        .limit(limit)
    )
    return [
        TopProductReportItemRead(
            product_id=row.product_id,
            product_name=row.product_name,
            sku=row.sku,
            total_quantity=row.total_quantity or 0,
            total_revenue=row.total_revenue or Decimal("0"),
        )
        for row in result
    ]


@router.get("/low-stock-products", response_model=list[LowStockProductReportItemRead])
async def get_low_stock_products_report(
    db: DBSession,
    limit: int = Query(default=20, ge=1, le=100),
) -> list[LowStockProductReportItemRead]:
    result = await db.execute(
        select(
            InventoryItem.id.label("inventory_item_id"),
            InventoryItem.product_id,
            InventoryItem.warehouse_id,
            Product.name.label("product_name"),
            Product.sku,
            Warehouse.name.label("warehouse_name"),
            InventoryItem.quantity,
            InventoryItem.low_stock_threshold,
        )
        .select_from(InventoryItem)
        .join(Product, InventoryItem.product_id == Product.id, isouter=True)
        .join(Warehouse, InventoryItem.warehouse_id == Warehouse.id)
        .where(InventoryItem.quantity <= InventoryItem.low_stock_threshold)
        .order_by(InventoryItem.quantity.asc(), InventoryItem.updated_at.asc())
        .limit(limit)
    )
    return [
        LowStockProductReportItemRead(
            inventory_item_id=row.inventory_item_id,
            product_id=row.product_id,
            warehouse_id=row.warehouse_id,
            product_name=row.product_name or "Unknown product",
            sku=row.sku,
            warehouse_name=row.warehouse_name,
            quantity=row.quantity,
            low_stock_threshold=row.low_stock_threshold,
            stock_status="out_of_stock" if row.quantity <= 0 else "low_stock",
        )
        for row in result
    ]


@router.get("/revenue-by-date", response_model=list[RevenueByDateReportItemRead])
async def get_revenue_by_date_report(
    db: DBSession,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    limit: int = Query(default=31, ge=1, le=366),
) -> list[RevenueByDateReportItemRead]:
    effective_date_from, effective_date_to = _coalesce_date_filters(date_from, date_to, start_date, end_date)
    report_date = func.date_trunc("day", Order.created_at).label("report_date")
    stmt = select(
        report_date,
        func.count(Order.id).label("order_count"),
        func.coalesce(func.sum(Order.total), 0).label("total_sales"),
    )
    stmt = _apply_created_at_filters(stmt, Order, effective_date_from, effective_date_to)
    result = await db.execute(
        stmt.group_by(report_date).order_by(report_date.desc()).limit(limit)
    )
    return [
        RevenueByDateReportItemRead(
            report_date=row.report_date,
            order_count=row.order_count or 0,
            total_sales=row.total_sales or Decimal("0"),
        )
        for row in result
    ]


@router.get("/recent-order-activity", response_model=list[RecentOrderActivityItemRead])
async def get_recent_order_activity_report(
    db: DBSession,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    limit: int = Query(default=10, ge=1, le=100),
) -> list[RecentOrderActivityItemRead]:
    effective_date_from, effective_date_to = _coalesce_date_filters(date_from, date_to, start_date, end_date)
    stmt = (
        select(
            Order.id.label("order_id"),
            Order.order_number,
            Order.status,
            Order.payment_status,
            Order.total,
            Customer.name.label("customer_name"),
            Order.created_at,
        )
        .select_from(Order)
        .join(Customer, Order.customer_id == Customer.id, isouter=True)
    )
    stmt = _apply_created_at_filters(stmt, Order, effective_date_from, effective_date_to)
    result = await db.execute(stmt.order_by(Order.created_at.desc()).limit(limit))
    return [
        RecentOrderActivityItemRead(
            order_id=row.order_id,
            order_number=row.order_number,
            status=row.status,
            payment_status=row.payment_status,
            total=row.total or Decimal("0"),
            customer_name=row.customer_name,
            created_at=row.created_at,
        )
        for row in result
    ]
