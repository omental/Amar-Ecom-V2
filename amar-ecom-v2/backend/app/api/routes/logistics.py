from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import DBSession, get_current_user
from app.api.utils import normalize_pagination
from app.models.order import Order
from app.schemas.courier import PendingDispatchOrderRead


router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("/pending-dispatch", response_model=list[PendingDispatchOrderRead])
async def list_pending_dispatch_orders(
    db: DBSession,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    warehouse_id: UUID | None = None,
) -> list[Order]:
    skip, limit = normalize_pagination(skip, limit)
    result = await db.execute(
        select(Order)
        .options(
            selectinload(Order.customer),
            selectinload(Order.warehouse),
            selectinload(Order.shipments),
        )
        .where(Order.status.in_(["confirmed", "processing", "ready_to_ship"]))
        .order_by(Order.created_at.desc())
    )
    orders = list(result.scalars().unique().all())
    if warehouse_id is not None:
        orders = [order for order in orders if order.warehouse_id == warehouse_id]

    filtered_orders = [
        order
        for order in orders
        if not any(
            shipment.status not in {"cancelled", "returned"}
            for shipment in order.shipments
        )
    ]
    return filtered_orders[skip : skip + limit]
