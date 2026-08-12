from __future__ import annotations

from dataclasses import asdict
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select

from app.api.deps import DBSession, get_current_user, get_entitlement_context, get_tenant_context, require_platform_admin
from app.core.tenant import TenantContext, tenant_scope
from app.models.access_control import ActivityLog
from app.models.commercial import Plan, PlanEntitlement, StoreEntitlementOverride, StorePlanAssignment
from app.models.tenant import Store
from app.models.user import User
from app.schemas.commercial import (
    CommercialSummaryRead, FeatureDefinitionRead, PlanEntitlementsUpdate, PlanRead,
    PlatformPlanCreate, PlatformPlanUpdate, StoreOverrideCreate, StoreOverrideRead,
    StorePlanAssignInput, TrialExtendInput, TrialRead, UsageRead,
)
from app.services.commercial_access_service import EntitlementService, UsageService, assign_plan, ensure_commercial_catalog, plan_snapshot, usage_result
from app.services.commercial_registry import FEATURE_REGISTRY, complete_entitlements


router = APIRouter()
platform_router = APIRouter(dependencies=[Depends(require_platform_admin)])
LIMIT_KEYS = ("product_limit", "staff_limit", "warehouse_limit", "store_limit", "theme_count_limit")


async def _plan_read(db: DBSession, plan: Plan) -> PlanRead:
    return PlanRead(
        id=plan.id, key=plan.key, version=plan.version, name=plan.name, description=plan.description,
        status=plan.status, sort_order=plan.sort_order, is_public=plan.is_public,
        monthly_price_display=plan.monthly_price_display, annual_price_display=plan.annual_price_display,
        trial_days=plan.trial_days, entitlements=await plan_snapshot(db, plan),
    )


@router.get("/plans", response_model=list[PlanRead])
async def public_plan_catalog(db: DBSession) -> list[PlanRead]:
    await ensure_commercial_catalog(db)
    plans = list((await db.execute(select(Plan).where(Plan.status == "active", Plan.is_public.is_(True)).order_by(Plan.sort_order))).scalars().all())
    return [await _plan_read(db, plan) for plan in plans]


@router.get("/features", response_model=list[FeatureDefinitionRead])
async def public_feature_catalog(db: DBSession) -> list[FeatureDefinitionRead]:
    await ensure_commercial_catalog(db)
    return [FeatureDefinitionRead(**asdict(item)) for item in FEATURE_REGISTRY.values()]


@router.get("/summary", response_model=CommercialSummaryRead, dependencies=[Depends(get_current_user)])
async def commercial_summary(
    db: DBSession,
    ctx: TenantContext = Depends(get_tenant_context),
    access: EntitlementService = Depends(get_entitlement_context),
) -> CommercialSummaryRead:
    effective = await access.resolve()
    usage_service = UsageService(db, store_id=ctx.store.id, organization_id=ctx.organization.id)
    usage: dict[str, UsageRead] = {}
    for key in LIMIT_KEYS:
        amount = await usage_service.get_usage(key)
        item = usage_result(key, amount, await access.get_limit(key))
        usage[key] = UsageRead(**asdict(item))
    plan = await db.get(Plan, effective.assignment.plan_id)
    if plan is None:
        raise HTTPException(status_code=503, detail="Commercial plan configuration is unavailable")
    return CommercialSummaryRead(
        store_id=ctx.store.id,
        plan=await _plan_read(db, plan),
        status=effective.status,
        trial=TrialRead(
            started_at=effective.assignment.trial_started_at,
            ends_at=effective.assignment.trial_ends_at,
            days_remaining=effective.trial_days_remaining,
        ),
        entitlements=effective.entitlements,
        usage=usage,
    )


@router.get("/usage", response_model=dict[str, UsageRead], dependencies=[Depends(get_current_user)])
async def current_usage(
    db: DBSession,
    ctx: TenantContext = Depends(get_tenant_context),
    access: EntitlementService = Depends(get_entitlement_context),
) -> dict[str, UsageRead]:
    service = UsageService(db, store_id=ctx.store.id, organization_id=ctx.organization.id)
    output: dict[str, UsageRead] = {}
    for key in LIMIT_KEYS:
        item = usage_result(key, await service.get_usage(key), await access.get_limit(key))
        output[key] = UsageRead(**asdict(item))
    return output


@platform_router.get("/plans", response_model=list[PlanRead])
async def platform_plans(db: DBSession) -> list[PlanRead]:
    await ensure_commercial_catalog(db)
    plans = list((await db.execute(select(Plan).order_by(Plan.key, Plan.version.desc()))).scalars().all())
    return [await _plan_read(db, plan) for plan in plans]


@platform_router.post("/plans", response_model=PlanRead, status_code=201)
async def create_plan(payload: PlatformPlanCreate, db: DBSession) -> PlanRead:
    if await db.scalar(select(Plan.id).where(Plan.key == payload.key, Plan.version == payload.version)):
        raise HTTPException(status_code=409, detail="This plan key and version already exist")
    values = payload.model_dump(exclude={"entitlements"})
    plan = Plan(**values)
    db.add(plan)
    await db.flush()
    for key, value in complete_entitlements(payload.entitlements).items():
        db.add(PlanEntitlement(plan_id=plan.id, feature_key=key, value=value))
    await db.commit()
    return await _plan_read(db, plan)


@platform_router.patch("/plans/{plan_id}", response_model=PlanRead)
async def update_plan(plan_id: UUID, payload: PlatformPlanUpdate, db: DBSession) -> PlanRead:
    plan = await db.get(Plan, plan_id)
    if plan is None:
        raise HTTPException(status_code=404, detail="Plan not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(plan, field, value)
    await db.commit()
    return await _plan_read(db, plan)


@platform_router.put("/plans/{plan_id}/entitlements", response_model=PlanRead)
async def update_plan_entitlements(plan_id: UUID, payload: PlanEntitlementsUpdate, db: DBSession) -> PlanRead:
    plan = await db.get(Plan, plan_id)
    if plan is None:
        raise HTTPException(status_code=404, detail="Plan not found")
    existing = {item.feature_key: item for item in (await db.execute(select(PlanEntitlement).where(PlanEntitlement.plan_id == plan.id))).scalars().all()}
    for key, value in payload.entitlements.items():
        if key in existing:
            existing[key].value = value
        else:
            db.add(PlanEntitlement(plan_id=plan.id, feature_key=key, value=value))
    await db.commit()
    return await _plan_read(db, plan)


@platform_router.post("/stores/{store_id}/assignment", response_model=CommercialSummaryRead)
async def platform_assign_store_plan(
    store_id: UUID,
    payload: StorePlanAssignInput,
    db: DBSession,
    actor: User = Depends(require_platform_admin),
) -> CommercialSummaryRead:
    store = await db.scalar(select(Store).where(Store.id == store_id).execution_options(include_all_stores=True))
    plan = await db.get(Plan, payload.plan_id)
    if store is None or plan is None or plan.status == "archived":
        raise HTTPException(status_code=404, detail="Store or plan not found")
    with tenant_scope(store_id=store.id, organization_id=store.organization_id):
        assignment = await assign_plan(db, store_id=store.id, plan=plan, source="platform", start_trial=payload.start_trial)
        db.add(ActivityLog(organization_id=store.organization_id, user_id=actor.id, action="plan_changed", module="commercial", entity_type="store", entity_id=str(store.id), message=f"Store assigned to {plan.key} v{plan.version}."))
        await db.commit()
        service = EntitlementService(db, store_id=store.id, organization_id=store.organization_id)
        effective = await service.resolve()
        usage_service = UsageService(db, store_id=store.id, organization_id=store.organization_id)
        usage = {}
        for key in LIMIT_KEYS:
            item = usage_result(key, await usage_service.get_usage(key), await service.get_limit(key))
            usage[key] = UsageRead(**asdict(item))
        return CommercialSummaryRead(store_id=store.id, plan=await _plan_read(db, plan), status=effective.status, trial=TrialRead(started_at=assignment.trial_started_at, ends_at=assignment.trial_ends_at, days_remaining=effective.trial_days_remaining), entitlements=effective.entitlements, usage=usage)


@platform_router.post("/stores/{store_id}/overrides", response_model=StoreOverrideRead, status_code=201)
async def create_override(store_id: UUID, payload: StoreOverrideCreate, db: DBSession, actor: User = Depends(require_platform_admin)) -> StoreEntitlementOverride:
    store = await db.scalar(select(Store).where(Store.id == store_id).execution_options(include_all_stores=True))
    if store is None:
        raise HTTPException(status_code=404, detail="Store not found")
    if payload.ends_at and payload.starts_at and payload.ends_at <= payload.starts_at:
        raise HTTPException(status_code=422, detail="Override end must follow its start")
    with tenant_scope(store_id=store.id, organization_id=store.organization_id):
        item = StoreEntitlementOverride(feature_key=payload.feature_key, value=payload.validated_value(), reason=payload.reason, starts_at=payload.starts_at or datetime.now(timezone.utc), ends_at=payload.ends_at, created_by_id=actor.id)
        db.add(item)
        db.add(ActivityLog(organization_id=store.organization_id, user_id=actor.id, action="entitlement_override_added", module="commercial", entity_type="store_entitlement_override", entity_id=str(item.id), message=f"Override added for {payload.feature_key}."))
        await db.commit()
        await db.refresh(item)
        return item


@platform_router.get("/stores/{store_id}/overrides", response_model=list[StoreOverrideRead])
async def list_overrides(store_id: UUID, db: DBSession) -> list[StoreEntitlementOverride]:
    store = await db.scalar(select(Store).where(Store.id == store_id).execution_options(include_all_stores=True))
    if store is None:
        raise HTTPException(status_code=404, detail="Store not found")
    with tenant_scope(store_id=store.id, organization_id=store.organization_id):
        return list((await db.execute(select(StoreEntitlementOverride).order_by(StoreEntitlementOverride.created_at.desc()))).scalars().all())


@platform_router.post("/stores/{store_id}/trial-extension", response_model=CommercialSummaryRead)
async def extend_trial(
    store_id: UUID,
    payload: TrialExtendInput,
    db: DBSession,
    actor: User = Depends(require_platform_admin),
) -> CommercialSummaryRead:
    from datetime import timedelta

    store = await db.scalar(select(Store).where(Store.id == store_id).execution_options(include_all_stores=True))
    if store is None:
        raise HTTPException(status_code=404, detail="Store not found")
    with tenant_scope(store_id=store.id, organization_id=store.organization_id):
        assignment = await db.scalar(select(StorePlanAssignment).where(StorePlanAssignment.store_id == store.id))
        if assignment is None:
            raise HTTPException(status_code=404, detail="Commercial assignment not found")
        now = datetime.now(timezone.utc)
        assignment.status = "trialing"
        assignment.trial_started_at = assignment.trial_started_at or now
        assignment.trial_ends_at = max(now, assignment.trial_ends_at or now) + timedelta(days=payload.days)
        db.add(ActivityLog(organization_id=store.organization_id, user_id=actor.id, action="trial_extended", module="commercial", entity_type="store_plan_assignment", entity_id=str(assignment.id), message=f"Trial extended by {payload.days} days: {payload.reason}"))
        await db.commit()
        service = EntitlementService(db, store_id=store.id, organization_id=store.organization_id)
        effective = await service.resolve()
        plan = await db.get(Plan, assignment.plan_id)
        if plan is None:
            raise HTTPException(status_code=503, detail="Commercial plan configuration is unavailable")
        usage_service = UsageService(db, store_id=store.id, organization_id=store.organization_id)
        usage = {}
        for key in LIMIT_KEYS:
            item = usage_result(key, await usage_service.get_usage(key), await service.get_limit(key))
            usage[key] = UsageRead(**asdict(item))
        return CommercialSummaryRead(store_id=store.id, plan=await _plan_read(db, plan), status=effective.status, trial=TrialRead(started_at=assignment.trial_started_at, ends_at=assignment.trial_ends_at, days_remaining=effective.trial_days_remaining), entitlements=effective.entitlements, usage=usage)


@platform_router.delete("/stores/{store_id}/overrides/{override_id}", status_code=204)
async def delete_override(store_id: UUID, override_id: UUID, db: DBSession, actor: User = Depends(require_platform_admin)) -> Response:
    store = await db.scalar(select(Store).where(Store.id == store_id).execution_options(include_all_stores=True))
    if store is None:
        raise HTTPException(status_code=404, detail="Store not found")
    with tenant_scope(store_id=store.id, organization_id=store.organization_id):
        item = await db.scalar(select(StoreEntitlementOverride).where(StoreEntitlementOverride.id == override_id))
        if item is None:
            raise HTTPException(status_code=404, detail="Override not found")
        await db.delete(item)
        db.add(ActivityLog(organization_id=store.organization_id, user_id=actor.id, action="entitlement_override_removed", module="commercial", entity_type="store_entitlement_override", entity_id=str(override_id), message=f"Override removed for {item.feature_key}."))
        await db.commit()
    return Response(status_code=204)
