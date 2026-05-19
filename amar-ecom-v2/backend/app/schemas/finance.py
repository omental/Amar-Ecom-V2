from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import AliasChoices, BaseModel, Field, computed_field, model_validator

from app.schemas.common import ORMBaseSchema
from app.schemas.supplier import SupplierRead
from app.schemas.user import UserRead


def _normalize_account_type(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip().lower().replace("-", "_").replace(" ", "_")
    aliases = {
        "mobile": "mobile_banking",
        "mobilebanking": "mobile_banking",
        "mfs": "mobile_banking",
    }
    return aliases.get(normalized, normalized)


def _display_account_type(value: str) -> str:
    normalized = _normalize_account_type(value) or ""
    mapping = {
        "cash": "Cash",
        "bank": "Bank",
        "mobile_banking": "Mobile Banking",
        "asset": "Asset",
        "liability": "Liability",
        "equity": "Equity",
    }
    return mapping.get(normalized, normalized.replace("_", " ").title())


def _account_category(value: str) -> str:
    normalized = _normalize_account_type(value) or ""
    if normalized in {"cash", "bank", "mobile_banking", "asset"}:
        return "Assets"
    if normalized == "liability":
        return "Liabilities"
    if normalized == "equity":
        return "Equity"
    return "Assets"


class AccountCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    code: str | None = Field(default=None, min_length=1, max_length=100)
    account_type: str = Field(
        min_length=1,
        max_length=50,
        validation_alias=AliasChoices("account_type", "accountType", "type"),
    )
    opening_balance: Decimal = Field(
        default=Decimal("0.00"),
        validation_alias=AliasChoices("opening_balance", "openingBalance", "initialBalance", "balance"),
    )
    notes: str | None = None
    is_active: bool = Field(default=True, validation_alias=AliasChoices("is_active", "isActive", "active"))

    @model_validator(mode="after")
    def normalize_fields(self):
        self.account_type = _normalize_account_type(self.account_type) or self.account_type
        return self


class AccountUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    code: str | None = Field(default=None, min_length=1, max_length=100)
    account_type: str | None = Field(
        default=None,
        min_length=1,
        max_length=50,
        validation_alias=AliasChoices("account_type", "accountType", "type"),
    )
    notes: str | None = None
    is_active: bool | None = Field(default=None, validation_alias=AliasChoices("is_active", "isActive", "active"))

    @model_validator(mode="after")
    def normalize_fields(self):
        if self.account_type is not None:
            self.account_type = _normalize_account_type(self.account_type)
        return self


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

    @computed_field(return_type=str)
    @property
    def type(self) -> str:
        return _display_account_type(self.account_type)

    @computed_field(return_type=str)
    @property
    def accountType(self) -> str:
        return _display_account_type(self.account_type)

    @computed_field(return_type=str)
    @property
    def category(self) -> str:
        return _account_category(self.account_type)

    @computed_field(return_type=Decimal)
    @property
    def balance(self) -> Decimal:
        return self.current_balance

    @computed_field(return_type=Decimal)
    @property
    def openingBalance(self) -> Decimal:
        return self.opening_balance

    @computed_field(return_type=Decimal)
    @property
    def currentBalance(self) -> Decimal:
        return self.current_balance

    @computed_field(return_type=bool)
    @property
    def active(self) -> bool:
        return self.is_active

    @computed_field(return_type=bool)
    @property
    def isActive(self) -> bool:
        return self.is_active

    @computed_field(return_type=str)
    @property
    def status(self) -> str:
        return "Active" if self.is_active else "Inactive"

    @computed_field
    @property
    def accountNumber(self) -> None:
        return None

    @computed_field(return_type=datetime)
    @property
    def createdAt(self) -> datetime:
        return self.created_at

    @computed_field(return_type=datetime)
    @property
    def updatedAt(self) -> datetime:
        return self.updated_at


class TransactionCreate(BaseModel):
    transaction_number: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
        validation_alias=AliasChoices("transaction_number", "transactionNumber"),
    )
    account_id: UUID = Field(validation_alias=AliasChoices("account_id", "accountId"))
    related_account_id: UUID | None = Field(
        default=None,
        validation_alias=AliasChoices("related_account_id", "relatedAccountId", "toAccountId"),
    )
    transaction_type: str = Field(
        min_length=1,
        max_length=50,
        validation_alias=AliasChoices("transaction_type", "transactionType", "type"),
    )
    category: str | None = Field(default=None, max_length=100, validation_alias=AliasChoices("category", "subCategory", "method"))
    amount: Decimal = Field(gt=0)
    direction: str | None = Field(default=None, min_length=1, max_length=10)
    reference_type: str | None = Field(default=None, max_length=100)
    reference_id: str | None = Field(default=None, max_length=100)
    description: str | None = Field(default=None, validation_alias=AliasChoices("description", "notes", "remark"))
    transaction_date: datetime | None = Field(
        default=None,
        validation_alias=AliasChoices("transaction_date", "transactionDate", "date"),
    )

    @model_validator(mode="after")
    def normalize_fields(self):
        self.transaction_type = self.transaction_type.strip().lower().replace(" ", "_")
        if self.direction is None:
            if self.transaction_type in {"income", "customer_payment"}:
                self.direction = "in"
            else:
                self.direction = "out"
        return self


class TransactionUpdate(BaseModel):
    category: str | None = Field(default=None, max_length=100, validation_alias=AliasChoices("category", "subCategory", "method"))
    description: str | None = Field(default=None, validation_alias=AliasChoices("description", "notes", "remark"))


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

    @computed_field(return_type=str)
    @property
    def transactionNumber(self) -> str:
        return self.transaction_number

    @computed_field(return_type=str)
    @property
    def type(self) -> str:
        return self.transaction_type

    @computed_field(return_type=UUID)
    @property
    def accountId(self) -> UUID:
        return self.account_id

    @computed_field(return_type=UUID | None)
    @property
    def toAccountId(self) -> UUID | None:
        return self.related_account_id

    @computed_field(return_type=str | None)
    @property
    def subCategory(self) -> str | None:
        return self.category

    @computed_field(return_type=str | None)
    @property
    def method(self) -> str | None:
        return self.category

    @computed_field(return_type=str)
    @property
    def status(self) -> str:
        return "Completed"

    @computed_field(return_type=str | None)
    @property
    def notes(self) -> str | None:
        return self.description

    @computed_field(return_type=datetime)
    @property
    def date(self) -> datetime:
        return self.transaction_date

    @computed_field(return_type=str | None)
    @property
    def accountName(self) -> str | None:
        return self.account.name if self.account else None

    @computed_field(return_type=str | None)
    @property
    def toAccountName(self) -> str | None:
        return self.related_account.name if self.related_account else None

    @computed_field(return_type=str | None)
    @property
    def userName(self) -> str | None:
        return self.created_by.full_name if self.created_by else None

    @computed_field(return_type=datetime)
    @property
    def createdAt(self) -> datetime:
        return self.created_at

    @computed_field(return_type=datetime)
    @property
    def updatedAt(self) -> datetime:
        return self.updated_at


class PettyCashEntryCreate(BaseModel):
    entry_number: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
        validation_alias=AliasChoices("entry_number", "entryNumber", "voucherNo"),
    )
    account_id: UUID | None = Field(default=None, validation_alias=AliasChoices("account_id", "accountId"))
    entry_type: str = Field(min_length=1, max_length=50, validation_alias=AliasChoices("entry_type", "entryType", "type"))
    amount: Decimal = Field(gt=0)
    purpose: str = Field(min_length=1, validation_alias=AliasChoices("purpose", "notes", "note"))
    spent_by: str | None = Field(default=None, max_length=255)
    approved_by_id: UUID | None = None
    status: str = Field(default="pending", min_length=1, max_length=50)
    entry_date: datetime | None = Field(default=None, validation_alias=AliasChoices("entry_date", "entryDate", "date"))


class PettyCashEntryUpdate(BaseModel):
    account_id: UUID | None = Field(default=None, validation_alias=AliasChoices("account_id", "accountId"))
    entry_type: str | None = Field(
        default=None,
        min_length=1,
        max_length=50,
        validation_alias=AliasChoices("entry_type", "entryType", "type"),
    )
    purpose: str | None = Field(default=None, min_length=1, validation_alias=AliasChoices("purpose", "notes", "note"))
    spent_by: str | None = Field(default=None, max_length=255)
    approved_by_id: UUID | None = None
    status: str | None = Field(default=None, min_length=1, max_length=50)
    entry_date: datetime | None = Field(default=None, validation_alias=AliasChoices("entry_date", "entryDate", "date"))


class PettyCashEntryRead(ORMBaseSchema):
    id: UUID
    entry_number: str
    account_id: UUID | None
    transaction_id: UUID | None
    transaction_created: bool
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

    @computed_field(return_type=str)
    @property
    def entryNumber(self) -> str:
        return self.entry_number

    @computed_field(return_type=str)
    @property
    def type(self) -> str:
        return self.entry_type

    @computed_field(return_type=str)
    @property
    def note(self) -> str:
        return self.purpose

    @computed_field(return_type=datetime)
    @property
    def date(self) -> datetime:
        return self.entry_date

    @computed_field(return_type=str | None)
    @property
    def accountName(self) -> str | None:
        return self.account.name if self.account else None

    @computed_field(return_type=str | None)
    @property
    def approvedByName(self) -> str | None:
        return self.approved_by.full_name if self.approved_by else None

    @computed_field(return_type=datetime)
    @property
    def createdAt(self) -> datetime:
        return self.created_at

    @computed_field(return_type=datetime)
    @property
    def updatedAt(self) -> datetime:
        return self.updated_at


class SupplierPaymentCreate(BaseModel):
    supplier_id: UUID | None = Field(default=None, validation_alias=AliasChoices("supplier_id", "supplierId"))
    account_id: UUID = Field(validation_alias=AliasChoices("account_id", "accountId"))
    payment_number: str | None = Field(
        default=None,
        min_length=1,
        max_length=100,
        validation_alias=AliasChoices("payment_number", "paymentNumber", "voucherNo"),
    )
    amount: Decimal | None = Field(default=None, validation_alias=AliasChoices("amount", "paidAmount"))
    payment_method: str | None = Field(default=None, max_length=100, validation_alias=AliasChoices("payment_method", "paymentMethod", "paymentType"))
    reference: str | None = Field(default=None, max_length=255)
    notes: str | None = Field(default=None, validation_alias=AliasChoices("notes", "remark"))
    payment_date: datetime | None = Field(default=None, validation_alias=AliasChoices("payment_date", "paymentDate", "date"))

    @model_validator(mode="after")
    def ensure_amount(self):
        if self.amount is None or self.amount <= 0:
            raise ValueError("amount must be greater than zero")
        return self


class SupplierPaymentRead(ORMBaseSchema):
    id: UUID
    supplier_id: UUID | None
    account_id: UUID
    transaction_id: UUID | None
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
    transaction: TransactionRead | None = None

    @computed_field(return_type=str)
    @property
    def paymentNumber(self) -> str:
        return self.payment_number

    @computed_field(return_type=str)
    @property
    def voucherNo(self) -> str:
        return self.payment_number

    @computed_field(return_type=str | None)
    @property
    def supplierName(self) -> str | None:
        return self.supplier.name if self.supplier else None

    @computed_field(return_type=str | None)
    @property
    def accountName(self) -> str | None:
        return self.account.name if self.account else None

    @computed_field(return_type=str | None)
    @property
    def paymentType(self) -> str | None:
        return self.payment_method

    @computed_field(return_type=Decimal)
    @property
    def paidAmount(self) -> Decimal:
        return self.amount

    @computed_field(return_type=str | None)
    @property
    def remark(self) -> str | None:
        return self.notes

    @computed_field(return_type=datetime)
    @property
    def date(self) -> datetime:
        return self.payment_date

    @computed_field(return_type=datetime)
    @property
    def createdAt(self) -> datetime:
        return self.created_at

    @computed_field(return_type=datetime)
    @property
    def updatedAt(self) -> datetime:
        return self.updated_at


class FinanceSummaryRead(BaseModel):
    total_cash_bank_balance: Decimal
    total_income: Decimal
    total_expense: Decimal
    net_cash_flow: Decimal
    pending_petty_cash_count: int
    supplier_payments_total: Decimal
    recent_transactions: list[TransactionRead]

    @computed_field(return_type=Decimal)
    @property
    def cashBankBalance(self) -> Decimal:
        return self.total_cash_bank_balance

    @computed_field(return_type=Decimal)
    @property
    def totalIncome(self) -> Decimal:
        return self.total_income

    @computed_field(return_type=Decimal)
    @property
    def totalExpense(self) -> Decimal:
        return self.total_expense

    @computed_field(return_type=Decimal)
    @property
    def netCashFlow(self) -> Decimal:
        return self.net_cash_flow

    @computed_field(return_type=int)
    @property
    def pendingPettyCash(self) -> int:
        return self.pending_petty_cash_count

    @computed_field(return_type=Decimal)
    @property
    def supplierPayments(self) -> Decimal:
        return self.supplier_payments_total

    @computed_field(return_type=list[TransactionRead])
    @property
    def recentTransactions(self) -> list[TransactionRead]:
        return self.recent_transactions
