from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import Select, desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.inventory import InventoryItem
from app.models.stock_movement import StockMovement


def _inventory_lookup_stmt(
    *,
    product_id: UUID | None,
    variant_id: UUID | None,
    warehouse_id: UUID | None = None,
) -> Select[tuple[InventoryItem]]:
    stmt = select(InventoryItem).where(
        InventoryItem.product_id == product_id,
        InventoryItem.variant_id == variant_id,
    )

    if warehouse_id is not None:
        stmt = stmt.where(InventoryItem.warehouse_id == warehouse_id)

    return stmt


async def get_inventory_item(
    db: AsyncSession,
    *,
    product_id: UUID | None,
    variant_id: UUID | None,
    warehouse_id: UUID,
) -> InventoryItem:
    result = await db.execute(
        _inventory_lookup_stmt(
            product_id=product_id,
            variant_id=variant_id,
            warehouse_id=warehouse_id,
        )
    )
    inventory_item = result.scalar_one_or_none()
    if inventory_item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inventory item not found",
        )
    return inventory_item


async def ensure_inventory_item(
    db: AsyncSession,
    *,
    product_id: UUID | None,
    variant_id: UUID | None,
    warehouse_id: UUID,
    initial_quantity: int = 0,
    low_stock_threshold: int = 5,
) -> InventoryItem:
    result = await db.execute(
        _inventory_lookup_stmt(
            product_id=product_id,
            variant_id=variant_id,
            warehouse_id=warehouse_id,
        )
    )
    inventory_item = result.scalar_one_or_none()
    if inventory_item is not None:
        return inventory_item

    inventory_item = InventoryItem(
        product_id=product_id,
        variant_id=variant_id,
        warehouse_id=warehouse_id,
        quantity=initial_quantity,
        low_stock_threshold=low_stock_threshold,
    )
    db.add(inventory_item)
    await db.flush()
    return inventory_item


async def get_inventory_item_for_fulfillment(
    db: AsyncSession,
    *,
    product_id: UUID | None,
    variant_id: UUID | None,
    warehouse_id: UUID,
    required_quantity: int,
) -> InventoryItem:
    inventory_item = await get_inventory_item(
        db,
        product_id=product_id,
        variant_id=variant_id,
        warehouse_id=warehouse_id,
    )

    if inventory_item.quantity < required_quantity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Insufficient stock in the selected warehouse for one or more order items",
        )

    return inventory_item


async def get_fulfillment_inventory_item(
    db: AsyncSession,
    *,
    product_id: UUID | None,
    variant_id: UUID | None,
    required_quantity: int,
) -> InventoryItem:
    result = await db.execute(
        _inventory_lookup_stmt(product_id=product_id, variant_id=variant_id).order_by(
            desc(InventoryItem.quantity),
            InventoryItem.created_at.asc(),
        )
    )
    candidates = list(result.scalars().all())

    if not candidates:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No inventory item found for one or more order items",
        )

    for inventory_item in candidates:
        if inventory_item.quantity >= required_quantity:
            return inventory_item

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Insufficient stock for one or more order items",
    )


async def create_stock_movement(
    db: AsyncSession,
    *,
    inventory_item: InventoryItem,
    movement_type: str,
    quantity: int,
    previous_quantity: int,
    new_quantity: int,
    order_id: UUID | None = None,
    note: str | None = None,
) -> StockMovement:
    movement = StockMovement(
        product_id=inventory_item.product_id,
        variant_id=inventory_item.variant_id,
        warehouse_id=inventory_item.warehouse_id,
        order_id=order_id,
        movement_type=movement_type,
        quantity=quantity,
        previous_quantity=previous_quantity,
        new_quantity=new_quantity,
        note=note,
    )
    db.add(movement)
    return movement


async def increase_stock(
    db: AsyncSession,
    *,
    inventory_item: InventoryItem,
    quantity: int,
    movement_type: str = "stock_in",
    order_id: UUID | None = None,
    note: str | None = None,
) -> InventoryItem:
    if quantity < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Quantity cannot be negative",
        )

    previous_quantity = inventory_item.quantity
    inventory_item.quantity = previous_quantity + quantity

    await create_stock_movement(
        db,
        inventory_item=inventory_item,
        movement_type=movement_type,
        quantity=quantity,
        previous_quantity=previous_quantity,
        new_quantity=inventory_item.quantity,
        order_id=order_id,
        note=note,
    )
    return inventory_item


async def decrease_stock(
    db: AsyncSession,
    *,
    inventory_item: InventoryItem,
    quantity: int,
    movement_type: str = "stock_out",
    order_id: UUID | None = None,
    note: str | None = None,
) -> InventoryItem:
    if quantity < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Quantity cannot be negative",
        )

    previous_quantity = inventory_item.quantity
    new_quantity = previous_quantity - quantity

    if new_quantity < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Stock cannot go below zero",
        )

    inventory_item.quantity = new_quantity

    await create_stock_movement(
        db,
        inventory_item=inventory_item,
        movement_type=movement_type,
        quantity=quantity,
        previous_quantity=previous_quantity,
        new_quantity=new_quantity,
        order_id=order_id,
        note=note,
    )
    return inventory_item


async def adjust_stock(
    db: AsyncSession,
    *,
    inventory_item: InventoryItem,
    new_quantity: int,
    movement_type: str = "adjustment",
    order_id: UUID | None = None,
    note: str | None = None,
) -> InventoryItem:
    if new_quantity < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Stock cannot go below zero",
        )

    previous_quantity = inventory_item.quantity
    inventory_item.quantity = new_quantity

    await create_stock_movement(
        db,
        inventory_item=inventory_item,
        movement_type=movement_type,
        quantity=abs(new_quantity - previous_quantity),
        previous_quantity=previous_quantity,
        new_quantity=new_quantity,
        order_id=order_id,
        note=note,
    )
    return inventory_item
