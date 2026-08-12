from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class PlanPriceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    plan_id: UUID
    plan_key: str | None = None
    plan_name: str | None = None
    key: str
    billing_cycle: str
    currency: str
    amount: Decimal


class CheckoutCreate(BaseModel):
    plan_price_id: UUID
    idempotency_key: str = Field(min_length=8, max_length=128)


class CheckoutRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    status: str
    provider: str
    checkout_url: str | None
    expires_at: datetime


class SubscriptionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    plan_key: str
    plan_version: int
    price_key: str
    billing_cycle: str
    status: str
    currency: str
    unit_amount: Decimal
    current_period_start: datetime | None
    current_period_end: datetime | None
    grace_ends_at: datetime | None
    cancel_at_period_end: bool
    pending_price_id: UUID | None


class BillingSummaryRead(BaseModel):
    billing_account_id: UUID | None
    subscription: SubscriptionRead | None
    commercial_status: str


class InvoiceLineRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    description: str
    quantity: int
    unit_amount: Decimal
    amount: Decimal


class InvoiceRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    invoice_number: str
    status: str
    currency: str
    subtotal: Decimal
    discount_total: Decimal
    tax_total: Decimal
    total: Decimal
    amount_paid: Decimal
    amount_due: Decimal
    period_start: datetime | None
    period_end: datetime | None
    paid_at: datetime | None
    created_at: datetime
    lines: list[InvoiceLineRead] = Field(default_factory=list)


class PaymentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    amount: Decimal
    currency: str
    status: str
    paid_at: datetime | None
    refunded_amount: Decimal
    created_at: datetime


class PlanChangeInput(BaseModel):
    plan_price_id: UUID


class CancellationInput(BaseModel):
    at_period_end: bool = True


class TestEventInput(BaseModel):
    outcome: Literal["success", "failed", "renewal", "refund"] = "success"


class RefundInput(BaseModel):
    amount: Decimal = Field(gt=0)
    reason: str = Field(min_length=3, max_length=500)


class PlanPriceCreate(BaseModel):
    plan_id: UUID
    key: str = Field(pattern=r"^[a-z0-9][a-z0-9-]{2,119}$")
    billing_cycle: Literal["monthly", "annual"]
    currency: str = Field(min_length=3, max_length=10)
    amount: Decimal = Field(ge=0)
