from __future__ import annotations

import math
import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Callable

from fastapi import HTTPException, status
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.tenant import tenant_scope
from app.models.access_control import ActivityLog
from app.models.ai_commerce import AIUsageEvent
from app.models.billing import StoreSubscription
from app.models.commercial import FeatureDefinition, Plan, PlanEntitlement, StoreEntitlementOverride, StorePlanAssignment
from app.models.product import Product
from app.models.storefront import StorefrontTheme
from app.models.tenant import OrganizationMember, Store, StoreMember
from app.models.warehouse import Warehouse
from app.services.commercial_registry import FEATURE_REGISTRY, PLAN_CATALOG, PLAN_DEFAULTS, FeatureValue, complete_entitlements, validate_feature_value


Clock = Callable[[], datetime]
logger = logging.getLogger(__name__)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def entitlement_error(feature_key: str, message: str | None = None) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={
            "code": "ENTITLEMENT_REQUIRED",
            "feature": feature_key,
            "message": message or "This feature is not available on your current plan.",
        },
    )


def limit_error(feature_key: str, *, limit: int | float, usage: int | float) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail={
            "code": "PLAN_LIMIT_REACHED",
            "feature": feature_key,
            "limit": limit,
            "usage": usage,
            "message": f"Your plan limit for {FEATURE_REGISTRY[feature_key].name.lower()} has been reached.",
        },
    )


@dataclass(frozen=True, slots=True)
class EffectiveCommercialAccess:
    assignment: StorePlanAssignment
    status: str
    entitlements: dict[str, FeatureValue]
    trial_days_remaining: int | None


@dataclass(frozen=True, slots=True)
class UsageResult:
    feature: str
    usage: int | float
    limit: int | float | None
    remaining: int | float | None
    over_limit: bool


async def ensure_commercial_catalog(db: AsyncSession) -> dict[str, Plan]:
    definitions = {item.key: item for item in (await db.execute(select(FeatureDefinition))).scalars().all()}
    for key, registered in FEATURE_REGISTRY.items():
        definition = definitions.get(key)
        if definition is None:
            db.add(FeatureDefinition(
                key=key, name=registered.name, description=registered.description,
                category=registered.category, value_type=registered.value_type,
                default_value=registered.default_value, enforcement_type=registered.enforcement_type,
            ))
        else:
            definition.name = registered.name
            definition.category = registered.category
            definition.value_type = registered.value_type
            definition.enforcement_type = registered.enforcement_type
    await db.flush()

    existing = {
        plan.key: plan for plan in (
            await db.execute(select(Plan).where(Plan.version == 1))
        ).scalars().all()
    }
    for key, metadata in PLAN_CATALOG.items():
        plan = existing.get(key)
        if plan is None:
            plan = Plan(key=key, version=1, status="active", **metadata)
            db.add(plan)
            await db.flush()
            existing[key] = plan
        entitlement_keys = set(
            (await db.execute(select(PlanEntitlement.feature_key).where(PlanEntitlement.plan_id == plan.id))).scalars().all()
        )
        for feature_key, value in complete_entitlements(PLAN_DEFAULTS[key]).items():
            if feature_key not in entitlement_keys:
                db.add(PlanEntitlement(plan_id=plan.id, feature_key=feature_key, value=value))
    await db.flush()
    latest: dict[str, Plan] = {}
    for plan in (await db.execute(select(Plan).order_by(Plan.key, Plan.version.desc()))).scalars().all():
        latest.setdefault(plan.key, plan)
    return latest


async def plan_snapshot(db: AsyncSession, plan: Plan) -> dict[str, FeatureValue]:
    values = {item.feature_key: item.value for item in (
        await db.execute(select(PlanEntitlement).where(PlanEntitlement.plan_id == plan.id))
    ).scalars().all()}
    return complete_entitlements(values)


async def assign_plan(
    db: AsyncSession,
    *,
    store_id: uuid.UUID,
    plan: Plan,
    source: str,
    start_trial: bool,
    now: datetime | None = None,
) -> StorePlanAssignment:
    moment = now or utc_now()
    snapshot = await plan_snapshot(db, plan)
    assignment = await db.scalar(select(StorePlanAssignment).where(StorePlanAssignment.store_id == store_id))
    trial_days = plan.trial_days if start_trial else 0
    values = {
        "plan_id": plan.id,
        "status": "trialing" if trial_days > 0 else "active",
        "source": source,
        "plan_key_snapshot": plan.key,
        "plan_name_snapshot": plan.name,
        "plan_version_snapshot": plan.version,
        "entitlement_snapshot": snapshot,
        "trial_started_at": moment if trial_days > 0 else None,
        "trial_ends_at": moment + timedelta(days=trial_days) if trial_days > 0 else None,
        "access_started_at": moment,
        "access_ends_at": None,
    }
    if assignment is None:
        assignment = StorePlanAssignment(store_id=store_id, **values)
        db.add(assignment)
    else:
        for field, value in values.items():
            setattr(assignment, field, value)
    await db.flush()
    return assignment


async def assign_signup_plan(db: AsyncSession, *, store_id: uuid.UUID, now: datetime | None = None) -> StorePlanAssignment:
    plans = await ensure_commercial_catalog(db)
    plan = plans.get(settings.DEFAULT_SIGNUP_PLAN_KEY)
    if plan is None or plan.status != "active":
        raise RuntimeError(f"Configured signup plan is unavailable: {settings.DEFAULT_SIGNUP_PLAN_KEY}")
    return await assign_plan(db, store_id=store_id, plan=plan, source="provisioning", start_trial=plan.trial_days > 0, now=now)


class EntitlementService:
    def __init__(
        self,
        db: AsyncSession,
        *,
        store_id: uuid.UUID,
        organization_id: uuid.UUID,
        clock: Clock = utc_now,
    ) -> None:
        self.db = db
        self.store_id = store_id
        self.organization_id = organization_id
        self.clock = clock
        self._effective: EffectiveCommercialAccess | None = None

    async def resolve(self) -> EffectiveCommercialAccess:
        if self._effective is not None:
            return self._effective
        assignment = await self.db.scalar(select(StorePlanAssignment).where(StorePlanAssignment.store_id == self.store_id))
        if assignment is None:
            raise RuntimeError("Store has no commercial access assignment")
        now = self.clock()
        effective_status = assignment.status
        if assignment.access_ends_at and assignment.access_ends_at <= now:
            effective_status = "expired"
        if assignment.status == "trialing" and assignment.trial_ends_at and assignment.trial_ends_at <= now:
            effective_status = "expired"
        values = complete_entitlements(assignment.entitlement_snapshot or {})
        overrides = (
            await self.db.execute(
                select(StoreEntitlementOverride).where(
                    StoreEntitlementOverride.store_id == self.store_id,
                    StoreEntitlementOverride.starts_at <= now,
                    (StoreEntitlementOverride.ends_at.is_(None) | (StoreEntitlementOverride.ends_at > now)),
                ).order_by(StoreEntitlementOverride.created_at)
            )
        ).scalars().all()
        for override in overrides:
            values[override.feature_key] = validate_feature_value(override.feature_key, override.value)
        # Platform availability is an emergency kill switch and always wins.
        unavailable = set((await self.db.execute(select(FeatureDefinition.key).where(FeatureDefinition.platform_available.is_(False)))).scalars().all())
        for key in unavailable:
            definition = FEATURE_REGISTRY.get(key)
            values[key] = 0 if definition and definition.enforcement_type in {"limit", "metered"} else False
        remaining = None
        if effective_status == "trialing" and assignment.trial_ends_at:
            remaining = max(0, math.ceil((assignment.trial_ends_at - now).total_seconds() / 86400))
        self._effective = EffectiveCommercialAccess(assignment, effective_status, values, remaining)
        return self._effective

    async def get_feature(self, feature_key: str) -> FeatureValue:
        if feature_key not in FEATURE_REGISTRY:
            raise ValueError(f"Unknown feature: {feature_key}")
        return (await self.resolve()).entitlements[feature_key]

    async def has_feature(self, feature_key: str) -> bool:
        effective = await self.resolve()
        return effective.status in {"active", "trialing"} and effective.entitlements.get(feature_key) is True

    async def get_limit(self, feature_key: str) -> int | float | None:
        definition = FEATURE_REGISTRY.get(feature_key)
        if definition is None or definition.enforcement_type not in {"limit", "metered"}:
            raise ValueError(f"{feature_key} is not a limit")
        value = await self.get_feature(feature_key)
        return None if value is None else int(value) if definition.value_type == "integer" else float(value)

    async def require_feature(self, feature_key: str) -> None:
        effective = await self.resolve()
        if effective.status not in {"active", "trialing"}:
            raise entitlement_error(feature_key, "Your trial or commercial access has expired. Existing storefront data remains safe.")
        if effective.entitlements.get(feature_key) is not True:
            raise entitlement_error(feature_key)

    async def require_capacity(self, feature_key: str, requested_amount: int = 1) -> UsageResult:
        effective = await self.resolve()
        if effective.status not in {"active", "trialing"}:
            raise entitlement_error(feature_key, "Your trial or commercial access has expired. Existing data remains available.")
        await self._quota_lock(feature_key)
        usage = await UsageService(self.db, store_id=self.store_id, organization_id=self.organization_id).get_usage(feature_key)
        limit = await self.get_limit(feature_key)
        result = usage_result(feature_key, usage, limit)
        if limit is not None and usage + requested_amount > limit:
            await self._record_limit_reached(feature_key, limit=limit, usage=usage)
            raise limit_error(feature_key, limit=limit, usage=usage)
        return result

    async def _quota_lock(self, feature_key: str) -> None:
        bind = self.db.get_bind()
        if bind.dialect.name == "postgresql":
            lock_key = f"amar-quota:{self.organization_id if feature_key == 'store_limit' else self.store_id}:{feature_key}"
            await self.db.execute(text("SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))"), {"key": lock_key})

    async def _record_limit_reached(self, feature_key: str, *, limit: int | float, usage: int | float) -> None:
        logger.warning(
            "Commercial plan limit reached",
            extra={"store_id": str(self.store_id), "organization_id": str(self.organization_id), "feature_key": feature_key},
        )
        try:
            async with AsyncSessionLocal() as audit_db:
                with tenant_scope(store_id=self.store_id, organization_id=self.organization_id):
                    audit_db.add(ActivityLog(
                        organization_id=self.organization_id,
                        user_id=None,
                        action="limit_reached",
                        module="commercial",
                        entity_type="feature",
                        entity_id=feature_key,
                        message=f"{feature_key} reached usage {usage} of limit {limit}.",
                    ))
                    await audit_db.commit()
        except Exception:
            logger.exception("Could not persist commercial limit activity", extra={"store_id": str(self.store_id), "feature_key": feature_key})


class UsageService:
    def __init__(self, db: AsyncSession, *, store_id: uuid.UUID, organization_id: uuid.UUID) -> None:
        self.db = db
        self.store_id = store_id
        self.organization_id = organization_id

    async def get_usage(self, feature_key: str) -> int:
        if feature_key == "product_limit":
            statement = select(func.count()).select_from(Product).where(Product.store_id == self.store_id)
        elif feature_key == "warehouse_limit":
            statement = select(func.count()).select_from(Warehouse).where(Warehouse.store_id == self.store_id)
        elif feature_key == "theme_count_limit":
            statement = select(func.count()).select_from(StorefrontTheme).where(StorefrontTheme.store_id == self.store_id)
        elif feature_key == "store_limit":
            statement = select(func.count()).select_from(Store).where(Store.organization_id == self.organization_id, Store.status != "archived")
        elif feature_key == "staff_limit":
            owner_ids = select(OrganizationMember.user_id).where(
                OrganizationMember.organization_id == self.organization_id,
                OrganizationMember.role == "owner",
                OrganizationMember.status == "active",
            )
            statement = select(func.count()).select_from(StoreMember).where(
                StoreMember.store_id == self.store_id,
                StoreMember.status == "active",
                StoreMember.user_id.not_in(owner_ids),
            )
        elif feature_key == "ai_messages_monthly":
            now = datetime.now(timezone.utc)
            subscription = await self.db.scalar(select(StoreSubscription).where(
                StoreSubscription.store_id == self.store_id,
                StoreSubscription.current_period_start.is_not(None),
                StoreSubscription.current_period_end.is_not(None),
            ).order_by(StoreSubscription.updated_at.desc()).limit(1))
            period_start = subscription.current_period_start if subscription else now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            period_end = subscription.current_period_end if subscription else None
            statement = select(func.coalesce(func.sum(AIUsageEvent.billable_units), 0)).where(
                AIUsageEvent.store_id == self.store_id,
                AIUsageEvent.occurred_at >= period_start,
            )
            if period_end is not None:
                statement = statement.where(AIUsageEvent.occurred_at < period_end)
        else:
            raise ValueError(f"No derived usage provider for {feature_key}")
        return int(await self.db.scalar(statement.execution_options(include_all_stores=True)) or 0)


def usage_result(feature_key: str, usage: int | float, limit: int | float | None) -> UsageResult:
    return UsageResult(
        feature=feature_key,
        usage=usage,
        limit=limit,
        remaining=None if limit is None else max(0, limit - usage),
        over_limit=False if limit is None else usage > limit,
    )
