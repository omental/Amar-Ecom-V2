from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.access_control import Permission, UserPermission
from app.models.user import User


DEFAULT_PERMISSION_DEFINITIONS = [
    ("dashboard", "view"),
    ("reports", "view"),
    ("orders", "view"),
    ("orders", "create"),
    ("orders", "update"),
    ("orders", "delete"),
    ("products", "view"),
    ("products", "create"),
    ("products", "update"),
    ("products", "delete"),
    ("inventory", "view"),
    ("inventory", "create"),
    ("inventory", "update"),
    ("inventory", "delete"),
    ("customers", "view"),
    ("customers", "create"),
    ("customers", "update"),
    ("customers", "delete"),
    ("logistics", "view"),
    ("couriers", "view"),
    ("woocommerce", "view"),
    ("woocommerce", "import"),
    ("pos", "view"),
    ("pos", "checkout"),
    ("pos", "refund"),
    ("returns", "view"),
    ("returns", "create"),
    ("returns", "update"),
    ("returns", "delete"),
    ("shipments", "view"),
    ("shipments", "create"),
    ("shipments", "update"),
    ("shipments", "delete"),
    ("finance", "view"),
    ("hr", "view"),
    ("settings", "view"),
    ("settings", "update"),
    ("online_store", "view"),
    ("online_store", "update"),
    ("team", "view"),
    ("team", "create"),
    ("team", "update"),
    ("users", "view"),
    ("permissions", "view"),
]

LEGACY_PERMISSION_MODULES = (
    "dashboard",
    "orders",
    "inventory",
    "crm",
    "logistics",
    "reports",
    "finance",
    "hr",
    "settings",
    "team",
    "pos",
)

LEGACY_PERMISSION_LABELS = {
    "dashboard": "Dashboard",
    "orders": "Orders",
    "inventory": "Inventory",
    "crm": "CRM",
    "logistics": "Logistics",
    "reports": "Reports",
    "finance": "Finance",
    "hr": "HR",
    "settings": "Settings",
    "team": "Team",
    "pos": "POS",
}

LEGACY_PERMISSION_KEY_MAP = {
    "dashboard": {"dashboard.view"},
    "orders": {"orders.view"},
    "inventory": {"inventory.view", "products.view"},
    "crm": {"customers.view"},
    "logistics": {"logistics.view", "shipments.view", "couriers.view"},
    "reports": {"reports.view"},
    "finance": {"finance.view"},
    "hr": {"hr.view"},
    "settings": {"settings.view"},
    "team": {"team.view", "users.view", "permissions.view"},
    "pos": {"pos.view"},
}


def permission_key(module: str, action: str) -> str:
    return f"{module}.{action}"


def get_default_permission_keys() -> list[str]:
    return [permission_key(module, action) for module, action in DEFAULT_PERMISSION_DEFINITIONS]


def build_legacy_permissions_map(permission_keys: list[str], role: str | None = None) -> dict[str, bool]:
    if role in {"admin", "super_admin"}:
        return {module: True for module in LEGACY_PERMISSION_MODULES}

    permission_key_set = set(permission_keys)
    return {
        module: any(required_key in permission_key_set for required_key in LEGACY_PERMISSION_KEY_MAP.get(module, set()))
        for module in LEGACY_PERMISSION_MODULES
    }


def build_permission_keys_from_legacy_map(legacy_permissions: dict[str, bool]) -> list[str]:
    permission_keys: set[str] = set()
    for module, enabled in legacy_permissions.items():
        if enabled:
            permission_keys.update(LEGACY_PERMISSION_KEY_MAP.get(module, set()))
    return sorted(permission_keys)


async def ensure_default_permissions(db: AsyncSession) -> list[Permission]:
    result = await db.execute(select(Permission))
    existing_permissions = list(result.scalars().all())
    existing_keys = {permission_key(permission.module, permission.action) for permission in existing_permissions}

    created = False
    for module, action in DEFAULT_PERMISSION_DEFINITIONS:
        key = permission_key(module, action)
        if key in existing_keys:
            continue

        db.add(
            Permission(
                module=module,
                action=action,
                label=f"{module.title()} {action.title()}",
            )
        )
        created = True

    if created:
        await db.flush()
        result = await db.execute(select(Permission).order_by(Permission.module.asc(), Permission.action.asc()))
        return list(result.scalars().all())

    return sorted(existing_permissions, key=lambda item: (item.module, item.action))


async def get_all_permissions(db: AsyncSession) -> list[Permission]:
    result = await db.execute(select(Permission).order_by(Permission.module.asc(), Permission.action.asc()))
    return list(result.scalars().all())


async def get_user_permissions(db: AsyncSession, user_id: UUID) -> list[str]:
    result = await db.execute(
        select(UserPermission)
        .where(UserPermission.user_id == user_id, UserPermission.is_allowed.is_(True))
        .options(selectinload(UserPermission.permission))
    )
    assignments = list(result.scalars().all())
    return sorted(
        [
        permission_key(assignment.permission.module, assignment.permission.action)
        for assignment in assignments
        if assignment.permission is not None
        ]
    )


async def set_user_permissions(
    db: AsyncSession,
    user_id: UUID,
    *,
    permission_ids: list[UUID] | None = None,
    permission_keys: list[str] | None = None,
) -> list[str]:
    all_permissions = await ensure_default_permissions(db)
    permission_map_by_id = {permission.id: permission for permission in all_permissions}
    permission_map_by_key = {permission_key(permission.module, permission.action): permission for permission in all_permissions}

    selected_permissions: list[Permission] = []
    if permission_ids:
        selected_permissions.extend(
            permission_map_by_id[permission_id]
            for permission_id in permission_ids
            if permission_id in permission_map_by_id
        )
    if permission_keys:
        selected_permissions.extend(
            permission_map_by_key[key]
            for key in permission_keys
            if key in permission_map_by_key
        )

    unique_permissions = {permission.id: permission for permission in selected_permissions}.values()

    existing_result = await db.execute(select(UserPermission).where(UserPermission.user_id == user_id))
    existing_assignments = list(existing_result.scalars().all())
    for assignment in existing_assignments:
        await db.delete(assignment)
    if existing_assignments:
        await db.flush()

    for permission in unique_permissions:
        db.add(
            UserPermission(
                user_id=user_id,
                permission_id=permission.id,
                is_allowed=True,
            )
        )

    await db.flush()
    return sorted(
        [permission_key(permission.module, permission.action) for permission in unique_permissions]
    )


async def user_has_permission(db: AsyncSession, user: User, module: str, action: str) -> bool:
    if user.role in {"admin", "super_admin"}:
        return True

    permissions = await get_user_permissions(db, user.id)
    return permission_key(module, action) in permissions
