from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy import func, select

from app.api.deps import DBSession, get_current_user
from app.api.utils import commit_or_409, ensure_unique, fetch_one_or_404, normalize_pagination
from app.models.courier import Courier, Shipment
from app.schemas.courier import CourierCreate, CourierRead, CourierUpdate


router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[CourierRead])
async def list_couriers(
    db: DBSession,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
) -> list[Courier]:
    skip, limit = normalize_pagination(skip, limit)
    result = await db.execute(select(Courier).order_by(Courier.created_at.desc()).offset(skip).limit(limit))
    couriers = list(result.scalars().all())
    if not couriers:
        return couriers

    courier_ids = [courier.id for courier in couriers]
    counts_result = await db.execute(
        select(
            Shipment.courier_id,
            func.count(Shipment.id).filter(Shipment.status.not_in(["delivered", "cancelled", "returned", "failed"])),
            func.count(Shipment.id).filter(Shipment.status == "delivered"),
            func.count(Shipment.id).filter(Shipment.reconciliation_status != "settled"),
        )
        .where(Shipment.courier_id.in_(courier_ids))
        .group_by(Shipment.courier_id)
    )
    counts_map = {
        row[0]: {
            "active": row[1] or 0,
            "delivered": row[2] or 0,
            "pending_reconciliation": row[3] or 0,
        }
        for row in counts_result.all()
    }
    for courier in couriers:
        counts = counts_map.get(courier.id, {})
        setattr(courier, "active_shipment_count", counts.get("active", 0))
        setattr(courier, "delivered_count", counts.get("delivered", 0))
        setattr(courier, "pending_reconciliation_count", counts.get("pending_reconciliation", 0))
    return couriers


@router.get("/{courier_id}", response_model=CourierRead)
async def get_courier(courier_id: UUID, db: DBSession) -> Courier:
    courier = await fetch_one_or_404(db, select(Courier).where(Courier.id == courier_id), "Courier not found")
    counts_result = await db.execute(
        select(
            func.count(Shipment.id).filter(Shipment.status.not_in(["delivered", "cancelled", "returned", "failed"])),
            func.count(Shipment.id).filter(Shipment.status == "delivered"),
            func.count(Shipment.id).filter(Shipment.reconciliation_status != "settled"),
        ).where(Shipment.courier_id == courier.id)
    )
    counts = counts_result.one()
    setattr(courier, "active_shipment_count", counts[0] or 0)
    setattr(courier, "delivered_count", counts[1] or 0)
    setattr(courier, "pending_reconciliation_count", counts[2] or 0)
    return courier


@router.post("", response_model=CourierRead, status_code=status.HTTP_201_CREATED)
async def create_courier(courier_in: CourierCreate, db: DBSession) -> Courier:
    await ensure_unique(db, Courier, "code", courier_in.code, "Courier code already exists")
    courier = Courier(**courier_in.model_dump())
    db.add(courier)
    await commit_or_409(db, "Could not create courier")
    await db.refresh(courier)
    return courier


@router.patch("/{courier_id}", response_model=CourierRead)
async def update_courier(courier_id: UUID, courier_in: CourierUpdate, db: DBSession) -> Courier:
    courier = await fetch_one_or_404(db, select(Courier).where(Courier.id == courier_id), "Courier not found")
    payload = courier_in.model_dump(exclude_unset=True)

    if "code" in payload:
        await ensure_unique(db, Courier, "code", payload["code"], "Courier code already exists", exclude_id=courier.id)

    for field, value in payload.items():
        setattr(courier, field, value)

    await commit_or_409(db, "Could not update courier")
    await db.refresh(courier)
    return courier


@router.delete("/{courier_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_courier(courier_id: UUID, db: DBSession) -> Response:
    courier = await fetch_one_or_404(db, select(Courier).where(Courier.id == courier_id), "Courier not found")
    courier.is_active = False
    await commit_or_409(db, "Could not deactivate courier")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
