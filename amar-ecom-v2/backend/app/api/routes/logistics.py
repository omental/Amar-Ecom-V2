from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, func, not_, or_, select
from sqlalchemy.orm import selectinload

from app.api.deps import DBSession, get_current_user
from app.api.utils import normalize_pagination
from app.models.courier import Shipment
from app.models.order import Order
from app.schemas.courier import LogisticsOperationsSummaryRead, PendingDispatchOrderRead


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


@router.get("/operations-summary", response_model=LogisticsOperationsSummaryRead)
async def get_logistics_operations_summary(db: DBSession) -> LogisticsOperationsSummaryRead:
    pending_dispatch_result = await db.execute(
        select(func.count(Order.id)).where(
            Order.status.in_(["confirmed", "processing", "ready_to_ship"]),
            not_(Order.shipments.any(Shipment.status.not_in(["cancelled", "returned"]))),
        )
    )
    counts_result = await db.execute(
        select(
            func.count(Shipment.id).filter(Shipment.sent_to_courier_at.is_not(None)),
            func.count(Shipment.id).filter(
                and_(
                    Shipment.external_status == "delivered",
                    Shipment.reconciliation_status.not_in(["settled", "cancelled"]),
                )
            ),
            func.count(Shipment.id).filter(Shipment.external_status.in_(["failed", "returned"])),
            func.count(Shipment.id).filter(Shipment.reconciliation_status.not_in(["settled", "cancelled"])),
            func.count(Shipment.id).filter(
                and_(Shipment.tracking_number.is_(None), Shipment.external_tracking_number.is_(None))
            ),
            func.count(Shipment.id).filter(
                and_(
                    Shipment.external_provider.is_not(None),
                    Shipment.sent_to_courier_at.is_not(None),
                    or_(
                        Shipment.external_synced_at.is_(None),
                        Shipment.external_status.is_(None),
                        Shipment.external_status.in_(["submitted", "pending", "processing", "assigned", "picked_up", "in_transit"]),
                    ),
                )
            ),
            func.count(Shipment.id).filter(Shipment.status == "delivered"),
            func.count(Shipment.id).filter(Shipment.status == "failed"),
        )
    )
    row = counts_result.one()
    return LogisticsOperationsSummaryRead(
        pending_dispatch_count=pending_dispatch_result.scalar_one() or 0,
        sent_to_external_courier_count=row[0] or 0,
        external_delivered_unsettled_count=row[1] or 0,
        external_failed_returned_count=row[2] or 0,
        unsettled_reconciliation_count=row[3] or 0,
        shipments_missing_tracking_count=row[4] or 0,
        shipments_waiting_status_sync_count=row[5] or 0,
        delivered_shipments=row[6] or 0,
        failed_shipments=row[7] or 0,
    )
