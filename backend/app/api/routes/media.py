from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, Response, UploadFile, status
from sqlalchemy import Text, cast, func, or_, select

from app.api.deps import DBSession, get_current_user, require_permission
from app.api.utils import commit_or_409, fetch_one_or_404, normalize_pagination
from app.models.media import MediaAsset
from app.models.product import Product
from app.models.user import User
from app.schemas.media import MediaAssetPage, MediaAssetRead, MediaAssetUpdate, MediaUsageRecord
from app.services.media_storage import (
    build_media_public_url,
    get_media_storage,
    read_and_validate_image,
    safe_original_filename,
)


router = APIRouter(dependencies=[Depends(get_current_user)])


def serialize_asset(asset: MediaAsset, request: Request) -> MediaAssetRead:
    return MediaAssetRead.model_validate(
        {
            "id": asset.id,
            "filename": asset.filename,
            "original_filename": asset.original_filename,
            "mime_type": asset.mime_type,
            "file_size": asset.file_size,
            "width": asset.width,
            "height": asset.height,
            "title": asset.title,
            "alt_text": asset.alt_text,
            "caption": asset.caption,
            "uploaded_by_id": asset.uploaded_by_id,
            "created_at": asset.created_at,
            "updated_at": asset.updated_at,
            "public_url": build_media_public_url(asset.storage_key, str(request.base_url)),
        }
    )


@router.get("", response_model=MediaAssetPage, dependencies=[Depends(require_permission("media", "view"))])
async def list_media(
    request: Request,
    db: DBSession,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=24, ge=1, le=100),
    search: str | None = Query(default=None, max_length=255),
    mime_type: str | None = Query(default=None),
    sort: str = Query(default="newest", pattern="^(newest|oldest|name)$"),
) -> MediaAssetPage:
    skip, limit = normalize_pagination(skip, limit)
    filters = []
    if search and search.strip():
        term = f"%{search.strip()}%"
        filters.append(
            or_(
                MediaAsset.original_filename.ilike(term),
                MediaAsset.filename.ilike(term),
                MediaAsset.title.ilike(term),
                MediaAsset.alt_text.ilike(term),
            )
        )
    if mime_type:
        filters.append(MediaAsset.mime_type == mime_type)

    count_stmt = select(func.count(MediaAsset.id))
    item_stmt = select(MediaAsset)
    if filters:
        count_stmt = count_stmt.where(*filters)
        item_stmt = item_stmt.where(*filters)
    order_by = {
        "newest": MediaAsset.created_at.desc(),
        "oldest": MediaAsset.created_at.asc(),
        "name": MediaAsset.original_filename.asc(),
    }[sort]
    total = int((await db.execute(count_stmt)).scalar_one())
    result = await db.execute(item_stmt.order_by(order_by).offset(skip).limit(limit))
    items = [serialize_asset(asset, request) for asset in result.scalars().all()]
    return MediaAssetPage(items=items, total=total, skip=skip, limit=limit, has_more=skip + len(items) < total)


@router.post(
    "/upload",
    response_model=MediaAssetRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("media", "create"))],
)
async def upload_media(
    request: Request,
    db: DBSession,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
) -> MediaAssetRead:
    validated = await read_and_validate_image(file)
    storage = get_media_storage()
    storage_key, filename = storage.save(validated.content, validated.extension)
    asset = MediaAsset(
        filename=filename,
        original_filename=safe_original_filename(file.filename),
        storage_key=storage_key,
        mime_type=validated.mime_type,
        file_size=len(validated.content),
        width=validated.width,
        height=validated.height,
        title=None,
        alt_text=None,
        caption=None,
        uploaded_by_id=current_user.id,
    )
    db.add(asset)
    try:
        await commit_or_409(db, "Could not save media metadata")
    except Exception:
        storage.delete(storage_key)
        raise
    await db.refresh(asset)
    return serialize_asset(asset, request)


@router.get("/{media_id}", response_model=MediaAssetRead, dependencies=[Depends(require_permission("media", "view"))])
async def get_media(media_id: UUID, request: Request, db: DBSession) -> MediaAssetRead:
    asset = await fetch_one_or_404(db, select(MediaAsset).where(MediaAsset.id == media_id), "Media asset not found")
    return serialize_asset(asset, request)


@router.patch("/{media_id}", response_model=MediaAssetRead, dependencies=[Depends(require_permission("media", "update"))])
async def update_media(
    media_id: UUID,
    media_in: MediaAssetUpdate,
    request: Request,
    db: DBSession,
) -> MediaAssetRead:
    asset = await fetch_one_or_404(db, select(MediaAsset).where(MediaAsset.id == media_id), "Media asset not found")
    for field, value in media_in.model_dump(exclude_unset=True).items():
        setattr(asset, field, value)
    await commit_or_409(db, "Could not update media metadata")
    await db.refresh(asset)
    return serialize_asset(asset, request)


async def product_media_usage(db: DBSession, public_url: str, relative_url: str) -> list[MediaUsageRecord]:
    candidate_urls = list(dict.fromkeys([public_url, relative_url]))
    result = await db.execute(
        select(Product).where(
            or_(
                Product.image_url.in_(candidate_urls),
                Product.image_url.endswith(relative_url),
                Product.size_guide_image_url.in_(candidate_urls),
                Product.size_guide_image_url.endswith(relative_url),
                cast(Product.gallery_image_urls, Text).contains(relative_url),
            )
        )
    )
    usages: list[MediaUsageRecord] = []
    def matches(value: str | None) -> bool:
        return bool(value and (value in candidate_urls or value.endswith(relative_url)))

    for product in result.scalars().all():
        if matches(product.image_url):
            usages.append(MediaUsageRecord(type="product_featured", entity_id=product.id, label=product.name))
        for gallery_url in product.gallery_image_urls or []:
            if matches(gallery_url):
                usages.append(MediaUsageRecord(type="product_gallery", entity_id=product.id, label=product.name))
                break
        if matches(product.size_guide_image_url):
            usages.append(MediaUsageRecord(type="product_size_guide", entity_id=product.id, label=product.name))
    return usages


@router.delete("/{media_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_permission("media", "delete"))])
async def delete_media(media_id: UUID, request: Request, db: DBSession) -> Response:
    asset = await fetch_one_or_404(db, select(MediaAsset).where(MediaAsset.id == media_id), "Media asset not found")
    public_url = build_media_public_url(asset.storage_key, str(request.base_url))
    relative_url = f"/media/{asset.storage_key}"
    usages = await product_media_usage(db, public_url, relative_url)
    if usages:
        product_count = len({usage.entity_id for usage in usages})
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": f"This image is currently used by {product_count} product{'s' if product_count != 1 else ''}.",
                "product_count": product_count,
                "usages": [usage.model_dump(mode="json") for usage in usages],
            },
        )
    storage_key = asset.storage_key
    await db.delete(asset)
    await commit_or_409(db, "Could not delete media asset")
    get_media_storage().delete(storage_key)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
