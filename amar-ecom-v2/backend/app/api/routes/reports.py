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
from app.schemas.reports import (
    CustomerReportRead,
    InventoryReportRead,
    LogisticsReportRead,
    OrderStatusReportItemRead,
    SalesSummaryRead,
    StockMovementSummaryItemRead,
    TopProductReportItemRead,
)


router = APIRouter(dependencies=[Depends(get_current_user)])


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
) -> SalesSummaryRead:
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
    stmt = _apply_created_at_filters(stmt, Order, date_from, date_to)
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
async def get_order_status_report(db: DBSession) -> list[OrderStatusReportItemRead]:
    result = await db.execute(
        select(
            Order.status,
            func.count(Order.id).label("count"),
            func.coalesce(func.sum(Order.total), 0).label("total_amount"),
        )
        .group_by(Order.status)
        .order_by(Order.status.asc())
    )
    return [
        OrderStatusReportItemRead(
            status=row.status,
            count=row.count,
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
    movement_type: str | None = Query(default=None),
) -> list[StockMovementSummaryItemRead]:
    stmt = select(
        StockMovement.movement_type,
        func.count(StockMovement.id).label("movement_count"),
        func.coalesce(func.sum(StockMovement.quantity), 0).label("total_quantity"),
    )
    stmt = _apply_created_at_filters(stmt, StockMovement, date_from, date_to)
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
    limit: int = Query(default=10, ge=1, le=50),
) -> list[TopProductReportItemRead]:
    result = await db.execute(
        select(
            OrderItem.product_id,
            OrderItem.product_name,
            OrderItem.sku,
            func.coalesce(func.sum(OrderItem.quantity), 0).label("total_quantity"),
            func.coalesce(func.sum(OrderItem.total_price), 0).label("total_revenue"),
        )
        .group_by(OrderItem.product_id, OrderItem.product_name, OrderItem.sku)
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
