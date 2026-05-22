from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import DBSession
from app.api.utils import fetch_one_or_404
from app.models.storefront import StorefrontBanner, StorefrontMenu, StorefrontPage, StorefrontSection
from app.schemas.storefront import (
    PublicStorefrontMenuItem,
    PublicStorefrontPage,
    PublicStorefrontResponse,
    PublicStorefrontSection,
    PublicStorefrontSetting,
)
from app.services.storefront_service import (
    banner_is_currently_active,
    build_menu_tree,
    ensure_storefront_defaults,
    get_or_create_storefront_settings,
)
from app.services.storefront_product_service import PRODUCT_SECTION_TYPES, resolve_storefront_section_products


router = APIRouter()


def _public_menu_item(item) -> PublicStorefrontMenuItem:
    return PublicStorefrontMenuItem(
        label=item.label,
        url=item.url,
        target=item.target,
        children=[_public_menu_item(child) for child in item.children if child.is_active],
    )


async def _public_menus_map(db: DBSession) -> dict[str, list[PublicStorefrontMenuItem]]:
    result = await db.execute(
        select(StorefrontMenu)
        .options(selectinload(StorefrontMenu.items))
        .where(StorefrontMenu.is_active.is_(True))
        .order_by(StorefrontMenu.location.asc())
    )
    menus = list(result.scalars().unique().all())
    payload: dict[str, list[PublicStorefrontMenuItem]] = {}
    for menu in menus:
        roots = build_menu_tree(list(menu.items), include_inactive=False)
        payload[menu.location] = [_public_menu_item(item) for item in roots]
    return payload


async def _section_payload(db: DBSession, section: StorefrontSection) -> PublicStorefrontSection:
    products = []
    if section.type in PRODUCT_SECTION_TYPES:
        products = await resolve_storefront_section_products(
            db,
            section_type=section.type,
            settings=section.settings or {},
        )
    return PublicStorefrontSection(
        type=section.type,
        title=section.title,
        subtitle=section.subtitle,
        settings=section.settings or {},
        content=section.content or {},
        products=products,
    )


async def _page_response(db: DBSession, page: StorefrontPage) -> PublicStorefrontPage:
    return PublicStorefrontPage(
        title=page.title,
        slug=page.slug,
        seo_title=page.seo_title,
        seo_description=page.seo_description,
        content=page.content,
        sections=[
            await _section_payload(db, section)
            for section in sorted(page.sections, key=lambda item: (item.sort_order, item.created_at))
            if section.is_enabled
        ],
    )


def _settings_payload(settings) -> PublicStorefrontSetting:
    return PublicStorefrontSetting(
        brand_name=settings.brand_name,
        logo_url=settings.logo_url,
        favicon_url=settings.favicon_url,
        phone=settings.phone,
        email=settings.email,
        address=settings.address,
        primary_color=settings.primary_color,
        secondary_color=settings.secondary_color,
        currency=settings.currency,
        show_topbar=settings.show_topbar,
        show_search=settings.show_search,
        show_cart=settings.show_cart,
        show_track_order=settings.show_track_order,
        footer_description=settings.footer_description,
        footer_copyright_text=settings.footer_copyright_text,
        social_share_image_url=settings.social_share_image_url,
        social_links=settings.social_links or {},
        seo_title=settings.seo_title,
        seo_description=settings.seo_description,
    )


async def _storefront_response_for_page(db: DBSession, page: StorefrontPage) -> PublicStorefrontResponse:
    settings = await get_or_create_storefront_settings(db)
    if not settings.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Storefront is inactive")

    menus = await _public_menus_map(db)
    return PublicStorefrontResponse(
        settings=_settings_payload(settings),
        menus=menus,
        page=await _page_response(db, page),
    )


@router.get("/settings", response_model=PublicStorefrontSetting)
async def get_public_storefront_settings(db: DBSession) -> PublicStorefrontSetting:
    await ensure_storefront_defaults(db)
    settings = await get_or_create_storefront_settings(db)
    if not settings.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Storefront is inactive")
    return _settings_payload(settings)


@router.get("/menus")
async def get_public_storefront_menus(db: DBSession) -> dict[str, list[PublicStorefrontMenuItem]]:
    await ensure_storefront_defaults(db)
    return await _public_menus_map(db)


@router.get("/pages/home", response_model=PublicStorefrontResponse)
async def get_public_home_page(db: DBSession) -> PublicStorefrontResponse:
    await ensure_storefront_defaults(db)
    page = await fetch_one_or_404(
        db,
        select(StorefrontPage)
        .options(selectinload(StorefrontPage.sections))
        .where(StorefrontPage.slug == "home", StorefrontPage.status == "published"),
        "Public storefront page not found",
    )

    banners_result = await db.execute(
        select(StorefrontBanner)
        .where(StorefrontBanner.location == "hero_slider")
        .order_by(StorefrontBanner.sort_order.asc(), StorefrontBanner.created_at.asc())
    )
    active_banners = [banner for banner in banners_result.scalars().all() if banner_is_currently_active(banner)]
    for section in page.sections:
        if section.type == "hero_slider" and active_banners:
            existing_slides = section.content.get("slides", []) if isinstance(section.content, dict) else []
            section.content = {
                **(section.content or {}),
                "slides": [
                    {
                        "title": banner.title,
                        "subtitle": banner.subtitle,
                        "image_url": banner.image_url,
                        "mobile_image_url": banner.mobile_image_url,
                        "button_text": banner.button_text,
                        "button_url": banner.button_url,
                        "discount": existing_slides[index].get("discount") if index < len(existing_slides) and isinstance(existing_slides[index], dict) else None,
                    }
                    for index, banner in enumerate(active_banners)
                ],
            }
    return await _storefront_response_for_page(db, page)


@router.get("/pages/{slug}", response_model=PublicStorefrontResponse)
async def get_public_storefront_page(slug: str, db: DBSession) -> PublicStorefrontResponse:
    await ensure_storefront_defaults(db)
    page = await fetch_one_or_404(
        db,
        select(StorefrontPage)
        .options(selectinload(StorefrontPage.sections))
        .where(StorefrontPage.slug == slug, StorefrontPage.status == "published"),
        "Public storefront page not found",
    )
    return await _storefront_response_for_page(db, page)
