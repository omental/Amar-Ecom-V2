from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, Query, Request, Response, status
from sqlalchemy import select

from app.api.deps import DBSession, get_current_user
from app.api.utils import commit_or_409, ensure_unique, fetch_one_or_404, normalize_pagination
from app.models.finance import Account
from app.models.user import User
from app.schemas.finance import AccountCreate, AccountRead, AccountUpdate
from app.services.activity_log_service import log_activity


router = APIRouter(dependencies=[Depends(get_current_user)])


def _generate_account_code(account_name: str, account_type: str) -> str:
    prefix = "".join(part[:3].upper() for part in account_type.replace("_", " ").split()) or "ACC"
    suffix = "".join(ch for ch in account_name.upper() if ch.isalnum())[:6] or "AUTO"
    return f"{prefix}-{suffix}-{uuid4().hex[:4].upper()}"


@router.get("", response_model=list[AccountRead])
async def list_accounts(
    db: DBSession,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
) -> list[Account]:
    skip, limit = normalize_pagination(skip, limit)
    result = await db.execute(select(Account).order_by(Account.created_at.desc()).offset(skip).limit(limit))
    return list(result.scalars().all())


@router.get("/{account_id}", response_model=AccountRead)
async def get_account(account_id: UUID, db: DBSession) -> Account:
    return await fetch_one_or_404(db, select(Account).where(Account.id == account_id), "Account not found")


@router.post("", response_model=AccountRead, status_code=status.HTTP_201_CREATED)
async def create_account(
    account_in: AccountCreate,
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> Account:
    account_code = account_in.code or _generate_account_code(account_in.name, account_in.account_type)
    await ensure_unique(db, Account, "code", account_code, "Account code already exists")
    payload = account_in.model_dump()
    payload["code"] = account_code
    opening_balance = payload.pop("opening_balance")
    account = Account(**payload, opening_balance=opening_balance, current_balance=opening_balance)
    db.add(account)
    await db.flush()
    await log_activity(
        db,
        user_id=current_user.id,
        action="account_created",
        module="finance",
        entity_type="account",
        entity_id=account.id,
        message=f"Created account {account.name}.",
        request=request,
    )
    await commit_or_409(db, "Could not create account")
    await db.refresh(account)
    return account


@router.patch("/{account_id}", response_model=AccountRead)
async def update_account(
    account_id: UUID,
    account_in: AccountUpdate,
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> Account:
    account = await fetch_one_or_404(db, select(Account).where(Account.id == account_id), "Account not found")
    payload = account_in.model_dump(exclude_unset=True)
    if "code" in payload and payload["code"] != account.code:
        await ensure_unique(db, Account, "code", payload["code"], "Account code already exists", exclude_id=account.id)
    for field, value in payload.items():
        setattr(account, field, value)
    await log_activity(
        db,
        user_id=current_user.id,
        action="account_updated",
        module="finance",
        entity_type="account",
        entity_id=account.id,
        message=f"Updated account {account.name}.",
        request=request,
    )
    await commit_or_409(db, "Could not update account")
    await db.refresh(account)
    return account


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_account(
    account_id: UUID,
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> Response:
    account = await fetch_one_or_404(db, select(Account).where(Account.id == account_id), "Account not found")
    account.is_active = False
    await log_activity(
        db,
        user_id=current_user.id,
        action="account_deactivated",
        module="finance",
        entity_type="account",
        entity_id=account.id,
        message=f"Deactivated account {account.name}.",
        request=request,
    )
    await commit_or_409(db, "Could not update account")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
