from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import Select, select
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


def _transaction_query() -> Select[tuple[Transaction]]:
    return select(Transaction).options(
        selectinload(Transaction.account),
        selectinload(Transaction.related_account),
        selectinload(Transaction.created_by),
    )


def _petty_cash_query() -> Select[tuple[PettyCashEntry]]:
    return select(PettyCashEntry).options(
        selectinload(PettyCashEntry.account),
        selectinload(PettyCashEntry.approved_by),
    )


def _supplier_payment_query() -> Select[tuple[SupplierPayment]]:
    return select(SupplierPayment).options(
        selectinload(SupplierPayment.supplier),
        selectinload(SupplierPayment.account),
        selectinload(SupplierPayment.transaction).selectinload(Transaction.account),
        selectinload(SupplierPayment.transaction).selectinload(Transaction.related_account),
        selectinload(SupplierPayment.transaction).selectinload(Transaction.created_by),
    )


def _generate_transaction_number(prefix: str) -> str:
    return f"{prefix}-{_now().strftime('%Y%m%d%H%M%S%f')}"


def _generate_petty_cash_entry_number() -> str:
    return f"PC-{_now().strftime('%Y%m%d%H%M%S%f')}"


def _generate_supplier_payment_number() -> str:
    return f"SP-{_now().strftime('%Y%m%d%H%M%S%f')}"


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
    apply_balance: bool = True,
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

    if apply_balance:
        apply_account_balance(account, amount=transaction_in.amount, direction=transaction_in.direction)
    if apply_balance and transaction_in.transaction_type == "transfer" and related_account is not None:
        apply_account_balance(related_account, amount=transaction_in.amount, direction="in")

    transaction = Transaction(
        **transaction_in.model_dump(exclude={"transaction_date"}),
        transaction_date=transaction_in.transaction_date or _now(),
        created_by_id=created_by.id if created_by else None,
    )
    db.add(transaction)
    await db.flush()

    result = await db.execute(_transaction_query().where(Transaction.id == transaction.id))
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


async def _find_transaction_by_reference(
    db: AsyncSession,
    *,
    reference_type: str,
    reference_id: str,
) -> Transaction | None:
    result = await db.execute(
        _transaction_query().where(
            Transaction.reference_type == reference_type,
            Transaction.reference_id == reference_id,
        )
    )
    return result.scalar_one_or_none()


async def _create_reference_transaction(
    db: AsyncSession,
    *,
    account_id: UUID,
    amount: Decimal,
    transaction_type: str,
    reference_type: str,
    reference_id: UUID,
    description: str,
    transaction_date: datetime,
    category: str | None = None,
    created_by: User | None = None,
    prefix: str,
) -> Transaction:
    existing = await _find_transaction_by_reference(
        db,
        reference_type=reference_type,
        reference_id=str(reference_id),
    )
    if existing is not None:
        return existing

    transaction_in = TransactionCreate(
        transaction_number=_generate_transaction_number(prefix),
        account_id=account_id,
        related_account_id=None,
        transaction_type=transaction_type,
        category=category,
        amount=amount,
        direction="out",
        reference_type=reference_type,
        reference_id=str(reference_id),
        description=description,
        transaction_date=transaction_date,
    )
    return await create_transaction(db, transaction_in, created_by=created_by, apply_balance=False)


async def record_supplier_payment(
    db: AsyncSession,
    payment_in: SupplierPaymentCreate,
    *,
    created_by: User | None = None,
) -> SupplierPayment:
    payment_number = payment_in.payment_number or _generate_supplier_payment_number()
    await ensure_unique(
        db,
        SupplierPayment,
        "payment_number",
        payment_number,
        "Payment number already exists",
    )
    account = await _get_account(db, payment_in.account_id)
    if payment_in.supplier_id is not None:
        await fetch_one_or_404(db, select(Supplier).where(Supplier.id == payment_in.supplier_id), "Supplier not found")

    apply_account_balance(account, amount=payment_in.amount, direction="out")

    payment = SupplierPayment(
        **payment_in.model_dump(exclude={"payment_date", "payment_number"}),
        payment_number=payment_number,
        payment_date=payment_in.payment_date or _now(),
    )
    db.add(payment)
    await db.flush()

    transaction = await _create_reference_transaction(
        db,
        account_id=payment.account_id,
        amount=payment.amount,
        transaction_type="supplier_payment",
        reference_type="supplier_payment",
        reference_id=payment.id,
        description=f"Supplier payment {payment.payment_number}"
        + (f" for supplier {payment.supplier_id}" if payment.supplier_id else ""),
        transaction_date=payment.payment_date,
        category=payment.payment_method,
        created_by=created_by,
        prefix="TXN-SP",
    )
    payment.transaction_id = transaction.id

    result = await db.execute(_supplier_payment_query().where(SupplierPayment.id == payment.id))
    return result.scalar_one()


async def _maybe_create_petty_cash_transaction(
    db: AsyncSession,
    *,
    entry: PettyCashEntry,
    created_by: User | None = None,
) -> Transaction | None:
    if entry.account_id is None or entry.status not in PETTY_CASH_DEDUCT_STATUSES:
        return None
    if entry.transaction_created and entry.transaction_id is not None:
        return await _find_transaction_by_reference(
            db,
            reference_type="petty_cash",
            reference_id=str(entry.id),
        )

    transaction = await _create_reference_transaction(
        db,
        account_id=entry.account_id,
        amount=entry.amount,
        transaction_type="petty_cash",
        reference_type="petty_cash",
        reference_id=entry.id,
        description=f"Petty cash {entry.entry_number}: {entry.purpose}",
        transaction_date=entry.entry_date,
        category=entry.entry_type,
        created_by=created_by,
        prefix="TXN-PC",
    )
    entry.transaction_id = transaction.id
    entry.transaction_created = True
    return transaction


async def record_petty_cash_entry(
    db: AsyncSession,
    entry_in: PettyCashEntryCreate,
    *,
    created_by: User | None = None,
) -> PettyCashEntry:
    entry_number = entry_in.entry_number or _generate_petty_cash_entry_number()
    await ensure_unique(
        db,
        PettyCashEntry,
        "entry_number",
        entry_number,
        "Petty cash entry number already exists",
    )
    if entry_in.account_id is not None:
        account = await _get_account(db, entry_in.account_id)
        if entry_in.status in PETTY_CASH_DEDUCT_STATUSES:
            apply_account_balance(account, amount=entry_in.amount, direction="out")

    entry = PettyCashEntry(
        **entry_in.model_dump(exclude={"entry_date", "entry_number"}),
        entry_number=entry_number,
        entry_date=entry_in.entry_date or _now(),
    )
    db.add(entry)
    await db.flush()
    await _maybe_create_petty_cash_transaction(db, entry=entry, created_by=created_by)

    result = await db.execute(_petty_cash_query().where(PettyCashEntry.id == entry.id))
    return result.scalar_one()


async def update_petty_cash_entry(
    db: AsyncSession,
    entry: PettyCashEntry,
    entry_in: PettyCashEntryUpdate,
    *,
    created_by: User | None = None,
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

    if entry.status in PETTY_CASH_DEDUCT_STATUSES:
        await _maybe_create_petty_cash_transaction(db, entry=entry, created_by=created_by)

    result = await db.execute(_petty_cash_query().where(PettyCashEntry.id == entry.id))
    return result.scalar_one()


async def get_recent_transactions(db: AsyncSession, limit: int = 10) -> list[Transaction]:
    result = await db.execute(
        _transaction_query().order_by(Transaction.transaction_date.desc(), Transaction.created_at.desc()).limit(limit)
    )
    return list(result.scalars().all())
