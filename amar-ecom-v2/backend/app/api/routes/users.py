from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import DBSession, get_current_user
from app.api.utils import commit_or_409, ensure_unique, fetch_one_or_404, normalize_pagination
from app.core.security import get_password_hash
from app.models.access_control import UserPermission
from app.models.user import User
from app.schemas.user import UserCreate, UserRead, UserUpdate
from app.services.activity_log_service import log_activity
from app.services.permission_service import (
    build_legacy_permissions_map,
    build_permission_keys_from_legacy_map,
    get_default_permission_keys,
    set_user_permissions,
)


router = APIRouter(dependencies=[Depends(get_current_user)])


def _permission_keys_from_user(user: User) -> list[str]:
    if user.role in {"admin", "super_admin"}:
        return get_default_permission_keys()
    return sorted(
        {
            f"{assignment.permission.module}.{assignment.permission.action}"
            for assignment in user.permission_assignments
            if assignment.is_allowed and assignment.permission is not None
        }
    )


def _to_user_read(user: User) -> UserRead:
    permission_keys = _permission_keys_from_user(user)
    legacy_permissions = build_legacy_permissions_map(permission_keys, user.role)
    pending_approval = not user.is_active
    status_label = "pending" if pending_approval else "active"
    has_full_access = user.role in {"admin", "super_admin"}

    return UserRead(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        last_login=user.last_login,
        created_at=user.created_at,
        updated_at=user.updated_at,
        uid=str(user.id),
        name=user.full_name,
        fullName=user.full_name,
        displayName=user.full_name,
        active=user.is_active,
        isActive=user.is_active,
        status=status_label,
        permissions=permission_keys,
        legacy_permissions=legacy_permissions,
        legacyPermissions=legacy_permissions,
        has_full_access=has_full_access,
        hasFullAccess=has_full_access,
        pendingApproval=pending_approval,
        lastLogin=user.last_login,
        photo_url=None,
        photoURL=None,
        createdAt=user.created_at,
        updatedAt=user.updated_at,
    )


def _normalize_permission_input(permissions: list[str] | dict[str, bool] | None) -> list[str] | None:
    if permissions is None:
        return None
    if isinstance(permissions, dict):
        return build_permission_keys_from_legacy_map(permissions)
    return permissions


def _user_with_permissions_stmt():
    return select(User).options(selectinload(User.permission_assignments).selectinload(UserPermission.permission))


@router.get("", response_model=list[UserRead])
async def list_users(
    db: DBSession,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
) -> list[UserRead]:
    skip, limit = normalize_pagination(skip, limit)
    result = await db.execute(
        _user_with_permissions_stmt().order_by(User.created_at.desc()).offset(skip).limit(limit)
    )
    return [_to_user_read(user) for user in result.scalars().all()]


@router.get("/{user_id}", response_model=UserRead)
async def get_user(user_id: UUID, db: DBSession) -> UserRead:
    user = await fetch_one_or_404(db, _user_with_permissions_stmt().where(User.id == user_id), "User not found")
    return _to_user_read(user)


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_in: UserCreate,
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> UserRead:
    await ensure_unique(db, User, "email", user_in.email, "Email already registered")
    permission_keys = _normalize_permission_input(user_in.permissions)

    user = User(
        full_name=user_in.full_name,
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        role=user_in.role,
        is_active=user_in.is_active,
    )
    db.add(user)
    await db.flush()

    if permission_keys is not None:
        await set_user_permissions(db, user.id, permission_keys=permission_keys)

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

    refreshed_user = await fetch_one_or_404(
        db,
        _user_with_permissions_stmt().where(User.id == user.id),
        "User not found",
    )
    return _to_user_read(refreshed_user)


@router.patch("/{user_id}", response_model=UserRead)
async def update_user(
    user_id: UUID,
    user_in: UserUpdate,
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> UserRead:
    user = await fetch_one_or_404(db, _user_with_permissions_stmt().where(User.id == user_id), "User not found")
    payload = user_in.model_dump(exclude_unset=True)
    previous_is_active = user.is_active
    permission_input = _normalize_permission_input(payload.pop("permissions", None))
    payload.pop("photo_url", None)

    if "email" in payload:
        await ensure_unique(db, User, "email", payload["email"], "Email already registered", exclude_id=user.id)

    if "password" in payload:
        user.hashed_password = get_password_hash(payload.pop("password"))

    for field, value in payload.items():
        setattr(user, field, value)

    if permission_input is not None:
        await set_user_permissions(db, user.id, permission_keys=permission_input)

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

    refreshed_user = await fetch_one_or_404(
        db,
        _user_with_permissions_stmt().where(User.id == user.id),
        "User not found",
    )
    return _to_user_read(refreshed_user)
