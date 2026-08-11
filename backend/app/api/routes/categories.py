from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy import select

from app.api.deps import DBSession, get_current_user, require_permission
from app.api.utils import commit_or_409, ensure_unique, fetch_one_or_404, normalize_pagination
from app.models.category import Category
from app.schemas.category import CategoryCreate, CategoryRead, CategoryUpdate


router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[CategoryRead])
async def list_categories(
    db: DBSession,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
) -> list[Category]:
    skip, limit = normalize_pagination(skip, limit)
    result = await db.execute(select(Category).order_by(Category.created_at.desc()).offset(skip).limit(limit))
    return list(result.scalars().all())


@router.get("/{category_id}", response_model=CategoryRead)
async def get_category(category_id: UUID, db: DBSession) -> Category:
    return await fetch_one_or_404(db, select(Category).where(Category.id == category_id), "Category not found")


@router.post("", response_model=CategoryRead, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_permission("categories", "create"))])
async def create_category(category_in: CategoryCreate, db: DBSession) -> Category:
    await ensure_unique(db, Category, "slug", category_in.slug, "Category slug already exists")
    category = Category(**category_in.model_dump())
    db.add(category)
    await commit_or_409(db, "Could not create category")
    await db.refresh(category)
    return category


@router.patch("/{category_id}", response_model=CategoryRead, dependencies=[Depends(require_permission("categories", "update"))])
async def update_category(category_id: UUID, category_in: CategoryUpdate, db: DBSession) -> Category:
    category = await fetch_one_or_404(db, select(Category).where(Category.id == category_id), "Category not found")
    payload = category_in.model_dump(exclude_unset=True)

    if "slug" in payload:
        await ensure_unique(db, Category, "slug", payload["slug"], "Category slug already exists", exclude_id=category.id)

    for field, value in payload.items():
        setattr(category, field, value)

    await commit_or_409(db, "Could not update category")
    await db.refresh(category)
    return category


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_permission("categories", "delete"))])
async def delete_category(category_id: UUID, db: DBSession) -> Response:
    category = await fetch_one_or_404(db, select(Category).where(Category.id == category_id), "Category not found")
    await db.delete(category)
    await commit_or_409(db, "Category cannot be deleted because it is in use")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
