from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.schemas.common import ORMBaseSchema


class PermissionRead(ORMBaseSchema):
    id: UUID
    module: str
    action: str
    label: str | None
    created_at: datetime


class UserPermissionRead(ORMBaseSchema):
    id: UUID
    user_id: UUID
    permission_id: UUID
    is_allowed: bool
    created_at: datetime
    updated_at: datetime
    permission: PermissionRead


class UserPermissionUpdate(BaseModel):
    permission_ids: list[UUID] | None = None
    permission_keys: list[str] | None = None


class UserPermissionAssignmentRead(BaseModel):
    user_id: UUID
    assigned_permission_ids: list[UUID]
    assigned_permission_keys: list[str]
    has_full_access: bool
