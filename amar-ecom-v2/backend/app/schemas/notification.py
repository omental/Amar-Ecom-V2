from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import ORMBaseSchema


class NotificationCreate(BaseModel):
    user_id: UUID | None = None
    title: str
    message: str
    type: str = Field(default="info", max_length=100)
    link: str | None = None
    module: str | None = None
    metadata: dict | None = None


class NotificationRead(ORMBaseSchema):
    id: UUID
    user_id: UUID | None
    title: str
    message: str
    type: str
    read: bool
    created_at: datetime
    link: str | None
    module: str | None
    metadata: dict | None = Field(default=None, validation_alias="metadata_json")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class NotificationUpdateReadState(BaseModel):
    read: bool = True


class NotificationUnreadCount(BaseModel):
    unread_count: int
