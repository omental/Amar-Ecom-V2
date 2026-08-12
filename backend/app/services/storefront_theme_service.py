from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
import uuid
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.persistence import commit_or_409
from app.models.storefront import (
    StorefrontPage,
    StorefrontRevision,
    StorefrontSection,
    StorefrontSectionGroup,
    StorefrontStyleClass,
    StorefrontSetting,
    StorefrontTemplate,
    StorefrontTheme,
)
from app.services.storefront_service import ensure_storefront_defaults, get_or_create_storefront_settings


RESOURCE_TYPES = ("home", "product", "collection", "page", "search", "cart", "not_found")
PRESENTATION_SETTING_FIELDS = (
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
    "show_topbar",
    "show_search",
    "show_cart",
    "show_track_order",
)
DEFAULT_TEMPLATES = (
    ("Home", "home", "home"),
    ("Default product", "product-default", "product"),
    ("Default collection", "collection-default", "collection"),
    ("Default page", "page-default", "page"),
    ("Search", "search-default", "search"),
    ("Cart", "cart-default", "cart"),
    ("404", "not-found-default", "not_found"),
)
SYSTEM_SECTION_TYPES = {
    "product": "product_main",
    "collection": "collection_main",
    "page": "page_main",
    "search": "search_results",
    "cart": "cart_main",
    "not_found": "not_found_main",
}


def theme_graph_stmt():
    return select(StorefrontTheme).options(
        selectinload(StorefrontTheme.templates).selectinload(StorefrontTemplate.sections),
        selectinload(StorefrontTheme.section_groups).selectinload(StorefrontSectionGroup.sections),
        selectinload(StorefrontTheme.style_classes),
    )


def _presentation_settings(settings: StorefrontSetting) -> dict[str, Any]:
    return {field: deepcopy(getattr(settings, field)) for field in PRESENTATION_SETTING_FIELDS}


def apply_theme_settings(settings: StorefrontSetting, theme: StorefrontTheme) -> StorefrontSetting:
    for field in PRESENTATION_SETTING_FIELDS:
        if field in (theme.settings or {}):
            setattr(settings, field, deepcopy(theme.settings[field]))
    return settings


def _clone_node_ids(value: Any, class_id_map: dict[str, str] | None = None) -> Any:
    if isinstance(value, list):
        return [_clone_node_ids(item, class_id_map) for item in value]
    if not isinstance(value, dict):
        return deepcopy(value)
    cloned = {key: _clone_node_ids(item, class_id_map) for key, item in value.items()}
    if isinstance(value.get("type"), str) and ("id" in value or "children" in value or "props" in value):
        cloned["id"] = str(uuid.uuid4())
    if class_id_map and isinstance(value.get("class_ids"), list):
        cloned["class_ids"] = [class_id_map.get(str(item), str(item)) for item in value["class_ids"] if isinstance(item, str)]
    return cloned


def clone_section_content(content: dict | None, *, new_node_ids: bool, class_id_map: dict[str, str] | None = None) -> dict:
    payload = deepcopy(content or {})
    return _clone_node_ids(payload, class_id_map) if new_node_ids or class_id_map else payload


def _copy_section(section: StorefrontSection, *, template_id: uuid.UUID | None = None, group_id: uuid.UUID | None = None, new_node_ids: bool = True, class_id_map: dict[str, str] | None = None) -> StorefrontSection:
    return StorefrontSection(
        template_id=template_id,
        section_group_id=group_id,
        type=section.type,
        title=section.title,
        subtitle=section.subtitle,
        sort_order=section.sort_order,
        is_enabled=section.is_enabled,
        settings=deepcopy(section.settings or {}),
        content=clone_section_content(section.content, new_node_ids=new_node_ids, class_id_map=class_id_map),
    )


def _system_section(resource_type: str, template_id: uuid.UUID) -> StorefrontSection:
    section_type = SYSTEM_SECTION_TYPES[resource_type]
    defaults: dict[str, dict[str, Any]] = {
        "product": {"show_intro": True},
        "collection": {"show_description": True, "limit": 24},
        "page": {"show_title": True, "include_legacy_sections": True},
        "search": {"show_filters": True, "limit": 24},
        "cart": {"show_summary": True},
        "not_found": {"heading": "Page not found", "message": "The page you are looking for does not exist.", "cta_label": "Return home", "cta_url": "/"},
    }
    return StorefrontSection(
        template_id=template_id,
        type=section_type,
        title=section_type.replace("_", " ").title(),
        sort_order=0,
        is_enabled=True,
        settings=defaults.get(resource_type, {}),
        content={},
    )


async def ensure_default_theme(
    db: AsyncSession,
    created_by_id: uuid.UUID | None = None,
    *,
    commit: bool = True,
    brand_name: str | None = None,
    email: str | None = None,
    currency: str | None = None,
) -> StorefrontTheme:
    existing = (await db.execute(theme_graph_stmt().order_by(StorefrontTheme.created_at.asc()).limit(1))).scalar_one_or_none()
    if existing is not None:
        return existing

    await ensure_storefront_defaults(
        db,
        commit=commit,
        brand_name=brand_name,
        email=email,
        currency=currency,
    )
    settings = await get_or_create_storefront_settings(
        db,
        commit=commit,
        brand_name=brand_name,
        email=email,
        currency=currency,
    )
    home_page = (await db.execute(
        select(StorefrontPage).options(selectinload(StorefrontPage.sections)).where(StorefrontPage.slug == "home").limit(1)
    )).scalar_one()

    theme = StorefrontTheme(
        name="Amar Classic",
        key="amar-classic",
        status="published",
        version="1.0.0",
        description="Compatibility theme created from the existing Amar-eCom storefront.",
        settings=_presentation_settings(settings),
        created_by_id=created_by_id,
        published_at=datetime.now(timezone.utc),
    )
    db.add(theme)
    await db.flush()

    for name, key, resource_type in DEFAULT_TEMPLATES:
        template = StorefrontTemplate(theme_id=theme.id, name=name, key=key, resource_type=resource_type, is_default=True, settings={})
        db.add(template)
        await db.flush()
        if resource_type == "home":
            for section in sorted(home_page.sections, key=lambda item: (item.sort_order, item.created_at)):
                db.add(_copy_section(section, template_id=template.id, new_node_ids=False))
        else:
            db.add(_system_section(resource_type, template.id))

    header = StorefrontSectionGroup(theme_id=theme.id, name="Header Group", group_type="header")
    footer = StorefrontSectionGroup(theme_id=theme.id, name="Footer Group", group_type="footer")
    db.add_all([header, footer])
    await db.flush()
    db.add_all([
        StorefrontSection(section_group_id=header.id, type="announcement_bar", title="Announcement Bar", sort_order=0, is_enabled=True, settings={"inherit_business_contact": True}, content={}),
        StorefrontSection(section_group_id=header.id, type="header", title="Main Header", sort_order=1, is_enabled=True, settings={"inherit_navigation": True}, content={}),
        StorefrontSection(section_group_id=footer.id, type="footer", title="Main Footer", sort_order=0, is_enabled=True, settings={"inherit_business_details": True, "inherit_navigation": True}, content={}),
    ])
    if commit:
        await commit_or_409(db, "Could not initialize the default storefront theme")
    else:
        await db.flush()
    return (await db.execute(theme_graph_stmt().where(StorefrontTheme.id == theme.id))).scalar_one()


async def get_theme_or_404(db: AsyncSession, theme_id: uuid.UUID) -> StorefrontTheme:
    theme = (await db.execute(theme_graph_stmt().where(StorefrontTheme.id == theme_id))).scalar_one_or_none()
    if theme is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Storefront theme not found")
    return theme


async def get_template_or_404(db: AsyncSession, template_id: uuid.UUID) -> StorefrontTemplate:
    template = (await db.execute(
        select(StorefrontTemplate).options(
            selectinload(StorefrontTemplate.sections),
            selectinload(StorefrontTemplate.theme).selectinload(StorefrontTheme.templates),
            selectinload(StorefrontTemplate.theme).selectinload(StorefrontTheme.section_groups),
        ).where(StorefrontTemplate.id == template_id)
    )).scalar_one_or_none()
    if template is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Storefront template not found")
    return template


def ensure_draft_theme(theme: StorefrontTheme) -> None:
    if theme.status != "draft":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Published themes are immutable. Duplicate the theme to create an editable draft.")


async def duplicate_theme(db: AsyncSession, source: StorefrontTheme, *, name: str, key: str, created_by_id: uuid.UUID | None) -> StorefrontTheme:
    duplicate = StorefrontTheme(name=name, key=key, status="draft", version=source.version, description=source.description, preview_image_url=source.preview_image_url, settings=deepcopy(source.settings or {}), created_by_id=created_by_id)
    db.add(duplicate)
    await db.flush()
    class_id_map: dict[str, str] = {}
    for source_class in source.style_classes:
        target_class = StorefrontStyleClass(theme_id=duplicate.id, name=source_class.name, styles=deepcopy(source_class.styles or {}), responsive=deepcopy(source_class.responsive or {}), states=deepcopy(source_class.states or {}))
        db.add(target_class)
        await db.flush()
        class_id_map[str(source_class.id)] = str(target_class.id)
    for source_template in source.templates:
        target = StorefrontTemplate(theme_id=duplicate.id, name=source_template.name, key=source_template.key, resource_type=source_template.resource_type, is_default=source_template.is_default, settings=deepcopy(source_template.settings or {}))
        db.add(target)
        await db.flush()
        for section in source_template.sections:
            db.add(_copy_section(section, template_id=target.id, new_node_ids=True, class_id_map=class_id_map))
    for source_group in source.section_groups:
        target_group = StorefrontSectionGroup(theme_id=duplicate.id, name=source_group.name, group_type=source_group.group_type)
        db.add(target_group)
        await db.flush()
        for section in source_group.sections:
            db.add(_copy_section(section, group_id=target_group.id, new_node_ids=True, class_id_map=class_id_map))
    await commit_or_409(db, "Could not duplicate storefront theme")
    return await get_theme_or_404(db, duplicate.id)


async def duplicate_template(db: AsyncSession, source: StorefrontTemplate, *, name: str, key: str) -> StorefrontTemplate:
    ensure_draft_theme(source.theme)
    target = StorefrontTemplate(theme_id=source.theme_id, name=name, key=key, resource_type=source.resource_type, is_default=False, settings=deepcopy(source.settings or {}))
    db.add(target)
    await db.flush()
    for section in source.sections:
        db.add(_copy_section(section, template_id=target.id, new_node_ids=True))
    await commit_or_409(db, "Could not duplicate storefront template")
    return await get_template_or_404(db, target.id)


def _section_snapshot(section: StorefrontSection) -> dict[str, Any]:
    return {"type": section.type, "title": section.title, "subtitle": section.subtitle, "sort_order": section.sort_order, "is_enabled": section.is_enabled, "settings": deepcopy(section.settings or {}), "content": deepcopy(section.content or {})}


def theme_snapshot(theme: StorefrontTheme) -> dict[str, Any]:
    return {
        "theme": {"id": str(theme.id), "name": theme.name, "key": theme.key, "version": theme.version, "settings": deepcopy(theme.settings or {})},
        "templates": [{"id": str(template.id), "name": template.name, "key": template.key, "resource_type": template.resource_type, "is_default": template.is_default, "settings": deepcopy(template.settings or {}), "sections": [_section_snapshot(section) for section in sorted(template.sections, key=lambda item: item.sort_order)]} for template in theme.templates],
        "section_groups": [{"id": str(group.id), "name": group.name, "group_type": group.group_type, "sections": [_section_snapshot(section) for section in sorted(group.sections, key=lambda item: item.sort_order)]} for group in theme.section_groups],
        "style_classes": [{"id": str(item.id), "name": item.name, "styles": deepcopy(item.styles or {}), "responsive": deepcopy(item.responsive or {}), "states": deepcopy(item.states or {})} for item in theme.style_classes],
    }


async def publish_theme(db: AsyncSession, theme: StorefrontTheme, created_by_id: uuid.UUID | None) -> StorefrontRevision:
    if theme.status not in {"draft", "archived"}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Only draft or archived themes can be published")
    missing = set(RESOURCE_TYPES) - {template.resource_type for template in theme.templates if template.is_default}
    if missing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Theme is missing default templates for: {', '.join(sorted(missing))}")
    group_types = {group.group_type for group in theme.section_groups}
    if not {"header", "footer"}.issubset(group_types):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Theme requires header and footer section groups")
    live = (await db.execute(select(StorefrontTheme).where(StorefrontTheme.status == "published", StorefrontTheme.id != theme.id))).scalar_one_or_none()
    if live is not None:
        live.status = "archived"
    await db.flush()
    theme.status = "published"
    theme.published_at = datetime.now(timezone.utc)
    revision = StorefrontRevision(theme_id=theme.id, revision_type="theme_publish", title=f"Published theme: {theme.name}", snapshot=theme_snapshot(theme), created_by_id=created_by_id)
    db.add(revision)
    await commit_or_409(db, "Could not publish storefront theme")
    await db.refresh(revision)
    return revision


async def resolve_template(db: AsyncSession, resource_type: str, *, assigned_template_id: uuid.UUID | None = None, theme_id: uuid.UUID | None = None, allow_draft: bool = False) -> tuple[StorefrontTheme, StorefrontTemplate]:
    if resource_type not in RESOURCE_TYPES:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Unsupported storefront resource type")
    if theme_id is not None:
        theme = await get_theme_or_404(db, theme_id)
        if theme.status != "published" and not allow_draft:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Storefront theme not found")
    else:
        theme = (await db.execute(theme_graph_stmt().where(StorefrontTheme.status == "published"))).scalar_one_or_none()
        if theme is None:
            theme = await ensure_default_theme(db)
    if assigned_template_id is not None:
        assigned = next((item for item in theme.templates if item.id == assigned_template_id and item.resource_type == resource_type), None)
        if assigned is not None:
            return theme, assigned
    template = next((item for item in theme.templates if item.resource_type == resource_type and item.is_default), None)
    if template is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Theme has no default {resource_type} template")
    return theme, template


async def validate_template_assignment(db: AsyncSession, template_id: uuid.UUID | None, resource_type: str) -> StorefrontTemplate | None:
    if template_id is None:
        return None
    template = await get_template_or_404(db, template_id)
    if template.resource_type != resource_type:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=f"Only {resource_type} templates can be assigned to this resource")
    return template


async def assigned_resource_count(db: AsyncSession, template: StorefrontTemplate) -> int:
    if template.resource_type == "product":
        from app.models.product import Product
        return int((await db.execute(select(func.count(Product.id)).where(Product.storefront_template_id == template.id))).scalar() or 0)
    if template.resource_type == "collection":
        from app.models.category import Category
        return int((await db.execute(select(func.count(Category.id)).where(Category.storefront_template_id == template.id))).scalar() or 0)
    if template.resource_type == "page":
        return int((await db.execute(select(func.count(StorefrontPage.id)).where(StorefrontPage.template_id == template.id))).scalar() or 0)
    return 0


async def assigned_theme_resource_count(db: AsyncSession, theme: StorefrontTheme) -> int:
    total = 0
    for template in theme.templates:
        total += await assigned_resource_count(db, template)
    return total
