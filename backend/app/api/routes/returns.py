from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import DBSession, get_current_user
from app.api.utils import commit_or_409, ensure_unique, fetch_one_or_404, normalize_pagination
from app.models.courier import Shipment
from app.models.order import Order, OrderEvent
from app.models.return_request import ReturnItem, ReturnRequest
from app.models.warehouse import Warehouse
from app.schemas.return_request import ReturnRequestCreate, ReturnRequestRead, ReturnRequestUpdate
from app.services.inventory_service import get_inventory_item, increase_stock


router = APIRouter(dependencies=[Depends(get_current_user)])


def _return_query():
    return select(ReturnRequest).options(
        selectinload(ReturnRequest.order).selectinload(Order.customer),
        selectinload(ReturnRequest.order).selectinload(Order.warehouse),
        selectinload(ReturnRequest.order).selectinload(Order.items),
        selectinload(ReturnRequest.order).selectinload(Order.shipments).selectinload(Shipment.courier),
        selectinload(ReturnRequest.order).selectinload(Order.events).selectinload(OrderEvent.created_by),
        selectinload(ReturnRequest.customer),
        selectinload(ReturnRequest.warehouse),
        selectinload(ReturnRequest.items),
    )


def _generate_return_number() -> str:
    return f"RMA-{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}"


async def _restock_return_items(db: DBSession, return_request: ReturnRequest) -> None:
    if return_request.stock_restocked:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Return items have already been restocked",
        )

    if return_request.warehouse_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A warehouse is required before restocking return items",
        )

    for item in return_request.items:
        inventory_item = await get_inventory_item(
            db,
            product_id=item.product_id,
            variant_id=item.variant_id,
            warehouse_id=return_request.warehouse_id,
        )
        await increase_stock(
            db,
            inventory_item=inventory_item,
            quantity=item.quantity,
            movement_type="return_restocked",
            order_id=return_request.order_id,
            note=f"Inventory restocked from return {return_request.return_number}",
        )
        item.restocked_quantity = item.quantity

    return_request.stock_restocked = True


@router.get("", response_model=list[ReturnRequestRead])
async def list_returns(
    db: DBSession,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
) -> list[ReturnRequest]:
    skip, limit = normalize_pagination(skip, limit)
    result = await db.execute(
        _return_query().order_by(ReturnRequest.created_at.desc()).offset(skip).limit(limit)
    )
    return list(result.scalars().unique().all())


@router.get("/{return_id}", response_model=ReturnRequestRead)
async def get_return(return_id: UUID, db: DBSession) -> ReturnRequest:
    return await fetch_one_or_404(db, _return_query().where(ReturnRequest.id == return_id), "Return request not found")


@router.post("", response_model=ReturnRequestRead, status_code=status.HTTP_201_CREATED)
async def create_return(return_in: ReturnRequestCreate, db: DBSession) -> ReturnRequest:
    order = await fetch_one_or_404(
        db,
        select(Order).options(selectinload(Order.customer), selectinload(Order.warehouse)).where(Order.id == return_in.order_id),
        "Order not found",
    )
    return_number = return_in.return_number or _generate_return_number()
    await ensure_unique(db, ReturnRequest, "return_number", return_number, "Return number already exists")

    warehouse_id = return_in.warehouse_id or order.warehouse_id
    customer_id = return_in.customer_id or order.customer_id

    if warehouse_id is not None:
        await fetch_one_or_404(db, select(Warehouse).where(Warehouse.id == warehouse_id), "Warehouse not found")

    payload = return_in.model_dump(exclude={"items", "return_number", "customer_id", "warehouse_id"})
    return_request = ReturnRequest(
        **payload,
        return_number=return_number,
        customer_id=customer_id,
        warehouse_id=warehouse_id,
    )

    for item_in in return_in.items:
        return_request.items.append(
            ReturnItem(**item_in.model_dump())
        )

    db.add(return_request)
    await commit_or_409(db, "Could not create return request")
    await db.refresh(return_request)
    return await fetch_one_or_404(db, _return_query().where(ReturnRequest.id == return_request.id), "Return request not found")


@router.patch("/{return_id}", response_model=ReturnRequestRead)
async def update_return(return_id: UUID, return_in: ReturnRequestUpdate, db: DBSession) -> ReturnRequest:
    return_request = await fetch_one_or_404(
        db,
        _return_query().where(ReturnRequest.id == return_id),
        "Return request not found",
    )
    previous_status = return_request.status
    updates = return_in.model_dump(exclude_unset=True)

    if "warehouse_id" in updates and updates["warehouse_id"] is not None:
        await fetch_one_or_404(db, select(Warehouse).where(Warehouse.id == updates["warehouse_id"]), "Warehouse not found")

    for field, value in updates.items():
        setattr(return_request, field, value)

    should_restock = (
        previous_status != "restocked"
        and return_request.status == "restocked"
        and return_request.restock_items
    )
    if should_restock:
        await _restock_return_items(db, return_request)

    await commit_or_409(db, "Could not update return request")
    await db.refresh(return_request)
    return await fetch_one_or_404(db, _return_query().where(ReturnRequest.id == return_request.id), "Return request not found")
