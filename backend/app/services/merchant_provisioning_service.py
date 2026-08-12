from __future__ import annotations

import hashlib
import logging
import secrets
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import get_password_hash
from app.core.tenant import tenant_scope
from app.models.access_control import ActivityLog
from app.models.ai_commerce import CommerceAISettings
from app.models.business_settings import BusinessSettings
from app.models.product import Product
from app.models.storefront import StorefrontTheme
from app.models.tenant import Organization, OrganizationMember, Store, StoreMember, StoreOnboarding, normalize_store_slug
from app.models.user import User
from app.models.warehouse import Warehouse
from app.schemas.onboarding import ExistingMerchantProvisionRequest, MerchantSignupRequest, OnboardingProgressRead, OnboardingStepRead
from app.services.storefront_theme_service import ensure_default_theme
from app.services.commercial_access_service import assign_signup_plan
from app.services.store_domain_service import ensure_platform_domain


logger = logging.getLogger(__name__)
VERIFICATION_TTL = timedelta(hours=24)
ONBOARDING_STEPS = (
    ("add_product", "Add your first product", "/dashboard/products"),
    ("customize_storefront", "Customize your storefront", "/dashboard/online-store/customize"),
    ("configure_delivery", "Configure delivery", "/dashboard/settings"),
    ("business_information", "Add business information", "/dashboard/settings"),
    ("preview_store", "Preview your store", "/dashboard/online-store/preview"),
    ("publish_storefront", "Publish your storefront", "/dashboard/online-store/themes"),
)


@dataclass(slots=True)
class ProvisioningResult:
    user: User
    organization: Organization
    store: Store
    verification_token: str | None = None


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _organization_slug(name: str) -> str:
    base = normalize_store_slug(name) or "merchant"
    return f"{base[:48].rstrip('-')}-{uuid.uuid4().hex[:10]}"


async def _assert_store_slug_available(db: AsyncSession, slug: str) -> None:
    existing = await db.scalar(
        select(Store.id).where(Store.slug == slug).execution_options(include_all_stores=True)
    )
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="That store URL is unavailable")


async def is_store_slug_available(db: AsyncSession, requested_slug: str) -> tuple[str, bool]:
    from app.models.tenant import is_valid_store_slug

    slug = normalize_store_slug(requested_slug)
    if not is_valid_store_slug(slug):
        return slug, False
    existing = await db.scalar(
        select(Store.id).where(Store.slug == slug).execution_options(include_all_stores=True)
    )
    return slug, existing is None


async def _bootstrap_store(
    db: AsyncSession,
    *,
    organization: Organization,
    user: User,
    store_name: str,
    store_slug: str,
    timezone_name: str,
    locale: str,
    currency: str,
    is_primary: bool,
) -> Store:
    await _assert_store_slug_available(db, store_slug)
    store = Store(
        organization_id=organization.id,
        name=store_name.strip(),
        slug=store_slug,
        status="provisioning",
        timezone=timezone_name,
        locale=locale,
        default_currency=currency,
        is_primary=is_primary,
    )
    db.add(store)
    await db.flush()
    db.add(StoreMember(store_id=store.id, user_id=user.id, role="admin", status="active"))

    with tenant_scope(store_id=store.id, organization_id=organization.id):
        await ensure_platform_domain(db, store)
        db.add(
            BusinessSettings(
                company_name=organization.name,
                business_email=user.email,
                currency=currency,
                timezone=timezone_name,
            )
        )
        db.add(Warehouse(name="Main Warehouse", code="MAIN", is_active=True))
        await ensure_default_theme(
            db,
            user.id,
            commit=False,
            brand_name=store.name,
            email=user.email,
            currency=currency,
        )
        assignment = await assign_signup_plan(db, store_id=store.id)
        db.add(StoreOnboarding(store_id=store.id, status="in_progress", current_step="add_product"))
        db.add(CommerceAISettings(organization_id=organization.id, store_id=store.id, enabled=False, mode="off"))
        for action, entity_type, entity_id, message in (
            ("merchant_account_created", "user", user.id, "Merchant owner account created."),
            ("organization_created", "organization", organization.id, "Merchant organization created."),
            ("store_created", "store", store.id, "Merchant store created."),
            ("store_provisioning_completed", "store", store.id, "Initial store provisioning completed."),
            ("plan_assigned", "store_plan_assignment", assignment.id, f"Store assigned to {assignment.plan_key_snapshot}."),
            ("trial_started", "store_plan_assignment", assignment.id, "Commercial trial started." if assignment.status == "trialing" else "Commercial access activated."),
        ):
            db.add(
                ActivityLog(
                    organization_id=organization.id,
                    user_id=user.id,
                    action=action,
                    module="onboarding",
                    entity_type=entity_type,
                    entity_id=str(entity_id),
                    message=message,
                )
            )
        store.status = "active"
        await db.flush()
    return store


async def provision_merchant_store(db: AsyncSession, payload: MerchantSignupRequest) -> ProvisioningResult:
    """Atomically create the merchant identity, tenant graph, and pristine storefront."""
    normalized_email = str(payload.email).strip().lower()
    verification_token = secrets.token_urlsafe(32)
    now = datetime.now(timezone.utc)
    try:
        if await db.scalar(select(User.id).where(func.lower(User.email) == normalized_email)) is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Unable to create an account with those details",
            )
        user = User(
            full_name=payload.full_name.strip(),
            email=normalized_email,
            hashed_password=get_password_hash(payload.password),
            role="admin",
            is_active=True,
            email_verified_at=None,
            email_verification_token_hash=_token_hash(verification_token),
            email_verification_expires_at=now + VERIFICATION_TTL,
        )
        db.add(user)
        await db.flush()
        organization = Organization(
            name=payload.business_name.strip(),
            slug=_organization_slug(payload.business_name),
            status="active",
        )
        db.add(organization)
        await db.flush()
        db.add(
            OrganizationMember(
                organization_id=organization.id,
                user_id=user.id,
                role="owner",
                status="active",
            )
        )
        store = await _bootstrap_store(
            db,
            organization=organization,
            user=user,
            store_name=payload.store_name,
            store_slug=payload.store_slug,
            timezone_name=payload.timezone,
            locale=payload.locale,
            currency=payload.currency,
            is_primary=True,
        )
        await db.commit()
        await db.refresh(user)
        await db.refresh(store)
    except HTTPException:
        await db.rollback()
        raise
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Unable to create an account or store with those details",
        ) from exc
    except Exception as exc:
        await db.rollback()
        logger.exception("Merchant provisioning failed", extra={"email": normalized_email})
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Store provisioning could not be completed. Please retry safely.",
        ) from exc

    if settings.APP_ENV in {"development", "test"}:
        logger.info(
            "Development email verification URL: %s/verify-email?token=%s",
            settings.FRONTEND_URL.rstrip("/"),
            verification_token,
        )
        preview_token: str | None = verification_token
    else:
        logger.warning("Merchant created but no production email delivery provider is configured", extra={"user_id": str(user.id)})
        preview_token = None
    return ProvisioningResult(user=user, organization=organization, store=store, verification_token=preview_token)


async def provision_additional_store(
    db: AsyncSession,
    *,
    organization: Organization,
    user: User,
    store_name: str,
    store_slug: str,
    timezone_name: str,
    locale: str,
    currency: str,
) -> Store:
    try:
        store = await _bootstrap_store(
            db,
            organization=organization,
            user=user,
            store_name=store_name,
            store_slug=store_slug,
            timezone_name=timezone_name,
            locale=locale,
            currency=currency,
            is_primary=False,
        )
        await db.commit()
        await db.refresh(store)
        return store
    except HTTPException:
        await db.rollback()
        raise
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="That store URL is unavailable") from exc
    except Exception as exc:
        await db.rollback()
        logger.exception(
            "Additional store provisioning failed",
            extra={"user_id": str(user.id), "organization_id": str(organization.id)},
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Store provisioning could not be completed. Please retry safely.",
        ) from exc


async def provision_existing_merchant(
    db: AsyncSession,
    *,
    user: User,
    payload: ExistingMerchantProvisionRequest,
) -> ProvisioningResult:
    active_membership = await db.scalar(
        select(OrganizationMember.id).where(
            OrganizationMember.user_id == user.id,
            OrganizationMember.status == "active",
        )
    )
    if active_membership is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This account already belongs to an organization but has no accessible store",
        )
    try:
        organization = Organization(
            name=payload.business_name.strip(),
            slug=_organization_slug(payload.business_name),
            status="active",
        )
        db.add(organization)
        await db.flush()
        db.add(
            OrganizationMember(
                organization_id=organization.id,
                user_id=user.id,
                role="owner",
                status="active",
            )
        )
        user.role = "admin"
        store = await _bootstrap_store(
            db,
            organization=organization,
            user=user,
            store_name=payload.store_name,
            store_slug=payload.store_slug,
            timezone_name=payload.timezone,
            locale=payload.locale,
            currency=payload.currency,
            is_primary=True,
        )
        await db.commit()
        await db.refresh(store)
        return ProvisioningResult(user=user, organization=organization, store=store)
    except HTTPException:
        await db.rollback()
        raise
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="That store URL is unavailable") from exc
    except Exception as exc:
        await db.rollback()
        logger.exception("Existing merchant provisioning failed", extra={"user_id": str(user.id)})
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Store provisioning could not be completed. Please retry safely.",
        ) from exc


async def verify_merchant_email(db: AsyncSession, token: str) -> User:
    now = datetime.now(timezone.utc)
    user = await db.scalar(
        select(User).where(
            User.email_verification_token_hash == _token_hash(token),
            User.email_verification_expires_at.is_not(None),
            User.email_verification_expires_at >= now,
        )
    )
    if user is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Verification link is invalid or expired")
    user.email_verified_at = now
    user.email_verification_token_hash = None
    user.email_verification_expires_at = None
    await db.commit()
    await db.refresh(user)
    return user


async def get_onboarding_progress(db: AsyncSession) -> OnboardingProgressRead:
    onboarding = await db.scalar(select(StoreOnboarding).limit(1))
    if onboarding is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Onboarding state not found")

    product_exists = bool(
        await db.scalar(select(func.count()).select_from(Product).where(Product.status == "active"))
    )
    draft_theme_exists = bool(
        await db.scalar(select(func.count()).select_from(StorefrontTheme).where(StorefrontTheme.status == "draft"))
    )
    published_theme_exists = bool(
        await db.scalar(select(func.count()).select_from(StorefrontTheme).where(StorefrontTheme.status == "published"))
    )
    business_settings_exists = bool(await db.scalar(select(func.count()).select_from(BusinessSettings)))
    derived = {
        "add_product": product_exists,
        "customize_storefront": draft_theme_exists,
        "business_information": business_settings_exists,
        "publish_storefront": published_theme_exists,
    }
    completed = set(onboarding.completed_steps or [])
    completed.update(key for key, value in derived.items() if value)
    ordered_completed = [key for key, _, _ in ONBOARDING_STEPS if key in completed]
    all_complete = len(ordered_completed) == len(ONBOARDING_STEPS)
    steps = [
        OnboardingStepRead(
            key=key,
            label=label,
            completed=key in completed,
            derived=bool(derived.get(key)),
            href=href,
        )
        for key, label, href in ONBOARDING_STEPS
    ]
    return OnboardingProgressRead(
        status="completed" if all_complete else onboarding.status,
        current_step="completed" if all_complete else next((step.key for step in steps if not step.completed), "completed"),
        completed_steps=ordered_completed,
        steps=steps,
        dismissed_at=onboarding.dismissed_at,
        completed_at=onboarding.completed_at,
        completion_percent=round((len(ordered_completed) / len(ONBOARDING_STEPS)) * 100),
    )


async def update_onboarding_progress(
    db: AsyncSession,
    *,
    step: str | None,
    completed: bool,
    dismissed: bool | None,
    user_id: uuid.UUID,
) -> OnboardingProgressRead:
    onboarding = await db.scalar(select(StoreOnboarding).limit(1))
    if onboarding is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Onboarding state not found")
    values = set(onboarding.completed_steps or [])
    if step:
        if completed:
            values.add(step)
        else:
            values.discard(step)
    onboarding.completed_steps = [key for key, _, _ in ONBOARDING_STEPS if key in values]
    if dismissed is True:
        onboarding.dismissed_at = datetime.now(timezone.utc)
    elif dismissed is False:
        onboarding.dismissed_at = None
    progress = await get_onboarding_progress(db)
    onboarding.current_step = progress.current_step
    onboarding.status = progress.status
    if progress.status == "completed" and onboarding.completed_at is None:
        onboarding.completed_at = datetime.now(timezone.utc)
        db.add(
            ActivityLog(
                user_id=user_id,
                action="onboarding_completed",
                module="onboarding",
                entity_type="store",
                entity_id=str(onboarding.store_id),
                message="Store onboarding checklist completed.",
            )
        )
    await db.commit()
    return await get_onboarding_progress(db)
