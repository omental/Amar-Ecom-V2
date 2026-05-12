from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, Response, status
from sqlalchemy import select

from app.api.deps import DBSession, get_current_user
from app.api.utils import commit_or_409, ensure_unique, fetch_one_or_404
from app.models.invoice_template import InvoiceTemplate
from app.models.user import User
from app.schemas.invoice_template import InvoiceTemplateCreate, InvoiceTemplateRead, InvoiceTemplateUpdate
from app.services.activity_log_service import log_activity


router = APIRouter(dependencies=[Depends(get_current_user)])


async def _get_invoice_template_or_404(db: DBSession, template_id: UUID) -> InvoiceTemplate:
    return await fetch_one_or_404(
        db,
        select(InvoiceTemplate).where(InvoiceTemplate.id == template_id),
        "Invoice template not found",
    )


async def _clear_other_defaults(db: DBSession, template_id: UUID) -> None:
    result = await db.execute(
        select(InvoiceTemplate).where(InvoiceTemplate.is_default.is_(True), InvoiceTemplate.id != template_id)
    )
    for template in result.scalars().all():
        template.is_default = False


@router.get("", response_model=list[InvoiceTemplateRead])
async def list_invoice_templates(
    db: DBSession,
    is_active: bool | None = Query(default=True),
) -> list[InvoiceTemplate]:
    stmt = select(InvoiceTemplate).order_by(InvoiceTemplate.is_default.desc(), InvoiceTemplate.name.asc())
    if is_active is not None:
        stmt = stmt.where(InvoiceTemplate.is_active.is_(is_active))
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get("/{template_id}", response_model=InvoiceTemplateRead)
async def get_invoice_template(template_id: UUID, db: DBSession) -> InvoiceTemplate:
    return await _get_invoice_template_or_404(db, template_id)


@router.post("", response_model=InvoiceTemplateRead, status_code=status.HTTP_201_CREATED)
async def create_invoice_template(
    template_in: InvoiceTemplateCreate,
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> InvoiceTemplate:
    await ensure_unique(db, InvoiceTemplate, "slug", template_in.slug, "Invoice template slug already exists")
    template = InvoiceTemplate(**template_in.model_dump())
    db.add(template)
    await db.flush()

    if template.is_default:
        await _clear_other_defaults(db, template.id)

    await log_activity(
        db,
        user_id=current_user.id,
        action="invoice_template_created",
        module="settings",
        entity_type="invoice_template",
        entity_id=template.id,
        message=f"Created invoice template {template.name}.",
        request=request,
    )
    await commit_or_409(db, "Could not create invoice template")
    await db.refresh(template)
    return template


@router.patch("/{template_id}", response_model=InvoiceTemplateRead)
async def update_invoice_template(
    template_id: UUID,
    template_in: InvoiceTemplateUpdate,
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> InvoiceTemplate:
    template = await _get_invoice_template_or_404(db, template_id)
    payload = template_in.model_dump(exclude_unset=True)

    if "slug" in payload and payload["slug"] != template.slug:
        await ensure_unique(
            db,
            InvoiceTemplate,
            "slug",
            payload["slug"],
            "Invoice template slug already exists",
            exclude_id=template.id,
        )

    for field, value in payload.items():
        setattr(template, field, value)

    if payload.get("is_default") is True:
        await _clear_other_defaults(db, template.id)
    if payload.get("is_active") is False:
        template.is_default = False

    await log_activity(
        db,
        user_id=current_user.id,
        action="invoice_template_updated",
        module="settings",
        entity_type="invoice_template",
        entity_id=template.id,
        message=f"Updated invoice template {template.name}.",
        request=request,
    )
    await commit_or_409(db, "Could not update invoice template")
    await db.refresh(template)
    return template


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_invoice_template(
    template_id: UUID,
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> Response:
    template = await _get_invoice_template_or_404(db, template_id)
    template.is_active = False
    template.is_default = False

    await log_activity(
        db,
        user_id=current_user.id,
        action="invoice_template_deactivated",
        module="settings",
        entity_type="invoice_template",
        entity_id=template.id,
        message=f"Deactivated invoice template {template.name}.",
        request=request,
    )
    await commit_or_409(db, "Could not deactivate invoice template")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{template_id}/set-default", response_model=InvoiceTemplateRead)
async def set_default_invoice_template(
    template_id: UUID,
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> InvoiceTemplate:
    template = await _get_invoice_template_or_404(db, template_id)
    template.is_default = True
    template.is_active = True
    await _clear_other_defaults(db, template.id)

    await log_activity(
        db,
        user_id=current_user.id,
        action="invoice_template_default_changed",
        module="settings",
        entity_type="invoice_template",
        entity_id=template.id,
        message=f"Set invoice template {template.name} as default.",
        request=request,
    )
    await commit_or_409(db, "Could not update default invoice template")
    await db.refresh(template)
    return template
