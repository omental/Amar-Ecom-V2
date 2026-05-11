from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import or_, select
from sqlalchemy.orm import selectinload

from app.api.deps import DBSession, get_current_user
from app.api.utils import commit_or_409, ensure_unique, fetch_one_or_404, normalize_pagination
from app.models.courier import Courier, Shipment, ShipmentEvent
from app.models.customer import Customer
from app.models.order import Order, OrderEvent, OrderItem
from app.models.user import User
from app.models.warehouse import Warehouse
from app.schemas.courier import ShipmentCreateFromOrder, ShipmentRead
from app.schemas.order import OrderCreate, OrderDuplicateRead, OrderListRead, OrderRead, OrderUpdate
from app.services.activity_log_service import log_activity
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


def _generate_shipment_number() -> str:
    return f"SHP-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')}"


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


def _log_shipment_event(
    shipment: Shipment,
    *,
    event_type: str,
    message: str,
    created_by_id: UUID | None = None,
) -> None:
    shipment.events.append(
        ShipmentEvent(
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
    request: Request,
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
    await log_activity(
        db,
        user_id=current_user.id,
        action="order_printed",
        module="orders",
        entity_type="order",
        entity_id=order.id,
        message=f"Marked order {order.order_number} as printed.",
        request=request,
    )
    await commit_or_409(db, "Could not mark order as printed")
    await db.refresh(order)
    return await fetch_one_or_404(db, _order_query().where(Order.id == order.id), "Order not found")


@router.post("/{order_id}/create-shipment", response_model=ShipmentRead, status_code=status.HTTP_201_CREATED)
async def create_shipment_from_order(
    order_id: UUID,
    shipment_in: ShipmentCreateFromOrder,
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> Shipment:
    order = await fetch_one_or_404(
        db,
        select(Order)
        .options(
            selectinload(Order.customer),
            selectinload(Order.items),
            selectinload(Order.events),
            selectinload(Order.shipments),
        )
        .where(Order.id == order_id),
        "Order not found",
    )
    if shipment_in.courier_id is not None:
        await fetch_one_or_404(db, select(Courier).where(Courier.id == shipment_in.courier_id), "Courier not found")

    active_shipment = next(
        (shipment for shipment in order.shipments if shipment.status not in {"cancelled", "returned"}),
        None,
    )
    if active_shipment is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This order already has an active shipment.",
        )

    shipment_number = shipment_in.shipment_number or _generate_shipment_number()
    await ensure_unique(db, Shipment, "shipment_number", shipment_number, "Shipment number already exists")

    shipment = Shipment(
        shipment_number=shipment_number,
        order_id=order.id,
        courier_id=shipment_in.courier_id,
        recipient_name=order.customer.name if order.customer else None,
        recipient_phone=order.customer_phone or (order.customer.phone if order.customer else None),
        delivery_address=order.shipping_address or (order.customer.address if order.customer else None),
        tracking_number=shipment_in.tracking_number,
        status="pending",
        delivery_charge=shipment_in.delivery_charge,
        courier_charge=shipment_in.courier_charge,
        cod_amount=shipment_in.cod_amount,
        collected_amount=shipment_in.collected_amount,
        reconciliation_status="pending",
        notes=shipment_in.notes,
    )
    if shipment.status == "delivered" and shipment.cod_amount > 0 and shipment.collected_amount <= 0:
        shipment.collected_amount = shipment.cod_amount
    _log_shipment_event(
        shipment,
        event_type="shipment_created",
        message=f"Shipment created from order {order.order_number}.",
        created_by_id=current_user.id,
    )
    db.add(shipment)

    if shipment_in.order_status is not None:
        previous_status = order.status
        order.status = shipment_in.order_status
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
        if previous_status != order.status:
            _log_order_event(
                order,
                event_type="status_changed",
                message=f"Status changed from {previous_status} to {order.status}.",
                created_by_id=current_user.id,
            )
            await log_activity(
                db,
                user_id=current_user.id,
                action="order_status_changed",
                module="orders",
                entity_type="order",
                entity_id=order.id,
                message=f"Changed order {order.order_number} from {previous_status} to {order.status}.",
                request=request,
            )

    await log_activity(
        db,
        user_id=current_user.id,
        action="shipment_created",
        module="shipments",
        entity_type="shipment",
        entity_id=shipment.id,
        message=f"Created shipment {shipment_number} from order {order.order_number}.",
        request=request,
    )
    await commit_or_409(db, "Could not create shipment from order")
    await db.refresh(shipment)
    return await fetch_one_or_404(
        db,
        select(Shipment)
        .options(
            selectinload(Shipment.order).selectinload(Order.customer),
            selectinload(Shipment.order).selectinload(Order.warehouse),
            selectinload(Shipment.courier),
            selectinload(Shipment.events).selectinload(ShipmentEvent.created_by),
        )
        .where(Shipment.id == shipment.id),
        "Shipment not found",
    )


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
    request: Request,
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
        await log_activity(
            db,
            user_id=current_user.id,
            action="order_status_changed",
            module="orders",
            entity_type="order",
            entity_id=order.id,
            message=f"Changed order {order.order_number} from {previous_status} to {order.status}.",
            request=request,
        )

    await commit_or_409(db, "Could not update order")
    await db.refresh(order)
    return await fetch_one_or_404(db, _order_query().where(Order.id == order.id), "Order not found")
