from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy import select

from app.api.deps import DBSession, get_current_user
from app.api.utils import commit_or_409, ensure_unique, fetch_one_or_404, normalize_pagination
from app.models.brand import Brand
from app.schemas.brand import BrandCreate, BrandRead, BrandUpdate


router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("", response_model=list[BrandRead])
async def list_brands(
    db: DBSession,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
) -> list[Brand]:
    skip, limit = normalize_pagination(skip, limit)
    result = await db.execute(select(Brand).order_by(Brand.created_at.desc()).offset(skip).limit(limit))
    return list(result.scalars().all())


@router.get("/{brand_id}", response_model=BrandRead)
async def get_brand(brand_id: UUID, db: DBSession) -> Brand:
    return await fetch_one_or_404(db, select(Brand).where(Brand.id == brand_id), "Brand not found")


@router.post("", response_model=BrandRead, status_code=status.HTTP_201_CREATED)
async def create_brand(brand_in: BrandCreate, db: DBSession) -> Brand:
    await ensure_unique(db, Brand, "slug", brand_in.slug, "Brand slug already exists")
    brand = Brand(**brand_in.model_dump())
    db.add(brand)
    await commit_or_409(db, "Could not create brand")
    await db.refresh(brand)
    return brand


@router.patch("/{brand_id}", response_model=BrandRead)
async def update_brand(brand_id: UUID, brand_in: BrandUpdate, db: DBSession) -> Brand:
    brand = await fetch_one_or_404(db, select(Brand).where(Brand.id == brand_id), "Brand not found")
    payload = brand_in.model_dump(exclude_unset=True)

    if "slug" in payload:
        await ensure_unique(db, Brand, "slug", payload["slug"], "Brand slug already exists", exclude_id=brand.id)

    for field, value in payload.items():
        setattr(brand, field, value)

    await commit_or_409(db, "Could not update brand")
    await db.refresh(brand)
    return brand


@router.delete("/{brand_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_brand(brand_id: UUID, db: DBSession) -> Response:
    brand = await fetch_one_or_404(db, select(Brand).where(Brand.id == brand_id), "Brand not found")
    await db.delete(brand)
    await commit_or_409(db, "Brand cannot be deleted because it is in use")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
