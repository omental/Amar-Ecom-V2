from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import DBSession, get_current_user
from app.api.utils import commit_or_409, fetch_one_or_404, normalize_pagination
from app.models.finance import Transaction
from app.models.user import User
from app.schemas.finance import TransactionCreate, TransactionRead
from app.services.activity_log_service import log_activity
from app.services.finance_service import create_transaction, create_transfer


router = APIRouter(dependencies=[Depends(get_current_user)])


def _transaction_query():
    return select(Transaction).options(
        selectinload(Transaction.account),
        selectinload(Transaction.related_account),
        selectinload(Transaction.created_by),
    )


@router.get("", response_model=list[TransactionRead])
async def list_transactions(
    db: DBSession,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
) -> list[Transaction]:
    skip, limit = normalize_pagination(skip, limit)
    result = await db.execute(
        _transaction_query().order_by(Transaction.transaction_date.desc(), Transaction.created_at.desc()).offset(skip).limit(limit)
    )
    return list(result.scalars().all())


@router.get("/{transaction_id}", response_model=TransactionRead)
async def get_transaction(transaction_id: UUID, db: DBSession) -> Transaction:
    return await fetch_one_or_404(db, _transaction_query().where(Transaction.id == transaction_id), "Transaction not found")


@router.post("", response_model=TransactionRead, status_code=status.HTTP_201_CREATED)
async def create_transaction_entry(
    transaction_in: TransactionCreate,
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> Transaction:
    transaction = await (
        create_transfer(db, transaction_in, created_by=current_user)
        if transaction_in.transaction_type == "transfer"
        else create_transaction(db, transaction_in, created_by=current_user)
    )
    await log_activity(
        db,
        user_id=current_user.id,
        action="transaction_created",
        module="finance",
        entity_type="transaction",
        entity_id=transaction.id,
        message=f"Created transaction {transaction.transaction_number}.",
        request=request,
    )
    await commit_or_409(db, "Could not create transaction")
    return await fetch_one_or_404(db, _transaction_query().where(Transaction.id == transaction.id), "Transaction not found")
