from collections.abc import Sequence
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import Select, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession


def normalize_pagination(skip: int = 0, limit: int = 20) -> tuple[int, int]:
    return max(skip, 0), min(max(limit, 1), 100)


async def fetch_one_or_404(db: AsyncSession, stmt: Select[Any], detail: str):
    result = await db.execute(stmt)
    instance = result.scalar_one_or_none()
    if instance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)
    return instance


async def ensure_unique(db: AsyncSession, model: type[Any], field_name: str, value: Any, detail: str, exclude_id: Any | None = None) -> None:
    if value is None:
        return
    column = getattr(model, field_name)
    stmt = select(model).where(column == value)
    if exclude_id is not None:
        stmt = stmt.where(model.id != exclude_id)
    existing = await db.execute(stmt)
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail)


def ensure_no_duplicates(values: Sequence[str], detail: str) -> None:
    normalized = [value.strip().lower() for value in values]
    if len(normalized) != len(set(normalized)):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail)


async def commit_or_409(db: AsyncSession, detail: str) -> None:
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail) from exc
