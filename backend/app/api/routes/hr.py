from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import case, func, select

from app.api.deps import DBSession, get_current_user
from app.models.hr import AttendanceRecord, Employee, SalaryAdvance, SalaryRecord
from app.schemas.hr import HrSummaryRead


router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("/summary", response_model=HrSummaryRead)
async def get_hr_summary(db: DBSession) -> HrSummaryRead:
    today = date.today()
    salary_month = today.strftime("%Y-%m")
    employee_result = await db.execute(
        select(
            func.count(Employee.id),
            func.coalesce(func.sum(case((Employee.employment_status == "active", 1), else_=0)), 0),
            func.coalesce(func.sum(case((Employee.employment_status == "inactive", 1), else_=0)), 0),
        )
    )
    attendance_result = await db.execute(
        select(
            func.coalesce(
                func.sum(case(((AttendanceRecord.attendance_date == today) & (AttendanceRecord.status == "present"), 1), else_=0)),
                0,
            ),
            func.coalesce(
                func.sum(case(((AttendanceRecord.attendance_date == today) & (AttendanceRecord.status == "absent"), 1), else_=0)),
                0,
            ),
        )
    )
    advance_result = await db.execute(
        select(func.coalesce(func.sum(case((SalaryAdvance.status == "pending", 1), else_=0)), 0))
    )
    salary_record_result = await db.execute(
        select(
            func.coalesce(func.sum(case((SalaryRecord.salary_month == salary_month, 1), else_=0)), 0),
            func.coalesce(func.sum(case((~SalaryRecord.status.in_(["paid", "cancelled"]), 1), else_=0)), 0),
        )
    )
    employee_row = employee_result.one()
    attendance_row = attendance_result.one()
    salary_record_row = salary_record_result.one()
    return HrSummaryRead(
        total_employees=employee_row[0] or 0,
        active_employees=employee_row[1] or 0,
        inactive_employees=employee_row[2] or 0,
        present_today=attendance_row[0] or 0,
        absent_today=attendance_row[1] or 0,
        pending_advances=advance_result.scalar_one() or 0,
        salary_records_this_month=salary_record_row[0] or 0,
        unpaid_salary_records=salary_record_row[1] or 0,
    )
