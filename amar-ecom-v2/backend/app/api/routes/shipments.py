import csv
from io import StringIO
from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import DBSession, get_current_user
from app.api.utils import commit_or_409, ensure_unique, fetch_one_or_404, normalize_pagination
from app.models.courier import Courier, Shipment, ShipmentEvent
from app.models.order import Order
from app.models.user import User
from app.schemas.courier import (
    ShipmentBatchStatusUpdateRequest,
    ShipmentBatchStatusUpdateResultRead,
    ShipmentBatchStatusUpdateRowRead,
    ShipmentCreate,
    ShipmentListRead,
    ShipmentRead,
    ShipmentUpdate,
)
from app.services.activity_log_service import log_activity


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


def _shipment_query():
    return select(Shipment).options(
        selectinload(Shipment.order).selectinload(Order.customer),
        selectinload(Shipment.order).selectinload(Order.warehouse),
        selectinload(Shipment.courier),
        selectinload(Shipment.events).selectinload(ShipmentEvent.created_by),
    )


def _sync_shipment_timestamps(shipment: Shipment, previous_status: str | None = None) -> None:
    current_time = datetime.now(timezone.utc)

    if shipment.status == "shipped" and shipment.shipped_at is None:
        shipment.shipped_at = current_time
    if shipment.status == "delivered":
        if shipment.shipped_at is None:
            shipment.shipped_at = current_time
        if shipment.delivered_at is None:
            shipment.delivered_at = current_time
        if (shipment.collected_amount or Decimal("0")) <= 0 and (shipment.cod_amount or Decimal("0")) > 0:
            shipment.collected_amount = shipment.cod_amount


def _is_safe_shipment_status_transition(previous_status: str, next_status: str) -> bool:
    if previous_status == next_status:
        return True
    if previous_status == "delivered":
        return False
    if previous_status == "cancelled":
        return next_status == "cancelled"
    if previous_status == "returned":
        return next_status == "returned"
    if previous_status == "failed":
        return next_status in {"failed", "returned"}
    if previous_status == "shipped" and next_status in {"pending", "ready_to_ship"}:
        return False
    if previous_status == "in_transit" and next_status == "pending":
        return False
    return True


def _sync_reconciliation_fields(
    shipment: Shipment,
    previous_reconciliation_status: str | None = None,
) -> None:
    if shipment.reconciliation_status in {"matched", "settled"}:
        if previous_reconciliation_status != shipment.reconciliation_status or shipment.reconciled_at is None:
            shipment.reconciled_at = datetime.now(timezone.utc)
    elif previous_reconciliation_status != shipment.reconciliation_status:
        shipment.reconciled_at = None


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


def _prefill_recipient_fields(order: Order) -> dict[str, str | None]:
    return {
        "recipient_name": order.customer.name if order.customer else None,
        "recipient_phone": order.customer_phone or (order.customer.phone if order.customer else None),
        "delivery_address": order.shipping_address or (order.customer.address if order.customer else None),
    }


@router.get("", response_model=list[ShipmentListRead])
async def list_shipments(
    db: DBSession,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    order_id: UUID | None = None,
    courier_id: UUID | None = None,
    status_filter: str | None = Query(default=None, alias="status"),
) -> list[Shipment]:
    skip, limit = normalize_pagination(skip, limit)
    stmt = _shipment_query()

    if order_id is not None:
        stmt = stmt.where(Shipment.order_id == order_id)
    if courier_id is not None:
        stmt = stmt.where(Shipment.courier_id == courier_id)
    if status_filter is not None:
        stmt = stmt.where(Shipment.status == status_filter)

    result = await db.execute(stmt.order_by(Shipment.created_at.desc()).offset(skip).limit(limit))
    return list(result.scalars().unique().all())


@router.post("/batch-status-update", response_model=ShipmentBatchStatusUpdateResultRead)
async def batch_update_shipment_statuses(
    payload: ShipmentBatchStatusUpdateRequest,
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> ShipmentBatchStatusUpdateResultRead:
    if not payload.shipment_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Select at least one shipment.")

    result = await db.execute(_shipment_query().where(Shipment.id.in_(payload.shipment_ids)))
    shipments = {shipment.id: shipment for shipment in result.scalars().unique().all()}

    rows: list[ShipmentBatchStatusUpdateRowRead] = []
    success_count = 0
    skipped_count = 0
    failed_count = 0

    for shipment_id in payload.shipment_ids:
        shipment = shipments.get(shipment_id)
        if shipment is None:
            failed_count += 1
            rows.append(
                ShipmentBatchStatusUpdateRowRead(
                    shipment_id=shipment_id,
                    status="failed",
                    message="Shipment not found.",
                )
            )
            continue

        previous_status = shipment.status
        if previous_status == payload.status:
            skipped_count += 1
            rows.append(
                ShipmentBatchStatusUpdateRowRead(
                    shipment_id=shipment.id,
                    status="skipped",
                    message="Shipment already has that status.",
                )
            )
            continue

        if not _is_safe_shipment_status_transition(previous_status, payload.status):
            skipped_count += 1
            rows.append(
                ShipmentBatchStatusUpdateRowRead(
                    shipment_id=shipment.id,
                    status="skipped",
                    message=f"Skipped unsafe transition from {previous_status} to {payload.status}.",
                )
            )
            continue

        shipment.status = payload.status
        _sync_shipment_timestamps(shipment, previous_status)
        _log_shipment_event(
            shipment,
            event_type="status_changed",
            message=f"Status changed from {previous_status} to {shipment.status}.",
            created_by_id=current_user.id,
        )
        await log_activity(
            db,
            user_id=current_user.id,
            action="shipment_status_changed",
            module="shipments",
            entity_type="shipment",
            entity_id=shipment.id,
            message=f"Changed shipment {shipment.shipment_number} from {previous_status} to {shipment.status} via batch update.",
            request=request,
        )
        success_count += 1
        rows.append(
            ShipmentBatchStatusUpdateRowRead(
                shipment_id=shipment.id,
                status="success",
                message=f"Updated to {shipment.status}.",
            )
        )

    await commit_or_409(db, "Could not complete shipment batch status update")
    return ShipmentBatchStatusUpdateResultRead(
        status=payload.status,
        success_count=success_count,
        skipped_count=skipped_count,
        failed_count=failed_count,
        rows=rows,
    )


@router.get("/{shipment_id}", response_model=ShipmentRead)
async def get_shipment(shipment_id: UUID, db: DBSession) -> Shipment:
    return await fetch_one_or_404(db, _shipment_query().where(Shipment.id == shipment_id), "Shipment not found")


@router.post("", response_model=ShipmentRead, status_code=status.HTTP_201_CREATED)
async def create_shipment(
    shipment_in: ShipmentCreate,
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> Shipment:
    await ensure_unique(db, Shipment, "shipment_number", shipment_in.shipment_number, "Shipment number already exists")
    order = await fetch_one_or_404(
        db,
        select(Order).options(selectinload(Order.customer)).where(Order.id == shipment_in.order_id),
        "Order not found",
    )
    if shipment_in.courier_id is not None:
        await fetch_one_or_404(db, select(Courier).where(Courier.id == shipment_in.courier_id), "Courier not found")

    payload = shipment_in.model_dump()
    recipient_defaults = _prefill_recipient_fields(order)
    payload["recipient_name"] = payload.get("recipient_name") or recipient_defaults["recipient_name"]
    payload["recipient_phone"] = payload.get("recipient_phone") or recipient_defaults["recipient_phone"]
    payload["delivery_address"] = payload.get("delivery_address") or recipient_defaults["delivery_address"]
    shipment = Shipment(
        **payload,
    )
    _sync_shipment_timestamps(shipment)
    _sync_reconciliation_fields(shipment)
    _log_shipment_event(
        shipment,
        event_type="shipment_created",
        message=f"Shipment created with status {shipment.status}.",
        created_by_id=current_user.id,
    )
    db.add(shipment)
    await log_activity(
        db,
        user_id=current_user.id,
        action="shipment_created",
        module="shipments",
        entity_type="shipment",
        entity_id=shipment.id,
        message=f"Created shipment {shipment.shipment_number} for order {order.order_number}.",
        request=request,
    )
    await commit_or_409(db, "Could not create shipment")
    await db.refresh(shipment)
    return await fetch_one_or_404(db, _shipment_query().where(Shipment.id == shipment.id), "Shipment not found")


@router.patch("/{shipment_id}", response_model=ShipmentRead)
async def update_shipment(
    shipment_id: UUID,
    shipment_in: ShipmentUpdate,
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> Shipment:
    shipment = await fetch_one_or_404(db, _shipment_query().where(Shipment.id == shipment_id), "Shipment not found")
    payload = shipment_in.model_dump(exclude_unset=True)
    previous_status = shipment.status
    previous_reconciliation_status = shipment.reconciliation_status

    if "courier_id" in payload and payload["courier_id"] is not None:
        await fetch_one_or_404(db, select(Courier).where(Courier.id == payload["courier_id"]), "Courier not found")

    for field, value in payload.items():
        setattr(shipment, field, value)

    _sync_shipment_timestamps(shipment, previous_status)
    _sync_reconciliation_fields(shipment, previous_reconciliation_status)
    if "status" in payload and previous_status != shipment.status:
        _log_shipment_event(
            shipment,
            event_type="status_changed",
            message=f"Status changed from {previous_status} to {shipment.status}.",
            created_by_id=current_user.id,
        )
        await log_activity(
            db,
            user_id=current_user.id,
            action="shipment_status_changed",
            module="shipments",
            entity_type="shipment",
            entity_id=shipment.id,
            message=f"Changed shipment {shipment.shipment_number} from {previous_status} to {shipment.status}.",
            request=request,
        )
    if "reconciliation_status" in payload and previous_reconciliation_status != shipment.reconciliation_status:
        _log_shipment_event(
            shipment,
            event_type="reconciliation_updated",
            message=(
                f"Reconciliation status changed from {previous_reconciliation_status} "
                f"to {shipment.reconciliation_status}."
            ),
            created_by_id=current_user.id,
        )
        await log_activity(
            db,
            user_id=current_user.id,
            action="shipment_reconciliation_updated",
            module="shipments",
            entity_type="shipment",
            entity_id=shipment.id,
            message=(
                f"Updated reconciliation for shipment {shipment.shipment_number} "
                f"from {previous_reconciliation_status} to {shipment.reconciliation_status}."
            ),
            request=request,
        )
    await commit_or_409(db, "Could not update shipment")
    await db.refresh(shipment)
    return await fetch_one_or_404(db, _shipment_query().where(Shipment.id == shipment.id), "Shipment not found")
