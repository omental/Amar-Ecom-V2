from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import DBSession, get_current_user
from app.api.utils import commit_or_409, fetch_one_or_404, normalize_pagination
from app.models.hr import Employee, SalaryAdvance
from app.models.user import User
from app.schemas.hr import SalaryAdvanceCreate, SalaryAdvanceRead, SalaryAdvanceUpdate
from app.services.activity_log_service import log_activity


router = APIRouter(dependencies=[Depends(get_current_user)])


def _advance_query():
    return select(SalaryAdvance).options(
        selectinload(SalaryAdvance.employee).selectinload(Employee.designation),
        selectinload(SalaryAdvance.employee).selectinload(Employee.user),
        selectinload(SalaryAdvance.approved_by),
    )


async def _ensure_employee(db: DBSession, employee_id: UUID) -> None:
    await fetch_one_or_404(db, select(Employee).where(Employee.id == employee_id), "Employee not found")


@router.get("", response_model=list[SalaryAdvanceRead])
async def list_salary_advances(
    db: DBSession,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    employee_id: UUID | None = None,
    status: str | None = None,
) -> list[SalaryAdvance]:
    skip, limit = normalize_pagination(skip, limit)
    stmt = _advance_query()
    if employee_id is not None:
        stmt = stmt.where(SalaryAdvance.employee_id == employee_id)
    if status:
        stmt = stmt.where(SalaryAdvance.status == status.lower())
    result = await db.execute(stmt.order_by(SalaryAdvance.requested_at.desc()).offset(skip).limit(limit))
    return list(result.scalars().all())


@router.get("/{advance_id}", response_model=SalaryAdvanceRead)
async def get_salary_advance(advance_id: UUID, db: DBSession) -> SalaryAdvance:
    return await fetch_one_or_404(db, _advance_query().where(SalaryAdvance.id == advance_id), "Salary advance not found")


@router.post("", response_model=SalaryAdvanceRead, status_code=status.HTTP_201_CREATED)
async def create_salary_advance(
    advance_in: SalaryAdvanceCreate,
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> SalaryAdvance:
    await _ensure_employee(db, advance_in.employee_id)
    advance = SalaryAdvance(**advance_in.model_dump())
    if advance.status == "approved" and advance.approved_at is None:
        advance.approved_at = datetime.now(timezone.utc)
        advance.approved_by_id = current_user.id
    db.add(advance)
    await db.flush()
    await log_activity(
        db,
        user_id=current_user.id,
        action="salary_advance_created",
        module="hr",
        entity_type="salary_advance",
        entity_id=advance.id,
        message=f"Created salary advance for employee {advance.employee_id}.",
        request=request,
    )
    if advance.status == "approved":
        await log_activity(
            db,
            user_id=current_user.id,
            action="salary_advance_status_changed",
            module="hr",
            entity_type="salary_advance",
            entity_id=advance.id,
            message="Marked salary advance approved.",
            request=request,
        )
    await commit_or_409(db, "Could not create salary advance")
    return await fetch_one_or_404(db, _advance_query().where(SalaryAdvance.id == advance.id), "Salary advance not found")


@router.patch("/{advance_id}", response_model=SalaryAdvanceRead)
async def update_salary_advance(
    advance_id: UUID,
    advance_in: SalaryAdvanceUpdate,
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> SalaryAdvance:
    advance = await fetch_one_or_404(db, select(SalaryAdvance).where(SalaryAdvance.id == advance_id), "Salary advance not found")
    payload = advance_in.model_dump(exclude_unset=True)
    previous_status = advance.status
    for field, value in payload.items():
        setattr(advance, field, value)
    if previous_status != advance.status and advance.status == "approved":
        if advance.approved_at is None:
            advance.approved_at = datetime.now(timezone.utc)
        if advance.approved_by_id is None:
            advance.approved_by_id = current_user.id
    await log_activity(
        db,
        user_id=current_user.id,
        action="salary_advance_updated",
        module="hr",
        entity_type="salary_advance",
        entity_id=advance.id,
        message=f"Updated salary advance {advance.id}.",
        request=request,
    )
    if previous_status != advance.status:
        await log_activity(
            db,
            user_id=current_user.id,
            action="salary_advance_status_changed",
            module="hr",
            entity_type="salary_advance",
            entity_id=advance.id,
            message=f"Changed salary advance status from {previous_status} to {advance.status}.",
            request=request,
        )
    await commit_or_409(db, "Could not update salary advance")
    return await fetch_one_or_404(db, _advance_query().where(SalaryAdvance.id == advance.id), "Salary advance not found")
