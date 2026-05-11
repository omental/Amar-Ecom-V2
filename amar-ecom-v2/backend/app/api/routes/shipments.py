from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import DBSession, get_current_user
from app.api.utils import commit_or_409, ensure_unique, fetch_one_or_404, normalize_pagination
from app.models.courier import Courier, Shipment
from app.models.order import Order
from app.schemas.courier import ShipmentCreate, ShipmentRead, ShipmentUpdate


router = APIRouter(dependencies=[Depends(get_current_user)])


def _shipment_query():
    return select(Shipment).options(
        selectinload(Shipment.order),
        selectinload(Shipment.courier),
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


@router.get("", response_model=list[ShipmentRead])
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


@router.get("/{shipment_id}", response_model=ShipmentRead)
async def get_shipment(shipment_id: UUID, db: DBSession) -> Shipment:
    return await fetch_one_or_404(db, _shipment_query().where(Shipment.id == shipment_id), "Shipment not found")


@router.post("", response_model=ShipmentRead, status_code=status.HTTP_201_CREATED)
async def create_shipment(shipment_in: ShipmentCreate, db: DBSession) -> Shipment:
    await ensure_unique(db, Shipment, "shipment_number", shipment_in.shipment_number, "Shipment number already exists")
    await fetch_one_or_404(db, select(Order).where(Order.id == shipment_in.order_id), "Order not found")
    if shipment_in.courier_id is not None:
        await fetch_one_or_404(db, select(Courier).where(Courier.id == shipment_in.courier_id), "Courier not found")

    shipment = Shipment(**shipment_in.model_dump())
    _sync_shipment_timestamps(shipment)
    db.add(shipment)
    await commit_or_409(db, "Could not create shipment")
    await db.refresh(shipment)
    return await fetch_one_or_404(db, _shipment_query().where(Shipment.id == shipment.id), "Shipment not found")


@router.patch("/{shipment_id}", response_model=ShipmentRead)
async def update_shipment(shipment_id: UUID, shipment_in: ShipmentUpdate, db: DBSession) -> Shipment:
    shipment = await fetch_one_or_404(db, _shipment_query().where(Shipment.id == shipment_id), "Shipment not found")
    payload = shipment_in.model_dump(exclude_unset=True)
    previous_status = shipment.status

    if "courier_id" in payload and payload["courier_id"] is not None:
        await fetch_one_or_404(db, select(Courier).where(Courier.id == payload["courier_id"]), "Courier not found")

    for field, value in payload.items():
        setattr(shipment, field, value)

    _sync_shipment_timestamps(shipment, previous_status)
    await commit_or_409(db, "Could not update shipment")
    await db.refresh(shipment)
    return await fetch_one_or_404(db, _shipment_query().where(Shipment.id == shipment.id), "Shipment not found")
