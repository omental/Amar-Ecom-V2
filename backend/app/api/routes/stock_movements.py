from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import DBSession, get_current_user
from app.api.utils import fetch_one_or_404, normalize_pagination
from app.models.stock_movement import StockMovement
from app.schemas.stock_movement import StockMovementRead


router = APIRouter(dependencies=[Depends(get_current_user)])


def _stock_movement_query():
    return select(StockMovement).options(
        selectinload(StockMovement.product),
        selectinload(StockMovement.variant),
        selectinload(StockMovement.warehouse),
    )


@router.get("", response_model=list[StockMovementRead])
async def list_stock_movements(
    db: DBSession,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    product_id: UUID | None = None,
    variant_id: UUID | None = None,
    warehouse_id: UUID | None = None,
    order_id: UUID | None = None,
    movement_type: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> list[StockMovement]:
    skip, limit = normalize_pagination(skip, limit)
    stmt = _stock_movement_query()

    if product_id is not None:
        stmt = stmt.where(StockMovement.product_id == product_id)
    if variant_id is not None:
        stmt = stmt.where(StockMovement.variant_id == variant_id)
    if warehouse_id is not None:
        stmt = stmt.where(StockMovement.warehouse_id == warehouse_id)
    if order_id is not None:
        stmt = stmt.where(StockMovement.order_id == order_id)
    if movement_type is not None:
        stmt = stmt.where(StockMovement.movement_type == movement_type)
    if date_from is not None:
        stmt = stmt.where(StockMovement.created_at >= date_from)
    if date_to is not None:
        stmt = stmt.where(StockMovement.created_at <= date_to)

    result = await db.execute(
        stmt.order_by(StockMovement.created_at.desc()).offset(skip).limit(limit)
    )
    return list(result.scalars().unique().all())


@router.get("/{movement_id}", response_model=StockMovementRead)
async def get_stock_movement(movement_id: UUID, db: DBSession) -> StockMovement:
    return await fetch_one_or_404(
        db,
        _stock_movement_query().where(StockMovement.id == movement_id),
        "Stock movement not found",
    )
