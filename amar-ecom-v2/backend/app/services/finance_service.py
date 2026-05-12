from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.utils import ensure_unique, fetch_one_or_404
from app.models.finance import Account, PettyCashEntry, SupplierPayment, Transaction
from app.models.supplier import Supplier
from app.models.user import User
from app.schemas.finance import PettyCashEntryCreate, PettyCashEntryUpdate, SupplierPaymentCreate, TransactionCreate


NON_NEGATIVE_ACCOUNT_TYPES = {"cash", "bank", "mobile_banking"}
PETTY_CASH_DEDUCT_STATUSES = {"approved", "settled"}


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _get_account(db: AsyncSession, account_id: UUID) -> Account:
    account = await fetch_one_or_404(db, select(Account).where(Account.id == account_id), "Account not found")
    if not account.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Account {account.name} is inactive.")
    return account


def apply_account_balance(account: Account, *, amount: Decimal, direction: str) -> None:
    delta = amount if direction == "in" else -amount
    next_balance = (account.current_balance or Decimal("0.00")) + delta
    if account.account_type in NON_NEGATIVE_ACCOUNT_TYPES and next_balance < Decimal("0.00"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient balance in account {account.name}.",
        )
    account.current_balance = next_balance


async def create_transaction(
    db: AsyncSession,
    transaction_in: TransactionCreate,
    *,
    created_by: User | None = None,
) -> Transaction:
    await ensure_unique(
        db,
        Transaction,
        "transaction_number",
        transaction_in.transaction_number,
        "Transaction number already exists",
    )
    account = await _get_account(db, transaction_in.account_id)
    related_account = None
    if transaction_in.related_account_id is not None:
        related_account = await _get_account(db, transaction_in.related_account_id)

    if transaction_in.transaction_type == "transfer":
        if related_account is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Transfer transactions require a related account.",
            )
        if related_account.id == account.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Transfer source and destination accounts must be different.",
            )
    elif transaction_in.transaction_type in {"income", "customer_payment"} and transaction_in.direction != "in":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{transaction_in.transaction_type} transactions must use direction 'in'.",
        )
    elif transaction_in.transaction_type in {"expense", "supplier_payment", "refund", "petty_cash"} and transaction_in.direction != "out":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{transaction_in.transaction_type} transactions must use direction 'out'.",
        )

    apply_account_balance(account, amount=transaction_in.amount, direction=transaction_in.direction)
    if transaction_in.transaction_type == "transfer" and related_account is not None:
        apply_account_balance(related_account, amount=transaction_in.amount, direction="in")

    transaction = Transaction(
        **transaction_in.model_dump(exclude={"transaction_date"}),
        transaction_date=transaction_in.transaction_date or _now(),
        created_by_id=created_by.id if created_by else None,
    )
    db.add(transaction)
    await db.flush()

    result = await db.execute(
        select(Transaction)
        .options(
            selectinload(Transaction.account),
            selectinload(Transaction.related_account),
            selectinload(Transaction.created_by),
        )
        .where(Transaction.id == transaction.id)
    )
    return result.scalar_one()


async def create_transfer(
    db: AsyncSession,
    transaction_in: TransactionCreate,
    *,
    created_by: User | None = None,
) -> Transaction:
    if transaction_in.transaction_type != "transfer" or transaction_in.direction != "out":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Transfers must use transaction_type 'transfer' and direction 'out'.",
        )
    return await create_transaction(db, transaction_in, created_by=created_by)


async def record_supplier_payment(db: AsyncSession, payment_in: SupplierPaymentCreate) -> SupplierPayment:
    await ensure_unique(
        db,
        SupplierPayment,
        "payment_number",
        payment_in.payment_number,
        "Payment number already exists",
    )
    account = await _get_account(db, payment_in.account_id)
    if payment_in.supplier_id is not None:
        await fetch_one_or_404(db, select(Supplier).where(Supplier.id == payment_in.supplier_id), "Supplier not found")

    apply_account_balance(account, amount=payment_in.amount, direction="out")

    payment = SupplierPayment(
        **payment_in.model_dump(exclude={"payment_date"}),
        payment_date=payment_in.payment_date or _now(),
    )
    db.add(payment)
    await db.flush()

    result = await db.execute(
        select(SupplierPayment)
        .options(selectinload(SupplierPayment.supplier), selectinload(SupplierPayment.account))
        .where(SupplierPayment.id == payment.id)
    )
    return result.scalar_one()


async def record_petty_cash_entry(db: AsyncSession, entry_in: PettyCashEntryCreate) -> PettyCashEntry:
    await ensure_unique(
        db,
        PettyCashEntry,
        "entry_number",
        entry_in.entry_number,
        "Petty cash entry number already exists",
    )
    if entry_in.account_id is not None:
        account = await _get_account(db, entry_in.account_id)
        if entry_in.status in PETTY_CASH_DEDUCT_STATUSES:
            apply_account_balance(account, amount=entry_in.amount, direction="out")

    entry = PettyCashEntry(
        **entry_in.model_dump(exclude={"entry_date"}),
        entry_date=entry_in.entry_date or _now(),
    )
    db.add(entry)
    await db.flush()

    result = await db.execute(
        select(PettyCashEntry)
        .options(selectinload(PettyCashEntry.account), selectinload(PettyCashEntry.approved_by))
        .where(PettyCashEntry.id == entry.id)
    )
    return result.scalar_one()


async def update_petty_cash_entry(
    db: AsyncSession,
    entry: PettyCashEntry,
    entry_in: PettyCashEntryUpdate,
) -> PettyCashEntry:
    payload = entry_in.model_dump(exclude_unset=True)
    previous_status = entry.status
    next_status = payload["status"] if "status" in payload else entry.status
    next_account_id = payload["account_id"] if "account_id" in payload else entry.account_id

    if "approved_by_id" in payload and payload["approved_by_id"] is not None:
        await fetch_one_or_404(db, select(User).where(User.id == payload["approved_by_id"]), "User not found")

    if previous_status not in PETTY_CASH_DEDUCT_STATUSES and next_status in PETTY_CASH_DEDUCT_STATUSES and next_account_id is not None:
        account = await _get_account(db, next_account_id)
        apply_account_balance(account, amount=entry.amount, direction="out")

    for field, value in payload.items():
        setattr(entry, field, value)

    result = await db.execute(
        select(PettyCashEntry)
        .options(selectinload(PettyCashEntry.account), selectinload(PettyCashEntry.approved_by))
        .where(PettyCashEntry.id == entry.id)
    )
    return result.scalar_one()


async def get_recent_transactions(db: AsyncSession, limit: int = 10) -> list[Transaction]:
    result = await db.execute(
        select(Transaction)
        .options(
            selectinload(Transaction.account),
            selectinload(Transaction.related_account),
            selectinload(Transaction.created_by),
        )
        .order_by(Transaction.transaction_date.desc(), Transaction.created_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())
