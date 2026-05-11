from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, EmailStr

from app.schemas.common import ORMBaseSchema
from app.schemas.user import UserRead


class CustomerActivityCreate(BaseModel):
    activity_type: str
    title: str
    description: str | None = None
    due_date: datetime | None = None
    completed_at: datetime | None = None


class CustomerActivityUpdate(BaseModel):
    activity_type: str | None = None
    title: str | None = None
    description: str | None = None
    due_date: datetime | None = None
    completed_at: datetime | None = None


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


class CustomerOrderSummaryRead(ORMBaseSchema):
    id: UUID
    order_number: str
    status: str
    payment_status: str
    total: Decimal
    created_at: datetime


class CustomerCreate(BaseModel):
    name: str
    phone: str
    email: EmailStr | None = None
    address: str | None = None
    city: str | None = None
    customer_type: str | None = None
    tags: str | None = None
    notes: str | None = None
    follow_up_date: date | None = None
    last_contacted_at: datetime | None = None


class CustomerUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    email: EmailStr | None = None
    address: str | None = None
    city: str | None = None
    customer_type: str | None = None
    tags: str | None = None
    notes: str | None = None
    follow_up_date: date | None = None
    last_contacted_at: datetime | None = None


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


class CustomerRead(CustomerListRead):
    orders: list[CustomerOrderSummaryRead] = []
    activities: list[CustomerActivityRead] = []
    total_order_count: int = 0
    total_spend: Decimal = Decimal("0.00")
    pending_follow_up_count: int = 0
