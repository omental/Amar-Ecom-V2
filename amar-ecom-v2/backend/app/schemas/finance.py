from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import ORMBaseSchema
from app.schemas.supplier import SupplierRead
from app.schemas.user import UserRead


class AccountCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    code: str = Field(min_length=1, max_length=100)
    account_type: str = Field(min_length=1, max_length=50)
    opening_balance: Decimal = Decimal("0.00")
    notes: str | None = None
    is_active: bool = True


class AccountUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    code: str | None = Field(default=None, min_length=1, max_length=100)
    account_type: str | None = Field(default=None, min_length=1, max_length=50)
    notes: str | None = None
    is_active: bool | None = None


class AccountRead(ORMBaseSchema):
    id: UUID
    name: str
    code: str
    account_type: str
    opening_balance: Decimal
    current_balance: Decimal
    is_active: bool
    notes: str | None
    created_at: datetime
    updated_at: datetime


class TransactionCreate(BaseModel):
    transaction_number: str = Field(min_length=1, max_length=100)
    account_id: UUID
    related_account_id: UUID | None = None
    transaction_type: str = Field(min_length=1, max_length=50)
    category: str | None = Field(default=None, max_length=100)
    amount: Decimal = Field(gt=0)
    direction: str = Field(min_length=1, max_length=10)
    reference_type: str | None = Field(default=None, max_length=100)
    reference_id: str | None = Field(default=None, max_length=100)
    description: str | None = None
    transaction_date: datetime | None = None


class TransactionUpdate(BaseModel):
    category: str | None = Field(default=None, max_length=100)
    description: str | None = None


class TransactionRead(ORMBaseSchema):
    id: UUID
    transaction_number: str
    account_id: UUID
    related_account_id: UUID | None
    transaction_type: str
    category: str | None
    amount: Decimal
    direction: str
    reference_type: str | None
    reference_id: str | None
    description: str | None
    transaction_date: datetime
    created_by_id: UUID | None
    created_at: datetime
    updated_at: datetime
    account: AccountRead
    related_account: AccountRead | None = None
    created_by: UserRead | None = None


class PettyCashEntryCreate(BaseModel):
    entry_number: str = Field(min_length=1, max_length=100)
    account_id: UUID | None = None
    entry_type: str = Field(min_length=1, max_length=50)
    amount: Decimal = Field(gt=0)
    purpose: str = Field(min_length=1)
    spent_by: str | None = Field(default=None, max_length=255)
    approved_by_id: UUID | None = None
    status: str = Field(default="pending", min_length=1, max_length=50)
    entry_date: datetime | None = None


class PettyCashEntryUpdate(BaseModel):
    account_id: UUID | None = None
    entry_type: str | None = Field(default=None, min_length=1, max_length=50)
    purpose: str | None = Field(default=None, min_length=1)
    spent_by: str | None = Field(default=None, max_length=255)
    approved_by_id: UUID | None = None
    status: str | None = Field(default=None, min_length=1, max_length=50)


class PettyCashEntryRead(ORMBaseSchema):
    id: UUID
    entry_number: str
    account_id: UUID | None
    entry_type: str
    amount: Decimal
    purpose: str
    spent_by: str | None
    approved_by_id: UUID | None
    status: str
    entry_date: datetime
    created_at: datetime
    updated_at: datetime
    account: AccountRead | None = None
    approved_by: UserRead | None = None


class SupplierPaymentCreate(BaseModel):
    supplier_id: UUID | None = None
    account_id: UUID
    payment_number: str = Field(min_length=1, max_length=100)
    amount: Decimal = Field(gt=0)
    payment_method: str | None = Field(default=None, max_length=100)
    reference: str | None = Field(default=None, max_length=255)
    notes: str | None = None
    payment_date: datetime | None = None


class SupplierPaymentRead(ORMBaseSchema):
    id: UUID
    supplier_id: UUID | None
    account_id: UUID
    payment_number: str
    amount: Decimal
    payment_method: str | None
    reference: str | None
    notes: str | None
    payment_date: datetime
    created_at: datetime
    updated_at: datetime
    supplier: SupplierRead | None = None
    account: AccountRead


class FinanceSummaryRead(BaseModel):
    total_cash_bank_balance: Decimal
    total_income: Decimal
    total_expense: Decimal
    net_cash_flow: Decimal
    pending_petty_cash_count: int
    supplier_payments_total: Decimal
    recent_transactions: list[TransactionRead]
