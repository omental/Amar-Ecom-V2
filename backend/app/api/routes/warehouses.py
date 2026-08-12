from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy import select

from app.api.deps import DBSession, get_current_user, get_entitlement_context, require_permission
from app.api.utils import commit_or_409, ensure_unique, fetch_one_or_404, normalize_pagination
from app.models.warehouse import Warehouse
from app.schemas.warehouse import WarehouseCreate, WarehouseRead, WarehouseUpdate
from app.services.commercial_access_service import EntitlementService


router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[WarehouseRead])
async def list_warehouses(
    db: DBSession,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
) -> list[Warehouse]:
    skip, limit = normalize_pagination(skip, limit)
    result = await db.execute(select(Warehouse).order_by(Warehouse.created_at.desc()).offset(skip).limit(limit))
    return list(result.scalars().all())


@router.get("/{warehouse_id}", response_model=WarehouseRead)
async def get_warehouse(warehouse_id: UUID, db: DBSession) -> Warehouse:
    return await fetch_one_or_404(db, select(Warehouse).where(Warehouse.id == warehouse_id), "Warehouse not found")


@router.post("", response_model=WarehouseRead, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_permission("warehouses", "create"))])
async def create_warehouse(warehouse_in: WarehouseCreate, db: DBSession, access: EntitlementService = Depends(get_entitlement_context)) -> Warehouse:
    await access.require_capacity("warehouse_limit")
    await ensure_unique(db, Warehouse, "code", warehouse_in.code, "Warehouse code already exists")
    warehouse = Warehouse(**warehouse_in.model_dump())
    db.add(warehouse)
    await commit_or_409(db, "Could not create warehouse")
    await db.refresh(warehouse)
    return warehouse


@router.patch("/{warehouse_id}", response_model=WarehouseRead, dependencies=[Depends(require_permission("warehouses", "update"))])
async def update_warehouse(warehouse_id: UUID, warehouse_in: WarehouseUpdate, db: DBSession) -> Warehouse:
    warehouse = await fetch_one_or_404(db, select(Warehouse).where(Warehouse.id == warehouse_id), "Warehouse not found")
    payload = warehouse_in.model_dump(exclude_unset=True)

    if "code" in payload:
        await ensure_unique(
            db,
            Warehouse,
            "code",
            payload["code"],
            "Warehouse code already exists",
            exclude_id=warehouse.id,
        )

    for field, value in payload.items():
        setattr(warehouse, field, value)

    await commit_or_409(db, "Could not update warehouse")
    await db.refresh(warehouse)
    return warehouse


@router.delete("/{warehouse_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_permission("warehouses", "delete"))])
async def delete_warehouse(warehouse_id: UUID, db: DBSession) -> Response:
    warehouse = await fetch_one_or_404(db, select(Warehouse).where(Warehouse.id == warehouse_id), "Warehouse not found")
    await db.delete(warehouse)
    await commit_or_409(db, "Warehouse cannot be deleted because it is in use")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
