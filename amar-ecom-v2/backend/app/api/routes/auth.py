from datetime import timedelta

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.api.deps import DBSession
from app.core.config import settings
from app.core.security import create_access_token, get_password_hash, verify_password
from app.models.user import User
from app.schemas.user import LoginRequest, TokenResponse, UserCreate, UserRead
from app.services.permission_service import get_default_permission_keys, get_user_permissions


router = APIRouter()


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def register(user_in: UserCreate, db: DBSession) -> User:
    existing_user = await db.execute(select(User).where(User.email == user_in.email))
    if existing_user.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    user = User(
        full_name=user_in.full_name,
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        role=user_in.role,
        is_active=user_in.is_active,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
async def login(login_in: LoginRequest, db: DBSession) -> TokenResponse:
    result = await db.execute(select(User).where(User.email == login_in.email))
    user = result.scalar_one_or_none()
    if user is None or not verify_password(login_in.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    access_token = create_access_token(
        subject=str(user.id),
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    if user.role in {"admin", "super_admin"}:
        permissions = get_default_permission_keys()
    else:
        permissions = await get_user_permissions(db, user.id)
    return TokenResponse(access_token=access_token, user=user, permissions=permissions)
