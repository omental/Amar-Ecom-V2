from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import or_, select
from sqlalchemy.orm import selectinload

from app.api.deps import DBSession, get_current_user
from app.api.utils import commit_or_409, ensure_unique, fetch_one_or_404, normalize_pagination
from app.models.customer import Customer
from app.models.order import Order, OrderEvent, OrderItem
from app.models.user import User
from app.models.warehouse import Warehouse
from app.schemas.order import OrderCreate, OrderDuplicateRead, OrderListRead, OrderRead, OrderUpdate
from app.services.inventory_service import (
    decrease_stock,
    get_fulfillment_inventory_item,
    get_inventory_item_for_fulfillment,
)


router = APIRouter(dependencies=[Depends(get_current_user)])


def _order_query():
    return select(Order).options(
        selectinload(Order.items),
        selectinload(Order.customer),
        selectinload(Order.warehouse),
        selectinload(Order.events).selectinload(OrderEvent.created_by),
        selectinload(Order.stock_movements),
    )


def _generate_order_number() -> str:
    return f"ORD-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')}"


def _should_deduct_stock(previous_status: str, next_status: str, stock_deducted: bool) -> bool:
    fulfillment_statuses = {"shipped", "delivered"}
    pre_fulfillment_statuses = {"pending", "confirmed", "processing", "ready_to_ship"}
    return (
        previous_status in pre_fulfillment_statuses
        and next_status in fulfillment_statuses
        and not stock_deducted
    )


def _log_order_event(
    order: Order,
    *,
    event_type: str,
    message: str,
    created_by_id: UUID | None = None,
) -> None:
    order.events.append(
        OrderEvent(
            event_type=event_type,
            message=message,
            created_by_id=created_by_id,
        )
    )


@router.get("", response_model=list[OrderListRead])
async def list_orders(
    db: DBSession,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
) -> list[Order]:
    skip, limit = normalize_pagination(skip, limit)
    result = await db.execute(
        _order_query().order_by(Order.created_at.desc()).offset(skip)
        .limit(limit)
    )
    return list(result.scalars().unique().all())


@router.get("/duplicate-check", response_model=list[OrderDuplicateRead])
async def duplicate_check_orders(
    db: DBSession,
    phone: str = Query(min_length=3),
    limit: int = Query(default=5, ge=1, le=20),
) -> list[Order]:
    normalized_phone = phone.strip()
    result = await db.execute(
        _order_query()
        .join(Customer, Order.customer_id == Customer.id, isouter=True)
        .where(
            or_(
                Order.customer_phone == normalized_phone,
                Customer.phone == normalized_phone,
            )
        )
        .order_by(Order.created_at.desc())
        .limit(limit)
    )
    return list(result.scalars().unique().all())


@router.post("/{order_id}/mark-printed", response_model=OrderRead)
async def mark_order_printed(
    order_id: UUID,
    db: DBSession,
    current_user: User = Depends(get_current_user),
) -> Order:
    order = await fetch_one_or_404(db, _order_query().where(Order.id == order_id), "Order not found")
    order.printed_count = (order.printed_count or 0) + 1
    order.last_printed_at = datetime.now(timezone.utc)
    _log_order_event(
        order,
        event_type="order_printed",
        message=f"Invoice marked as printed ({order.printed_count} total prints).",
        created_by_id=current_user.id,
    )
    await commit_or_409(db, "Could not mark order as printed")
    await db.refresh(order)
    return await fetch_one_or_404(db, _order_query().where(Order.id == order.id), "Order not found")


@router.get("/{order_id}", response_model=OrderRead)
async def get_order(order_id: UUID, db: DBSession) -> Order:
    return await fetch_one_or_404(db, _order_query().where(Order.id == order_id), "Order not found")


@router.post("", response_model=OrderRead, status_code=status.HTTP_201_CREATED)
async def create_order(
    order_in: OrderCreate,
    db: DBSession,
    current_user: User = Depends(get_current_user),
) -> Order:
    order_number = order_in.order_number or _generate_order_number()
    await ensure_unique(db, Order, "order_number", order_number, "Order number already exists")
    if order_in.warehouse_id is not None:
        await fetch_one_or_404(
            db,
            select(Warehouse).where(Warehouse.id == order_in.warehouse_id),
            "Warehouse not found",
        )
    payload = order_in.model_dump(exclude={"items", "order_number"})
    order = Order(
        **payload,
        order_number=order_number,
    )
    for item_in in order_in.items:
        order.items.append(OrderItem(**item_in.model_dump()))
    _log_order_event(
        order,
        event_type="order_created",
        message=f"Order created with status {order.status}.",
        created_by_id=current_user.id,
    )

    db.add(order)
    await db.flush()

    if _should_deduct_stock("pending", order.status, False):
        for item in order.items:
            if order.warehouse_id is not None:
                inventory_item = await get_inventory_item_for_fulfillment(
                    db,
                    product_id=item.product_id,
                    variant_id=item.variant_id,
                    warehouse_id=order.warehouse_id,
                    required_quantity=item.quantity,
                )
            else:
                inventory_item = await get_fulfillment_inventory_item(
                    db,
                    product_id=item.product_id,
                    variant_id=item.variant_id,
                    required_quantity=item.quantity,
                )
            await decrease_stock(
                db,
                inventory_item=inventory_item,
                quantity=item.quantity,
                movement_type="order_fulfilled",
                order_id=order.id,
                note=f"Stock deducted for order {order.order_number}",
            )
        order.stock_deducted = True

    await commit_or_409(db, "Could not create order")
    await db.refresh(order)

    return await fetch_one_or_404(db, _order_query().where(Order.id == order.id), "Order not found")


@router.patch("/{order_id}", response_model=OrderRead)
async def update_order(
    order_id: UUID,
    order_in: OrderUpdate,
    db: DBSession,
    current_user: User = Depends(get_current_user),
) -> Order:
    order = await fetch_one_or_404(db, _order_query().where(Order.id == order_id), "Order not found")
    updates = order_in.model_dump(exclude_unset=True)
    previous_status = order.status

    if "warehouse_id" in updates and updates["warehouse_id"] is not None:
        await fetch_one_or_404(
            db,
            select(Warehouse).where(Warehouse.id == updates["warehouse_id"]),
            "Warehouse not found",
        )

    for field, value in updates.items():
        setattr(order, field, value)

    if _should_deduct_stock(previous_status, order.status, order.stock_deducted):
        for item in order.items:
            if order.warehouse_id is not None:
                inventory_item = await get_inventory_item_for_fulfillment(
                    db,
                    product_id=item.product_id,
                    variant_id=item.variant_id,
                    warehouse_id=order.warehouse_id,
                    required_quantity=item.quantity,
                )
            else:
                inventory_item = await get_fulfillment_inventory_item(
                    db,
                    product_id=item.product_id,
                    variant_id=item.variant_id,
                    required_quantity=item.quantity,
                )
            await decrease_stock(
                db,
                inventory_item=inventory_item,
                quantity=item.quantity,
                movement_type="order_fulfilled",
                order_id=order.id,
                note=f"Stock deducted for order {order.order_number}",
            )
        order.stock_deducted = True

    if "status" in updates and previous_status != order.status:
        _log_order_event(
            order,
            event_type="status_changed",
            message=f"Status changed from {previous_status} to {order.status}.",
            created_by_id=current_user.id,
        )

    await commit_or_409(db, "Could not update order")
    await db.refresh(order)
    return await fetch_one_or_404(db, _order_query().where(Order.id == order.id), "Order not found")
