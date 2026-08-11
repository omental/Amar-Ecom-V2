from datetime import datetime, time, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import selectinload

from app.api.deps import DBSession, get_current_user, require_permission
from app.api.utils import commit_or_409, fetch_one_or_404, normalize_pagination
from app.models.task import Task
from app.models.user import User
from app.schemas.task import TaskCreate, TaskRead, TaskSummaryRead, TaskUpdate
from app.services.activity_log_service import log_activity


router = APIRouter(dependencies=[Depends(get_current_user)])

COMPLETED_STATUS = "completed"
CANCELLED_STATUS = "cancelled"
OPEN_STATUSES = {"todo", "in_progress", "review"}


def _task_query():
    return select(Task).options(
        selectinload(Task.assigned_to),
        selectinload(Task.created_by),
    )


def _date_range_bounds(date_from: datetime | None, date_to: datetime | None) -> tuple[datetime | None, datetime | None]:
    if date_to is not None and date_to.time() == time.min:
        return date_from, date_to.replace(hour=23, minute=59, second=59, microsecond=999999)
    return date_from, date_to


def _apply_due_date_filters(stmt, due_from: datetime | None, due_to: datetime | None):
    start, end = _date_range_bounds(due_from, due_to)
    if start is not None:
        stmt = stmt.where(Task.due_date >= start)
    if end is not None:
        stmt = stmt.where(Task.due_date <= end)
    return stmt


async def _ensure_user_exists(db: DBSession, user_id: UUID | None, detail: str) -> None:
    if user_id is None:
        return
    await fetch_one_or_404(db, select(User).where(User.id == user_id), detail)


def _sync_completion_fields(task: Task, next_status: str) -> None:
    if next_status == COMPLETED_STATUS:
        if task.completed_at is None:
            task.completed_at = datetime.now(timezone.utc)
    else:
        task.completed_at = None


@router.get("/summary", response_model=TaskSummaryRead)
async def get_task_summary(
    db: DBSession,
    current_user: User = Depends(get_current_user),
) -> TaskSummaryRead:
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(
            func.count(Task.id),
            func.coalesce(func.sum(case((Task.status == "todo", 1), else_=0)), 0),
            func.coalesce(func.sum(case((Task.status == "in_progress", 1), else_=0)), 0),
            func.coalesce(func.sum(case((Task.status == "review", 1), else_=0)), 0),
            func.coalesce(func.sum(case((Task.status == COMPLETED_STATUS, 1), else_=0)), 0),
            func.coalesce(
                func.sum(
                    case(
                        (
                            (Task.due_date.is_not(None))
                            & (Task.due_date < now)
                            & (Task.status != COMPLETED_STATUS)
                            & (Task.status != CANCELLED_STATUS),
                            1,
                        ),
                        else_=0,
                    )
                ),
                0,
            ),
            func.coalesce(func.sum(case((Task.priority == "urgent", 1), else_=0)), 0),
            func.coalesce(
                func.sum(
                    case(
                        (
                            (Task.assigned_to_id == current_user.id) & Task.status.in_(OPEN_STATUSES),
                            1,
                        ),
                        else_=0,
                    )
                ),
                0,
            ),
        )
    )
    row = result.one()
    return TaskSummaryRead(
        total_tasks=row[0] or 0,
        todo_tasks=row[1] or 0,
        in_progress_tasks=row[2] or 0,
        review_tasks=row[3] or 0,
        completed_tasks=row[4] or 0,
        overdue_tasks=row[5] or 0,
        urgent_tasks=row[6] or 0,
        my_open_tasks=row[7] or 0,
    )


@router.get("", response_model=list[TaskRead])
async def list_tasks(
    db: DBSession,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    status: str | None = None,
    priority: str | None = None,
    assigned_to_id: UUID | None = None,
    due_from: datetime | None = None,
    due_to: datetime | None = None,
    search: str | None = Query(default=None, min_length=1),
) -> list[Task]:
    skip, limit = normalize_pagination(skip, limit)
    stmt = _task_query()
    if status:
        stmt = stmt.where(Task.status == status)
    if priority:
        stmt = stmt.where(Task.priority == priority)
    if assigned_to_id is not None:
        stmt = stmt.where(Task.assigned_to_id == assigned_to_id)
    stmt = _apply_due_date_filters(stmt, due_from, due_to)
    if search:
        token = f"%{search.strip()}%"
        stmt = stmt.where(or_(Task.title.ilike(token), Task.description.ilike(token)))
    result = await db.execute(stmt.order_by(Task.due_date.asc().nulls_last(), Task.created_at.desc()).offset(skip).limit(limit))
    return list(result.scalars().all())


@router.get("/{task_id}", response_model=TaskRead)
async def get_task(task_id: UUID, db: DBSession) -> Task:
    return await fetch_one_or_404(db, _task_query().where(Task.id == task_id), "Task not found")


@router.post("", response_model=TaskRead, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_permission("tasks", "create"))])
async def create_task(
    task_in: TaskCreate,
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> Task:
    await _ensure_user_exists(db, task_in.assigned_to_id, "Assigned user not found")
    task = Task(
        **task_in.model_dump(),
        created_by_id=current_user.id,
    )
    _sync_completion_fields(task, task.status)
    db.add(task)
    await db.flush()
    await log_activity(
        db,
        user_id=current_user.id,
        action="task_created",
        module="tasks",
        entity_type="task",
        entity_id=task.id,
        message=f"Created task {task.title}.",
        request=request,
    )
    if task.assigned_to_id is not None:
        await log_activity(
            db,
            user_id=current_user.id,
            action="task_assigned",
            module="tasks",
            entity_type="task",
            entity_id=task.id,
            message=f"Assigned task {task.title}.",
            request=request,
        )
    await commit_or_409(db, "Could not create task")
    return await fetch_one_or_404(db, _task_query().where(Task.id == task.id), "Task not found")


@router.patch("/{task_id}", response_model=TaskRead, dependencies=[Depends(require_permission("tasks", "update"))])
async def update_task(
    task_id: UUID,
    task_in: TaskUpdate,
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> Task:
    task = await fetch_one_or_404(db, select(Task).where(Task.id == task_id), "Task not found")
    payload = task_in.model_dump(exclude_unset=True)
    previous_status = task.status
    previous_assigned_to_id = task.assigned_to_id

    if "assigned_to_id" in payload:
        await _ensure_user_exists(db, payload["assigned_to_id"], "Assigned user not found")

    for field, value in payload.items():
        setattr(task, field, value)

    _sync_completion_fields(task, task.status)

    await log_activity(
        db,
        user_id=current_user.id,
        action="task_updated",
        module="tasks",
        entity_type="task",
        entity_id=task.id,
        message=f"Updated task {task.title}.",
        request=request,
    )
    if previous_status != task.status:
        await log_activity(
            db,
            user_id=current_user.id,
            action="task_status_changed",
            module="tasks",
            entity_type="task",
            entity_id=task.id,
            message=f"Changed task {task.title} status from {previous_status} to {task.status}.",
            request=request,
        )
    if previous_assigned_to_id != task.assigned_to_id and task.assigned_to_id is not None:
        await log_activity(
            db,
            user_id=current_user.id,
            action="task_assigned",
            module="tasks",
            entity_type="task",
            entity_id=task.id,
            message=f"Assigned task {task.title}.",
            request=request,
        )
    await commit_or_409(db, "Could not update task")
    return await fetch_one_or_404(db, _task_query().where(Task.id == task.id), "Task not found")


@router.delete("/{task_id}", response_model=TaskRead, dependencies=[Depends(require_permission("tasks", "delete"))])
async def cancel_task(
    task_id: UUID,
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> Task:
    task = await fetch_one_or_404(db, select(Task).where(Task.id == task_id), "Task not found")
    task.status = CANCELLED_STATUS
    task.completed_at = None
    await log_activity(
        db,
        user_id=current_user.id,
        action="task_cancelled",
        module="tasks",
        entity_type="task",
        entity_id=task.id,
        message=f"Cancelled task {task.title}.",
        request=request,
    )
    await commit_or_409(db, "Could not cancel task")
    return await fetch_one_or_404(db, _task_query().where(Task.id == task.id), "Task not found")
