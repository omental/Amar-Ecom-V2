from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import selectinload

from app.api.deps import DBSession, get_current_user
from app.api.utils import normalize_pagination
from app.models.access_control import ActivityLog
from app.models.user import User
from app.schemas.activity_log import ActivityLogRead


router = APIRouter(dependencies=[Depends(get_current_user)])


def _titleize(value: str | None) -> str | None:
    if not value:
        return value
    return value.replace("_", " ").title()


def _to_activity_log_read(log: ActivityLog) -> ActivityLogRead:
    return ActivityLogRead(
        id=log.id,
        user_id=log.user_id,
        action=log.action,
        module=log.module,
        entity_type=log.entity_type,
        entity_id=log.entity_id,
        message=log.message,
        ip_address=log.ip_address,
        user_agent=log.user_agent,
        created_at=log.created_at,
        user=log.user,
        userName=log.user.full_name if log.user else None,
        userEmail=log.user.email if log.user else None,
        actionLabel=_titleize(log.action),
        moduleLabel=_titleize(log.module),
        entityType=log.entity_type,
        entityId=log.entity_id,
        createdAt=log.created_at,
    )


@router.get("", response_model=list[ActivityLogRead])
async def list_activity_logs(
    db: DBSession,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    user_id: UUID | None = Query(default=None),
    module: str | None = Query(default=None),
    action: str | None = Query(default=None),
    entity_type: str | None = Query(default=None),
    search: str | None = Query(default=None),
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
) -> list[ActivityLogRead]:
    skip, limit = normalize_pagination(skip, limit)
    stmt = (
        select(ActivityLog)
        .options(selectinload(ActivityLog.user))
        .order_by(ActivityLog.created_at.desc())
    )

    if user_id is not None:
        stmt = stmt.where(ActivityLog.user_id == user_id)
    if module:
        stmt = stmt.where(ActivityLog.module == module)
    if action:
        stmt = stmt.where(ActivityLog.action == action)
    if entity_type:
        stmt = stmt.where(ActivityLog.entity_type == entity_type)
    if date_from is not None:
        stmt = stmt.where(ActivityLog.created_at >= date_from)
    if date_to is not None:
        stmt = stmt.where(ActivityLog.created_at <= date_to)
    if search:
        like_value = f"%{search}%"
        stmt = (
            stmt.join(User, ActivityLog.user_id == User.id, isouter=True)
            .where(
                or_(
                    ActivityLog.action.ilike(like_value),
                    ActivityLog.module.ilike(like_value),
                    ActivityLog.entity_type.ilike(like_value),
                    ActivityLog.message.ilike(like_value),
                    User.full_name.ilike(like_value),
                    User.email.ilike(like_value),
                )
            )
        )

    result = await db.execute(stmt.offset(skip).limit(limit))
    return [_to_activity_log_read(log) for log in result.scalars().unique().all()]
