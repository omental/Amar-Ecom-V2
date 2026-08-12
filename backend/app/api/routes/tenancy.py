from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import DBSession, get_entitlement_context, get_tenant_context
from app.core.tenant import TenantContext
from app.models.tenant import Store
from app.schemas.tenant import CurrentTenantResponse, StoreCreate, StoreSummary, StoreSwitchResponse, StoreUpdate
from app.services.tenant_service import get_accessible_stores
from app.services.merchant_provisioning_service import provision_additional_store
from app.services.commercial_access_service import EntitlementService


router = APIRouter()


@router.post("/stores", response_model=StoreSummary, status_code=201)
async def create_store(
    payload: StoreCreate,
    db: DBSession,
    ctx: TenantContext = Depends(get_tenant_context),
    access: EntitlementService = Depends(get_entitlement_context),
) -> Store:
    if ctx.organization_membership.role != "owner":
        raise HTTPException(status_code=403, detail="Organization owner access required")
    await access.require_capacity("store_limit")
    return await provision_additional_store(
        db,
        organization=ctx.organization,
        user=ctx.user,
        store_name=payload.name,
        store_slug=payload.slug,
        timezone_name=payload.timezone,
        locale=payload.locale,
        currency=payload.default_currency,
    )


@router.get("/current", response_model=CurrentTenantResponse)
async def current_tenant(
    db: DBSession,
    ctx: TenantContext = Depends(get_tenant_context),
) -> CurrentTenantResponse:
    stores = await get_accessible_stores(db, ctx.user)
    return CurrentTenantResponse(
        organization=ctx.organization,
        store=ctx.store,
        stores=stores,
        organization_role=ctx.organization_membership.role,
        store_role=ctx.store_membership.role if ctx.store_membership else None,
    )


@router.post("/switch/{store_slug}", response_model=StoreSwitchResponse)
async def switch_store(
    store_slug: str,
    db: DBSession,
    ctx: TenantContext = Depends(get_tenant_context),
) -> StoreSwitchResponse:
    stores = await get_accessible_stores(db, ctx.user)
    store = next((candidate for candidate in stores if candidate.slug == store_slug), None)
    if store is None:
        raise HTTPException(status_code=404, detail="Store not found")
    return StoreSwitchResponse(store=store, selected_at=datetime.now(timezone.utc))


@router.patch("/current-store", response_model=StoreSummary)
async def update_current_store(
    payload: StoreUpdate,
    db: DBSession,
    ctx: TenantContext = Depends(get_tenant_context),
) -> Store:
    if ctx.organization_membership.role not in {"owner", "admin"}:
        raise HTTPException(status_code=403, detail="Organization admin access required")
    if payload.slug and payload.slug != ctx.store.slug:
        raise HTTPException(status_code=409, detail="Store URL is immutable after provisioning")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(ctx.store, field, value)
    await db.commit()
    await db.refresh(ctx.store)
    return ctx.store
