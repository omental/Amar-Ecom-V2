from collections.abc import Iterable
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification
from app.models.user import User
from app.models.tenant import OrganizationMember
from app.core.tenant import current_organization_id


async def create_notification(
    db: AsyncSession,
    *,
    user_id: UUID | None = None,
    title: str,
    message: str,
    notification_type: str = "info",
    link: str | None = None,
    module: str | None = None,
    metadata: dict | None = None,
) -> Notification:
    notification = Notification(
        user_id=user_id,
        title=title,
        message=message,
        type=notification_type,
        read=False,
        link=link,
        module=module,
        metadata_json=metadata,
    )
    db.add(notification)
    await db.flush()
    return notification


async def notify_user(
    db: AsyncSession,
    *,
    user_id: UUID,
    title: str,
    message: str,
    notification_type: str = "info",
    link: str | None = None,
    module: str | None = None,
    metadata: dict | None = None,
) -> Notification:
    return await create_notification(
        db,
        user_id=user_id,
        title=title,
        message=message,
        notification_type=notification_type,
        link=link,
        module=module,
        metadata=metadata,
    )


async def notify_admins(
    db: AsyncSession,
    *,
    title: str,
    message: str,
    notification_type: str = "info",
    link: str | None = None,
    module: str | None = None,
    metadata: dict | None = None,
) -> list[Notification]:
    organization_id = current_organization_id.get()
    stmt = select(User.id).where(User.role.in_(("admin", "super_admin")))
    if organization_id is not None:
        stmt = stmt.join(OrganizationMember, OrganizationMember.user_id == User.id).where(
            OrganizationMember.organization_id == organization_id,
            OrganizationMember.status == "active",
        )
    result = await db.execute(stmt)
    admin_ids = list(result.scalars().all())
    return await notify_users(
        db,
        user_ids=admin_ids,
        title=title,
        message=message,
        notification_type=notification_type,
        link=link,
        module=module,
        metadata=metadata,
    )


async def notify_users(
    db: AsyncSession,
    *,
    user_ids: Iterable[UUID],
    title: str,
    message: str,
    notification_type: str = "info",
    link: str | None = None,
    module: str | None = None,
    metadata: dict | None = None,
) -> list[Notification]:
    notifications: list[Notification] = []
    for user_id in user_ids:
        notifications.append(
            await create_notification(
                db,
                user_id=user_id,
                title=title,
                message=message,
                notification_type=notification_type,
                link=link,
                module=module,
                metadata=metadata,
            )
        )
    return notifications
