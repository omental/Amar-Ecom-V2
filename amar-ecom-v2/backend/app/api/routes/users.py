from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select

from app.api.deps import DBSession, get_current_user
from app.api.utils import commit_or_409, ensure_unique, fetch_one_or_404, normalize_pagination
from app.core.security import get_password_hash
from app.models.user import User
from app.schemas.user import UserCreate, UserRead, UserUpdate


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
async def create_user(user_in: UserCreate, db: DBSession) -> User:
    await ensure_unique(db, User, "email", user_in.email, "Email already registered")

    user = User(
        full_name=user_in.full_name,
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        role=user_in.role,
        is_active=user_in.is_active,
    )
    db.add(user)
    await commit_or_409(db, "Could not create user")
    await db.refresh(user)
    return user


@router.patch("/{user_id}", response_model=UserRead)
async def update_user(user_id: UUID, user_in: UserUpdate, db: DBSession) -> User:
    user = await fetch_one_or_404(db, select(User).where(User.id == user_id), "User not found")
    payload = user_in.model_dump(exclude_unset=True)

    if "email" in payload:
        await ensure_unique(db, User, "email", payload["email"], "Email already registered", exclude_id=user.id)

    if "password" in payload:
        user.hashed_password = get_password_hash(payload.pop("password"))

    for field, value in payload.items():
        setattr(user, field, value)

    await commit_or_409(db, "Could not update user")
    await db.refresh(user)
    return user
