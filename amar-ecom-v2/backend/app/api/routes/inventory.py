from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select

from app.api.deps import DBSession, get_current_user
from app.api.utils import commit_or_409, fetch_one_or_404, normalize_pagination
from app.models.inventory import InventoryItem
from app.schemas.inventory import InventoryItemCreate, InventoryItemRead, InventoryItemUpdate
from app.services.inventory_service import adjust_stock, create_stock_movement


router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[InventoryItemRead])
async def list_inventory_items(
    db: DBSession,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
) -> list[InventoryItem]:
    skip, limit = normalize_pagination(skip, limit)
    result = await db.execute(
        select(InventoryItem).order_by(InventoryItem.created_at.desc()).offset(skip).limit(limit)
    )
    return list(result.scalars().all())


@router.get("/{inventory_item_id}", response_model=InventoryItemRead)
async def get_inventory_item(inventory_item_id: UUID, db: DBSession) -> InventoryItem:
    return await fetch_one_or_404(
        db,
        select(InventoryItem).where(InventoryItem.id == inventory_item_id),
        "Inventory item not found",
    )


@router.post("", response_model=InventoryItemRead, status_code=status.HTTP_201_CREATED)
async def create_inventory_item(inventory_in: InventoryItemCreate, db: DBSession) -> InventoryItem:
    payload = inventory_in.model_dump()
    initial_quantity = payload.pop("quantity")
    inventory_item = InventoryItem(**payload, quantity=initial_quantity)
    db.add(inventory_item)

    if initial_quantity > 0:
        await create_stock_movement(
            db,
            inventory_item=inventory_item,
            movement_type="stock_in",
            quantity=initial_quantity,
            previous_quantity=0,
            new_quantity=initial_quantity,
            note="Initial inventory creation",
        )

    await commit_or_409(db, "Could not create inventory item")
    await db.refresh(inventory_item)
    return inventory_item


@router.patch("/{inventory_item_id}", response_model=InventoryItemRead)
async def update_inventory_item(
    inventory_item_id: UUID,
    inventory_in: InventoryItemUpdate,
    db: DBSession,
) -> InventoryItem:
    inventory_item = await fetch_one_or_404(
        db,
        select(InventoryItem).where(InventoryItem.id == inventory_item_id),
        "Inventory item not found",
    )

    updates = inventory_in.model_dump(exclude_unset=True)
    new_quantity = updates.pop("quantity", None)

    for field, value in updates.items():
        setattr(inventory_item, field, value)

    if new_quantity is not None and new_quantity != inventory_item.quantity:
        await adjust_stock(
            db,
            inventory_item=inventory_item,
            new_quantity=new_quantity,
            note="Inventory quantity updated manually",
        )

    await commit_or_409(db, "Could not update inventory item")
    await db.refresh(inventory_item)
    return inventory_item
