from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import AliasChoices, BaseModel, EmailStr, Field, computed_field, field_validator

from app.schemas.common import ORMBaseSchema
from app.schemas.user import UserRead


class CustomerActivityCreate(BaseModel):
    activity_type: str = Field(validation_alias=AliasChoices("activity_type", "activityType"))
    title: str
    description: str | None = None
    due_date: datetime | None = Field(default=None, validation_alias=AliasChoices("due_date", "dueDate"))
    completed_at: datetime | None = Field(default=None, validation_alias=AliasChoices("completed_at", "completedAt"))


class CustomerActivityUpdate(BaseModel):
    activity_type: str | None = Field(default=None, validation_alias=AliasChoices("activity_type", "activityType"))
    title: str | None = None
    description: str | None = None
    due_date: datetime | None = Field(default=None, validation_alias=AliasChoices("due_date", "dueDate"))
    completed_at: datetime | None = Field(default=None, validation_alias=AliasChoices("completed_at", "completedAt"))


class CustomerActivityRead(ORMBaseSchema):
    id: UUID
    customer_id: UUID
    activity_type: str
    title: str
    description: str | None
    created_by_id: UUID | None
    due_date: datetime | None
    completed_at: datetime | None
    created_at: datetime
    created_by: UserRead | None = None

    @computed_field(return_type=str)
    @property
    def activityType(self) -> str:
        return self.activity_type

    @computed_field(return_type=datetime | None)
    @property
    def dueDate(self) -> datetime | None:
        return self.due_date

    @computed_field(return_type=datetime | None)
    @property
    def completedAt(self) -> datetime | None:
        return self.completed_at

    @computed_field(return_type=datetime)
    @property
    def createdAt(self) -> datetime:
        return self.created_at

    @computed_field(return_type=str | None)
    @property
    def createdBy(self) -> str | None:
        if self.created_by is None:
            return None
        return self.created_by.full_name or self.created_by.email


class CustomerOrderSummaryRead(ORMBaseSchema):
    id: UUID
    order_number: str
    status: str
    payment_status: str
    total: Decimal
    created_at: datetime

    @computed_field(return_type=str)
    @property
    def orderNumber(self) -> str:
        return self.order_number

    @computed_field(return_type=Decimal)
    @property
    def totalAmount(self) -> Decimal:
        return self.total

    @computed_field(return_type=datetime)
    @property
    def createdAt(self) -> datetime:
        return self.created_at


class CustomerCreate(BaseModel):
    name: str = Field(validation_alias=AliasChoices("name", "customerName"))
    phone: str = Field(validation_alias=AliasChoices("phone", "customerPhone"))
    email: EmailStr | None = None
    address: str | None = None
    city: str | None = None
    customer_type: str | None = Field(default=None, validation_alias=AliasChoices("customer_type", "customerType"))
    tags: str | None = None
    notes: str | None = None
    follow_up_date: date | None = Field(default=None, validation_alias=AliasChoices("follow_up_date", "followUpDate"))
    last_contacted_at: datetime | None = Field(default=None, validation_alias=AliasChoices("last_contacted_at", "lastContactedAt"))

    @field_validator("tags", mode="before")
    @classmethod
    def normalize_tags(cls, value):
        if isinstance(value, list):
            return ",".join(str(item).strip() for item in value if str(item).strip()) or None
        return value


class CustomerUpdate(BaseModel):
    name: str | None = Field(default=None, validation_alias=AliasChoices("name", "customerName"))
    phone: str | None = Field(default=None, validation_alias=AliasChoices("phone", "customerPhone"))
    email: EmailStr | None = None
    address: str | None = None
    city: str | None = None
    customer_type: str | None = Field(default=None, validation_alias=AliasChoices("customer_type", "customerType"))
    tags: str | None = None
    notes: str | None = None
    follow_up_date: date | None = Field(default=None, validation_alias=AliasChoices("follow_up_date", "followUpDate"))
    last_contacted_at: datetime | None = Field(default=None, validation_alias=AliasChoices("last_contacted_at", "lastContactedAt"))

    @field_validator("tags", mode="before")
    @classmethod
    def normalize_tags(cls, value):
        if isinstance(value, list):
            return ",".join(str(item).strip() for item in value if str(item).strip()) or None
        return value


class CustomerListRead(ORMBaseSchema):
    id: UUID
    name: str
    phone: str
    email: EmailStr | None
    address: str | None
    city: str | None
    customer_type: str | None
    tags: str | None
    notes: str | None
    follow_up_date: date | None
    last_contacted_at: datetime | None
    created_at: datetime
    updated_at: datetime
    customerName: str | None = None
    customerPhone: str | None = None
    customerType: str | None = None
    segment: str | None = None
    tagList: list[str] = []
    followUpDate: date | None = None
    lastContactedAt: datetime | None = None
    total_order_count: int = 0
    totalOrderCount: int = 0
    total_spend: Decimal = Decimal("0.00")
    totalSpend: Decimal = Decimal("0.00")
    lastOrderAt: datetime | None = None
    lastOrderNumber: str | None = None
    activityCount: int = 0
    openActivityCount: int = 0
    createdAt: datetime | None = None
    updatedAt: datetime | None = None


class CustomerRead(CustomerListRead):
    orders: list[CustomerOrderSummaryRead] = []
    activities: list[CustomerActivityRead] = []
    total_order_count: int = 0
    total_spend: Decimal = Decimal("0.00")
    pending_follow_up_count: int = 0
    averageOrderValue: Decimal = Decimal("0.00")
    lastOrderAt: datetime | None = None
    lastOrderNumber: str | None = None
    lastContactedAt: datetime | None = None
    followUpState: str | None = None
    stats: dict[str, object] = {}


class CustomerCRMSummaryRead(BaseModel):
    total_customers: int
    leads: int
    regular_customers: int
    vip_customers: int
    wholesale_customers: int
    reseller_customers: int
    blocked_customers: int
    followups_due: int
    followups_today: int
    overdue_followups: int
    recent_activity_count: int
    customers_with_orders: int
    total_customer_spend: Decimal
    average_customer_value: Decimal
