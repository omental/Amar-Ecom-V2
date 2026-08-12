from copy import deepcopy
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select

from app.api.deps import DBSession, get_current_user, get_entitlement_context
from app.api.utils import commit_or_409, ensure_unique, fetch_one_or_404
from app.models.storefront import StorefrontSection, StorefrontSectionGroup, StorefrontStyleClass, StorefrontTemplate, StorefrontTheme
from app.models.user import User
from app.schemas.storefront import (
    SectionsReorderInput,
    StorefrontResolvedTemplateRead,
    StorefrontSectionCreate,
    StorefrontSectionGroupRead,
    StorefrontSectionRead,
    StorefrontTemplateCreate,
    StorefrontTemplateRead,
    StorefrontTemplateUpdate,
    StorefrontStyleClassCreate,
    StorefrontStyleClassRead,
    StorefrontStyleClassUpdate,
    StorefrontThemeCreate,
    StorefrontThemePublishResponse,
    StorefrontThemeRead,
    StorefrontThemeUpdate,
)
from app.services.storefront_service import is_admin_user
from app.services.storefront_theme_service import (
    SYSTEM_SECTION_TYPES,
    assigned_theme_resource_count,
    assigned_resource_count,
    duplicate_template,
    duplicate_theme,
    ensure_default_theme,
    ensure_draft_theme,
    get_template_or_404,
    get_theme_or_404,
    publish_theme,
    resolve_template,
    theme_graph_stmt,
)
from app.services.commercial_access_service import EntitlementService


router = APIRouter(dependencies=[Depends(get_current_user)])


def _ensure_admin(user: User) -> None:
    if not is_admin_user(user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")


def _validate_section_resource(section_type: str, resource_type: str) -> None:
    supported = next((kind for kind, system_type in SYSTEM_SECTION_TYPES.items() if system_type == section_type), None)
    if supported is not None and supported != resource_type:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=f"{section_type} is only valid in {supported} templates")


def _count_class_usage(value: object, class_id: str) -> int:
    if isinstance(value, list):
        return sum(_count_class_usage(item, class_id) for item in value)
    if not isinstance(value, dict):
        return 0
    own = 1 if class_id in value.get("class_ids", []) else 0
    return own + sum(_count_class_usage(item, class_id) for item in value.values())


def _style_class_read(item: StorefrontStyleClass, theme: StorefrontTheme) -> StorefrontStyleClassRead:
    usage = sum(_count_class_usage(section.content or {}, str(item.id)) for template in theme.templates for section in template.sections)
    usage += sum(_count_class_usage(section.content or {}, str(item.id)) for group in theme.section_groups for section in group.sections)
    return StorefrontStyleClassRead.model_validate(item).model_copy(update={"usage_count": usage})


@router.get("/themes", response_model=list[StorefrontThemeRead])
async def list_themes(db: DBSession, current_user: User = Depends(get_current_user)) -> list[StorefrontTheme]:
    _ensure_admin(current_user)
    await ensure_default_theme(db, current_user.id)
    result = await db.execute(theme_graph_stmt().order_by(StorefrontTheme.status.desc(), StorefrontTheme.updated_at.desc()))
    return list(result.scalars().unique().all())


@router.post("/themes", response_model=StorefrontThemeRead, status_code=status.HTTP_201_CREATED)
async def create_theme(payload: StorefrontThemeCreate, db: DBSession, current_user: User = Depends(get_current_user), access: EntitlementService = Depends(get_entitlement_context)) -> StorefrontTheme:
    _ensure_admin(current_user)
    await access.require_capacity("theme_count_limit")
    await ensure_unique(db, StorefrontTheme, "key", payload.key, "Theme key already exists")
    source = await ensure_default_theme(db, current_user.id)
    created = await duplicate_theme(db, source, name=payload.name.strip(), key=payload.key, created_by_id=current_user.id)
    created.description = payload.description
    created.version = payload.version
    created.preview_image_url = payload.preview_image_url
    if payload.settings:
        created.settings = {**(created.settings or {}), **payload.settings}
    await commit_or_409(db, "Could not create storefront theme")
    return await get_theme_or_404(db, created.id)


@router.get("/themes/{theme_id}", response_model=StorefrontThemeRead)
async def get_theme(theme_id: UUID, db: DBSession, current_user: User = Depends(get_current_user)) -> StorefrontTheme:
    _ensure_admin(current_user)
    return await get_theme_or_404(db, theme_id)


@router.patch("/themes/{theme_id}", response_model=StorefrontThemeRead)
async def update_theme(theme_id: UUID, payload: StorefrontThemeUpdate, db: DBSession, current_user: User = Depends(get_current_user)) -> StorefrontTheme:
    _ensure_admin(current_user)
    theme = await get_theme_or_404(db, theme_id)
    ensure_draft_theme(theme)
    values = payload.model_dump(exclude_unset=True)
    if values.get("settings") is not None:
        values["settings"] = {**(theme.settings or {}), **values["settings"]}
    for field, value in values.items():
        setattr(theme, field, value)
    await commit_or_409(db, "Could not update storefront theme")
    return await get_theme_or_404(db, theme.id)


@router.post("/themes/{theme_id}/duplicate", response_model=StorefrontThemeRead, status_code=status.HTTP_201_CREATED)
async def duplicate_theme_route(theme_id: UUID, payload: StorefrontThemeCreate, db: DBSession, current_user: User = Depends(get_current_user), access: EntitlementService = Depends(get_entitlement_context)) -> StorefrontTheme:
    _ensure_admin(current_user)
    await access.require_capacity("theme_count_limit")
    source = await get_theme_or_404(db, theme_id)
    await ensure_unique(db, StorefrontTheme, "key", payload.key, "Theme key already exists")
    return await duplicate_theme(db, source, name=payload.name.strip(), key=payload.key, created_by_id=current_user.id)


@router.post("/themes/{theme_id}/publish", response_model=StorefrontThemePublishResponse)
async def publish_theme_route(theme_id: UUID, db: DBSession, current_user: User = Depends(get_current_user)) -> StorefrontThemePublishResponse:
    _ensure_admin(current_user)
    theme = await get_theme_or_404(db, theme_id)
    revision = await publish_theme(db, theme, current_user.id)
    published = await get_theme_or_404(db, theme.id)
    return StorefrontThemePublishResponse(theme=StorefrontThemeRead.model_validate(published), revision_id=revision.id, message=f"{published.name} is now live")


@router.delete("/themes/{theme_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_theme(theme_id: UUID, db: DBSession, current_user: User = Depends(get_current_user)) -> Response:
    _ensure_admin(current_user)
    theme = await get_theme_or_404(db, theme_id)
    if theme.status == "published":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="The published theme cannot be deleted")
    assigned = await assigned_theme_resource_count(db, theme)
    if assigned:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Theme templates are assigned to {assigned} resource(s); reassign them before deleting",
        )
    await db.delete(theme)
    await commit_or_409(db, "Could not delete storefront theme")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/themes/{theme_id}/templates", response_model=list[StorefrontTemplateRead])
async def list_templates(theme_id: UUID, db: DBSession, current_user: User = Depends(get_current_user)) -> list[StorefrontTemplate]:
    _ensure_admin(current_user)
    theme = await get_theme_or_404(db, theme_id)
    return sorted(theme.templates, key=lambda item: (item.resource_type, not item.is_default, item.name))


@router.post("/themes/{theme_id}/templates", response_model=StorefrontTemplateRead, status_code=status.HTTP_201_CREATED)
async def create_template(theme_id: UUID, payload: StorefrontTemplateCreate, db: DBSession, current_user: User = Depends(get_current_user)) -> StorefrontTemplate:
    _ensure_admin(current_user)
    theme = await get_theme_or_404(db, theme_id)
    ensure_draft_theme(theme)
    if any(item.key == payload.key for item in theme.templates):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Template key already exists in this theme")
    if payload.base_template_id:
        source = await get_template_or_404(db, payload.base_template_id)
        if source.theme_id != theme.id or source.resource_type != payload.resource_type:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Base template must belong to this theme and resource type")
        return await duplicate_template(db, source, name=payload.name, key=payload.key)
    if payload.is_default and any(item.resource_type == payload.resource_type and item.is_default for item in theme.templates):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This resource type already has a default template")
    template = StorefrontTemplate(theme_id=theme.id, name=payload.name, key=payload.key, resource_type=payload.resource_type, is_default=payload.is_default, settings=payload.settings)
    db.add(template)
    await commit_or_409(db, "Could not create storefront template")
    return await get_template_or_404(db, template.id)


@router.get("/templates/{template_id}", response_model=StorefrontTemplateRead)
async def get_template(template_id: UUID, db: DBSession, current_user: User = Depends(get_current_user)) -> StorefrontTemplate:
    _ensure_admin(current_user)
    return await get_template_or_404(db, template_id)


@router.patch("/templates/{template_id}", response_model=StorefrontTemplateRead)
async def update_template(template_id: UUID, payload: StorefrontTemplateUpdate, db: DBSession, current_user: User = Depends(get_current_user)) -> StorefrontTemplate:
    _ensure_admin(current_user)
    template = await get_template_or_404(db, template_id)
    ensure_draft_theme(template.theme)
    values = payload.model_dump(exclude_unset=True)
    if values.get("key") and any(item.key == values["key"] and item.id != template.id for item in template.theme.templates):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Template key already exists in this theme")
    if values.get("is_default") is True:
        for item in template.theme.templates:
            if item.resource_type == template.resource_type and item.id != template.id:
                item.is_default = False
    if values.get("is_default") is False and template.is_default:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Choose another default template before removing this default")
    for field, value in values.items():
        setattr(template, field, value)
    await commit_or_409(db, "Could not update storefront template")
    return await get_template_or_404(db, template.id)


@router.post("/templates/{template_id}/duplicate", response_model=StorefrontTemplateRead, status_code=status.HTTP_201_CREATED)
async def duplicate_template_route(template_id: UUID, payload: StorefrontTemplateCreate, db: DBSession, current_user: User = Depends(get_current_user)) -> StorefrontTemplate:
    _ensure_admin(current_user)
    source = await get_template_or_404(db, template_id)
    if payload.resource_type != source.resource_type:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Duplicated templates must keep their resource type")
    return await duplicate_template(db, source, name=payload.name, key=payload.key)


@router.delete("/templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(template_id: UUID, db: DBSession, current_user: User = Depends(get_current_user)) -> Response:
    _ensure_admin(current_user)
    template = await get_template_or_404(db, template_id)
    ensure_draft_theme(template.theme)
    if template.is_default:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Default templates cannot be deleted until a replacement is selected")
    assigned = await assigned_resource_count(db, template)
    if assigned:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Template is assigned to {assigned} resource(s); reassign them before deleting")
    await db.delete(template)
    await commit_or_409(db, "Could not delete storefront template")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/themes/{theme_id}/section-groups", response_model=list[StorefrontSectionGroupRead])
async def list_section_groups(theme_id: UUID, db: DBSession, current_user: User = Depends(get_current_user)) -> list[StorefrontSectionGroup]:
    _ensure_admin(current_user)
    return (await get_theme_or_404(db, theme_id)).section_groups


@router.get("/themes/{theme_id}/style-classes", response_model=list[StorefrontStyleClassRead])
async def list_style_classes(theme_id: UUID, db: DBSession, current_user: User = Depends(get_current_user)) -> list[StorefrontStyleClassRead]:
    _ensure_admin(current_user)
    theme = await get_theme_or_404(db, theme_id)
    return [_style_class_read(item, theme) for item in sorted(theme.style_classes, key=lambda value: value.name.lower())]


@router.post("/themes/{theme_id}/style-classes", response_model=StorefrontStyleClassRead, status_code=status.HTTP_201_CREATED)
async def create_style_class(theme_id: UUID, payload: StorefrontStyleClassCreate, db: DBSession, current_user: User = Depends(get_current_user)) -> StorefrontStyleClassRead:
    _ensure_admin(current_user)
    theme = await get_theme_or_404(db, theme_id)
    ensure_draft_theme(theme)
    if any(item.name.lower() == payload.name.lower() for item in theme.style_classes):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Style class name already exists in this theme")
    item = StorefrontStyleClass(theme_id=theme.id, **payload.model_dump())
    db.add(item)
    await commit_or_409(db, "Could not create style class")
    await db.refresh(item)
    return _style_class_read(item, theme)


async def _style_class_or_404(db: DBSession, class_id: UUID) -> tuple[StorefrontStyleClass, StorefrontTheme]:
    item = await fetch_one_or_404(db, select(StorefrontStyleClass).where(StorefrontStyleClass.id == class_id), "Style class not found")
    return item, await get_theme_or_404(db, item.theme_id)


@router.patch("/style-classes/{class_id}", response_model=StorefrontStyleClassRead)
async def update_style_class(class_id: UUID, payload: StorefrontStyleClassUpdate, db: DBSession, current_user: User = Depends(get_current_user)) -> StorefrontStyleClassRead:
    _ensure_admin(current_user)
    item, theme = await _style_class_or_404(db, class_id)
    ensure_draft_theme(theme)
    values = payload.model_dump(exclude_unset=True)
    if values.get("name") and any(other.id != item.id and other.name.lower() == values["name"].lower() for other in theme.style_classes):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Style class name already exists in this theme")
    for key, value in values.items():
        setattr(item, key, value)
    await commit_or_409(db, "Could not update style class")
    return _style_class_read(item, theme)


@router.post("/style-classes/{class_id}/duplicate", response_model=StorefrontStyleClassRead, status_code=status.HTTP_201_CREATED)
async def duplicate_style_class(class_id: UUID, payload: StorefrontStyleClassCreate, db: DBSession, current_user: User = Depends(get_current_user)) -> StorefrontStyleClassRead:
    _ensure_admin(current_user)
    source, theme = await _style_class_or_404(db, class_id)
    ensure_draft_theme(theme)
    if any(item.name.lower() == payload.name.lower() for item in theme.style_classes):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Style class name already exists in this theme")
    duplicate = StorefrontStyleClass(theme_id=theme.id, name=payload.name, styles=deepcopy(source.styles), responsive=deepcopy(source.responsive), states=deepcopy(source.states))
    db.add(duplicate)
    await commit_or_409(db, "Could not duplicate style class")
    await db.refresh(duplicate)
    return _style_class_read(duplicate, theme)


@router.delete("/style-classes/{class_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_style_class(class_id: UUID, db: DBSession, current_user: User = Depends(get_current_user)) -> Response:
    _ensure_admin(current_user)
    item, theme = await _style_class_or_404(db, class_id)
    ensure_draft_theme(theme)
    usage = _style_class_read(item, theme).usage_count
    if usage:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Style class is used by {usage} node(s); remove those references before deleting")
    await db.delete(item)
    await commit_or_409(db, "Could not delete style class")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/templates/{template_id}/sections", response_model=StorefrontSectionRead, status_code=status.HTTP_201_CREATED)
async def create_template_section(template_id: UUID, payload: StorefrontSectionCreate, db: DBSession, current_user: User = Depends(get_current_user)) -> StorefrontSection:
    _ensure_admin(current_user)
    template = await get_template_or_404(db, template_id)
    ensure_draft_theme(template.theme)
    _validate_section_resource(payload.type, template.resource_type)
    section = StorefrontSection(template_id=template.id, **payload.model_dump())
    db.add(section)
    await commit_or_409(db, "Could not add template section")
    await db.refresh(section)
    return section


@router.post("/section-groups/{group_id}/sections", response_model=StorefrontSectionRead, status_code=status.HTTP_201_CREATED)
async def create_group_section(group_id: UUID, payload: StorefrontSectionCreate, db: DBSession, current_user: User = Depends(get_current_user)) -> StorefrontSection:
    _ensure_admin(current_user)
    group = await fetch_one_or_404(db, select(StorefrontSectionGroup).where(StorefrontSectionGroup.id == group_id), "Section group not found")
    theme = await get_theme_or_404(db, group.theme_id)
    ensure_draft_theme(theme)
    allowed = {"header": {"announcement_bar", "header"}, "footer": {"footer", "flexible_grid"}}
    if payload.type not in allowed.get(group.group_type, {payload.type}):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=f"{payload.type} is not supported in the {group.group_type} group")
    section = StorefrontSection(section_group_id=group.id, **payload.model_dump())
    db.add(section)
    await commit_or_409(db, "Could not add section-group section")
    await db.refresh(section)
    return section


async def _reorder_owner_sections(db: DBSession, sections: list[StorefrontSection], payload: SectionsReorderInput) -> None:
    by_id = {section.id: section for section in sections}
    if set(payload.ordered_ids) != set(by_id):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Reorder payload must contain every owned section exactly once")
    for index, section_id in enumerate(payload.ordered_ids):
        by_id[section_id].sort_order = index
    await commit_or_409(db, "Could not reorder storefront sections")


@router.post("/templates/{template_id}/sections/reorder")
async def reorder_template_sections(template_id: UUID, payload: SectionsReorderInput, db: DBSession, current_user: User = Depends(get_current_user)) -> dict[str, str]:
    _ensure_admin(current_user)
    template = await get_template_or_404(db, template_id)
    ensure_draft_theme(template.theme)
    await _reorder_owner_sections(db, template.sections, payload)
    return {"message": "Template sections reordered"}


@router.post("/section-groups/{group_id}/sections/reorder")
async def reorder_group_sections(group_id: UUID, payload: SectionsReorderInput, db: DBSession, current_user: User = Depends(get_current_user)) -> dict[str, str]:
    _ensure_admin(current_user)
    group = await fetch_one_or_404(db, select(StorefrontSectionGroup).where(StorefrontSectionGroup.id == group_id), "Section group not found")
    theme = await get_theme_or_404(db, group.theme_id)
    ensure_draft_theme(theme)
    sections = list((await db.execute(select(StorefrontSection).where(StorefrontSection.section_group_id == group.id))).scalars().all())
    await _reorder_owner_sections(db, sections, payload)
    return {"message": "Section-group sections reordered"}


@router.get("/themes/{theme_id}/preview", response_model=StorefrontResolvedTemplateRead)
async def preview_theme(theme_id: UUID, resource_type: str, db: DBSession, current_user: User = Depends(get_current_user)) -> StorefrontResolvedTemplateRead:
    _ensure_admin(current_user)
    theme, template = await resolve_template(db, resource_type, theme_id=theme_id, allow_draft=True)
    header = next((group for group in theme.section_groups if group.group_type == "header"), None)
    footer = next((group for group in theme.section_groups if group.group_type == "footer"), None)
    return StorefrontResolvedTemplateRead(theme=StorefrontThemeRead.model_validate(theme), template=StorefrontTemplateRead.model_validate(template), header_group=StorefrontSectionGroupRead.model_validate(header) if header else None, footer_group=StorefrontSectionGroupRead.model_validate(footer) if footer else None, resource_type=resource_type)
