from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import DBSession, get_current_user
from app.api.utils import commit_or_409, ensure_unique, fetch_one_or_404, normalize_pagination
from app.models.hr import Designation, Employee
from app.models.user import User
from app.schemas.hr import EmployeeCreate, EmployeeRead, EmployeeUpdate
from app.services.activity_log_service import log_activity


router = APIRouter(dependencies=[Depends(get_current_user)])


def _employee_query():
    return select(Employee).options(
        selectinload(Employee.designation),
        selectinload(Employee.user),
    )


async def _validate_employee_links(db: DBSession, *, designation_id: UUID | None, user_id: UUID | None) -> None:
    if designation_id is not None:
        await fetch_one_or_404(db, select(Designation).where(Designation.id == designation_id), "Designation not found")
    if user_id is not None:
        await fetch_one_or_404(db, select(User).where(User.id == user_id), "User not found")


@router.get("", response_model=list[EmployeeRead])
async def list_employees(
    db: DBSession,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
) -> list[Employee]:
    skip, limit = normalize_pagination(skip, limit)
    result = await db.execute(_employee_query().order_by(Employee.created_at.desc()).offset(skip).limit(limit))
    return list(result.scalars().all())


@router.get("/{employee_id}", response_model=EmployeeRead)
async def get_employee(employee_id: UUID, db: DBSession) -> Employee:
    return await fetch_one_or_404(db, _employee_query().where(Employee.id == employee_id), "Employee not found")


@router.post("", response_model=EmployeeRead, status_code=status.HTTP_201_CREATED)
async def create_employee(
    employee_in: EmployeeCreate,
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> Employee:
    await ensure_unique(db, Employee, "employee_code", employee_in.employee_code, "Employee code already exists")
    await _validate_employee_links(db, designation_id=employee_in.designation_id, user_id=employee_in.user_id)
    employee = Employee(**employee_in.model_dump())
    db.add(employee)
    await db.flush()
    await log_activity(
        db,
        user_id=current_user.id,
        action="employee_created",
        module="hr",
        entity_type="employee",
        entity_id=employee.id,
        message=f"Created employee {employee.full_name}.",
        request=request,
    )
    await commit_or_409(db, "Could not create employee")
    return await fetch_one_or_404(db, _employee_query().where(Employee.id == employee.id), "Employee not found")


@router.patch("/{employee_id}", response_model=EmployeeRead)
async def update_employee(
    employee_id: UUID,
    employee_in: EmployeeUpdate,
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> Employee:
    employee = await fetch_one_or_404(db, select(Employee).where(Employee.id == employee_id), "Employee not found")
    payload = employee_in.model_dump(exclude_unset=True)
    if "employee_code" in payload:
        await ensure_unique(
            db,
            Employee,
            "employee_code",
            payload["employee_code"],
            "Employee code already exists",
            exclude_id=employee.id,
        )
    await _validate_employee_links(
        db,
        designation_id=payload["designation_id"] if "designation_id" in payload else employee.designation_id,
        user_id=payload["user_id"] if "user_id" in payload else employee.user_id,
    )
    for field, value in payload.items():
        setattr(employee, field, value)
    await log_activity(
        db,
        user_id=current_user.id,
        action="employee_updated",
        module="hr",
        entity_type="employee",
        entity_id=employee.id,
        message=f"Updated employee {employee.full_name}.",
        request=request,
    )
    await commit_or_409(db, "Could not update employee")
    return await fetch_one_or_404(db, _employee_query().where(Employee.id == employee.id), "Employee not found")


@router.delete("/{employee_id}", response_model=EmployeeRead)
async def deactivate_employee(
    employee_id: UUID,
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> Employee:
    employee = await fetch_one_or_404(db, select(Employee).where(Employee.id == employee_id), "Employee not found")
    employee.employment_status = "inactive"
    await log_activity(
        db,
        user_id=current_user.id,
        action="employee_updated",
        module="hr",
        entity_type="employee",
        entity_id=employee.id,
        message=f"Set employee {employee.full_name} inactive.",
        request=request,
    )
    await commit_or_409(db, "Could not deactivate employee")
    return await fetch_one_or_404(db, _employee_query().where(Employee.id == employee.id), "Employee not found")
