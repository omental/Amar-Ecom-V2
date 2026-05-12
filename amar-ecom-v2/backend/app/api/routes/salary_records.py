from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import DBSession, get_current_user
from app.api.utils import commit_or_409, fetch_one_or_404, normalize_pagination
from app.models.hr import Employee, SalaryRecord
from app.models.user import User
from app.schemas.hr import SalaryRecordCreate, SalaryRecordRead, SalaryRecordUpdate
from app.services.activity_log_service import log_activity


router = APIRouter(dependencies=[Depends(get_current_user)])


def _salary_record_query():
    return select(SalaryRecord).options(
        selectinload(SalaryRecord.employee).selectinload(Employee.designation),
        selectinload(SalaryRecord.employee).selectinload(Employee.user),
    )


async def _ensure_employee(db: DBSession, employee_id: UUID) -> None:
    await fetch_one_or_404(db, select(Employee).where(Employee.id == employee_id), "Employee not found")


def _recalculate_net_salary(record: SalaryRecord) -> None:
    record.net_salary = (
        Decimal(record.basic_salary or 0)
        + Decimal(record.bonus or 0)
        - Decimal(record.advance_deduction or 0)
        - Decimal(record.other_deductions or 0)
    )


def _sync_paid_at(record: SalaryRecord) -> None:
    if record.status == "paid":
        if record.paid_at is None:
            record.paid_at = datetime.now(timezone.utc)
    else:
        record.paid_at = None


@router.get("", response_model=list[SalaryRecordRead])
async def list_salary_records(
    db: DBSession,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
) -> list[SalaryRecord]:
    skip, limit = normalize_pagination(skip, limit)
    result = await db.execute(_salary_record_query().order_by(SalaryRecord.created_at.desc()).offset(skip).limit(limit))
    return list(result.scalars().all())


@router.get("/{record_id}", response_model=SalaryRecordRead)
async def get_salary_record(record_id: UUID, db: DBSession) -> SalaryRecord:
    return await fetch_one_or_404(db, _salary_record_query().where(SalaryRecord.id == record_id), "Salary record not found")


@router.post("", response_model=SalaryRecordRead, status_code=status.HTTP_201_CREATED)
async def create_salary_record(
    record_in: SalaryRecordCreate,
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> SalaryRecord:
    await _ensure_employee(db, record_in.employee_id)
    record = SalaryRecord(**record_in.model_dump())
    _recalculate_net_salary(record)
    _sync_paid_at(record)
    db.add(record)
    await db.flush()
    await log_activity(
        db,
        user_id=current_user.id,
        action="salary_record_created",
        module="hr",
        entity_type="salary_record",
        entity_id=record.id,
        message=f"Created salary record for employee {record.employee_id}.",
        request=request,
    )
    if record.status == "paid":
        await log_activity(
            db,
            user_id=current_user.id,
            action="salary_record_status_changed",
            module="hr",
            entity_type="salary_record",
            entity_id=record.id,
            message="Marked salary record paid.",
            request=request,
        )
    await commit_or_409(db, "Could not create salary record")
    return await fetch_one_or_404(db, _salary_record_query().where(SalaryRecord.id == record.id), "Salary record not found")


@router.patch("/{record_id}", response_model=SalaryRecordRead)
async def update_salary_record(
    record_id: UUID,
    record_in: SalaryRecordUpdate,
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> SalaryRecord:
    record = await fetch_one_or_404(db, select(SalaryRecord).where(SalaryRecord.id == record_id), "Salary record not found")
    payload = record_in.model_dump(exclude_unset=True)
    previous_status = record.status
    for field, value in payload.items():
        setattr(record, field, value)
    _recalculate_net_salary(record)
    _sync_paid_at(record)
    await log_activity(
        db,
        user_id=current_user.id,
        action="salary_record_updated",
        module="hr",
        entity_type="salary_record",
        entity_id=record.id,
        message=f"Updated salary record {record.id}.",
        request=request,
    )
    if previous_status != record.status:
        await log_activity(
            db,
            user_id=current_user.id,
            action="salary_record_status_changed",
            module="hr",
            entity_type="salary_record",
            entity_id=record.id,
            message=f"Changed salary record status from {previous_status} to {record.status}.",
            request=request,
        )
    await commit_or_409(db, "Could not update salary record")
    return await fetch_one_or_404(db, _salary_record_query().where(SalaryRecord.id == record.id), "Salary record not found")
