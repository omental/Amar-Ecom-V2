from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy import select

from app.api.deps import DBSession, get_current_user
from app.api.utils import commit_or_409, fetch_one_or_404, normalize_pagination
from app.models.supplier import Supplier
from app.schemas.supplier import SupplierCreate, SupplierRead, SupplierUpdate


router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[SupplierRead])
async def list_suppliers(
    db: DBSession,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
) -> list[Supplier]:
    skip, limit = normalize_pagination(skip, limit)
    result = await db.execute(
        select(Supplier).order_by(Supplier.created_at.desc()).offset(skip).limit(limit)
    )
    return list(result.scalars().all())


@router.get("/{supplier_id}", response_model=SupplierRead)
async def get_supplier(supplier_id: UUID, db: DBSession) -> Supplier:
    return await fetch_one_or_404(
        db,
        select(Supplier).where(Supplier.id == supplier_id),
        "Supplier not found",
    )


@router.post("", response_model=SupplierRead, status_code=status.HTTP_201_CREATED)
async def create_supplier(supplier_in: SupplierCreate, db: DBSession) -> Supplier:
    supplier = Supplier(**supplier_in.model_dump())
    db.add(supplier)
    await commit_or_409(db, "Could not create supplier")
    await db.refresh(supplier)
    return supplier


@router.patch("/{supplier_id}", response_model=SupplierRead)
async def update_supplier(supplier_id: UUID, supplier_in: SupplierUpdate, db: DBSession) -> Supplier:
    supplier = await fetch_one_or_404(
        db,
        select(Supplier).where(Supplier.id == supplier_id),
        "Supplier not found",
    )
    updates = supplier_in.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(supplier, field, value)

    await commit_or_409(db, "Could not update supplier")
    await db.refresh(supplier)
    return supplier


@router.delete("/{supplier_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_supplier(supplier_id: UUID, db: DBSession) -> Response:
    supplier = await fetch_one_or_404(
        db,
        select(Supplier).where(Supplier.id == supplier_id),
        "Supplier not found",
    )
    supplier.is_active = False
    await commit_or_409(db, "Could not update supplier")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
