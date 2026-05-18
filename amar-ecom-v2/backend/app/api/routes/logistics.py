import csv
from io import StringIO
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import and_, func, not_, or_, select
from sqlalchemy.orm import selectinload

from app.api.deps import DBSession, get_current_user
from app.api.utils import normalize_pagination
from app.models.courier import Courier, Shipment
from app.models.order import Order
from app.models.return_request import ReturnRequest
from app.models.supplier import PurchaseOrder, Supplier
from app.schemas.courier import (
    LogisticsCommandSummaryRead,
    LogisticsOperationsSummaryRead,
    PendingDispatchOrderRead,
)


router = APIRouter(dependencies=[Depends(get_current_user)])


def _csv_response(filename: str, headers: list[str], rows: list[list[object]]) -> Response:
    buffer = StringIO()
    writer = csv.writer(buffer)
    writer.writerow(headers)
    writer.writerows(rows)
    return Response(
        content=buffer.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


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
            selectinload(Order.items),
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
    for order in filtered_orders:
        setattr(order, "has_shipment", order.active_shipment is not None)
    return filtered_orders[skip : skip + limit]


@router.get("/command-summary", response_model=LogisticsCommandSummaryRead)
async def get_logistics_command_summary(db: DBSession) -> LogisticsCommandSummaryRead:
    pending_dispatch_result = await db.execute(
        select(func.count(Order.id)).where(
            Order.status.in_(["confirmed", "processing", "ready_to_ship"]),
            not_(Order.shipments.any(Shipment.status.not_in(["cancelled", "returned"]))),
        )
    )
    ready_to_ship_result = await db.execute(
        select(func.count(Order.id)).where(Order.status == "ready_to_ship")
    )
    shipment_counts_result = await db.execute(
        select(
            func.count(Shipment.id).filter(Shipment.status.in_(["pending", "ready_to_ship", "shipped", "in_transit"])),
            func.count(Shipment.id).filter(Shipment.status == "shipped"),
            func.count(Shipment.id).filter(Shipment.status == "delivered"),
            func.count(Shipment.id).filter(Shipment.status == "failed"),
            func.count(Shipment.id).filter(Shipment.status == "returned"),
            func.count(Shipment.id).filter(Shipment.reconciliation_status != "settled"),
            func.count(Shipment.id).filter(Shipment.reconciliation_status == "settled"),
            func.coalesce(func.sum(Shipment.cod_amount), 0),
            func.coalesce(func.sum(Shipment.collected_amount), 0),
            func.coalesce(func.sum(Shipment.courier_charge), 0),
            func.count(Shipment.id).filter(Shipment.sent_to_courier_at.is_not(None)),
            func.count(Shipment.id).filter(
                and_(
                    Shipment.external_provider.is_not(None),
                    or_(
                        Shipment.external_synced_at.is_(None),
                        Shipment.external_status.is_(None),
                        Shipment.external_status.in_(["submitted", "pending", "processing", "assigned", "picked_up", "in_transit"]),
                    ),
                )
            ),
            func.count(Shipment.id).filter(
                Shipment.external_status.in_(["failed", "returned", "cancelled"])
            ),
        )
    )
    courier_counts_result = await db.execute(
        select(
            func.count(Courier.id),
            func.count(Courier.id).filter(Courier.is_active.is_(True)),
        )
    )
    return_counts_result = await db.execute(
        select(
            func.count(ReturnRequest.id).filter(ReturnRequest.status != "restocked"),
            func.count(ReturnRequest.id).filter(
                or_(ReturnRequest.status == "restocked", ReturnRequest.stock_restocked.is_(True))
            ),
        )
    )
    purchase_orders_pending_result = await db.execute(
        select(func.count(PurchaseOrder.id)).where(PurchaseOrder.status != "received")
    )
    suppliers_count_result = await db.execute(
        select(func.count(Supplier.id)).where(Supplier.is_active.is_(True))
    )

    shipment_counts = shipment_counts_result.one()
    courier_counts = courier_counts_result.one()
    return_counts = return_counts_result.one()
    return LogisticsCommandSummaryRead(
        pending_dispatch_count=pending_dispatch_result.scalar_one() or 0,
        ready_to_ship_count=ready_to_ship_result.scalar_one() or 0,
        active_shipments=shipment_counts[0] or 0,
        shipped_shipments=shipment_counts[1] or 0,
        delivered_shipments=shipment_counts[2] or 0,
        failed_shipments=shipment_counts[3] or 0,
        returned_shipments=shipment_counts[4] or 0,
        pending_reconciliation=shipment_counts[5] or 0,
        settled_reconciliation=shipment_counts[6] or 0,
        total_cod_amount=shipment_counts[7] or 0,
        total_collected_amount=shipment_counts[8] or 0,
        total_courier_charge=shipment_counts[9] or 0,
        external_sent_count=shipment_counts[10] or 0,
        external_pending_sync_count=shipment_counts[11] or 0,
        external_failed_count=shipment_counts[12] or 0,
        courier_count=courier_counts[0] or 0,
        active_courier_count=courier_counts[1] or 0,
        returns_pending=return_counts[0] or 0,
        returns_restocked=return_counts[1] or 0,
        purchase_orders_pending=purchase_orders_pending_result.scalar_one() or 0,
        suppliers_count=suppliers_count_result.scalar_one() or 0,
    )


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


@router.get("/reconciliation-export")
async def export_reconciliation_rows(
    db: DBSession,
    courier_id: UUID | None = None,
    reconciliation_status: str | None = None,
    external_status: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> Response:
    stmt = (
        select(Shipment)
        .options(
            selectinload(Shipment.order).selectinload(Order.customer),
            selectinload(Shipment.order).selectinload(Order.warehouse),
            selectinload(Shipment.courier),
        )
        .order_by(Shipment.created_at.desc())
    )
    if courier_id is not None:
        stmt = stmt.where(Shipment.courier_id == courier_id)
    if reconciliation_status:
        stmt = stmt.where(Shipment.reconciliation_status == reconciliation_status)
    if external_status:
        stmt = stmt.where(Shipment.external_status == external_status)
    if date_from is not None:
        stmt = stmt.where(Shipment.created_at >= date_from)
    if date_to is not None:
        stmt = stmt.where(Shipment.created_at <= date_to)

    shipments = list((await db.execute(stmt)).scalars().unique().all())
    return _csv_response(
        "reconciliation-shipments.csv",
        [
            "Shipment Number",
            "Order Number",
            "Courier",
            "Tracking",
            "External Tracking",
            "External Status",
            "COD Amount",
            "Collected Amount",
            "Courier Charge",
            "Reconciliation Status",
            "Created At",
        ],
        [
            [
                shipment.shipment_number,
                shipment.order.order_number if shipment.order else "",
                shipment.courier.name if shipment.courier else "",
                shipment.tracking_number or "",
                shipment.external_tracking_number or shipment.external_consignment_id or "",
                shipment.external_status or "",
                shipment.cod_amount,
                shipment.collected_amount,
                shipment.courier_charge,
                shipment.reconciliation_status,
                shipment.created_at.isoformat(),
            ]
            for shipment in shipments
        ],
    )
