from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy import select

from app.api.deps import DBSession, get_current_user
from app.api.utils import commit_or_409, fetch_one_or_404, normalize_pagination
from app.models.hr import Designation
from app.models.user import User
from app.schemas.hr import DesignationCreate, DesignationRead, DesignationUpdate
from app.services.activity_log_service import log_activity


router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[DesignationRead])
async def list_designations(
    db: DBSession,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
) -> list[Designation]:
    skip, limit = normalize_pagination(skip, limit)
    result = await db.execute(select(Designation).order_by(Designation.title.asc()).offset(skip).limit(limit))
    return list(result.scalars().all())


@router.get("/{designation_id}", response_model=DesignationRead)
async def get_designation(designation_id: UUID, db: DBSession) -> Designation:
    return await fetch_one_or_404(db, select(Designation).where(Designation.id == designation_id), "Designation not found")


@router.post("", response_model=DesignationRead, status_code=status.HTTP_201_CREATED)
async def create_designation(
    designation_in: DesignationCreate,
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> Designation:
    designation = Designation(**designation_in.model_dump())
    db.add(designation)
    await db.flush()
    await log_activity(
        db,
        user_id=current_user.id,
        action="designation_created",
        module="hr",
        entity_type="designation",
        entity_id=designation.id,
        message=f"Created designation {designation.title}.",
        request=request,
    )
    await commit_or_409(db, "Could not create designation")
    return await fetch_one_or_404(db, select(Designation).where(Designation.id == designation.id), "Designation not found")


@router.patch("/{designation_id}", response_model=DesignationRead)
async def update_designation(
    designation_id: UUID,
    designation_in: DesignationUpdate,
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> Designation:
    designation = await fetch_one_or_404(db, select(Designation).where(Designation.id == designation_id), "Designation not found")
    for field, value in designation_in.model_dump(exclude_unset=True).items():
        setattr(designation, field, value)
    await log_activity(
        db,
        user_id=current_user.id,
        action="designation_updated",
        module="hr",
        entity_type="designation",
        entity_id=designation.id,
        message=f"Updated designation {designation.title}.",
        request=request,
    )
    await commit_or_409(db, "Could not update designation")
    return await fetch_one_or_404(db, select(Designation).where(Designation.id == designation.id), "Designation not found")


@router.delete("/{designation_id}", response_model=DesignationRead)
async def deactivate_designation(
    designation_id: UUID,
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> Designation:
    designation = await fetch_one_or_404(db, select(Designation).where(Designation.id == designation_id), "Designation not found")
    designation.is_active = False
    await log_activity(
        db,
        user_id=current_user.id,
        action="designation_deactivated",
        module="hr",
        entity_type="designation",
        entity_id=designation.id,
        message=f"Deactivated designation {designation.title}.",
        request=request,
    )
    await commit_or_409(db, "Could not deactivate designation")
    return await fetch_one_or_404(db, select(Designation).where(Designation.id == designation.id), "Designation not found")
