from copy import deepcopy
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import set_committed_value

from app.core.persistence import commit_or_409
from app.models.storefront import StorefrontPage, StorefrontSection, StorefrontRevision, StorefrontTemplate, StorefrontTheme
from app.schemas.storefront import StorefrontTemplatePresetRead
from app.models.user import User
from app.services.storefront_revision_service import create_storefront_revision
from app.services.storefront_service import get_or_create_storefront_settings


TEMPLATE_PRESETS: dict[str, dict[str, Any]] = {
    "live_shopping_classic": {
        "key": "live_shopping_classic",
        "name": "LiveShopping Classic",
        "description": "Offer-heavy Bangladeshi live shopping style with a strong hero, fast product discovery, and compact sections.",
        "best_for": "Fashion, impulse buys, and F-commerce style selling.",
        "recommended_typography_preset": "modern_commerce",
        "recommended_color_preset": "live_red",
        "recommended_animation_preset": "subtle_fade",
        "header_layout": "search_heavy",
        "footer_layout": "multi_column",
        "product_card_style": "compact_deal",
        "button_style": "rounded",
        "spacing_density": "compact",
        "corner_radius": "soft",
        "shadow_style": "soft",
        "primary_color": "#db011c",
        "accent_color": "#111111",
        "default_homepage_sections": [
            {
                "type": "hero_slider",
                "title": "Hero Slider",
                "settings": {"autoplay": True, "show_dots": True, "show_arrows": True},
                "content": {
                    "slides": [
                        {
                            "title": "STYLE THAT FITS",
                            "subtitle": "YOUR EVERYDAY",
                            "discount": "UP TO 70% OFF",
                            "button_text": "Shop Now",
                            "button_url": "/products",
                            "image_url": "/storefront/demo-products/jacket-monogram-3153.jpg",
                        }
                    ]
                },
            },
            {
                "type": "new_arrivals",
                "title": "NEW ARRIVALS",
                "settings": {"source": "new_arrivals", "limit": 8, "columns_desktop": 4, "columns_mobile": 2, "show_shop_more": True, "shop_more_url": "/products"},
                "content": {},
            },
            {
                "type": "category_grid",
                "title": "Categories",
                "settings": {"limit": 8, "menu_source": "category_nav", "tile_style": "classic"},
                "content": {
                    "items": [
                        {"label": "Accessories", "image_url": "/storefront/demo-products/sneakers-flex-3374.png"},
                        {"label": "Watch", "image_url": "/storefront/demo-products/sneakers-flex-3374.png"},
                        {"label": "Sunglass", "image_url": "/storefront/demo-products/sneakers-flex-3374.png"},
                        {"label": "Jacket", "image_url": "/storefront/demo-products/sneakers-flex-3374.png"},
                    ]
                },
            },
            {
                "type": "featured_collection",
                "title": "WINTER COLLECTION",
                "settings": {"source": "featured_collection", "limit": 8, "columns_desktop": 4, "columns_mobile": 2, "show_shop_more": True, "shop_more_url": "/products"},
                "content": {},
            },
            {
                "type": "flash_sale",
                "title": "FLASH SALE",
                "settings": {"source": "flash_sale", "limit": 4, "columns_desktop": 4, "columns_mobile": 2},
                "content": {},
            },
        ],
    },
    "minimal_fashion": {
        "key": "minimal_fashion",
        "name": "Minimal Fashion",
        "description": "Editorial fashion presentation with lighter structure and premium spacing.",
        "best_for": "Curated apparel, premium drops, and brand-forward stores.",
        "recommended_typography_preset": "elegant_fashion",
        "recommended_color_preset": "fashion_rose",
        "recommended_animation_preset": "premium_smooth",
        "header_layout": "centered_logo",
        "footer_layout": "brand_story",
        "product_card_style": "premium_card",
        "button_style": "pill",
        "spacing_density": "airy",
        "corner_radius": "rounded",
        "shadow_style": "premium",
        "primary_color": "#171717",
        "accent_color": "#d9465f",
        "default_homepage_sections": [
            {
                "type": "hero_slider",
                "title": "New Season",
                "settings": {"autoplay": True, "show_dots": True, "show_arrows": False},
                "content": {
                    "slides": [
                        {
                            "title": "CURATED",
                            "subtitle": "EVERYDAY FASHION",
                            "discount": "NEW ARRIVALS",
                            "button_text": "Explore",
                            "button_url": "/products",
                            "image_url": "/storefront/demo-products/jacket-italian-3154.jpg",
                        }
                    ]
                },
            },
            {
                "type": "image_text",
                "title": "Designed for modern wardrobes",
                "subtitle": "A softer, brand-led homepage layout with story blocks and premium presentation.",
                "settings": {"image_position": "right"},
                "content": {
                    "body": "Highlight seasonal edits, curated arrivals, and signature styling without losing the storefront buying flow.",
                    "button_text": "Shop Collection",
                    "button_url": "/products",
                    "image_url": "/storefront/demo-products/jacket-puffer-3159.jpg",
                },
            },
            {
                "type": "featured_collection",
                "title": "EDITOR'S PICKS",
                "settings": {"source": "featured_collection", "limit": 8, "columns_desktop": 4, "columns_mobile": 2, "show_shop_more": True, "shop_more_url": "/products"},
                "content": {},
            },
            {
                "type": "single_banner",
                "title": "Limited capsule drop",
                "subtitle": "Feature standout pieces and limited collections with a cleaner, more premium callout.",
                "settings": {},
                "content": {"image_url": "/storefront/demo-products/jacket-monogram-3153.jpg", "button_text": "View Now", "button_url": "/products"},
            },
            {
                "type": "newsletter",
                "title": "Stay in the loop",
                "subtitle": "Capture interest for new collections and restocks.",
                "settings": {},
                "content": {"button_text": "Join Now"},
            },
        ],
    },
    "electronics_deals": {
        "key": "electronics_deals",
        "name": "Electronics Deals",
        "description": "Compact, deal-first storefront for gadgets, accessories, and bundle promotions.",
        "best_for": "Electronics, accessories, and price-driven campaigns.",
        "recommended_typography_preset": "bold_deal_store",
        "recommended_color_preset": "electronics_blue",
        "recommended_animation_preset": "deal_pop",
        "header_layout": "category_first",
        "footer_layout": "simple",
        "product_card_style": "image_first",
        "button_style": "bold_block",
        "spacing_density": "balanced",
        "corner_radius": "soft",
        "shadow_style": "soft",
        "primary_color": "#0f5bd8",
        "accent_color": "#111111",
        "default_homepage_sections": [
            {
                "type": "hero_slider",
                "title": "Deal Banner",
                "settings": {"autoplay": True, "show_dots": True, "show_arrows": True},
                "content": {
                    "slides": [
                        {
                            "title": "BIG SAVINGS",
                            "subtitle": "ON GADGET ESSENTIALS",
                            "discount": "UP TO 45% OFF",
                            "button_text": "Shop Deals",
                            "button_url": "/products",
                            "image_url": "/storefront/demo-products/jacket-monogram-3153.jpg",
                        }
                    ]
                },
            },
            {
                "type": "flash_sale",
                "title": "TODAY'S DEALS",
                "settings": {"source": "flash_sale", "limit": 8, "columns_desktop": 4, "columns_mobile": 2, "show_shop_more": True, "shop_more_url": "/flash-sale"},
                "content": {},
            },
            {
                "type": "banner_grid",
                "title": "Hot Promo Blocks",
                "settings": {},
                "content": {
                    "items": [
                        {"title": "Headphones", "subtitle": "Weekend gadget deal", "button_text": "Explore", "button_url": "/products", "image_url": "/storefront/demo-products/jacket-italian-3154.jpg"},
                        {"title": "Accessories", "subtitle": "Add-on savings", "button_text": "Shop", "button_url": "/products", "image_url": "/storefront/demo-products/jacket-puffer-3159.jpg"},
                        {"title": "Bundles", "subtitle": "Save more together", "button_text": "View", "button_url": "/products", "image_url": "/storefront/demo-products/jacket-monogram-3153.jpg"},
                    ]
                },
            },
            {
                "type": "best_selling",
                "title": "BEST SELLERS",
                "settings": {"source": "best_selling", "limit": 8, "columns_desktop": 4, "columns_mobile": 2},
                "content": {},
            },
            {
                "type": "brand_strip",
                "title": "Top Brands",
                "settings": {},
                "content": {"items": [{"label": "Sony"}, {"label": "Xiaomi"}, {"label": "Baseus"}, {"label": "Anker"}]},
            },
        ],
    },
}


def list_template_presets() -> list[StorefrontTemplatePresetRead]:
    return [StorefrontTemplatePresetRead(**deepcopy(item)) for item in TEMPLATE_PRESETS.values()]


def get_template_preset(template_key: str) -> dict[str, Any]:
    preset = TEMPLATE_PRESETS.get(template_key)
    if preset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Storefront template not found")
    return deepcopy(preset)


async def apply_template_preset(
    db: AsyncSession,
    *,
    template_key: str,
    replace_homepage: bool,
    current_user: User | None = None,
) -> tuple[StorefrontPage, StorefrontRevision]:
    if not replace_homepage:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Applying a storefront template requires replace_homepage=true.",
        )

    preset = get_template_preset(template_key)
    settings = await get_or_create_storefront_settings(db)
    settings.active_template_key = preset["key"]
    settings.typography_preset = preset["recommended_typography_preset"]
    settings.color_preset = preset["recommended_color_preset"]
    settings.animation_preset = preset["recommended_animation_preset"]
    settings.product_card_style = preset["product_card_style"]
    settings.button_style = preset["button_style"]
    settings.header_layout = preset["header_layout"]
    settings.footer_layout = preset["footer_layout"]
    settings.spacing_density = preset["spacing_density"]
    settings.corner_radius = preset["corner_radius"]
    settings.shadow_style = preset["shadow_style"]
    settings.primary_color = preset["primary_color"]
    settings.accent_color = preset["accent_color"]

    home_page_result = await db.execute(
        select(StorefrontPage).where(StorefrontPage.slug == "home").limit(1)
    )
    home_page = home_page_result.scalar_one_or_none()
    if home_page is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="System homepage not found")

    sections_result = await db.execute(
        select(StorefrontSection).where(StorefrontSection.page_id == home_page.id).order_by(StorefrontSection.sort_order.asc(), StorefrontSection.created_at.asc())
    )
    # The relationship is lazy by default. Assigning to it through the normal
    # descriptor can issue async IO outside SQLAlchemy's greenlet context.
    set_committed_value(home_page, "sections", list(sections_result.scalars().all()))
    revision = await create_storefront_revision(
        db,
        revision_type="template_apply",
        title=f"Before applying template: {preset['name']}",
        page=home_page,
        include_theme_settings=True,
        current_user=current_user,
    )

    await db.execute(delete(StorefrontSection).where(StorefrontSection.page_id == home_page.id))

    # Compatibility bridge: the legacy preset action has always been an
    # immediate live-homepage operation. Mirror it atomically into the active
    # theme's Home template so upgrades do not make this existing action appear
    # to succeed while the public template resolver continues serving stale data.
    home_template = (await db.execute(
        select(StorefrontTemplate)
        .join(StorefrontTheme, StorefrontTheme.id == StorefrontTemplate.theme_id)
        .where(StorefrontTheme.status == "published", StorefrontTemplate.resource_type == "home", StorefrontTemplate.is_default.is_(True))
        .limit(1)
    )).scalar_one_or_none()
    if home_template is not None:
        await db.execute(delete(StorefrontSection).where(StorefrontSection.template_id == home_template.id))

    for index, section in enumerate(preset["default_homepage_sections"]):
        for owner in ({"page_id": home_page.id}, {"template_id": home_template.id} if home_template is not None else None):
            if owner is None:
                continue
            db.add(StorefrontSection(
                **owner,
                type=section["type"],
                title=section.get("title"),
                subtitle=section.get("subtitle"),
                sort_order=index,
                is_enabled=True,
                settings=section.get("settings") or {},
                content=section.get("content") or {},
            ))

    await commit_or_409(db, "Could not apply storefront template")
    await db.refresh(home_page)
    return home_page, revision
