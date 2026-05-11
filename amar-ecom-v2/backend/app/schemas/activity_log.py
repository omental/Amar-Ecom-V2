from datetime import datetime
from uuid import UUID

from app.schemas.common import ORMBaseSchema
from app.schemas.user import UserRead


class ActivityLogRead(ORMBaseSchema):
    id: UUID
    user_id: UUID | None
    action: str
    module: str | None
    entity_type: str | None
    entity_id: str | None
    message: str
    ip_address: str | None
    user_agent: str | None
    created_at: datetime
    user: UserRead | None = None
