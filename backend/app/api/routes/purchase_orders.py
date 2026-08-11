from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import DBSession, get_current_user, require_permission
from app.api.utils import commit_or_409, ensure_unique, fetch_one_or_404, normalize_pagination
from app.models.product import Product
from app.models.supplier import PurchaseOrder, PurchaseOrderItem, Supplier
from app.models.warehouse import Warehouse
from app.schemas.supplier import PurchaseOrderCreate, PurchaseOrderRead, PurchaseOrderUpdate
from app.services.inventory_service import ensure_inventory_item, increase_stock


router = APIRouter(dependencies=[Depends(get_current_user)])


def _purchase_order_query():
    return select(PurchaseOrder).options(
        selectinload(PurchaseOrder.supplier),
        selectinload(PurchaseOrder.warehouse),
        selectinload(PurchaseOrder.items),
    )


def _generate_po_number() -> str:
    return f"PO-{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}"


def _calculate_totals(items: list[PurchaseOrderItem], discount: Decimal) -> tuple[Decimal, Decimal]:
    subtotal = sum((item.total_cost for item in items), Decimal("0.00"))
    total = subtotal - discount
    return subtotal, total if total >= Decimal("0.00") else Decimal("0.00")


async def _validate_references(
    db: DBSession,
    *,
    supplier_id: UUID | None = None,
    warehouse_id: UUID | None = None,
) -> None:
    if supplier_id is not None:
        await fetch_one_or_404(db, select(Supplier).where(Supplier.id == supplier_id), "Supplier not found")
    if warehouse_id is not None:
        await fetch_one_or_404(db, select(Warehouse).where(Warehouse.id == warehouse_id), "Warehouse not found")


async def _receive_purchase_order(db: DBSession, purchase_order: PurchaseOrder) -> None:
    if purchase_order.stock_received:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Purchase order stock has already been received",
        )

    if purchase_order.warehouse_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A warehouse is required before marking a purchase order as received",
        )

    for item in purchase_order.items:
        received_quantity = item.received_quantity if item.received_quantity > 0 else item.quantity
        inventory_item = await ensure_inventory_item(
            db,
            product_id=item.product_id,
            variant_id=item.variant_id,
            warehouse_id=purchase_order.warehouse_id,
            initial_quantity=0,
            low_stock_threshold=5,
        )
        await increase_stock(
            db,
            inventory_item=inventory_item,
            quantity=received_quantity,
            movement_type="purchase_received",
            note=f"Inventory received from purchase order {purchase_order.po_number}",
        )
        item.received_quantity = received_quantity

    purchase_order.stock_received = True
    if purchase_order.received_date is None:
        purchase_order.received_date = date.today()


@router.get("", response_model=list[PurchaseOrderRead])
async def list_purchase_orders(
    db: DBSession,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
) -> list[PurchaseOrder]:
    skip, limit = normalize_pagination(skip, limit)
    result = await db.execute(
        _purchase_order_query().order_by(PurchaseOrder.created_at.desc()).offset(skip).limit(limit)
    )
    return list(result.scalars().unique().all())


@router.get("/{purchase_order_id}", response_model=PurchaseOrderRead)
async def get_purchase_order(purchase_order_id: UUID, db: DBSession) -> PurchaseOrder:
    return await fetch_one_or_404(
        db,
        _purchase_order_query().where(PurchaseOrder.id == purchase_order_id),
        "Purchase order not found",
    )


@router.post("", response_model=PurchaseOrderRead, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_permission("purchase_orders", "create"))])
async def create_purchase_order(purchase_order_in: PurchaseOrderCreate, db: DBSession) -> PurchaseOrder:
    po_number = purchase_order_in.po_number or _generate_po_number()
    await ensure_unique(db, PurchaseOrder, "po_number", po_number, "Purchase order number already exists")
    await _validate_references(
        db,
        supplier_id=purchase_order_in.supplier_id,
        warehouse_id=purchase_order_in.warehouse_id,
    )

    purchase_order = PurchaseOrder(
        po_number=po_number,
        supplier_id=purchase_order_in.supplier_id,
        warehouse_id=purchase_order_in.warehouse_id,
        status=purchase_order_in.status,
        order_date=purchase_order_in.order_date,
        expected_date=purchase_order_in.expected_date,
        discount=purchase_order_in.discount,
        notes=purchase_order_in.notes,
    )

    for item_in in purchase_order_in.items:
        if item_in.product_id is not None:
            await fetch_one_or_404(
                db,
                select(Product).where(Product.id == item_in.product_id),
                "Product not found",
            )
        purchase_order.items.append(PurchaseOrderItem(**item_in.model_dump()))

    subtotal, total = _calculate_totals(purchase_order.items, purchase_order.discount)
    purchase_order.subtotal = subtotal
    purchase_order.total = total

    db.add(purchase_order)
    await commit_or_409(db, "Could not create purchase order")
    await db.refresh(purchase_order)
    return await fetch_one_or_404(
        db,
        _purchase_order_query().where(PurchaseOrder.id == purchase_order.id),
        "Purchase order not found",
    )


@router.patch("/{purchase_order_id}", response_model=PurchaseOrderRead, dependencies=[Depends(require_permission("purchase_orders", "update"))])
async def update_purchase_order(
    purchase_order_id: UUID,
    purchase_order_in: PurchaseOrderUpdate,
    db: DBSession,
) -> PurchaseOrder:
    purchase_order = await fetch_one_or_404(
        db,
        _purchase_order_query().where(PurchaseOrder.id == purchase_order_id),
        "Purchase order not found",
    )
    previous_status = purchase_order.status
    updates = purchase_order_in.model_dump(exclude_unset=True)

    await _validate_references(
        db,
        supplier_id=updates.get("supplier_id"),
        warehouse_id=updates.get("warehouse_id"),
    )

    for field, value in updates.items():
        setattr(purchase_order, field, value)

    if any(field in updates for field in {"discount"}):
        subtotal, total = _calculate_totals(purchase_order.items, purchase_order.discount)
        purchase_order.subtotal = subtotal
        purchase_order.total = total

    if previous_status != "received" and purchase_order.status == "received":
        await _receive_purchase_order(db, purchase_order)

    await commit_or_409(db, "Could not update purchase order")
    await db.refresh(purchase_order)
    return await fetch_one_or_404(
        db,
        _purchase_order_query().where(PurchaseOrder.id == purchase_order.id),
        "Purchase order not found",
    )
