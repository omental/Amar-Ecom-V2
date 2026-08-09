import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.orm.attributes import set_committed_value
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.persistence import commit_or_409
from app.models.storefront import (
    StorefrontBanner,
    StorefrontMedia,
    StorefrontMenu,
    StorefrontMenuItem,
    StorefrontPage,
    StorefrontSection,
    StorefrontSetting,
)
from app.models.user import User
from app.schemas.storefront import MEDIA_TYPES


DEFAULT_MAIN_NAV = [
    ("Home", "/"),
    ("Shop Product", "/products"),
    ("Best Selling", "/best-selling"),
    ("Flash Sale", "/flash-sale"),
]

DEFAULT_CATEGORY_NAV = [
    "Accessories",
    "Watch",
    "Wallet",
    "Sunglass",
    "Tie",
    "Shirt",
    "Pant",
    "Panjabi",
    "Polo",
    "T-Shirt",
    "Blazer",
    "Waistcoat",
    "Shoe",
    "Belt",
    "Jacket",
    "Hoodie",
]

DEFAULT_FOOTER_SERVICES = [
    "Refund and Returns Policy",
    "Terms & Conditions",
    "Privacy Policy",
    "About Us",
    "Contact Us",
]

DEFAULT_HERO_SLIDES = [
    {
        "title": "STYLE THAT FITS",
        "subtitle": "YOUR EVERYDAY",
        "discount": "UP TO 70% OFF",
        "button_text": "Shop Now",
        "button_url": "/products",
        "image_url": "/storefront/demo-products/jacket-monogram-3153.jpg",
    },
    {
        "title": "LIVE SHOPPING",
        "subtitle": "FASHION DEALS",
        "discount": "UP TO 60% OFF",
        "button_text": "Shop Now",
        "button_url": "/products",
        "image_url": "/storefront/demo-products/jacket-italian-3154.jpg",
    },
]

UPLOAD_ROOT = Path(__file__).resolve().parents[2] / "uploads" / "storefront"
ALLOWED_MIME_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}
MEDIA_SIZE_LIMITS = {
    "logo": 2 * 1024 * 1024,
    "favicon": 512 * 1024,
    "banner": 5 * 1024 * 1024,
    "category": 5 * 1024 * 1024,
    "product": 5 * 1024 * 1024,
    "section": 5 * 1024 * 1024,
    "general": 5 * 1024 * 1024,
}


def ensure_storefront_upload_dir() -> Path:
    UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
    return UPLOAD_ROOT


def is_admin_user(user: User) -> bool:
    return user.role in {"admin", "super_admin"}


def _default_social_links() -> dict[str, str]:
    return {
        "facebook": "",
        "youtube": "",
        "instagram": "",
    }


async def get_or_create_storefront_settings(db: AsyncSession) -> StorefrontSetting:
    result = await db.execute(select(StorefrontSetting).limit(1))
    settings = result.scalar_one_or_none()

    if settings is None:
        settings = StorefrontSetting(
            brand_name="Amar-eCom",
            phone="+880 1711-000000",
            email="email@amar-ecom.com",
            address="Dhaka, Bangladesh",
            active_template_key="live_shopping_classic",
            typography_preset="modern_commerce",
            color_preset="live_red",
            animation_preset="subtle_fade",
            product_card_style="compact_deal",
            button_style="rounded",
            header_layout="search_heavy",
            footer_layout="multi_column",
            spacing_density="compact",
            corner_radius="soft",
            shadow_style="soft",
            primary_color="#db011c",
            accent_color="#111111",
            currency="BDT",
            show_topbar=True,
            show_search=True,
            show_cart=True,
            show_track_order=True,
            footer_description="Amar-eCom brings compact, offer-heavy Bangladesh fashion shopping with fast product discovery and order-first browsing.",
            footer_copyright_text="Powered by Amar-eCom",
            social_links=_default_social_links(),
            is_active=True,
        )
        db.add(settings)
        await commit_or_409(db, "Could not initialize storefront settings")
        await db.refresh(settings)
    else:
        defaults = {
            "active_template_key": "live_shopping_classic",
            "typography_preset": "modern_commerce",
            "color_preset": "live_red",
            "animation_preset": "subtle_fade",
            "product_card_style": "compact_deal",
            "button_style": "rounded",
            "header_layout": "search_heavy",
            "footer_layout": "multi_column",
            "spacing_density": "compact",
            "corner_radius": "soft",
            "shadow_style": "soft",
            "accent_color": "#111111",
        }
        dirty = False
        for field, value in defaults.items():
            if getattr(settings, field, None) in (None, ""):
                setattr(settings, field, value)
                dirty = True
        if dirty:
            await commit_or_409(db, "Could not upgrade storefront design defaults")
            await db.refresh(settings)

    return settings


async def ensure_storefront_defaults(db: AsyncSession) -> None:
    settings = await get_or_create_storefront_settings(db)
    del settings

    existing_menus_result = await db.execute(select(StorefrontMenu.location))
    existing_locations = set(existing_menus_result.scalars().all())

    menu_specs = [
        ("Main Navigation", "main_nav"),
        ("Category Navigation", "category_nav"),
        ("Footer Services", "footer_services"),
        ("Footer Join Us", "footer_join_us"),
        ("Footer Social", "footer_social"),
        ("Footer Quick Links", "footer_quick_links"),
    ]

    for name, location in menu_specs:
        if location in existing_locations:
            continue
        db.add(StorefrontMenu(name=name, location=location, is_active=True))

    await db.flush()

    menus_result = await db.execute(select(StorefrontMenu))
    menus = {menu.location: menu for menu in menus_result.scalars().all()}

    async def create_menu_items_if_empty(location: str, values: list[dict[str, Any]]) -> None:
        menu = menus.get(location)
        if menu is None:
            return
        result = await db.execute(select(func.count(StorefrontMenuItem.id)).where(StorefrontMenuItem.menu_id == menu.id))
        if int(result.scalar() or 0) > 0:
            return
        for index, value in enumerate(values):
            db.add(
                StorefrontMenuItem(
                    menu_id=menu.id,
                    label=value["label"],
                    url=value["url"],
                    target=value.get("target", "_self"),
                    sort_order=index,
                    is_active=True,
                )
            )

    await create_menu_items_if_empty(
        "main_nav",
        [{"label": label, "url": url} for label, url in DEFAULT_MAIN_NAV],
    )
    await create_menu_items_if_empty(
        "category_nav",
        [
            {"label": name, "url": f"/categories/{name.lower().replace(' ', '-')}"}
            for name in DEFAULT_CATEGORY_NAV
        ],
    )
    await create_menu_items_if_empty(
        "footer_services",
        [{"label": label, "url": f"/pages/{label.lower().replace(' ', '-').replace('&', 'and')}"} for label in DEFAULT_FOOTER_SERVICES],
    )
    await create_menu_items_if_empty(
        "footer_join_us",
        [
            {"label": "Join Us", "url": "/pages/join-us"},
            {"label": "Contact Us", "url": "/pages/contact-us"},
            {"label": "FAQs", "url": "/pages/faqs"},
        ],
    )
    await create_menu_items_if_empty(
        "footer_social",
        [
            {"label": "Facebook", "url": "#"},
            {"label": "YouTube", "url": "#"},
            {"label": "Instagram", "url": "#"},
        ],
    )
    await create_menu_items_if_empty(
        "footer_quick_links",
        [
            {"label": "Track Order", "url": "/track-order"},
            {"label": "Shop Product", "url": "/products"},
        ],
    )

    page_result = await db.execute(
        select(StorefrontPage)
        .options(selectinload(StorefrontPage.sections))
        .where(StorefrontPage.slug == "home")
        .limit(1)
    )
    home_page = page_result.scalar_one_or_none()
    section_count = 0

    if home_page is None:
        home_page = StorefrontPage(
            title="Home",
            slug="home",
            page_type="home",
            status="published",
            is_system=True,
            seo_title="Amar-eCom | LiveShopping Style Fashion Store",
            seo_description="Compact, offer-heavy Bangladeshi storefront with dynamic sections.",
        )
        db.add(home_page)
        await db.flush()
    else:
        section_count = len(list(home_page.sections or []))
    if section_count == 0:
        default_sections = [
            {
                "type": "hero_slider",
                "title": "Hero Slider",
                "settings": {"autoplay": True, "show_dots": True, "show_arrows": True},
                "content": {"slides": DEFAULT_HERO_SLIDES},
            },
            {
                "type": "new_arrivals",
                "title": "NEW ARRIVALS",
                "settings": {
                    "source": "new_arrivals",
                    "limit": 8,
                    "columns_desktop": 4,
                    "columns_mobile": 2,
                    "show_shop_more": True,
                },
                "content": None,
            },
            {
                "type": "category_grid",
                "title": "Categories",
                "settings": {"columns_desktop": 4, "columns_mobile": 2},
                "content": {
                    "items": [
                        {"label": name, "image_url": "/storefront/demo-products/sneakers-flex-3374.png"}
                        for name in ["Accessories", "Watch", "Sunglass", "Tie", "Panjabi", "T-Shirt", "Shoe", "Jacket"]
                    ]
                },
            },
            {
                "type": "featured_collection",
                "title": "WINTER COLLECTION",
                "settings": {
                    "source": "featured_collection",
                    "limit": 8,
                    "columns_desktop": 4,
                    "columns_mobile": 2,
                },
                "content": None,
            },
            {
                "type": "flash_sale",
                "title": "FLASH SALE",
                "settings": {
                    "source": "flash_sale",
                    "limit": 4,
                    "columns_desktop": 4,
                    "columns_mobile": 2,
                },
                "content": None,
            },
        ]
        for index, item in enumerate(default_sections):
            db.add(
                StorefrontSection(
                    page_id=home_page.id,
                    type=item["type"],
                    title=item["title"],
                    subtitle=None,
                    sort_order=index,
                    is_enabled=True,
                    settings=item["settings"],
                    content=item["content"],
                )
            )

    banner_count_result = await db.execute(select(func.count(StorefrontBanner.id)))
    if int(banner_count_result.scalar() or 0) == 0:
        for index, slide in enumerate(DEFAULT_HERO_SLIDES):
            db.add(
                StorefrontBanner(
                    title=slide["title"],
                    subtitle=slide["subtitle"],
                    image_url=slide["image_url"],
                    mobile_image_url=None,
                    button_text=slide["button_text"],
                    button_url=slide["button_url"],
                    location="hero_slider",
                    sort_order=index,
                    is_active=True,
                )
            )

    await commit_or_409(db, "Could not initialize storefront defaults")


def build_menu_tree(items: list[StorefrontMenuItem], *, include_inactive: bool = False) -> list[StorefrontMenuItem]:
    filtered = [item for item in items if include_inactive or item.is_active]
    item_map = {item.id: item for item in filtered}
    children_map: dict[uuid.UUID | None, list[StorefrontMenuItem]] = {}

    for item in filtered:
        parent_id = item.parent_id if item.parent_id in item_map else None
        children_map.setdefault(parent_id, []).append(item)

    for siblings in children_map.values():
        siblings.sort(key=lambda item: (item.sort_order, item.created_at))

    ordered: list[StorefrontMenuItem] = []

    def visit(node: StorefrontMenuItem) -> None:
        set_committed_value(node, "children", children_map.get(node.id, []))
        ordered.append(node)
        for child in node.children:
            visit(child)

    for root in children_map.get(None, []):
        visit(root)

    return children_map.get(None, [])


def safe_media_filename(original_name: str, mime_type: str) -> str:
    suffix = ALLOWED_MIME_TYPES[mime_type]
    return f"{uuid.uuid4().hex}{suffix}"


async def save_storefront_media(
    db: AsyncSession,
    *,
    file: UploadFile,
    media_type: str,
    alt_text: str | None,
    uploaded_by: User | None,
) -> StorefrontMedia:
    if media_type not in MEDIA_TYPES:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid media type")
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported file type")

    file_bytes = await file.read()
    size_limit = MEDIA_SIZE_LIMITS[media_type]
    if len(file_bytes) > size_limit:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file exceeds allowed size")

    directory = ensure_storefront_upload_dir() / media_type
    directory.mkdir(parents=True, exist_ok=True)
    filename = safe_media_filename(file.filename or "upload", file.content_type)
    storage_path = directory / filename
    storage_path.write_bytes(file_bytes)

    relative_url = f"/uploads/storefront/{media_type}/{filename}"
    media = StorefrontMedia(
        file_name=filename,
        original_name=os.path.basename(file.filename or filename),
        mime_type=file.content_type,
        file_size=len(file_bytes),
        url=relative_url,
        storage_path=str(storage_path),
        media_type=media_type,
        alt_text=alt_text,
        uploaded_by_id=uploaded_by.id if uploaded_by else None,
    )
    db.add(media)
    await commit_or_409(db, "Could not save storefront media")
    await db.refresh(media)
    return media


def banner_is_currently_active(banner: StorefrontBanner) -> bool:
    if not banner.is_active:
        return False
    now = datetime.now(timezone.utc)
    if banner.starts_at and banner.starts_at > now:
        return False
    if banner.ends_at and banner.ends_at < now:
        return False
    return True
