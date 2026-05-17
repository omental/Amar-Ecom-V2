from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select

from app.api.deps import DBSession, get_current_user
from app.api.utils import commit_or_409, fetch_one_or_404, normalize_pagination
from app.models.notification import Notification
from app.models.user import User
from app.schemas.notification import (
    NotificationCreate,
    NotificationRead,
    NotificationUnreadCount,
)
from app.services.notification_service import create_notification


router = APIRouter(dependencies=[Depends(get_current_user)])


def _base_notification_visibility_stmt(current_user: User):
    return select(Notification).where(
        or_(
            Notification.user_id == current_user.id,
            Notification.user_id.is_(None),
        )
    )


def _ensure_admin(user: User) -> None:
    if user.role not in {"admin", "super_admin"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")


@router.get("", response_model=list[NotificationRead])
async def list_notifications(
    db: DBSession,
    current_user: User = Depends(get_current_user),
    unread_only: bool = Query(default=False),
    type: str | None = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
) -> list[Notification]:
    skip, limit = normalize_pagination(skip, limit)
    stmt = _base_notification_visibility_stmt(current_user)
    if unread_only:
        stmt = stmt.where(Notification.read.is_(False))
    if type:
        stmt = stmt.where(Notification.type == type)
    stmt = stmt.order_by(Notification.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get("/unread-count", response_model=NotificationUnreadCount)
async def unread_count(
    db: DBSession,
    current_user: User = Depends(get_current_user),
) -> NotificationUnreadCount:
    stmt = select(func.count(Notification.id)).where(
        or_(Notification.user_id == current_user.id, Notification.user_id.is_(None)),
        Notification.read.is_(False),
    )
    result = await db.execute(stmt)
    return NotificationUnreadCount(unread_count=result.scalar_one() or 0)


@router.patch("/mark-all-read", response_model=NotificationUnreadCount)
async def mark_all_notifications_read(
    db: DBSession,
    current_user: User = Depends(get_current_user),
) -> NotificationUnreadCount:
    result = await db.execute(
        _base_notification_visibility_stmt(current_user).where(Notification.read.is_(False))
    )
    notifications = list(result.scalars().all())
    for notification in notifications:
        notification.read = True
    await commit_or_409(db, "Could not update notifications")
    return NotificationUnreadCount(unread_count=0)


@router.patch("/{notification_id}/read", response_model=NotificationRead)
async def mark_notification_read(
    notification_id: UUID,
    db: DBSession,
    current_user: User = Depends(get_current_user),
) -> Notification:
    stmt = _base_notification_visibility_stmt(current_user).where(Notification.id == notification_id)
    notification = await fetch_one_or_404(db, stmt, "Notification not found")
    notification.read = True
    await commit_or_409(db, "Could not update notification")
    await db.refresh(notification)
    return notification


@router.post("", response_model=NotificationRead, status_code=status.HTTP_201_CREATED)
async def create_notification_endpoint(
    notification_in: NotificationCreate,
    db: DBSession,
    current_user: User = Depends(get_current_user),
) -> Notification:
    _ensure_admin(current_user)
    notification = await create_notification(
        db,
        user_id=notification_in.user_id,
        title=notification_in.title,
        message=notification_in.message,
        notification_type=notification_in.type,
        link=notification_in.link,
        module=notification_in.module,
        metadata=notification_in.metadata,
    )
    await commit_or_409(db, "Could not create notification")
    await db.refresh(notification)
    return notification
