from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import DBSession, get_current_user
from app.api.utils import normalize_pagination
from app.models.access_control import ActivityLog
from app.schemas.activity_log import ActivityLogRead


router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[ActivityLogRead])
async def list_activity_logs(
    db: DBSession,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    user_id: UUID | None = Query(default=None),
    module: str | None = Query(default=None),
    entity_type: str | None = Query(default=None),
) -> list[ActivityLog]:
    skip, limit = normalize_pagination(skip, limit)
    stmt = select(ActivityLog).options(selectinload(ActivityLog.user)).order_by(ActivityLog.created_at.desc())

    if user_id is not None:
        stmt = stmt.where(ActivityLog.user_id == user_id)
    if module:
        stmt = stmt.where(ActivityLog.module == module)
    if entity_type:
        stmt = stmt.where(ActivityLog.entity_type == entity_type)

    result = await db.execute(stmt.offset(skip).limit(limit))
    return list(result.scalars().all())
