from datetime import timedelta

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy import func, select

from app.api.deps import DBSession, get_current_user, get_tenant_context
from app.core.config import settings
from app.core.security import create_access_token
from app.core.tenant import TenantContext
from app.models.tenant import OrganizationMember
from app.models.user import User
from app.schemas.onboarding import (
    AccountStateResponse,
    ExistingMerchantProvisionRequest,
    MerchantSignupRequest,
    MerchantSignupResponse,
    OnboardingProgressRead,
    OnboardingProgressUpdate,
    ProvisionedStoreResponse,
    SlugAvailabilityResponse,
    VerifyEmailRequest,
)
from app.schemas.user import TokenResponse
from app.services.merchant_provisioning_service import (
    get_onboarding_progress,
    is_store_slug_available,
    provision_merchant_store,
    provision_existing_merchant,
    update_onboarding_progress,
    verify_merchant_email,
)
from app.services.permission_service import get_default_permission_keys
from app.services.tenant_service import get_accessible_stores
from app.services.store_domain_service import get_development_storefront_url, get_platform_hostname, get_storefront_url_for_hostname


router = APIRouter()


@router.get("/slug-availability", response_model=SlugAvailabilityResponse)
async def slug_availability(
    response: Response,
    db: DBSession,
    slug: str = Query(min_length=1, max_length=100),
) -> SlugAvailabilityResponse:
    response.headers["Cache-Control"] = "no-store"
    normalized, available = await is_store_slug_available(db, slug)
    return SlugAvailabilityResponse(slug=normalized, available=available)


@router.post("/signup", response_model=MerchantSignupResponse, status_code=status.HTTP_201_CREATED)
async def merchant_signup(payload: MerchantSignupRequest, db: DBSession) -> MerchantSignupResponse:
    result = await provision_merchant_store(db, payload)
    return MerchantSignupResponse(
        message=(
            "Your store is ready. Verify your email to continue."
            if result.verification_token
            else "Your store is ready, but production email delivery is not configured yet."
        ),
        verification_token=result.verification_token,
        store_name=result.store.name,
        store_slug=result.store.slug,
        future_store_url=get_storefront_url_for_hostname(get_platform_hostname(result.store)),
        storefront_url=(
            get_development_storefront_url(result.store)
            if settings.APP_ENV in {"development", "test"}
            else get_storefront_url_for_hostname(get_platform_hostname(result.store))
        ),
    )


@router.post("/verify-email", response_model=TokenResponse)
async def verify_email(payload: VerifyEmailRequest, db: DBSession) -> TokenResponse:
    user = await verify_merchant_email(db, payload.token)
    access_token = create_access_token(
        subject=str(user.id),
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )
    return TokenResponse(access_token=access_token, user=user, permissions=get_default_permission_keys())


@router.get("/account-state", response_model=AccountStateResponse)
async def account_state(
    db: DBSession,
    current_user: User = Depends(get_current_user),
) -> AccountStateResponse:
    stores = await get_accessible_stores(db, current_user)
    organization_memberships = int(
        await db.scalar(
            select(func.count()).select_from(OrganizationMember).where(
                OrganizationMember.user_id == current_user.id,
                OrganizationMember.status == "active",
            )
        )
        or 0
    )
    return AccountStateResponse(
        email_verified=current_user.email_verified_at is not None,
        has_store=bool(stores),
        requires_provisioning=not stores and organization_memberships == 0,
    )


@router.get("/progress", response_model=OnboardingProgressRead)
async def onboarding_progress(
    db: DBSession,
    _ctx: TenantContext = Depends(get_tenant_context),
) -> OnboardingProgressRead:
    return await get_onboarding_progress(db)


@router.post("/provision", response_model=ProvisionedStoreResponse, status_code=status.HTTP_201_CREATED)
async def provision_existing_account(
    payload: ExistingMerchantProvisionRequest,
    db: DBSession,
    current_user: User = Depends(get_current_user),
) -> ProvisionedStoreResponse:
    result = await provision_existing_merchant(db, user=current_user, payload=payload)
    return ProvisionedStoreResponse(organization_name=result.organization.name, store=result.store)


@router.patch("/progress", response_model=OnboardingProgressRead)
async def patch_onboarding_progress(
    payload: OnboardingProgressUpdate,
    db: DBSession,
    ctx: TenantContext = Depends(get_tenant_context),
) -> OnboardingProgressRead:
    return await update_onboarding_progress(
        db,
        step=payload.step,
        completed=payload.completed,
        dismissed=payload.dismissed,
        user_id=ctx.user.id,
    )
