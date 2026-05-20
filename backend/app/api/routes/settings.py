from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Request
from sqlalchemy import func, select

from app.api.deps import DBSession, get_current_user
from app.api.utils import commit_or_409
from app.models.access_control import ActivityLog, Permission
from app.models.business_settings import BusinessSettings
from app.models.invoice_template import InvoiceTemplate
from app.models.user import User
from app.schemas.business_settings import BusinessSettingsRead, BusinessSettingsUpdate, SettingsCenterSummaryRead
from app.services.activity_log_service import log_activity


router = APIRouter(dependencies=[Depends(get_current_user)])


async def get_or_create_business_settings(db: DBSession) -> BusinessSettings:
    result = await db.execute(select(BusinessSettings).limit(1))
    settings = result.scalar_one_or_none()

    if settings is None:
        settings = BusinessSettings()
        db.add(settings)
        await commit_or_409(db, "Could not initialize business settings")
        await db.refresh(settings)

    return settings


def _to_business_settings_read(settings: BusinessSettings) -> BusinessSettingsRead:
    return BusinessSettingsRead(
        id=settings.id,
        company_name=settings.company_name,
        business_email=settings.business_email,
        business_phone=settings.business_phone,
        business_address=settings.business_address,
        website=settings.website,
        currency=settings.currency,
        timezone=settings.timezone,
        invoice_prefix=settings.invoice_prefix,
        order_prefix=settings.order_prefix,
        invoice_title=settings.invoice_title,
        invoice_footer_note=settings.invoice_footer_note,
        invoice_terms=settings.invoice_terms,
        payment_instructions=settings.payment_instructions,
        show_logo_on_invoice=settings.show_logo_on_invoice,
        show_business_address_on_invoice=settings.show_business_address_on_invoice,
        show_customer_phone_on_invoice=settings.show_customer_phone_on_invoice,
        show_payment_status_on_invoice=settings.show_payment_status_on_invoice,
        show_warehouse_on_invoice=settings.show_warehouse_on_invoice,
        invoice_template=settings.invoice_template,
        invoice_accent_color=settings.invoice_accent_color,
        invoice_signature_label=settings.invoice_signature_label,
        low_stock_default_threshold=settings.low_stock_default_threshold,
        tax_rate=settings.tax_rate,
        logo_url=settings.logo_url,
        created_at=settings.created_at,
        updated_at=settings.updated_at,
        companyName=settings.company_name,
        businessName=settings.company_name,
        businessEmail=settings.business_email,
        businessPhone=settings.business_phone,
        businessAddress=settings.business_address,
        logoUrl=settings.logo_url,
        invoicePrefix=settings.invoice_prefix,
        orderPrefix=settings.order_prefix,
        invoiceTitle=settings.invoice_title,
        invoiceFooterNote=settings.invoice_footer_note,
        invoiceTerms=settings.invoice_terms,
        paymentInstructions=settings.payment_instructions,
        taxRate=settings.tax_rate,
        lowStockDefaultThreshold=settings.low_stock_default_threshold,
        createdAt=settings.created_at,
        updatedAt=settings.updated_at,
    )


@router.get("/business", response_model=BusinessSettingsRead)
async def get_business_settings(db: DBSession) -> BusinessSettings:
    return _to_business_settings_read(await get_or_create_business_settings(db))


@router.get("/center-summary", response_model=SettingsCenterSummaryRead)
async def get_settings_center_summary(db: DBSession) -> SettingsCenterSummaryRead:
    settings = await get_or_create_business_settings(db)
    recent_activity_cutoff = datetime.now(timezone.utc) - timedelta(days=7)

    profile_fields = [
        settings.company_name,
        settings.business_email,
        settings.business_phone,
        settings.business_address,
        settings.logo_url,
        settings.currency,
        settings.timezone,
    ]
    completed_profile_fields = sum(1 for value in profile_fields if value not in {None, ""})
    business_profile_completeness = int(round((completed_profile_fields / len(profile_fields)) * 100))

    active_users = int(await db.scalar(select(func.count()).select_from(User).where(User.is_active.is_(True))) or 0)
    pending_or_inactive_users = int(
        await db.scalar(select(func.count()).select_from(User).where(User.is_active.is_(False))) or 0
    )
    permissions_count = int(await db.scalar(select(func.count()).select_from(Permission)) or 0)
    recent_activity_count = int(
        await db.scalar(
            select(func.count()).select_from(ActivityLog).where(ActivityLog.created_at >= recent_activity_cutoff)
        )
        or 0
    )
    active_admin_count = int(
        await db.scalar(
            select(func.count()).select_from(User).where(
                User.is_active.is_(True),
                User.role.in_(["admin", "super_admin"]),
            )
        )
        or 0
    )
    default_invoice_template_configured = bool(
        await db.scalar(
            select(func.count()).select_from(InvoiceTemplate).where(
                InvoiceTemplate.is_active.is_(True),
                InvoiceTemplate.is_default.is_(True),
            )
        )
    )
    distinct_roles = list((await db.execute(select(User.role).distinct())).scalars().all())

    return SettingsCenterSummaryRead(
        business_profile_completeness=business_profile_completeness,
        invoice_settings_configured=bool(settings.invoice_title and settings.invoice_prefix and settings.order_prefix),
        default_invoice_template_configured=default_invoice_template_configured,
        active_users=active_users,
        pending_users=pending_or_inactive_users,
        inactive_users=pending_or_inactive_users,
        roles_count=len([role for role in distinct_roles if role]),
        permissions_count=permissions_count,
        recent_activity_count=recent_activity_count,
        has_active_admin=active_admin_count > 0,
        permissions_seeded=permissions_count > 0,
        backup_guidance_available=True,
        maintenance_checklist_available=True,
        system_health_status="ok",
    )


@router.patch("/business", response_model=BusinessSettingsRead)
async def update_business_settings(
    settings_in: BusinessSettingsUpdate,
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> BusinessSettings:
    settings = await get_or_create_business_settings(db)
    payload = settings_in.model_dump(exclude_unset=True)

    for field, value in payload.items():
        setattr(settings, field, value)

    await log_activity(
        db,
        user_id=current_user.id,
        action="business_settings_updated",
        module="settings",
        entity_type="business_settings",
        entity_id=settings.id,
        message="Updated business settings.",
        request=request,
    )
    await commit_or_409(db, "Could not update business settings")
    await db.refresh(settings)
    return _to_business_settings_read(settings)
