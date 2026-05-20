from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import DBSession, get_current_user
from app.api.utils import commit_or_409, fetch_one_or_404, normalize_pagination
from app.models.finance import PettyCashEntry
from app.models.user import User
from app.schemas.finance import PettyCashEntryCreate, PettyCashEntryRead, PettyCashEntryUpdate
from app.services.activity_log_service import log_activity
from app.services.finance_service import record_petty_cash_entry, update_petty_cash_entry


router = APIRouter(dependencies=[Depends(get_current_user)])


def _petty_cash_query():
    return select(PettyCashEntry).options(
        selectinload(PettyCashEntry.account),
        selectinload(PettyCashEntry.approved_by),
    )


@router.get("", response_model=list[PettyCashEntryRead])
async def list_petty_cash_entries(
    db: DBSession,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
) -> list[PettyCashEntry]:
    skip, limit = normalize_pagination(skip, limit)
    result = await db.execute(
        _petty_cash_query().order_by(PettyCashEntry.entry_date.desc(), PettyCashEntry.created_at.desc()).offset(skip).limit(limit)
    )
    return list(result.scalars().all())


@router.get("/{entry_id}", response_model=PettyCashEntryRead)
async def get_petty_cash_entry(entry_id: UUID, db: DBSession) -> PettyCashEntry:
    return await fetch_one_or_404(db, _petty_cash_query().where(PettyCashEntry.id == entry_id), "Petty cash entry not found")


@router.post("", response_model=PettyCashEntryRead, status_code=status.HTTP_201_CREATED)
async def create_petty_cash_entry(
    entry_in: PettyCashEntryCreate,
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> PettyCashEntry:
    entry = await record_petty_cash_entry(db, entry_in, created_by=current_user)
    await log_activity(
        db,
        user_id=current_user.id,
        action="petty_cash_created",
        module="finance",
        entity_type="petty_cash_entry",
        entity_id=entry.id,
        message=f"Created petty cash entry {entry.entry_number}.",
        request=request,
    )
    if entry.transaction_created and entry.transaction_id is not None:
        await log_activity(
            db,
            user_id=current_user.id,
            action="petty_cash_transaction_created",
            module="finance",
            entity_type="transaction",
            entity_id=entry.transaction_id,
            message=f"Recorded petty cash transaction for {entry.entry_number}.",
            request=request,
        )
    await commit_or_409(db, "Could not create petty cash entry")
    return await fetch_one_or_404(db, _petty_cash_query().where(PettyCashEntry.id == entry.id), "Petty cash entry not found")


@router.patch("/{entry_id}", response_model=PettyCashEntryRead)
async def update_petty_cash(
    entry_id: UUID,
    entry_in: PettyCashEntryUpdate,
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> PettyCashEntry:
    entry = await fetch_one_or_404(db, select(PettyCashEntry).where(PettyCashEntry.id == entry_id), "Petty cash entry not found")
    had_transaction = entry.transaction_created
    await update_petty_cash_entry(db, entry, entry_in, created_by=current_user)
    await log_activity(
        db,
        user_id=current_user.id,
        action="petty_cash_updated",
        module="finance",
        entity_type="petty_cash_entry",
        entity_id=entry.id,
        message=f"Updated petty cash entry {entry.entry_number}.",
        request=request,
    )
    if not had_transaction and entry.transaction_created and entry.transaction_id is not None:
        await log_activity(
            db,
            user_id=current_user.id,
            action="petty_cash_transaction_created",
            module="finance",
            entity_type="transaction",
            entity_id=entry.transaction_id,
            message=f"Recorded petty cash transaction for {entry.entry_number}.",
            request=request,
        )
    await commit_or_409(db, "Could not update petty cash entry")
    return await fetch_one_or_404(db, _petty_cash_query().where(PettyCashEntry.id == entry.id), "Petty cash entry not found")
