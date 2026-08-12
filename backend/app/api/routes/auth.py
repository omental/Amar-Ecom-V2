from datetime import datetime, timedelta, timezone
import os

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.api.deps import DBSession, get_current_user
from app.core.config import settings
from app.core.security import create_access_token, get_password_hash, verify_password
from app.core.tenant import activate_tenant, deactivate_tenant
from app.models.user import User
from app.schemas.user import AuthMeResponse, LoginRequest, TokenResponse, UserCreate, UserRead
from app.services.permission_service import (
    build_legacy_permissions_map,
    get_default_permission_keys,
    get_user_permissions,
)
from app.services.notification_service import notify_admins
from app.services.tenant_service import add_user_to_primary_store


router = APIRouter()


@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def register(user_in: UserCreate, db: DBSession) -> User:
    if os.environ.get("AMAR_ECOM_TESTING") != "1":
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Use the merchant signup flow or an organization invitation",
        )
    existing_user = await db.execute(select(User).where(User.email == user_in.email))
    if existing_user.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    user = User(
        full_name=user_in.full_name,
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        role=user_in.role if user_in.role in {"admin", "staff"} else "staff",
        is_active=user_in.is_active,
        email_verified_at=datetime.now(timezone.utc),
    )
    db.add(user)
    await db.flush()
    store = await add_user_to_primary_store(db, user)
    await db.commit()
    await db.refresh(user)

    if not user.is_active:
        tokens = activate_tenant(store_id=store.id, organization_id=store.organization_id)
        try:
            await notify_admins(
                db,
                title="New user pending approval",
                message=f"{user.full_name} registered and is waiting for approval.",
                notification_type="info",
                link="/dashboard/users",
                module="team",
                metadata={"user_id": str(user.id), "email": user.email, "role": user.role},
            )
        finally:
            deactivate_tenant(tokens)
        await db.commit()

    return user


@router.post("/login", response_model=TokenResponse)
async def login(login_in: LoginRequest, db: DBSession) -> TokenResponse:
    result = await db.execute(select(User).where(User.email == login_in.email))
    user = result.scalar_one_or_none()
    if user is None or not verify_password(login_in.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    if user.email_verified_at is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Email verification required")

    access_token = create_access_token(
        subject=str(user.id),
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    if user.role in {"admin", "super_admin"}:
        permissions = get_default_permission_keys()
    else:
        permissions = await get_user_permissions(db, user.id)
    user.last_login = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(user)
    return TokenResponse(access_token=access_token, user=user, permissions=permissions)


@router.get("/me", response_model=AuthMeResponse)
async def auth_me(
    db: DBSession,
    current_user: User = Depends(get_current_user),
) -> AuthMeResponse:
    if current_user.role in {"admin", "super_admin"}:
        permissions = get_default_permission_keys()
    else:
        permissions = await get_user_permissions(db, current_user.id)

    legacy_permissions = build_legacy_permissions_map(permissions, current_user.role)
    user_id = str(current_user.id)

    return AuthMeResponse(
        id=current_user.id,
        uid=user_id,
        name=current_user.full_name,
        full_name=current_user.full_name,
        email=current_user.email,
        role=current_user.role,
        active=current_user.is_active,
        is_active=current_user.is_active,
        permissions=permissions,
        legacy_permissions=legacy_permissions,
        has_full_access=current_user.role in {"admin", "super_admin"},
        last_login=current_user.last_login,
        lastLogin=current_user.last_login,
        created_at=current_user.created_at,
        createdAt=current_user.created_at,
        display_name=current_user.full_name,
        photo_url=None,
        photoURL=None,
    )
