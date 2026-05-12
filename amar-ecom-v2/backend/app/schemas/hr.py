from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import ORMBaseSchema
from app.schemas.user import UserRead


class DesignationCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    is_active: bool = True


class DesignationUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    is_active: bool | None = None


class DesignationRead(ORMBaseSchema):
    id: UUID
    title: str
    description: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class EmployeeCreate(BaseModel):
    employee_code: str = Field(min_length=1, max_length=100)
    full_name: str = Field(min_length=1, max_length=255)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    address: str | None = None
    designation_id: UUID | None = None
    user_id: UUID | None = None
    joining_date: date | None = None
    salary: Decimal = Decimal("0.00")
    employment_status: str = Field(default="active", min_length=1, max_length=50)
    notes: str | None = None


class EmployeeUpdate(BaseModel):
    employee_code: str | None = Field(default=None, min_length=1, max_length=100)
    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    address: str | None = None
    designation_id: UUID | None = None
    user_id: UUID | None = None
    joining_date: date | None = None
    salary: Decimal | None = None
    employment_status: str | None = Field(default=None, min_length=1, max_length=50)
    notes: str | None = None


class EmployeeRead(ORMBaseSchema):
    id: UUID
    employee_code: str
    full_name: str
    email: str | None
    phone: str | None
    address: str | None
    designation_id: UUID | None
    user_id: UUID | None
    joining_date: date | None
    salary: Decimal
    employment_status: str
    notes: str | None
    created_at: datetime
    updated_at: datetime
    designation: DesignationRead | None = None
    user: UserRead | None = None


class AttendanceRecordCreate(BaseModel):
    employee_id: UUID
    attendance_date: date
    status: str = Field(default="present", min_length=1, max_length=50)
    check_in: datetime | None = None
    check_out: datetime | None = None
    notes: str | None = None


class AttendanceRecordUpdate(BaseModel):
    attendance_date: date | None = None
    status: str | None = Field(default=None, min_length=1, max_length=50)
    check_in: datetime | None = None
    check_out: datetime | None = None
    notes: str | None = None


class AttendanceRecordRead(ORMBaseSchema):
    id: UUID
    employee_id: UUID
    attendance_date: date
    status: str
    check_in: datetime | None
    check_out: datetime | None
    notes: str | None
    created_at: datetime
    updated_at: datetime
    employee: EmployeeRead


class SalaryAdvanceCreate(BaseModel):
    employee_id: UUID
    amount: Decimal = Field(gt=0)
    reason: str | None = None
    status: str = Field(default="pending", min_length=1, max_length=50)


class SalaryAdvanceUpdate(BaseModel):
    amount: Decimal | None = Field(default=None, gt=0)
    reason: str | None = None
    status: str | None = Field(default=None, min_length=1, max_length=50)


class SalaryAdvanceRead(ORMBaseSchema):
    id: UUID
    employee_id: UUID
    amount: Decimal
    reason: str | None
    status: str
    requested_at: datetime
    approved_at: datetime | None
    approved_by_id: UUID | None
    created_at: datetime
    updated_at: datetime
    employee: EmployeeRead
    approved_by: UserRead | None = None


class SalaryRecordCreate(BaseModel):
    employee_id: UUID
    salary_month: str = Field(min_length=1, max_length=20)
    basic_salary: Decimal = Decimal("0.00")
    advance_deduction: Decimal = Decimal("0.00")
    bonus: Decimal = Decimal("0.00")
    other_deductions: Decimal = Decimal("0.00")
    status: str = Field(default="draft", min_length=1, max_length=50)


class SalaryRecordUpdate(BaseModel):
    salary_month: str | None = Field(default=None, min_length=1, max_length=20)
    basic_salary: Decimal | None = None
    advance_deduction: Decimal | None = None
    bonus: Decimal | None = None
    other_deductions: Decimal | None = None
    status: str | None = Field(default=None, min_length=1, max_length=50)


class SalaryRecordRead(ORMBaseSchema):
    id: UUID
    employee_id: UUID
    salary_month: str
    basic_salary: Decimal
    advance_deduction: Decimal
    bonus: Decimal
    other_deductions: Decimal
    net_salary: Decimal
    status: str
    paid_at: datetime | None
    created_at: datetime
    updated_at: datetime
    employee: EmployeeRead


class HrSummaryRead(BaseModel):
    total_employees: int
    active_employees: int
    inactive_employees: int
    present_today: int
    absent_today: int
    pending_advances: int
    salary_records_this_month: int
    unpaid_salary_records: int
