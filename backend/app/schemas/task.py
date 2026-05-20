from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import ORMBaseSchema
from app.schemas.user import UserRead


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    status: str = Field(default="todo", min_length=1, max_length=50)
    priority: str = Field(default="medium", min_length=1, max_length=50)
    assigned_to_id: UUID | None = None
    related_module: str | None = Field(default=None, max_length=100)
    related_entity_type: str | None = Field(default=None, max_length=100)
    related_entity_id: str | None = Field(default=None, max_length=100)
    due_date: datetime | None = None


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    status: str | None = Field(default=None, min_length=1, max_length=50)
    priority: str | None = Field(default=None, min_length=1, max_length=50)
    assigned_to_id: UUID | None = None
    related_module: str | None = Field(default=None, max_length=100)
    related_entity_type: str | None = Field(default=None, max_length=100)
    related_entity_id: str | None = Field(default=None, max_length=100)
    due_date: datetime | None = None


class TaskRead(ORMBaseSchema):
    id: UUID
    title: str
    description: str | None
    status: str
    priority: str
    assigned_to_id: UUID | None
    created_by_id: UUID | None
    related_module: str | None
    related_entity_type: str | None
    related_entity_id: str | None
    due_date: datetime | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime
    assigned_to: UserRead | None = None
    created_by: UserRead | None = None


class TaskSummaryRead(BaseModel):
    total_tasks: int
    todo_tasks: int
    in_progress_tasks: int
    review_tasks: int
    completed_tasks: int
    overdue_tasks: int
    urgent_tasks: int
    my_open_tasks: int
