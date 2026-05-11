from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy import select

from app.api.deps import DBSession, get_current_user
from app.api.utils import commit_or_409, ensure_unique, fetch_one_or_404, normalize_pagination
from app.core.security import get_password_hash
from app.models.user import User
from app.schemas.user import UserCreate, UserRead, UserUpdate
from app.services.activity_log_service import log_activity


router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[UserRead])
async def list_users(
    db: DBSession,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
) -> list[User]:
    skip, limit = normalize_pagination(skip, limit)
    result = await db.execute(select(User).order_by(User.created_at.desc()).offset(skip).limit(limit))
    return list(result.scalars().all())


@router.get("/{user_id}", response_model=UserRead)
async def get_user(user_id: UUID, db: DBSession) -> User:
    return await fetch_one_or_404(db, select(User).where(User.id == user_id), "User not found")


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_in: UserCreate,
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> User:
    await ensure_unique(db, User, "email", user_in.email, "Email already registered")

    user = User(
        full_name=user_in.full_name,
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        role=user_in.role,
        is_active=user_in.is_active,
    )
    db.add(user)
    await db.flush()
    await log_activity(
        db,
        user_id=current_user.id,
        action="user_created",
        module="team",
        entity_type="user",
        entity_id=user.id,
        message=f"Created user {user.full_name} with role {user.role}.",
        request=request,
    )
    await commit_or_409(db, "Could not create user")
    await db.refresh(user)
    return user


@router.patch("/{user_id}", response_model=UserRead)
async def update_user(
    user_id: UUID,
    user_in: UserUpdate,
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> User:
    user = await fetch_one_or_404(db, select(User).where(User.id == user_id), "User not found")
    payload = user_in.model_dump(exclude_unset=True)
    previous_is_active = user.is_active

    if "email" in payload:
        await ensure_unique(db, User, "email", payload["email"], "Email already registered", exclude_id=user.id)

    if "password" in payload:
        user.hashed_password = get_password_hash(payload.pop("password"))

    for field, value in payload.items():
        setattr(user, field, value)

    action = "user_updated"
    message = f"Updated user {user.full_name}."
    if "is_active" in payload and previous_is_active != user.is_active:
        action = "user_activated" if user.is_active else "user_deactivated"
        message = f"{'Activated' if user.is_active else 'Deactivated'} user {user.full_name}."

    await log_activity(
        db,
        user_id=current_user.id,
        action=action,
        module="team",
        entity_type="user",
        entity_id=user.id,
        message=message,
        request=request,
    )
    await commit_or_409(db, "Could not update user")
    await db.refresh(user)
    return user
