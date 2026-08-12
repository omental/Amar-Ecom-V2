from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select

from app.api.deps import DBSession, get_current_user, get_tenant_context
from app.core.tenant import TenantContext
from app.models.tenant import OrganizationMember
from app.api.utils import commit_or_409, fetch_one_or_404
from app.models.user import User
from app.schemas.permission import (
    LegacyPermissionMatrixRead,
    LegacyPermissionModuleRead,
    PermissionRead,
    UserLegacyPermissionUpdate,
    UserPermissionAssignmentRead,
    UserPermissionUpdate,
)
from app.services.activity_log_service import log_activity
from app.services.notification_service import notify_user
from app.services.permission_service import (
    build_legacy_permissions_map,
    build_permission_keys_from_legacy_map,
    ensure_default_permissions,
    get_all_permissions,
    get_user_permissions,
    LEGACY_PERMISSION_KEY_MAP,
    LEGACY_PERMISSION_LABELS,
    set_user_permissions,
)


router = APIRouter(dependencies=[Depends(get_current_user)])


def _organization_user(ctx: TenantContext, user_id: UUID):
    return select(User).join(OrganizationMember, OrganizationMember.user_id == User.id).where(
        User.id == user_id,
        OrganizationMember.organization_id == ctx.organization.id,
        OrganizationMember.status == "active",
    )


def _ensure_admin(user: User) -> None:
    if user.role not in {"admin", "super_admin"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")


def _assignment_response(
    user: User,
    assigned_permission_keys: list[str],
    assigned_permission_ids: list[UUID],
) -> UserPermissionAssignmentRead:
    legacy_permissions = build_legacy_permissions_map(assigned_permission_keys, user.role)
    return UserPermissionAssignmentRead(
        user_id=user.id,
        assigned_permission_ids=assigned_permission_ids,
        assigned_permission_keys=assigned_permission_keys,
        has_full_access=user.role in {"admin", "super_admin"},
        legacy_permissions=legacy_permissions,
        legacyPermissions=legacy_permissions,
    )


@router.get("/permissions", response_model=list[PermissionRead])
async def list_permissions(db: DBSession) -> list:
    return await get_all_permissions(db)


@router.get("/permissions/legacy-matrix", response_model=LegacyPermissionMatrixRead)
async def get_legacy_permissions_matrix() -> LegacyPermissionMatrixRead:
    modules = [
        LegacyPermissionModuleRead(
            module=module,
            label=LEGACY_PERMISSION_LABELS.get(module, module.replace("_", " ").title()),
            permission_keys=sorted(LEGACY_PERMISSION_KEY_MAP.get(module, set())),
        )
        for module in LEGACY_PERMISSION_KEY_MAP
    ]
    return LegacyPermissionMatrixRead(modules=modules)


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
async def get_permissions_for_user(user_id: UUID, db: DBSession, ctx: TenantContext = Depends(get_tenant_context)) -> UserPermissionAssignmentRead:
    user = await fetch_one_or_404(db, _organization_user(ctx, user_id), "User not found")
    assigned_permission_keys = await get_user_permissions(db, user.id)
    all_permissions = await get_all_permissions(db)
    key_to_id = {f"{permission.module}.{permission.action}": permission.id for permission in all_permissions}
    assigned_permission_ids = [key_to_id[key] for key in assigned_permission_keys if key in key_to_id]
    return _assignment_response(user, assigned_permission_keys, assigned_permission_ids)


@router.patch("/users/{user_id}/permissions", response_model=UserPermissionAssignmentRead)
async def update_user_permissions(
    user_id: UUID,
    permissions_in: UserPermissionUpdate,
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
    ctx: TenantContext = Depends(get_tenant_context),
) -> UserPermissionAssignmentRead:
    _ensure_admin(current_user)
    user = await fetch_one_or_404(db, _organization_user(ctx, user_id), "User not found")
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
    await notify_user(
        db,
        user_id=user.id,
        title="Permissions updated",
        message=f"Your module access was updated by {current_user.full_name}.",
        notification_type="info",
        link="/dashboard/team",
        module="team",
        metadata={
            "user_id": str(user.id),
            "updated_by_id": str(current_user.id),
            "legacy_permissions": build_legacy_permissions_map(assigned_permission_keys, user.role),
        },
    )
    await commit_or_409(db, "Could not update user permissions")

    return _assignment_response(user, assigned_permission_keys, assigned_permission_ids)


@router.patch("/users/{user_id}/legacy-permissions", response_model=UserPermissionAssignmentRead)
async def update_user_legacy_permissions(
    user_id: UUID,
    permissions_in: UserLegacyPermissionUpdate,
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
    ctx: TenantContext = Depends(get_tenant_context),
) -> UserPermissionAssignmentRead:
    _ensure_admin(current_user)
    user = await fetch_one_or_404(db, _organization_user(ctx, user_id), "User not found")
    assigned_permission_keys = await set_user_permissions(
        db,
        user.id,
        permission_keys=build_permission_keys_from_legacy_map(permissions_in.permissions),
    )
    all_permissions = await get_all_permissions(db)
    key_to_id = {f"{permission.module}.{permission.action}": permission.id for permission in all_permissions}
    assigned_permission_ids = [key_to_id[key] for key in assigned_permission_keys if key in key_to_id]

    await log_activity(
        db,
        user_id=current_user.id,
        action="legacy_permissions_updated",
        module="team",
        entity_type="user",
        entity_id=user.id,
        message=f"Updated legacy module permissions for {user.full_name}.",
        request=request,
    )
    await notify_user(
        db,
        user_id=user.id,
        title="Permissions updated",
        message=f"Your module access was updated by {current_user.full_name}.",
        notification_type="info",
        link="/dashboard/team",
        module="team",
        metadata={
            "user_id": str(user.id),
            "updated_by_id": str(current_user.id),
            "legacy_permissions": build_legacy_permissions_map(assigned_permission_keys, user.role),
        },
    )
    await commit_or_409(db, "Could not update legacy user permissions")

    return _assignment_response(user, assigned_permission_keys, assigned_permission_ids)
