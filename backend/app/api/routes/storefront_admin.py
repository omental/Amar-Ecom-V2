from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload
from sqlalchemy.orm.attributes import set_committed_value
from starlette.datastructures import UploadFile

from app.api.deps import DBSession, get_current_user
from app.api.utils import commit_or_409, ensure_unique, fetch_one_or_404
from app.models.storefront import (
    StorefrontBanner,
    StorefrontCoupon,
    StorefrontMedia,
    StorefrontMenu,
    StorefrontMenuItem,
    StorefrontPage,
    StorefrontRevision,
    StorefrontSection,
    StorefrontSetting,
)
from app.models.user import User
from app.schemas.storefront import (
    MenuItemsReorderInput,
    PublicStorefrontResponse,
    SectionsReorderInput,
    StorefrontBannerCreate,
    StorefrontBannerRead,
    StorefrontBannerUpdate,
    StorefrontCouponCreate,
    StorefrontCouponRead,
    StorefrontCouponUpdate,
    StorefrontMediaUploadResponse,
    StorefrontMenuCreate,
    StorefrontMenuItemCreate,
    StorefrontMenuItemRead,
    StorefrontMenuItemUpdate,
    StorefrontMenuRead,
    StorefrontMenuUpdate,
    StorefrontOverviewRead,
    StorefrontPageCreate,
    StorefrontPagePublishResponse,
    StorefrontPageRead,
    StorefrontPageUpdate,
    StorefrontProductPickerResponse,
    StorefrontRevisionRead,
    StorefrontRevisionRestoreResponse,
    StorefrontSectionCreate,
    StorefrontSectionRead,
    StorefrontSectionUpdate,
    StorefrontSettingRead,
    StorefrontSettingUpdate,
    StorefrontTemplateApplyInput,
    StorefrontTemplateApplyResponse,
    StorefrontTemplatePresetRead,
)
from app.services.activity_log_service import log_activity
from app.services.storefront_html_service import sanitize_storefront_html
from app.services.storefront_product_service import list_picker_products
from app.services.storefront_revision_service import create_storefront_revision, restore_storefront_revision
from app.services.storefront_service import (
    build_menu_tree,
    ensure_storefront_defaults,
    get_or_create_storefront_settings,
    is_admin_user,
    save_storefront_media,
)
from app.services.storefront_template_service import apply_template_preset, list_template_presets
from datetime import datetime, timezone


router = APIRouter(dependencies=[Depends(get_current_user)])


def _ensure_admin(user: User) -> None:
    if not is_admin_user(user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")


async def _get_menu_or_404(db: DBSession, menu_id: UUID) -> StorefrontMenu:
    menu = await fetch_one_or_404(
        db,
        select(StorefrontMenu)
        .options(selectinload(StorefrontMenu.items))
        .where(StorefrontMenu.id == menu_id),
        "Storefront menu not found",
    )
    set_committed_value(menu, "items", build_menu_tree(list(menu.items), include_inactive=True))
    return menu


async def _get_page_or_404(db: DBSession, page_id: UUID) -> StorefrontPage:
    page = await fetch_one_or_404(
        db,
        select(StorefrontPage)
        .options(selectinload(StorefrontPage.sections))
        .where(StorefrontPage.id == page_id),
        "Storefront page not found",
    )
    set_committed_value(page, "sections", sorted(page.sections, key=lambda section: (section.sort_order, section.created_at)))
    return page


def _coupon_read(coupon: StorefrontCoupon) -> StorefrontCouponRead:
    return StorefrontCouponRead(
        id=coupon.id,
        code=coupon.code,
        type=coupon.type,
        value=float(coupon.value),
        min_order_amount=float(coupon.min_order_amount),
        max_discount_amount=float(coupon.max_discount_amount) if coupon.max_discount_amount is not None else None,
        active=coupon.is_active,
        starts_at=coupon.starts_at,
        ends_at=coupon.ends_at,
        usage_limit=coupon.usage_limit,
        usage_count=coupon.usage_count,
        created_at=coupon.created_at,
        updated_at=coupon.updated_at,
    )


def _setting_read(settings: StorefrontSetting) -> StorefrontSettingRead:
    return StorefrontSettingRead.model_validate(settings)


def _revision_read(revision: StorefrontRevision) -> StorefrontRevisionRead:
    return StorefrontRevisionRead(
        id=revision.id,
        page_id=revision.page_id,
        revision_type=revision.revision_type,
        title=revision.title,
        snapshot=revision.snapshot or {},
        created_by_id=revision.created_by_id,
        created_by_name=revision.created_by.full_name if revision.created_by is not None else None,
        created_at=revision.created_at,
    )


@router.get("/overview", response_model=StorefrontOverviewRead)
async def get_storefront_overview(
    db: DBSession,
    current_user: User = Depends(get_current_user),
) -> StorefrontOverviewRead:
    _ensure_admin(current_user)
    await ensure_storefront_defaults(db)

    settings = await get_or_create_storefront_settings(db)
    homepage_sections_count = int(
        await db.scalar(
            select(func.count(StorefrontSection.id))
            .select_from(StorefrontSection)
            .join(StorefrontPage, StorefrontSection.page_id == StorefrontPage.id)
            .where(StorefrontPage.slug == "home")
        )
        or 0
    )
    menus_count = int(await db.scalar(select(func.count(StorefrontMenu.id))) or 0)
    published_pages_count = int(
        await db.scalar(select(func.count(StorefrontPage.id)).where(StorefrontPage.status == "published"))
        or 0
    )
    banners_count = int(await db.scalar(select(func.count(StorefrontBanner.id))) or 0)
    return StorefrontOverviewRead(
        storefront_status="active" if settings.is_active else "inactive",
        homepage_sections_count=homepage_sections_count,
        menus_count=menus_count,
        published_pages_count=published_pages_count,
        banners_count=banners_count,
    )


@router.get("/settings", response_model=StorefrontSettingRead)
async def get_storefront_settings(
    db: DBSession,
    current_user: User = Depends(get_current_user),
) -> StorefrontSettingRead:
    _ensure_admin(current_user)
    await ensure_storefront_defaults(db)
    return _setting_read(await get_or_create_storefront_settings(db))


@router.put("/settings", response_model=StorefrontSettingRead)
async def update_storefront_settings(
    settings_in: StorefrontSettingUpdate,
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> StorefrontSettingRead:
    _ensure_admin(current_user)
    settings = await get_or_create_storefront_settings(db)
    payload = settings_in.model_dump(exclude_unset=True)
    if payload:
        await create_storefront_revision(
            db,
            revision_type="theme_settings",
            title="Before theme settings update",
            include_theme_settings=True,
            current_user=current_user,
        )
    for field, value in payload.items():
        setattr(settings, field, value)

    await log_activity(
        db,
        user_id=current_user.id,
        action="storefront_settings_updated",
        module="settings",
        entity_type="storefront_setting",
        entity_id=settings.id,
        message="Updated storefront settings.",
        request=request,
    )
    await commit_or_409(db, "Could not update storefront settings")
    await db.refresh(settings)
    return _setting_read(settings)


@router.get("/templates", response_model=list[StorefrontTemplatePresetRead])
async def get_storefront_templates(
    current_user: User = Depends(get_current_user),
) -> list[StorefrontTemplatePresetRead]:
    _ensure_admin(current_user)
    return list_template_presets()


@router.post("/templates/{template_key}/apply", response_model=StorefrontTemplateApplyResponse)
async def apply_storefront_template(
    template_key: str,
    payload: StorefrontTemplateApplyInput,
    db: DBSession,
    current_user: User = Depends(get_current_user),
) -> StorefrontTemplateApplyResponse:
    _ensure_admin(current_user)
    page, revision = await apply_template_preset(
        db,
        template_key=template_key,
        replace_homepage=payload.replace_homepage,
        current_user=current_user,
    )
    return StorefrontTemplateApplyResponse(
        applied_template_key=template_key,
        revision_id=revision.id,
        message="Template applied successfully. A rollback snapshot was created before the homepage layout changed.",
        page=StorefrontPageRead.model_validate(await _get_page_or_404(db, page.id)),
    )


@router.get("/menus", response_model=list[StorefrontMenuRead])
async def list_storefront_menus(
    db: DBSession,
    current_user: User = Depends(get_current_user),
) -> list[StorefrontMenu]:
    _ensure_admin(current_user)
    await ensure_storefront_defaults(db)
    result = await db.execute(select(StorefrontMenu).options(selectinload(StorefrontMenu.items)).order_by(StorefrontMenu.location.asc()))
    menus = list(result.scalars().unique().all())
    for menu in menus:
        set_committed_value(menu, "items", build_menu_tree(list(menu.items), include_inactive=True))
    return menus


@router.post("/menus", response_model=StorefrontMenuRead, status_code=status.HTTP_201_CREATED)
async def create_storefront_menu(
    menu_in: StorefrontMenuCreate,
    db: DBSession,
    current_user: User = Depends(get_current_user),
) -> StorefrontMenu:
    _ensure_admin(current_user)
    menu = StorefrontMenu(**menu_in.model_dump())
    db.add(menu)
    await commit_or_409(db, "Could not create storefront menu")
    await db.refresh(menu)
    set_committed_value(menu, "items", [])
    return menu


@router.get("/menus/{menu_id}", response_model=StorefrontMenuRead)
async def get_storefront_menu(
    menu_id: UUID,
    db: DBSession,
    current_user: User = Depends(get_current_user),
) -> StorefrontMenu:
    _ensure_admin(current_user)
    return await _get_menu_or_404(db, menu_id)


@router.put("/menus/{menu_id}", response_model=StorefrontMenuRead)
async def update_storefront_menu(
    menu_id: UUID,
    menu_in: StorefrontMenuUpdate,
    db: DBSession,
    current_user: User = Depends(get_current_user),
) -> StorefrontMenu:
    _ensure_admin(current_user)
    menu = await fetch_one_or_404(db, select(StorefrontMenu).where(StorefrontMenu.id == menu_id), "Storefront menu not found")
    for field, value in menu_in.model_dump(exclude_unset=True).items():
        setattr(menu, field, value)
    await commit_or_409(db, "Could not update storefront menu")
    return await _get_menu_or_404(db, menu_id)


@router.delete("/menus/{menu_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_storefront_menu(
    menu_id: UUID,
    db: DBSession,
    current_user: User = Depends(get_current_user),
) -> Response:
    _ensure_admin(current_user)
    menu = await fetch_one_or_404(db, select(StorefrontMenu).where(StorefrontMenu.id == menu_id), "Storefront menu not found")
    menu.is_active = False
    await commit_or_409(db, "Could not disable storefront menu")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/menus/{menu_id}/items", response_model=StorefrontMenuItemRead, status_code=status.HTTP_201_CREATED)
async def create_storefront_menu_item(
    menu_id: UUID,
    item_in: StorefrontMenuItemCreate,
    db: DBSession,
    current_user: User = Depends(get_current_user),
) -> StorefrontMenuItem:
    _ensure_admin(current_user)
    await fetch_one_or_404(db, select(StorefrontMenu).where(StorefrontMenu.id == menu_id), "Storefront menu not found")
    if item_in.parent_id is not None:
        parent = await fetch_one_or_404(db, select(StorefrontMenuItem).where(StorefrontMenuItem.id == item_in.parent_id), "Parent menu item not found")
        if parent.menu_id != menu_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Parent menu item must belong to the same menu")
    item = StorefrontMenuItem(menu_id=menu_id, **item_in.model_dump())
    db.add(item)
    await commit_or_409(db, "Could not create storefront menu item")
    await db.refresh(item)
    set_committed_value(item, "children", [])
    return item


@router.put("/menu-items/{item_id}", response_model=StorefrontMenuItemRead)
async def update_storefront_menu_item(
    item_id: UUID,
    item_in: StorefrontMenuItemUpdate,
    db: DBSession,
    current_user: User = Depends(get_current_user),
) -> StorefrontMenuItem:
    _ensure_admin(current_user)
    item = await fetch_one_or_404(db, select(StorefrontMenuItem).where(StorefrontMenuItem.id == item_id), "Storefront menu item not found")
    payload = item_in.model_dump(exclude_unset=True)
    if "parent_id" in payload and payload["parent_id"] is not None:
        if payload["parent_id"] == item.id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A menu item cannot be its own parent")
        parent = await fetch_one_or_404(db, select(StorefrontMenuItem).where(StorefrontMenuItem.id == payload["parent_id"]), "Parent menu item not found")
        if parent.menu_id != item.menu_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Parent menu item must belong to the same menu")
    for field, value in payload.items():
        setattr(item, field, value)
    await commit_or_409(db, "Could not update storefront menu item")
    await db.refresh(item)
    set_committed_value(item, "children", [])
    return item


@router.delete("/menu-items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_storefront_menu_item(
    item_id: UUID,
    db: DBSession,
    current_user: User = Depends(get_current_user),
) -> Response:
    _ensure_admin(current_user)
    item = await fetch_one_or_404(db, select(StorefrontMenuItem).where(StorefrontMenuItem.id == item_id), "Storefront menu item not found")
    item.is_active = False
    await commit_or_409(db, "Could not disable storefront menu item")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/menus/{menu_id}/items/reorder", status_code=status.HTTP_200_OK)
async def reorder_storefront_menu_items(
    menu_id: UUID,
    payload: MenuItemsReorderInput,
    db: DBSession,
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    _ensure_admin(current_user)
    menu = await fetch_one_or_404(db, select(StorefrontMenu).where(StorefrontMenu.id == menu_id), "Storefront menu not found")
    result = await db.execute(select(StorefrontMenuItem).where(StorefrontMenuItem.menu_id == menu.id))
    items = {item.id: item for item in result.scalars().all()}
    for index, item_id in enumerate(payload.ordered_ids):
        item = items.get(item_id)
        if item is not None:
            item.sort_order = index
    await commit_or_409(db, "Could not reorder storefront menu items")
    return {"message": "Menu items reordered"}


@router.get("/pages", response_model=list[StorefrontPageRead])
async def list_storefront_pages(
    db: DBSession,
    current_user: User = Depends(get_current_user),
) -> list[StorefrontPage]:
    _ensure_admin(current_user)
    await ensure_storefront_defaults(db)
    result = await db.execute(select(StorefrontPage).options(selectinload(StorefrontPage.sections)).order_by(StorefrontPage.created_at.desc()))
    pages = list(result.scalars().unique().all())
    for page in pages:
        set_committed_value(page, "sections", sorted(page.sections, key=lambda section: (section.sort_order, section.created_at)))
    return pages


@router.post("/pages", response_model=StorefrontPageRead, status_code=status.HTTP_201_CREATED)
async def create_storefront_page(
    page_in: StorefrontPageCreate,
    db: DBSession,
    current_user: User = Depends(get_current_user),
) -> StorefrontPage:
    _ensure_admin(current_user)
    await ensure_unique(db, StorefrontPage, "slug", page_in.slug, "Storefront page slug already exists")
    payload = page_in.model_dump()
    payload["content"] = sanitize_storefront_html(payload.get("content"))
    page = StorefrontPage(**payload)
    db.add(page)
    await commit_or_409(db, "Could not create storefront page")
    await db.refresh(page)
    set_committed_value(page, "sections", [])
    return page


@router.get("/pages/{page_id}", response_model=StorefrontPageRead)
async def get_storefront_page(
    page_id: UUID,
    db: DBSession,
    current_user: User = Depends(get_current_user),
) -> StorefrontPage:
    _ensure_admin(current_user)
    return await _get_page_or_404(db, page_id)


@router.put("/pages/{page_id}", response_model=StorefrontPageRead)
async def update_storefront_page(
    page_id: UUID,
    page_in: StorefrontPageUpdate,
    db: DBSession,
    current_user: User = Depends(get_current_user),
) -> StorefrontPage:
    _ensure_admin(current_user)
    page = await fetch_one_or_404(db, select(StorefrontPage).where(StorefrontPage.id == page_id), "Storefront page not found")
    payload = page_in.model_dump(exclude_unset=True)
    if "slug" in payload:
        await ensure_unique(db, StorefrontPage, "slug", payload["slug"], "Storefront page slug already exists", exclude_id=page.id)
    if "content" in payload:
        payload["content"] = sanitize_storefront_html(payload.get("content"))
    for field, value in payload.items():
        setattr(page, field, value)
    await commit_or_409(db, "Could not update storefront page")
    return await _get_page_or_404(db, page_id)


@router.post("/pages/{page_id}/publish", response_model=StorefrontPagePublishResponse)
async def publish_storefront_page(
    page_id: UUID,
    db: DBSession,
    current_user: User = Depends(get_current_user),
) -> StorefrontPagePublishResponse:
    _ensure_admin(current_user)
    page = await _get_page_or_404(db, page_id)
    revision = await create_storefront_revision(
        db,
        revision_type="publish",
        title=f"Before publish: {page.title}",
        page=page,
        include_theme_settings=True,
        current_user=current_user,
    )
    page.status = "published"
    page.last_published_at = datetime.now(timezone.utc)
    await commit_or_409(db, "Could not publish storefront page")
    await db.refresh(page)
    return StorefrontPagePublishResponse(
        id=page.id,
        status=page.status,
        last_published_at=page.last_published_at,
        revision_id=revision.id,
        message="Page published successfully. A rollback snapshot was created before publish.",
    )


@router.get("/pages/{page_id}/preview", response_model=PublicStorefrontResponse)
async def preview_storefront_page(
    page_id: UUID,
    db: DBSession,
    current_user: User = Depends(get_current_user),
) -> PublicStorefrontResponse:
    _ensure_admin(current_user)
    from app.api.routes.public_storefront import _storefront_response_for_page

    page = await _get_page_or_404(db, page_id)
    return await _storefront_response_for_page(db, page)


@router.get("/revisions", response_model=list[StorefrontRevisionRead])
async def list_storefront_revisions(
    db: DBSession,
    current_user: User = Depends(get_current_user),
) -> list[StorefrontRevisionRead]:
    _ensure_admin(current_user)
    result = await db.execute(
        select(StorefrontRevision)
        .options(selectinload(StorefrontRevision.created_by))
        .order_by(StorefrontRevision.created_at.desc())
    )
    return [_revision_read(item) for item in result.scalars().all()]


@router.get("/revisions/{revision_id}", response_model=StorefrontRevisionRead)
async def get_storefront_revision(
    revision_id: UUID,
    db: DBSession,
    current_user: User = Depends(get_current_user),
) -> StorefrontRevisionRead:
    _ensure_admin(current_user)
    revision = await fetch_one_or_404(
        db,
        select(StorefrontRevision).options(selectinload(StorefrontRevision.created_by)).where(StorefrontRevision.id == revision_id),
        "Storefront revision not found",
    )
    return _revision_read(revision)


@router.post("/revisions/{revision_id}/restore", response_model=StorefrontRevisionRestoreResponse)
async def restore_revision(
    revision_id: UUID,
    db: DBSession,
    current_user: User = Depends(get_current_user),
) -> StorefrontRevisionRestoreResponse:
    _ensure_admin(current_user)
    revision = await fetch_one_or_404(
        db,
        select(StorefrontRevision).where(StorefrontRevision.id == revision_id),
        "Storefront revision not found",
    )
    page = await restore_storefront_revision(db, revision=revision)
    return StorefrontRevisionRestoreResponse(
        revision_id=revision.id,
        restored_page_id=page.id if page is not None else None,
        message="Revision restored successfully.",
    )


@router.delete("/pages/{page_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_storefront_page(
    page_id: UUID,
    db: DBSession,
    current_user: User = Depends(get_current_user),
) -> Response:
    _ensure_admin(current_user)
    page = await fetch_one_or_404(db, select(StorefrontPage).where(StorefrontPage.id == page_id), "Storefront page not found")
    if page.is_system:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="System storefront pages cannot be deleted")
    await db.delete(page)
    await commit_or_409(db, "Could not delete storefront page")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/products/picker", response_model=StorefrontProductPickerResponse)
async def get_storefront_products_picker(
    db: DBSession,
    q: str | None = Query(default=None),
    category_slug: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=12, ge=1, le=50),
    current_user: User = Depends(get_current_user),
) -> StorefrontProductPickerResponse:
    _ensure_admin(current_user)
    payload = await list_picker_products(
        db,
        q=q,
        category_slug=category_slug,
        page=page,
        limit=limit,
    )
    return StorefrontProductPickerResponse(**payload)


@router.get("/coupons", response_model=list[StorefrontCouponRead])
async def list_storefront_coupons(
    db: DBSession,
    q: str | None = Query(default=None),
    active: bool | None = Query(default=None),
    current_user: User = Depends(get_current_user),
) -> list[StorefrontCouponRead]:
    _ensure_admin(current_user)
    stmt = select(StorefrontCoupon).order_by(StorefrontCoupon.created_at.desc())
    if q:
        stmt = stmt.where(StorefrontCoupon.code.ilike(f"%{q.strip()}%"))
    if active is not None:
        stmt = stmt.where(StorefrontCoupon.is_active.is_(active))
    result = await db.execute(stmt)
    return [_coupon_read(coupon) for coupon in result.scalars().all()]


@router.post("/coupons", response_model=StorefrontCouponRead, status_code=status.HTTP_201_CREATED)
async def create_storefront_coupon(
    coupon_in: StorefrontCouponCreate,
    db: DBSession,
    current_user: User = Depends(get_current_user),
) -> StorefrontCouponRead:
    _ensure_admin(current_user)
    payload = coupon_in.model_dump()
    await ensure_unique(db, StorefrontCoupon, "code", payload["code"], "Coupon code already exists")
    coupon = StorefrontCoupon(
        code=payload["code"],
        type=payload["type"],
        value=payload["value"],
        min_order_amount=payload["min_order_amount"],
        max_discount_amount=payload["max_discount_amount"],
        is_active=payload["active"],
        starts_at=payload["starts_at"],
        ends_at=payload["ends_at"],
        usage_limit=payload["usage_limit"],
    )
    db.add(coupon)
    await commit_or_409(db, "Could not create storefront coupon")
    await db.refresh(coupon)
    return _coupon_read(coupon)


@router.get("/coupons/{coupon_id}", response_model=StorefrontCouponRead)
async def get_storefront_coupon(
    coupon_id: UUID,
    db: DBSession,
    current_user: User = Depends(get_current_user),
) -> StorefrontCouponRead:
    _ensure_admin(current_user)
    coupon = await fetch_one_or_404(
        db,
        select(StorefrontCoupon).where(StorefrontCoupon.id == coupon_id),
        "Storefront coupon not found",
    )
    return _coupon_read(coupon)


@router.put("/coupons/{coupon_id}", response_model=StorefrontCouponRead)
async def update_storefront_coupon(
    coupon_id: UUID,
    coupon_in: StorefrontCouponUpdate,
    db: DBSession,
    current_user: User = Depends(get_current_user),
) -> StorefrontCouponRead:
    _ensure_admin(current_user)
    coupon = await fetch_one_or_404(
        db,
        select(StorefrontCoupon).where(StorefrontCoupon.id == coupon_id),
        "Storefront coupon not found",
    )
    payload = coupon_in.model_dump(exclude_unset=True)
    if "code" in payload:
        await ensure_unique(
            db,
            StorefrontCoupon,
            "code",
            payload["code"],
            "Coupon code already exists",
            exclude_id=coupon.id,
        )
    if ("type" in payload and payload["type"] == "percentage" and "value" not in payload and float(coupon.value) > 100) or (
        "value" in payload and payload.get("type", coupon.type) == "percentage" and payload["value"] > 100
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Percentage coupon value cannot exceed 100",
        )
    field_map = {
        "active": "is_active",
    }
    for field, value in payload.items():
        setattr(coupon, field_map.get(field, field), value)
    await commit_or_409(db, "Could not update storefront coupon")
    await db.refresh(coupon)
    return _coupon_read(coupon)


@router.delete("/coupons/{coupon_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_storefront_coupon(
    coupon_id: UUID,
    db: DBSession,
    current_user: User = Depends(get_current_user),
) -> Response:
    _ensure_admin(current_user)
    coupon = await fetch_one_or_404(
        db,
        select(StorefrontCoupon).where(StorefrontCoupon.id == coupon_id),
        "Storefront coupon not found",
    )
    await db.delete(coupon)
    await commit_or_409(db, "Could not delete storefront coupon")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/pages/{page_id}/sections", response_model=StorefrontSectionRead, status_code=status.HTTP_201_CREATED)
async def create_storefront_section(
    page_id: UUID,
    section_in: StorefrontSectionCreate,
    db: DBSession,
    current_user: User = Depends(get_current_user),
) -> StorefrontSection:
    _ensure_admin(current_user)
    await fetch_one_or_404(db, select(StorefrontPage).where(StorefrontPage.id == page_id), "Storefront page not found")
    section = StorefrontSection(page_id=page_id, **section_in.model_dump())
    db.add(section)
    await commit_or_409(db, "Could not create storefront section")
    await db.refresh(section)
    return section


@router.put("/sections/{section_id}", response_model=StorefrontSectionRead)
async def update_storefront_section(
    section_id: UUID,
    section_in: StorefrontSectionUpdate,
    db: DBSession,
    current_user: User = Depends(get_current_user),
) -> StorefrontSection:
    _ensure_admin(current_user)
    section = await fetch_one_or_404(db, select(StorefrontSection).where(StorefrontSection.id == section_id), "Storefront section not found")
    for field, value in section_in.model_dump(exclude_unset=True).items():
        setattr(section, field, value)
    await commit_or_409(db, "Could not update storefront section")
    await db.refresh(section)
    return section


@router.delete("/sections/{section_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_storefront_section(
    section_id: UUID,
    db: DBSession,
    current_user: User = Depends(get_current_user),
) -> Response:
    _ensure_admin(current_user)
    section = await fetch_one_or_404(db, select(StorefrontSection).where(StorefrontSection.id == section_id), "Storefront section not found")
    await db.delete(section)
    await commit_or_409(db, "Could not delete storefront section")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/pages/{page_id}/sections/reorder", status_code=status.HTTP_200_OK)
async def reorder_storefront_sections(
    page_id: UUID,
    payload: SectionsReorderInput,
    db: DBSession,
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    _ensure_admin(current_user)
    await fetch_one_or_404(db, select(StorefrontPage).where(StorefrontPage.id == page_id), "Storefront page not found")
    result = await db.execute(select(StorefrontSection).where(StorefrontSection.page_id == page_id))
    sections = {section.id: section for section in result.scalars().all()}
    for index, section_id in enumerate(payload.ordered_ids):
        section = sections.get(section_id)
        if section is not None:
            section.sort_order = index
    await commit_or_409(db, "Could not reorder storefront sections")
    return {"message": "Sections reordered"}


@router.get("/banners", response_model=list[StorefrontBannerRead])
async def list_storefront_banners(
    db: DBSession,
    current_user: User = Depends(get_current_user),
) -> list[StorefrontBanner]:
    _ensure_admin(current_user)
    await ensure_storefront_defaults(db)
    result = await db.execute(select(StorefrontBanner).order_by(StorefrontBanner.sort_order.asc(), StorefrontBanner.created_at.asc()))
    return list(result.scalars().all())


@router.post("/banners", response_model=StorefrontBannerRead, status_code=status.HTTP_201_CREATED)
async def create_storefront_banner(
    banner_in: StorefrontBannerCreate,
    db: DBSession,
    current_user: User = Depends(get_current_user),
) -> StorefrontBanner:
    _ensure_admin(current_user)
    banner = StorefrontBanner(**banner_in.model_dump())
    db.add(banner)
    await commit_or_409(db, "Could not create storefront banner")
    await db.refresh(banner)
    return banner


@router.get("/banners/{banner_id}", response_model=StorefrontBannerRead)
async def get_storefront_banner(
    banner_id: UUID,
    db: DBSession,
    current_user: User = Depends(get_current_user),
) -> StorefrontBanner:
    _ensure_admin(current_user)
    return await fetch_one_or_404(db, select(StorefrontBanner).where(StorefrontBanner.id == banner_id), "Storefront banner not found")


@router.put("/banners/{banner_id}", response_model=StorefrontBannerRead)
async def update_storefront_banner(
    banner_id: UUID,
    banner_in: StorefrontBannerUpdate,
    db: DBSession,
    current_user: User = Depends(get_current_user),
) -> StorefrontBanner:
    _ensure_admin(current_user)
    banner = await fetch_one_or_404(db, select(StorefrontBanner).where(StorefrontBanner.id == banner_id), "Storefront banner not found")
    for field, value in banner_in.model_dump(exclude_unset=True).items():
        setattr(banner, field, value)
    await commit_or_409(db, "Could not update storefront banner")
    await db.refresh(banner)
    return banner


@router.delete("/banners/{banner_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_storefront_banner(
    banner_id: UUID,
    db: DBSession,
    current_user: User = Depends(get_current_user),
) -> Response:
    _ensure_admin(current_user)
    banner = await fetch_one_or_404(db, select(StorefrontBanner).where(StorefrontBanner.id == banner_id), "Storefront banner not found")
    banner.is_active = False
    await commit_or_409(db, "Could not disable storefront banner")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/media/upload", response_model=StorefrontMediaUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_storefront_media(
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> StorefrontMedia:
    _ensure_admin(current_user)
    form = await request.form()
    file = form.get("file")
    media_type = str(form.get("media_type") or "")
    alt_text_raw = form.get("alt_text")
    alt_text = str(alt_text_raw) if alt_text_raw is not None else None

    if not isinstance(file, UploadFile):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Upload file is required")

    return await save_storefront_media(
        db,
        file=file,
        media_type=media_type,
        alt_text=alt_text,
        uploaded_by=current_user,
    )


@router.get("/media", response_model=list[StorefrontMediaUploadResponse])
async def list_storefront_media(
    db: DBSession,
    media_type: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
) -> list[StorefrontMedia]:
    _ensure_admin(current_user)
    stmt = select(StorefrontMedia).order_by(StorefrontMedia.created_at.desc())
    if media_type:
        stmt = stmt.where(StorefrontMedia.media_type == media_type)
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.delete("/media/{media_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_storefront_media(
    media_id: UUID,
    db: DBSession,
    current_user: User = Depends(get_current_user),
) -> Response:
    _ensure_admin(current_user)
    media = await fetch_one_or_404(db, select(StorefrontMedia).where(StorefrontMedia.id == media_id), "Storefront media not found")
    storage_path = Path(media.storage_path)
    if storage_path.exists() and storage_path.is_file():
        storage_path.unlink()
    await db.delete(media)
    await commit_or_409(db, "Could not delete storefront media")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
