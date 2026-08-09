from copy import deepcopy
from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.persistence import commit_or_409
from app.models.storefront import StorefrontPage, StorefrontRevision, StorefrontSection, StorefrontSetting
from app.models.user import User
from app.services.storefront_service import get_or_create_storefront_settings


THEME_FIELDS = (
    "brand_name",
    "logo_url",
    "favicon_url",
    "phone",
    "email",
    "address",
    "active_template_key",
    "typography_preset",
    "color_preset",
    "animation_preset",
    "product_card_style",
    "button_style",
    "header_layout",
    "footer_layout",
    "spacing_density",
    "corner_radius",
    "shadow_style",
    "primary_color",
    "accent_color",
    "secondary_color",
    "currency",
    "show_topbar",
    "show_search",
    "show_cart",
    "show_track_order",
    "inside_dhaka_delivery_charge",
    "outside_dhaka_delivery_charge",
    "free_delivery_minimum",
    "footer_description",
    "footer_copyright_text",
    "social_share_image_url",
    "social_links",
    "seo_title",
    "seo_description",
    "is_active",
)


def _serialize_theme_settings(settings: StorefrontSetting) -> dict[str, Any]:
    payload: dict[str, Any] = {}
    for field in THEME_FIELDS:
        payload[field] = _make_json_safe(getattr(settings, field))
    return payload


def _make_json_safe(value: Any) -> Any:
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, dict):
        return {str(key): _make_json_safe(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_make_json_safe(item) for item in value]
    return deepcopy(value)


def _serialize_page(page: StorefrontPage) -> dict[str, Any]:
    return {
        "id": str(page.id),
        "title": page.title,
        "slug": page.slug,
        "page_type": page.page_type,
        "content": page.content,
        "seo_title": page.seo_title,
        "seo_description": page.seo_description,
        "status": page.status,
        "is_system": page.is_system,
        "last_published_at": page.last_published_at.isoformat() if page.last_published_at else None,
    }


def _serialize_sections(page: StorefrontPage) -> list[dict[str, Any]]:
    return [
        {
            "type": section.type,
            "title": section.title,
            "subtitle": section.subtitle,
            "sort_order": section.sort_order,
            "is_enabled": section.is_enabled,
            "settings": _make_json_safe(section.settings or {}),
            "content": _make_json_safe(section.content or {}),
        }
        for section in sorted(page.sections, key=lambda item: (item.sort_order, item.created_at))
    ]


async def create_storefront_revision(
    db: AsyncSession,
    *,
    revision_type: str,
    title: str,
    page: StorefrontPage | None = None,
    include_theme_settings: bool = False,
    current_user: User | None = None,
) -> StorefrontRevision:
    snapshot: dict[str, Any] = {}
    if page is not None:
        snapshot["page"] = _serialize_page(page)
        snapshot["sections"] = _serialize_sections(page)
    if include_theme_settings:
        settings = await get_or_create_storefront_settings(db)
        snapshot["theme_settings"] = _serialize_theme_settings(settings)

    revision = StorefrontRevision(
        page_id=page.id if page is not None else None,
        revision_type=revision_type,
        title=title,
        snapshot=snapshot,
        created_by_id=current_user.id if current_user is not None else None,
    )
    db.add(revision)
    await commit_or_409(db, "Could not create storefront revision")
    await db.refresh(revision)
    return revision


async def restore_storefront_revision(
    db: AsyncSession,
    *,
    revision: StorefrontRevision,
) -> StorefrontPage | None:
    snapshot = revision.snapshot or {}
    page_snapshot = snapshot.get("page")
    sections_snapshot = snapshot.get("sections") or []
    theme_snapshot = snapshot.get("theme_settings")

    restored_page: StorefrontPage | None = None

    if theme_snapshot:
        settings = await get_or_create_storefront_settings(db)
        for field in THEME_FIELDS:
            if field in theme_snapshot:
                setattr(settings, field, deepcopy(theme_snapshot[field]))

    if page_snapshot:
        page_identifier = page_snapshot.get("id")
        stmt = select(StorefrontPage)
        if page_identifier:
            try:
                stmt = stmt.where(StorefrontPage.id == UUID(page_identifier))
            except ValueError:
                stmt = stmt.where(StorefrontPage.slug == page_snapshot.get("slug"))
        else:
            stmt = stmt.where(StorefrontPage.slug == page_snapshot.get("slug"))
        page_result = await db.execute(stmt.limit(1))
        restored_page = page_result.scalar_one_or_none()
        if restored_page is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Revision target page no longer exists.")

        for field in ("title", "slug", "page_type", "content", "seo_title", "seo_description", "status", "is_system"):
            if field in page_snapshot:
                setattr(restored_page, field, deepcopy(page_snapshot[field]))
        if page_snapshot.get("last_published_at"):
            restored_page.last_published_at = datetime.fromisoformat(page_snapshot["last_published_at"])

        await db.execute(delete(StorefrontSection).where(StorefrontSection.page_id == restored_page.id))
        await db.flush()
        for index, section in enumerate(sections_snapshot):
            db.add(
                StorefrontSection(
                    page_id=restored_page.id,
                    type=section["type"],
                    title=section.get("title"),
                    subtitle=section.get("subtitle"),
                    sort_order=section.get("sort_order", index),
                    is_enabled=section.get("is_enabled", True),
                    settings=deepcopy(section.get("settings") or {}),
                    content=deepcopy(section.get("content") or {}),
                )
            )

    await commit_or_409(db, "Could not restore storefront revision")
    if restored_page is not None:
        await db.refresh(restored_page)
    return restored_page
