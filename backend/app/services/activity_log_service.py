from uuid import UUID

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.access_control import ActivityLog


async def log_activity(
    db: AsyncSession,
    *,
    user_id: UUID | None,
    action: str,
    module: str | None,
    entity_type: str | None,
    entity_id: str | UUID | None,
    message: str,
    request: Request | None = None,
) -> ActivityLog:
    log = ActivityLog(
        user_id=user_id,
        action=action,
        module=module,
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id is not None else None,
        message=message,
        ip_address=request.client.host if request and request.client else None,
        user_agent=request.headers.get("user-agent") if request else None,
    )
    db.add(log)
    await db.flush()
    return log
