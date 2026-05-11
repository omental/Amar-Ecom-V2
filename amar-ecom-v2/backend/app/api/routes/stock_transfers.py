from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import DBSession, get_current_user
from app.api.utils import commit_or_409, ensure_unique, fetch_one_or_404, normalize_pagination
from app.models.inventory_ops import StockTransfer, StockTransferItem
from app.models.user import User
from app.models.warehouse import Warehouse
from app.schemas.inventory_ops import StockTransferCreate, StockTransferRead, StockTransferUpdate
from app.services.activity_log_service import log_activity
from app.services.inventory_service import (
    decrease_stock,
    ensure_inventory_item,
    get_inventory_item_for_fulfillment,
    increase_stock,
)


router = APIRouter(dependencies=[Depends(get_current_user)])


def _stock_transfer_query():
    return select(StockTransfer).options(
        selectinload(StockTransfer.from_warehouse),
        selectinload(StockTransfer.to_warehouse),
        selectinload(StockTransfer.items),
    )


async def _apply_stock_transfer(db: DBSession, stock_transfer: StockTransfer) -> None:
    if stock_transfer.stock_moved:
        return

    if not stock_transfer.items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot complete a stock transfer without items.")

    for item in stock_transfer.items:
        source_inventory = await get_inventory_item_for_fulfillment(
            db,
            product_id=item.product_id,
            variant_id=item.variant_id,
            warehouse_id=stock_transfer.from_warehouse_id,
            required_quantity=item.quantity,
        )
        await decrease_stock(
            db,
            inventory_item=source_inventory,
            quantity=item.quantity,
            movement_type="transfer_out",
            note=f"Transferred out via {stock_transfer.transfer_number}",
        )

        destination_inventory = await ensure_inventory_item(
            db,
            product_id=item.product_id,
            variant_id=item.variant_id,
            warehouse_id=stock_transfer.to_warehouse_id,
            initial_quantity=0,
            low_stock_threshold=source_inventory.low_stock_threshold,
        )
        await increase_stock(
            db,
            inventory_item=destination_inventory,
            quantity=item.quantity,
            movement_type="transfer_in",
            note=f"Transferred in via {stock_transfer.transfer_number}",
        )

    stock_transfer.stock_moved = True


@router.get("", response_model=list[StockTransferRead])
async def list_stock_transfers(
    db: DBSession,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
) -> list[StockTransfer]:
    skip, limit = normalize_pagination(skip, limit)
    result = await db.execute(
        _stock_transfer_query().order_by(StockTransfer.created_at.desc()).offset(skip).limit(limit)
    )
    return list(result.scalars().unique().all())


@router.get("/{stock_transfer_id}", response_model=StockTransferRead)
async def get_stock_transfer(stock_transfer_id: UUID, db: DBSession) -> StockTransfer:
    return await fetch_one_or_404(
        db,
        _stock_transfer_query().where(StockTransfer.id == stock_transfer_id),
        "Stock transfer not found",
    )


@router.post("", response_model=StockTransferRead, status_code=status.HTTP_201_CREATED)
async def create_stock_transfer(
    stock_transfer_in: StockTransferCreate,
    db: DBSession,
) -> StockTransfer:
    await ensure_unique(db, StockTransfer, "transfer_number", stock_transfer_in.transfer_number, "Transfer number already exists")
    if stock_transfer_in.from_warehouse_id == stock_transfer_in.to_warehouse_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Source and destination warehouses must be different.")

    await fetch_one_or_404(db, select(Warehouse).where(Warehouse.id == stock_transfer_in.from_warehouse_id), "Source warehouse not found")
    await fetch_one_or_404(db, select(Warehouse).where(Warehouse.id == stock_transfer_in.to_warehouse_id), "Destination warehouse not found")

    stock_transfer = StockTransfer(
        transfer_number=stock_transfer_in.transfer_number,
        from_warehouse_id=stock_transfer_in.from_warehouse_id,
        to_warehouse_id=stock_transfer_in.to_warehouse_id,
        status=stock_transfer_in.status,
        notes=stock_transfer_in.notes,
    )
    for item_in in stock_transfer_in.items:
        stock_transfer.items.append(StockTransferItem(**item_in.model_dump()))

    db.add(stock_transfer)
    await commit_or_409(db, "Could not create stock transfer")
    await db.refresh(stock_transfer)
    return await fetch_one_or_404(
        db,
        _stock_transfer_query().where(StockTransfer.id == stock_transfer.id),
        "Stock transfer not found",
    )


@router.patch("/{stock_transfer_id}", response_model=StockTransferRead)
async def update_stock_transfer(
    stock_transfer_id: UUID,
    stock_transfer_in: StockTransferUpdate,
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> StockTransfer:
    stock_transfer = await fetch_one_or_404(
        db,
        _stock_transfer_query().where(StockTransfer.id == stock_transfer_id),
        "Stock transfer not found",
    )
    previous_status = stock_transfer.status
    updates = stock_transfer_in.model_dump(exclude_unset=True)

    for field, value in updates.items():
        setattr(stock_transfer, field, value)

    if "status" in updates and previous_status != stock_transfer.status and stock_transfer.status == "completed":
        await _apply_stock_transfer(db, stock_transfer)
        await log_activity(
            db,
            user_id=current_user.id,
            action="stock_transfer_completed",
            module="inventory",
            entity_type="stock_transfer",
            entity_id=stock_transfer.id,
            message=f"Completed stock transfer {stock_transfer.transfer_number}.",
            request=request,
        )

    await commit_or_409(db, "Could not update stock transfer")
    await db.refresh(stock_transfer)
    return await fetch_one_or_404(
        db,
        _stock_transfer_query().where(StockTransfer.id == stock_transfer.id),
        "Stock transfer not found",
    )
