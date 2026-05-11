from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select

from app.api.deps import DBSession, get_current_user
from app.api.utils import commit_or_409, fetch_one_or_404
from app.models.user import User
from app.schemas.permission import (
    PermissionRead,
    UserPermissionAssignmentRead,
    UserPermissionUpdate,
)
from app.services.activity_log_service import log_activity
from app.services.permission_service import (
    ensure_default_permissions,
    get_all_permissions,
    get_user_permissions,
    set_user_permissions,
)


router = APIRouter(dependencies=[Depends(get_current_user)])


def _ensure_admin(user: User) -> None:
    if user.role not in {"admin", "super_admin"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")


@router.get("/permissions", response_model=list[PermissionRead])
async def list_permissions(db: DBSession) -> list:
    return await get_all_permissions(db)


@router.post("/permissions/seed-defaults", response_model=list[PermissionRead], status_code=status.HTTP_201_CREATED)
async def seed_default_permissions(
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> list:
    _ensure_admin(current_user)
    permissions = await ensure_default_permissions(db)
    await log_activity(
        db,
        user_id=current_user.id,
        action="permissions_seeded",
        module="team",
        entity_type="permission",
        entity_id=None,
        message="Seeded default module permissions.",
        request=request,
    )
    await commit_or_409(db, "Could not seed default permissions")
    return permissions


@router.get("/users/{user_id}/permissions", response_model=UserPermissionAssignmentRead)
async def get_permissions_for_user(user_id: UUID, db: DBSession) -> UserPermissionAssignmentRead:
    user = await fetch_one_or_404(db, select(User).where(User.id == user_id), "User not found")
    assigned_permission_keys = await get_user_permissions(db, user.id)
    all_permissions = await get_all_permissions(db)
    key_to_id = {f"{permission.module}.{permission.action}": permission.id for permission in all_permissions}
    assigned_permission_ids = [key_to_id[key] for key in assigned_permission_keys if key in key_to_id]
    return UserPermissionAssignmentRead(
        user_id=user.id,
        assigned_permission_ids=assigned_permission_ids,
        assigned_permission_keys=assigned_permission_keys,
        has_full_access=user.role in {"admin", "super_admin"},
    )


@router.patch("/users/{user_id}/permissions", response_model=UserPermissionAssignmentRead)
async def update_user_permissions(
    user_id: UUID,
    permissions_in: UserPermissionUpdate,
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> UserPermissionAssignmentRead:
    _ensure_admin(current_user)
    user = await fetch_one_or_404(db, select(User).where(User.id == user_id), "User not found")
    assigned_permission_keys = await set_user_permissions(
        db,
        user.id,
        permission_ids=permissions_in.permission_ids,
        permission_keys=permissions_in.permission_keys,
    )
    all_permissions = await get_all_permissions(db)
    key_to_id = {f"{permission.module}.{permission.action}": permission.id for permission in all_permissions}
    assigned_permission_ids = [key_to_id[key] for key in assigned_permission_keys if key in key_to_id]

    await log_activity(
        db,
        user_id=current_user.id,
        action="permissions_updated",
        module="team",
        entity_type="user",
        entity_id=user.id,
        message=f"Updated permissions for {user.full_name}.",
        request=request,
    )
    await commit_or_409(db, "Could not update user permissions")

    return UserPermissionAssignmentRead(
        user_id=user.id,
        assigned_permission_ids=assigned_permission_ids,
        assigned_permission_keys=assigned_permission_keys,
        has_full_access=user.role in {"admin", "super_admin"},
    )
