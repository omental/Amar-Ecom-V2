from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import AliasChoices, BaseModel, Field, computed_field, model_validator

from app.schemas.common import ORMBaseSchema
from app.schemas.user import UserRead


def _display_hr_status(value: str | None) -> str | None:
    if value is None:
        return None
    return value.replace("_", " ").title()


class DesignationCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255, validation_alias=AliasChoices("title", "name"))
    description: str | None = None
    is_active: bool = Field(default=True, validation_alias=AliasChoices("is_active", "isActive", "active"))


class DesignationUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255, validation_alias=AliasChoices("title", "name"))
    description: str | None = None
    is_active: bool | None = Field(default=None, validation_alias=AliasChoices("is_active", "isActive", "active"))


class DesignationRead(ORMBaseSchema):
    id: UUID
    title: str
    description: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    @computed_field(return_type=str)
    @property
    def name(self) -> str:
        return self.title

    @computed_field(return_type=bool)
    @property
    def active(self) -> bool:
        return self.is_active

    @computed_field(return_type=str)
    @property
    def status(self) -> str:
        return "Active" if self.is_active else "Inactive"

    @computed_field(return_type=datetime)
    @property
    def createdAt(self) -> datetime:
        return self.created_at

    @computed_field(return_type=datetime)
    @property
    def updatedAt(self) -> datetime:
        return self.updated_at


class EmployeeCreate(BaseModel):
    employee_code: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
        validation_alias=AliasChoices("employee_code", "employeeCode"),
    )
    full_name: str = Field(min_length=1, max_length=255, validation_alias=AliasChoices("full_name", "fullName", "name"))
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    address: str | None = None
    designation_id: UUID | None = Field(default=None, validation_alias=AliasChoices("designation_id", "designationId"))
    user_id: UUID | None = Field(default=None, validation_alias=AliasChoices("user_id", "userId"))
    joining_date: date | None = Field(default=None, validation_alias=AliasChoices("joining_date", "joiningDate"))
    salary: Decimal = Field(default=Decimal("0.00"), validation_alias=AliasChoices("salary", "baseSalary"))
    employment_status: str = Field(
        default="active",
        min_length=1,
        max_length=50,
        validation_alias=AliasChoices("employment_status", "employmentStatus", "status"),
    )
    notes: str | None = None

    @model_validator(mode="after")
    def normalize_status(self):
        self.employment_status = self.employment_status.lower()
        return self


class EmployeeUpdate(BaseModel):
    employee_code: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
        validation_alias=AliasChoices("employee_code", "employeeCode"),
    )
    full_name: str | None = Field(
        default=None,
        min_length=1,
        max_length=255,
        validation_alias=AliasChoices("full_name", "fullName", "name"),
    )
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    address: str | None = None
    designation_id: UUID | None = Field(default=None, validation_alias=AliasChoices("designation_id", "designationId"))
    user_id: UUID | None = Field(default=None, validation_alias=AliasChoices("user_id", "userId"))
    joining_date: date | None = Field(default=None, validation_alias=AliasChoices("joining_date", "joiningDate"))
    salary: Decimal | None = Field(default=None, validation_alias=AliasChoices("salary", "baseSalary"))
    employment_status: str | None = Field(
        default=None,
        min_length=1,
        max_length=50,
        validation_alias=AliasChoices("employment_status", "employmentStatus", "status"),
    )
    notes: str | None = None

    @model_validator(mode="after")
    def normalize_status(self):
        if self.employment_status is not None:
            self.employment_status = self.employment_status.lower()
        return self


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

    @computed_field(return_type=str)
    @property
    def employeeCode(self) -> str:
        return self.employee_code

    @computed_field(return_type=str)
    @property
    def name(self) -> str:
        return self.full_name

    @computed_field(return_type=str)
    @property
    def fullName(self) -> str:
        return self.full_name

    @computed_field(return_type=str | None)
    @property
    def designationName(self) -> str | None:
        return self.designation.title if self.designation else None

    @computed_field(return_type=date | None)
    @property
    def joiningDate(self) -> date | None:
        return self.joining_date

    @computed_field(return_type=Decimal)
    @property
    def baseSalary(self) -> Decimal:
        return self.salary

    @computed_field(return_type=str)
    @property
    def status(self) -> str:
        return _display_hr_status(self.employment_status) or "Active"

    @computed_field(return_type=bool)
    @property
    def active(self) -> bool:
        return self.employment_status == "active"

    @computed_field(return_type=bool)
    @property
    def isActive(self) -> bool:
        return self.employment_status == "active"

    @computed_field
    @property
    def profileImage(self) -> None:
        return None

    @computed_field
    @property
    def photoURL(self) -> None:
        return None

    @computed_field(return_type=datetime)
    @property
    def createdAt(self) -> datetime:
        return self.created_at

    @computed_field(return_type=datetime)
    @property
    def updatedAt(self) -> datetime:
        return self.updated_at


class AttendanceRecordCreate(BaseModel):
    employee_id: UUID
    attendance_date: date = Field(validation_alias=AliasChoices("attendance_date", "attendanceDate", "date"))
    status: str = Field(default="present", min_length=1, max_length=50)
    check_in: datetime | None = None
    check_out: datetime | None = None
    notes: str | None = None

    @model_validator(mode="after")
    def normalize_status(self):
        self.status = self.status.lower()
        return self


class AttendanceRecordUpdate(BaseModel):
    attendance_date: date | None = Field(default=None, validation_alias=AliasChoices("attendance_date", "attendanceDate", "date"))
    status: str | None = Field(default=None, min_length=1, max_length=50)
    check_in: datetime | None = None
    check_out: datetime | None = None
    notes: str | None = None

    @model_validator(mode="after")
    def normalize_status(self):
        if self.status is not None:
            self.status = self.status.lower()
        return self


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

    @computed_field(return_type=date)
    @property
    def attendanceDate(self) -> date:
        return self.attendance_date

    @computed_field(return_type=date)
    @property
    def date(self) -> date:
        return self.attendance_date

    @computed_field(return_type=str)
    @property
    def employeeName(self) -> str:
        return self.employee.full_name

    @computed_field(return_type=str | None)
    @property
    def designationName(self) -> str | None:
        return self.employee.designation.title if self.employee.designation else None

    @computed_field(return_type=datetime)
    @property
    def createdAt(self) -> datetime:
        return self.created_at

    @computed_field(return_type=datetime)
    @property
    def updatedAt(self) -> datetime:
        return self.updated_at


class SalaryAdvanceCreate(BaseModel):
    employee_id: UUID
    amount: Decimal = Field(gt=0)
    reason: str | None = Field(default=None, validation_alias=AliasChoices("reason", "note", "notes"))
    status: str = Field(default="pending", min_length=1, max_length=50)
    requested_at: datetime | None = Field(default=None, validation_alias=AliasChoices("requested_at", "requestedAt", "date"))

    @model_validator(mode="after")
    def normalize_status(self):
        self.status = self.status.lower()
        return self


class SalaryAdvanceUpdate(BaseModel):
    amount: Decimal | None = Field(default=None, gt=0)
    reason: str | None = Field(default=None, validation_alias=AliasChoices("reason", "note", "notes"))
    status: str | None = Field(default=None, min_length=1, max_length=50)
    requested_at: datetime | None = Field(default=None, validation_alias=AliasChoices("requested_at", "requestedAt", "date"))

    @model_validator(mode="after")
    def normalize_status(self):
        if self.status is not None:
            self.status = self.status.lower()
        return self


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

    @computed_field(return_type=str)
    @property
    def employeeName(self) -> str:
        return self.employee.full_name

    @computed_field(return_type=str | None)
    @property
    def note(self) -> str | None:
        return self.reason

    @computed_field(return_type=datetime)
    @property
    def date(self) -> datetime:
        return self.requested_at

    @computed_field(return_type=datetime | None)
    @property
    def approvedAt(self) -> datetime | None:
        return self.approved_at

    @computed_field(return_type=str | None)
    @property
    def approvedByName(self) -> str | None:
        return self.approved_by.full_name if self.approved_by else None

    @computed_field(return_type=str)
    @property
    def statusLabel(self) -> str:
        return _display_hr_status(self.status) or "Pending"

    @computed_field(return_type=datetime)
    @property
    def createdAt(self) -> datetime:
        return self.created_at

    @computed_field(return_type=datetime)
    @property
    def updatedAt(self) -> datetime:
        return self.updated_at


class SalaryRecordCreate(BaseModel):
    employee_id: UUID
    salary_month: str = Field(min_length=1, max_length=20, validation_alias=AliasChoices("salary_month", "salaryMonth", "month"))
    basic_salary: Decimal = Field(default=Decimal("0.00"), validation_alias=AliasChoices("basic_salary", "basicSalary"))
    advance_deduction: Decimal = Field(default=Decimal("0.00"), validation_alias=AliasChoices("advance_deduction", "advanceDeduction"))
    bonus: Decimal = Decimal("0.00")
    other_deductions: Decimal = Field(default=Decimal("0.00"), validation_alias=AliasChoices("other_deductions", "otherDeductions", "deductions"))
    status: str = Field(default="draft", min_length=1, max_length=50)

    @model_validator(mode="after")
    def normalize_status(self):
        self.status = self.status.lower()
        return self


class SalaryRecordUpdate(BaseModel):
    salary_month: str | None = Field(default=None, min_length=1, max_length=20, validation_alias=AliasChoices("salary_month", "salaryMonth", "month"))
    basic_salary: Decimal | None = Field(default=None, validation_alias=AliasChoices("basic_salary", "basicSalary"))
    advance_deduction: Decimal | None = Field(default=None, validation_alias=AliasChoices("advance_deduction", "advanceDeduction"))
    bonus: Decimal | None = None
    other_deductions: Decimal | None = Field(default=None, validation_alias=AliasChoices("other_deductions", "otherDeductions", "deductions"))
    status: str | None = Field(default=None, min_length=1, max_length=50)

    @model_validator(mode="after")
    def normalize_status(self):
        if self.status is not None:
            self.status = self.status.lower()
        return self


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

    @computed_field(return_type=str)
    @property
    def employeeName(self) -> str:
        return self.employee.full_name

    @computed_field(return_type=str)
    @property
    def month(self) -> str:
        return self.salary_month

    @computed_field(return_type=Decimal)
    @property
    def basicSalary(self) -> Decimal:
        return self.basic_salary

    @computed_field(return_type=Decimal)
    @property
    def advanceDeduction(self) -> Decimal:
        return self.advance_deduction

    @computed_field(return_type=Decimal)
    @property
    def otherDeductions(self) -> Decimal:
        return self.other_deductions

    @computed_field(return_type=Decimal)
    @property
    def netSalary(self) -> Decimal:
        return self.net_salary

    @computed_field(return_type=datetime | None)
    @property
    def paidAt(self) -> datetime | None:
        return self.paid_at

    @computed_field(return_type=datetime)
    @property
    def createdAt(self) -> datetime:
        return self.created_at

    @computed_field(return_type=datetime)
    @property
    def updatedAt(self) -> datetime:
        return self.updated_at


class HrSummaryRead(BaseModel):
    total_employees: int
    active_employees: int
    inactive_employees: int
    present_today: int
    absent_today: int
    pending_advances: int
    salary_records_this_month: int
    unpaid_salary_records: int

    @computed_field(return_type=int)
    @property
    def totalEmployees(self) -> int:
        return self.total_employees

    @computed_field(return_type=int)
    @property
    def activeEmployees(self) -> int:
        return self.active_employees

    @computed_field(return_type=int)
    @property
    def inactiveEmployees(self) -> int:
        return self.inactive_employees

    @computed_field(return_type=int)
    @property
    def presentToday(self) -> int:
        return self.present_today

    @computed_field(return_type=int)
    @property
    def absentToday(self) -> int:
        return self.absent_today

    @computed_field(return_type=int)
    @property
    def pendingAdvances(self) -> int:
        return self.pending_advances

    @computed_field(return_type=int)
    @property
    def salaryRecordsThisMonth(self) -> int:
        return self.salary_records_this_month

    @computed_field(return_type=int)
    @property
    def unpaidSalaryRecords(self) -> int:
        return self.unpaid_salary_records
