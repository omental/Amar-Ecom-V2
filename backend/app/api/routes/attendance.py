from datetime import date, datetime, time
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import DBSession, get_current_user
from app.api.utils import commit_or_409, fetch_one_or_404, normalize_pagination
from app.models.hr import AttendanceRecord, Employee
from app.models.user import User
from app.schemas.hr import AttendanceRecordCreate, AttendanceRecordRead, AttendanceRecordUpdate
from app.services.activity_log_service import log_activity


router = APIRouter(dependencies=[Depends(get_current_user)])


def _attendance_query():
    return select(AttendanceRecord).options(
        selectinload(AttendanceRecord.employee).selectinload(Employee.designation),
        selectinload(AttendanceRecord.employee).selectinload(Employee.user),
    )


def _date_range_bounds(date_from: date | None, date_to: date | None) -> tuple[date | None, date | None]:
    return date_from, date_to


async def _ensure_employee(db: DBSession, employee_id: UUID) -> None:
    await fetch_one_or_404(db, select(Employee).where(Employee.id == employee_id), "Employee not found")


async def _ensure_unique_attendance(
    db: DBSession,
    *,
    employee_id: UUID,
    attendance_date: date,
    exclude_id: UUID | None = None,
) -> None:
    stmt = select(AttendanceRecord).where(
        AttendanceRecord.employee_id == employee_id,
        AttendanceRecord.attendance_date == attendance_date,
    )
    if exclude_id is not None:
        stmt = stmt.where(AttendanceRecord.id != exclude_id)
    existing = await db.execute(stmt)
    if existing.scalar_one_or_none() is not None:
        from fastapi import HTTPException, status as http_status

        raise HTTPException(
            status_code=http_status.HTTP_409_CONFLICT,
            detail="Attendance already exists for this employee and date.",
        )


@router.get("", response_model=list[AttendanceRecordRead])
async def list_attendance_records(
    db: DBSession,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    employee_id: UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    status: str | None = None,
) -> list[AttendanceRecord]:
    skip, limit = normalize_pagination(skip, limit)
    stmt = _attendance_query()
    if employee_id is not None:
        stmt = stmt.where(AttendanceRecord.employee_id == employee_id)
    if status:
        stmt = stmt.where(AttendanceRecord.status == status)
    start, end = _date_range_bounds(date_from, date_to)
    if start is not None:
        stmt = stmt.where(AttendanceRecord.attendance_date >= start)
    if end is not None:
        stmt = stmt.where(AttendanceRecord.attendance_date <= end)
    result = await db.execute(
        stmt.order_by(AttendanceRecord.attendance_date.desc(), AttendanceRecord.created_at.desc()).offset(skip).limit(limit)
    )
    return list(result.scalars().all())


@router.get("/{attendance_id}", response_model=AttendanceRecordRead)
async def get_attendance_record(attendance_id: UUID, db: DBSession) -> AttendanceRecord:
    return await fetch_one_or_404(db, _attendance_query().where(AttendanceRecord.id == attendance_id), "Attendance record not found")


@router.post("", response_model=AttendanceRecordRead, status_code=status.HTTP_201_CREATED)
async def create_attendance_record(
    attendance_in: AttendanceRecordCreate,
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> AttendanceRecord:
    await _ensure_employee(db, attendance_in.employee_id)
    await _ensure_unique_attendance(db, employee_id=attendance_in.employee_id, attendance_date=attendance_in.attendance_date)
    record = AttendanceRecord(**attendance_in.model_dump())
    db.add(record)
    await db.flush()
    await log_activity(
        db,
        user_id=current_user.id,
        action="attendance_created",
        module="hr",
        entity_type="attendance_record",
        entity_id=record.id,
        message=f"Created attendance for employee {record.employee_id}.",
        request=request,
    )
    await commit_or_409(db, "Could not create attendance record")
    return await fetch_one_or_404(db, _attendance_query().where(AttendanceRecord.id == record.id), "Attendance record not found")


@router.patch("/{attendance_id}", response_model=AttendanceRecordRead)
async def update_attendance_record(
    attendance_id: UUID,
    attendance_in: AttendanceRecordUpdate,
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> AttendanceRecord:
    record = await fetch_one_or_404(db, select(AttendanceRecord).where(AttendanceRecord.id == attendance_id), "Attendance record not found")
    payload = attendance_in.model_dump(exclude_unset=True)
    next_date = payload["attendance_date"] if "attendance_date" in payload else record.attendance_date
    await _ensure_unique_attendance(db, employee_id=record.employee_id, attendance_date=next_date, exclude_id=record.id)
    for field, value in payload.items():
        setattr(record, field, value)
    await log_activity(
        db,
        user_id=current_user.id,
        action="attendance_updated",
        module="hr",
        entity_type="attendance_record",
        entity_id=record.id,
        message=f"Updated attendance for employee {record.employee_id}.",
        request=request,
    )
    await commit_or_409(db, "Could not update attendance record")
    return await fetch_one_or_404(db, _attendance_query().where(AttendanceRecord.id == record.id), "Attendance record not found")
