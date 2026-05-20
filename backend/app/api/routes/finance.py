from datetime import datetime, time
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import func, select

from app.api.deps import DBSession, get_current_user
from app.models.finance import Account, PettyCashEntry, SupplierPayment, Transaction
from app.schemas.finance import FinanceSummaryRead
from app.services.finance_service import get_recent_transactions


router = APIRouter(dependencies=[Depends(get_current_user)])


def _date_range_bounds(date_from: datetime | None, date_to: datetime | None) -> tuple[datetime | None, datetime | None]:
    if date_to is not None and date_to.time() == time.min:
        return date_from, date_to.replace(hour=23, minute=59, second=59, microsecond=999999)
    return date_from, date_to


def _apply_transaction_date_filters(stmt, date_from: datetime | None, date_to: datetime | None):
    start, end = _date_range_bounds(date_from, date_to)
    if start is not None:
        stmt = stmt.where(Transaction.transaction_date >= start)
    if end is not None:
        stmt = stmt.where(Transaction.transaction_date <= end)
    return stmt


def _apply_supplier_payment_date_filters(stmt, date_from: datetime | None, date_to: datetime | None):
    start, end = _date_range_bounds(date_from, date_to)
    if start is not None:
        stmt = stmt.where(SupplierPayment.payment_date >= start)
    if end is not None:
        stmt = stmt.where(SupplierPayment.payment_date <= end)
    return stmt


@router.get("/summary", response_model=FinanceSummaryRead)
async def get_finance_summary(
    db: DBSession,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> FinanceSummaryRead:
    cash_balance_result = await db.execute(
        select(func.coalesce(func.sum(Account.current_balance), 0)).where(
            Account.account_type.in_(["cash", "bank", "mobile_banking"]),
            Account.is_active.is_(True),
        )
    )
    income_stmt = select(func.coalesce(func.sum(Transaction.amount), 0)).where(
        Transaction.direction == "in",
        Transaction.transaction_type != "transfer",
    )
    income_result = await db.execute(_apply_transaction_date_filters(income_stmt, date_from, date_to))
    expense_stmt = select(func.coalesce(func.sum(Transaction.amount), 0)).where(
        Transaction.direction == "out",
        Transaction.transaction_type != "transfer",
    )
    expense_result = await db.execute(_apply_transaction_date_filters(expense_stmt, date_from, date_to))
    petty_cash_result = await db.execute(
        select(func.count(PettyCashEntry.id)).where(PettyCashEntry.status == "pending")
    )
    supplier_payments_stmt = select(func.coalesce(func.sum(SupplierPayment.amount), 0))
    supplier_payments_result = await db.execute(
        _apply_supplier_payment_date_filters(supplier_payments_stmt, date_from, date_to)
    )
    recent_transactions = await get_recent_transactions(db, limit=10)

    total_cash_bank_balance = cash_balance_result.scalar_one() or Decimal("0")
    total_income = income_result.scalar_one() or Decimal("0")
    total_expense = expense_result.scalar_one() or Decimal("0")
    pending_petty_cash_count = petty_cash_result.scalar_one() or 0
    supplier_payments_total = supplier_payments_result.scalar_one() or Decimal("0")

    return FinanceSummaryRead(
        total_cash_bank_balance=total_cash_bank_balance,
        total_income=total_income,
        total_expense=total_expense,
        net_cash_flow=total_income - total_expense,
        pending_petty_cash_count=pending_petty_cash_count,
        supplier_payments_total=supplier_payments_total,
        recent_transactions=recent_transactions,
    )
