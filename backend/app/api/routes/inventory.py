from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.orm import selectinload

from app.api.deps import DBSession, get_current_user
from app.api.utils import commit_or_409, fetch_one_or_404, normalize_pagination
from app.models.brand import Brand
from app.models.category import Category
from app.models.inventory import InventoryItem
from app.models.inventory_ops import StockTransfer, WastageLog
from app.models.product import Product
from app.models.user import User
from app.models.return_request import ReturnRequest
from app.models.stock_movement import StockMovement
from app.models.supplier import PurchaseOrder, Supplier
from app.models.warehouse import Warehouse
from app.schemas.inventory import (
    InventoryAdjustmentCreate,
    InventoryItemCreate,
    InventoryHubSummaryRead,
    InventoryItemRead,
    InventoryItemUpdate,
)
from app.services.activity_log_service import log_activity
from app.services.inventory_service import adjust_stock, create_stock_movement


router = APIRouter(dependencies=[Depends(get_current_user)])


def _inventory_query():
    return select(InventoryItem).options(
        selectinload(InventoryItem.product).selectinload(Product.category),
        selectinload(InventoryItem.product).selectinload(Product.brand),
        selectinload(InventoryItem.variant),
        selectinload(InventoryItem.warehouse),
    )


async def _attach_latest_movements(db: DBSession, items: list[InventoryItem]) -> None:
    if not items:
        return

    movement_filters = []
    for item in items:
        variant_filter = (
            StockMovement.variant_id == item.variant_id
            if item.variant_id is not None
            else StockMovement.variant_id.is_(None)
        )
        movement_filters.append(
            and_(
                StockMovement.product_id == item.product_id,
                variant_filter,
                StockMovement.warehouse_id == item.warehouse_id,
            )
        )

    result = await db.execute(
        select(StockMovement)
        .where(or_(*movement_filters))
        .order_by(desc(StockMovement.created_at))
    )

    latest_by_key: dict[tuple[UUID | None, UUID | None, UUID], StockMovement] = {}
    for movement in result.scalars().all():
        key = (movement.product_id, movement.variant_id, movement.warehouse_id)
        latest_by_key.setdefault(key, movement)

    for item in items:
        key = (item.product_id, item.variant_id, item.warehouse_id)
        setattr(item, "_latest_movement", latest_by_key.get(key))


@router.get("/hub-summary", response_model=InventoryHubSummaryRead)
async def get_inventory_hub_summary(db: DBSession) -> InventoryHubSummaryRead:
    completed_statuses = ("completed", "received")
    non_pending_statuses = ("completed", "received", "cancelled")

    total_products = (await db.execute(select(func.count(Product.id)))).scalar_one()
    active_products = (
        await db.execute(select(func.count(Product.id)).where(func.lower(Product.status) == "active"))
    ).scalar_one()
    categories = (await db.execute(select(func.count(Category.id)))).scalar_one()
    brands = (await db.execute(select(func.count(Brand.id)))).scalar_one()
    warehouses = (await db.execute(select(func.count(Warehouse.id)))).scalar_one()
    stock_rows = (await db.execute(select(func.count(InventoryItem.id)))).scalar_one()
    low_stock = (
        await db.execute(
            select(func.count(InventoryItem.id)).where(
                InventoryItem.quantity > 0,
                InventoryItem.quantity <= InventoryItem.low_stock_threshold,
            )
        )
    ).scalar_one()
    out_of_stock = (
        await db.execute(select(func.count(InventoryItem.id)).where(InventoryItem.quantity <= 0))
    ).scalar_one()
    pending_transfers = (
        await db.execute(
            select(func.count(StockTransfer.id)).where(
                func.lower(StockTransfer.status).notin_(non_pending_statuses)
            )
        )
    ).scalar_one()
    completed_transfers = (
        await db.execute(
            select(func.count(StockTransfer.id)).where(func.lower(StockTransfer.status).in_(completed_statuses))
        )
    ).scalar_one()
    wastage_count = (await db.execute(select(func.count(WastageLog.id)))).scalar_one()
    purchase_orders = (await db.execute(select(func.count(PurchaseOrder.id)))).scalar_one()
    suppliers = (await db.execute(select(func.count(Supplier.id)))).scalar_one()
    returns = (await db.execute(select(func.count(ReturnRequest.id)))).scalar_one()
    stock_movement_count = (await db.execute(select(func.count(StockMovement.id)))).scalar_one()
    inventory_value = (
        await db.execute(
            select(func.coalesce(func.sum(InventoryItem.quantity * Product.cost_price), 0)).join(
                Product,
                InventoryItem.product_id == Product.id,
            )
        )
    ).scalar_one()

    return InventoryHubSummaryRead(
        total_products=total_products,
        active_products=active_products,
        categories=categories,
        brands=brands,
        warehouses=warehouses,
        stock_rows=stock_rows,
        low_stock=low_stock,
        out_of_stock=out_of_stock,
        pending_transfers=pending_transfers,
        completed_transfers=completed_transfers,
        wastage_count=wastage_count,
        purchase_orders=purchase_orders,
        suppliers=suppliers,
        returns=returns,
        stock_movement_count=stock_movement_count,
        inventory_value=inventory_value,
    )


@router.get("", response_model=list[InventoryItemRead])
async def list_inventory_items(
    db: DBSession,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
) -> list[InventoryItem]:
    skip, limit = normalize_pagination(skip, limit)
    result = await db.execute(
        _inventory_query().order_by(InventoryItem.created_at.desc()).offset(skip).limit(limit)
    )
    items = list(result.scalars().unique().all())
    await _attach_latest_movements(db, items)
    return items


@router.get("/{inventory_item_id}", response_model=InventoryItemRead)
async def get_inventory_item(inventory_item_id: UUID, db: DBSession) -> InventoryItem:
    inventory_item = await fetch_one_or_404(
        db,
        _inventory_query().where(InventoryItem.id == inventory_item_id),
        "Inventory item not found",
    )
    await _attach_latest_movements(db, [inventory_item])
    return inventory_item


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
    return await get_inventory_item(inventory_item.id, db)


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
    return await get_inventory_item(inventory_item.id, db)


@router.post("/{inventory_item_id}/adjust", response_model=InventoryItemRead)
async def adjust_inventory_item(
    inventory_item_id: UUID,
    adjustment_in: InventoryAdjustmentCreate,
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> InventoryItem:
    inventory_item = await fetch_one_or_404(
        db,
        select(InventoryItem).where(InventoryItem.id == inventory_item_id),
        "Inventory item not found",
    )

    if adjustment_in.new_quantity is None and adjustment_in.quantity_delta is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Either new_quantity or quantity_delta is required.")

    if adjustment_in.new_quantity is not None and adjustment_in.quantity_delta is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Provide either new_quantity or quantity_delta, not both.")

    target_quantity = (
        adjustment_in.new_quantity
        if adjustment_in.new_quantity is not None
        else inventory_item.quantity + (adjustment_in.quantity_delta or 0)
    )

    if target_quantity < 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Stock cannot go below zero.")

    await adjust_stock(
        db,
        inventory_item=inventory_item,
        new_quantity=target_quantity,
        note=adjustment_in.note or "Inventory adjusted from operations hub",
    )
    await log_activity(
        db,
        user_id=current_user.id,
        action="inventory_adjusted",
        module="inventory",
        entity_type="inventory_item",
        entity_id=inventory_item.id,
        message=f"Adjusted inventory item {inventory_item.id} to quantity {target_quantity}.",
        request=request,
    )
    await commit_or_409(db, "Could not adjust inventory item")
    await db.refresh(inventory_item)
    return await get_inventory_item(inventory_item.id, db)
