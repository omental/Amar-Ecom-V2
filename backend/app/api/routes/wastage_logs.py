from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import DBSession, get_current_user
from app.api.utils import commit_or_409, ensure_unique, fetch_one_or_404, normalize_pagination
from app.models.inventory_ops import WastageLog
from app.models.user import User
from app.models.warehouse import Warehouse
from app.schemas.inventory_ops import WastageLogCreate, WastageLogRead
from app.services.activity_log_service import log_activity
from app.services.inventory_service import decrease_stock, get_inventory_item_for_fulfillment


router = APIRouter(dependencies=[Depends(get_current_user)])


def _wastage_query():
    return select(WastageLog).options(selectinload(WastageLog.warehouse))


@router.get("", response_model=list[WastageLogRead])
async def list_wastage_logs(
    db: DBSession,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
) -> list[WastageLog]:
    skip, limit = normalize_pagination(skip, limit)
    result = await db.execute(
        _wastage_query().order_by(WastageLog.created_at.desc()).offset(skip).limit(limit)
    )
    return list(result.scalars().unique().all())


@router.get("/{wastage_log_id}", response_model=WastageLogRead)
async def get_wastage_log(wastage_log_id: UUID, db: DBSession) -> WastageLog:
    return await fetch_one_or_404(
        db,
        _wastage_query().where(WastageLog.id == wastage_log_id),
        "Wastage log not found",
    )


@router.post("", response_model=WastageLogRead, status_code=status.HTTP_201_CREATED)
async def create_wastage_log(
    wastage_in: WastageLogCreate,
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> WastageLog:
    await ensure_unique(db, WastageLog, "wastage_number", wastage_in.wastage_number, "Wastage number already exists")
    await fetch_one_or_404(db, select(Warehouse).where(Warehouse.id == wastage_in.warehouse_id), "Warehouse not found")

    inventory_item = await get_inventory_item_for_fulfillment(
        db,
        product_id=wastage_in.product_id,
        variant_id=wastage_in.variant_id,
        warehouse_id=wastage_in.warehouse_id,
        required_quantity=wastage_in.quantity,
    )

    wastage_log = WastageLog(**wastage_in.model_dump(), stock_deducted=False)
    db.add(wastage_log)
    await db.flush()

    await decrease_stock(
        db,
        inventory_item=inventory_item,
        quantity=wastage_in.quantity,
        movement_type="wastage",
        note=wastage_in.note or f"Wastage logged via {wastage_in.wastage_number}",
    )
    wastage_log.stock_deducted = True
    await log_activity(
        db,
        user_id=current_user.id,
        action="wastage_logged",
        module="inventory",
        entity_type="wastage_log",
        entity_id=wastage_log.id,
        message=f"Logged wastage {wastage_log.wastage_number}.",
        request=request,
    )
    await commit_or_409(db, "Could not create wastage log")
    await db.refresh(wastage_log)
    return await fetch_one_or_404(
        db,
        _wastage_query().where(WastageLog.id == wastage_log.id),
        "Wastage log not found",
    )
