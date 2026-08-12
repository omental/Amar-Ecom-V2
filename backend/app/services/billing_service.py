from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.tenant import tenant_scope
from app.models.access_control import ActivityLog
from app.models.billing import (
    BillingAccount, BillingCheckoutSession, BillingInvoice, BillingInvoiceLine,
    BillingPayment, BillingProviderEvent, PlanPrice, StoreSubscription, SubscriptionChange,
)
from app.models.commercial import Plan, StorePlanAssignment
from app.models.tenant import Organization, Store
from app.models.user import User
from app.services.billing_provider import NormalizedBillingEvent, get_billing_provider
from app.services.commercial_access_service import assign_plan


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def period_end(start: datetime, cycle: str) -> datetime:
    return start + timedelta(days=365 if cycle == "annual" else 30)


async def active_prices(db: AsyncSession) -> list[tuple[PlanPrice, Plan]]:
    rows = await db.execute(
        select(PlanPrice, Plan).join(Plan, Plan.id == PlanPrice.plan_id).where(
            PlanPrice.status == "active", PlanPrice.retired_at.is_(None),
            Plan.status == "active", Plan.is_public.is_(True),
        ).order_by(Plan.sort_order, PlanPrice.billing_cycle)
    )
    return list(rows.all())


async def ensure_billing_account(db: AsyncSession, *, organization: Organization, user: User) -> BillingAccount:
    account = await db.scalar(select(BillingAccount).where(BillingAccount.organization_id == organization.id))
    if account is None:
        account = BillingAccount(
            organization_id=organization.id,
            legal_name=organization.name,
            billing_email=user.email,
            default_currency="BDT",
        )
        db.add(account)
        await db.flush()
    return account


async def sync_commercial_access_from_subscription(
    db: AsyncSession, subscription: StoreSubscription, *, now: datetime | None = None,
) -> StorePlanAssignment:
    moment = now or utc_now()
    plan = await db.get(Plan, subscription.plan_id)
    if plan is None:
        raise RuntimeError("Subscription plan no longer exists")
    allowed = subscription.status in {"active", "trialing"} or (
        subscription.status == "past_due" and subscription.grace_ends_at is not None and subscription.grace_ends_at > moment
    )
    if allowed:
        assignment = await assign_plan(db, store_id=subscription.store_id, plan=plan, source="billing", start_trial=False, now=moment)
        assignment.status = "active"
        assignment.access_ends_at = None
        return assignment
    assignment = await db.scalar(select(StorePlanAssignment).where(StorePlanAssignment.store_id == subscription.store_id))
    if assignment is None:
        assignment = await assign_plan(db, store_id=subscription.store_id, plan=plan, source="billing", start_trial=False, now=moment)
    assignment.status = "expired"
    assignment.access_ends_at = subscription.ended_at or subscription.current_period_end or moment
    return assignment


async def create_checkout(
    db: AsyncSession, *, store: Store, organization: Organization, user: User,
    price_id: uuid.UUID, idempotency_key: str,
) -> BillingCheckoutSession:
    existing = await db.scalar(select(BillingCheckoutSession).where(
        BillingCheckoutSession.store_id == store.id,
        BillingCheckoutSession.idempotency_key == idempotency_key,
    ))
    if existing:
        return existing
    row = await db.execute(select(PlanPrice, Plan).join(Plan).where(
        PlanPrice.id == price_id, PlanPrice.status == "active", PlanPrice.retired_at.is_(None),
        Plan.status == "active", Plan.is_public.is_(True),
    ))
    price_plan = row.one_or_none()
    if price_plan is None:
        raise HTTPException(404, "Billing price not found")
    price, plan = price_plan
    account = await ensure_billing_account(db, organization=organization, user=user)
    now = utc_now()
    session = BillingCheckoutSession(
        billing_account_id=account.id, target_plan_price_id=price.id, status="pending",
        provider=settings.BILLING_PROVIDER, success_url=f"{settings.FRONTEND_URL}/dashboard/billing?checkout=return",
        cancel_url=f"{settings.FRONTEND_URL}/dashboard/billing?checkout=cancelled",
        idempotency_key=idempotency_key, expires_at=now + timedelta(minutes=30), created_by_id=user.id,
    )
    db.add(session)
    await db.flush()
    if price.amount == 0:
        session.provider = "internal"
        session.provider_session_ref = f"free_{session.id}"
        session.checkout_url = session.success_url
        await _activate_from_checkout(db, session, price, plan, event_time=now, provider_data={"subscription_ref": f"free_sub_{store.id}"})
    else:
        checkout = get_billing_provider().create_checkout(session_id=str(session.id))
        session.provider_session_ref = checkout.reference
        session.checkout_url = checkout.url
    db.add(ActivityLog(organization_id=organization.id, user_id=user.id, action="checkout_created", module="billing", entity_type="billing_checkout_session", entity_id=str(session.id), message=f"Checkout created for {price.key}."))
    await db.flush()
    return session


async def _activate_from_checkout(
    db: AsyncSession, session: BillingCheckoutSession, price: PlanPrice, plan: Plan, *,
    event_time: datetime, provider_data: dict,
) -> StoreSubscription:
    subscription = await db.scalar(select(StoreSubscription).where(StoreSubscription.store_id == session.store_id))
    start = _dt(provider_data.get("period_start")) or event_time
    end = _dt(provider_data.get("period_end")) or period_end(start, price.billing_cycle)
    values = dict(
        billing_account_id=session.billing_account_id, plan_id=plan.id, plan_price_id=price.id,
        pending_plan_price_id=None, plan_key_snapshot=plan.key, plan_version_snapshot=plan.version,
        price_key_snapshot=price.key, billing_cycle=price.billing_cycle, status="active",
        currency=price.currency, unit_amount=price.amount, quantity=1,
        current_period_start=start, current_period_end=end, grace_ends_at=None,
        cancel_at_period_end=False, cancelled_at=None, ended_at=None, trial_ends_at=None,
        provider=session.provider, provider_subscription_ref=provider_data.get("subscription_ref") or f"{session.provider}_sub_{session.id}",
        last_provider_event_at=event_time,
    )
    if subscription is None:
        subscription = StoreSubscription(**values)
        db.add(subscription)
    else:
        for key, value in values.items():
            setattr(subscription, key, value)
    session.status = "completed"
    session.completed_at = event_time
    await db.flush()
    await sync_commercial_access_from_subscription(db, subscription, now=event_time)
    return subscription


def _dt(value: object) -> datetime | None:
    if value is None or isinstance(value, datetime):
        return value
    parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


async def receive_provider_event(db: AsyncSession, *, provider_name: str, payload: bytes, signature: str | None) -> BillingProviderEvent:
    provider = get_billing_provider(provider_name)
    normalized = provider.verify_and_parse(payload, signature)
    existing = await db.scalar(select(BillingProviderEvent).where(
        BillingProviderEvent.provider == provider_name,
        BillingProviderEvent.provider_event_id == normalized.id,
    ))
    if existing:
        return existing
    event = BillingProviderEvent(
        provider=provider_name, provider_event_id=normalized.id, event_type=normalized.type,
        event_created_at=normalized.created_at, payload=json.loads(payload), signature_valid=True,
    )
    db.add(event)
    try:
        await db.flush()
        await process_provider_event(db, event, normalized)
    except Exception as exc:
        event.processing_status = "failed"
        event.failure_reason = str(exc)[:2000]
    return event


async def process_provider_event(db: AsyncSession, event: BillingProviderEvent, normalized: NormalizedBillingEvent | None = None) -> None:
    value = normalized or NormalizedBillingEvent(event.provider_event_id, event.event_type, event.event_created_at or event.received_at, event.payload["data"])
    data = value.data
    session = None
    if data.get("checkout_session_ref"):
        session = await db.scalar(select(BillingCheckoutSession).where(
            BillingCheckoutSession.provider == event.provider,
            BillingCheckoutSession.provider_session_ref == data["checkout_session_ref"],
        ).execution_options(include_all_stores=True))
    subscription = None
    if data.get("subscription_ref"):
        subscription = await db.scalar(select(StoreSubscription).where(
            StoreSubscription.provider == event.provider,
            StoreSubscription.provider_subscription_ref == data["subscription_ref"],
        ).execution_options(include_all_stores=True))
    store_id = session.store_id if session else subscription.store_id if subscription else None
    if store_id is None:
        raise ValueError("Billing event does not map to an Amar Store")
    store = await db.scalar(select(Store).where(Store.id == store_id).execution_options(include_all_stores=True))
    if store is None:
        raise ValueError("Billing event Store does not exist")
    with tenant_scope(store_id=store.id, organization_id=store.organization_id):
        if subscription and subscription.last_provider_event_at and value.created_at < subscription.last_provider_event_at:
            event.processing_status = "ignored"
            event.processed_at = utc_now()
            return
        event.processing_status = "processing"
        if value.type in {"checkout.completed", "payment.succeeded", "subscription.renewed"}:
            if session:
                price = await db.get(PlanPrice, session.target_plan_price_id)
                plan = await db.get(Plan, price.plan_id) if price else None
                if not price or not plan:
                    raise ValueError("Checkout price is unavailable")
                subscription = await _activate_from_checkout(db, session, price, plan, event_time=value.created_at, provider_data=data)
            elif subscription:
                subscription.status = "active"
                subscription.current_period_start = _dt(data.get("period_start")) or subscription.current_period_start
                subscription.current_period_end = _dt(data.get("period_end")) or period_end(value.created_at, subscription.billing_cycle)
                subscription.grace_ends_at = None
                subscription.last_provider_event_at = value.created_at
                await _apply_pending_change(db, subscription, value.created_at)
                await sync_commercial_access_from_subscription(db, subscription, now=value.created_at)
            if subscription:
                await _record_invoice_payment(db, subscription, data, succeeded=True, event_time=value.created_at)
        elif value.type == "payment.failed":
            if subscription:
                subscription.status = "past_due"
                subscription.grace_ends_at = value.created_at + timedelta(days=settings.BILLING_GRACE_DAYS)
                subscription.last_provider_event_at = value.created_at
                await _record_invoice_payment(db, subscription, data, succeeded=False, event_time=value.created_at)
                await sync_commercial_access_from_subscription(db, subscription, now=value.created_at)
            elif session:
                session.status = "failed"
        elif value.type == "subscription.cancelled" and subscription:
            subscription.status = "cancelled"
            subscription.cancelled_at = value.created_at
            subscription.ended_at = _dt(data.get("ended_at")) or value.created_at
            subscription.last_provider_event_at = value.created_at
            await sync_commercial_access_from_subscription(db, subscription, now=value.created_at)
        elif value.type == "payment.refunded" and subscription:
            await _apply_refund(db, subscription, data)
            subscription.last_provider_event_at = value.created_at
        else:
            event.processing_status = "ignored"
            event.processed_at = utc_now()
            return
        event.processing_status = "processed"
        event.processed_at = utc_now()
        db.add(ActivityLog(organization_id=store.organization_id, action=value.type.replace(".", "_"), module="billing", entity_type="store_subscription", entity_id=str(subscription.id) if subscription else None, message=f"Billing event {value.id} processed."))
        # The webhook route commits after this explicit tenant scope exits. Flush
        # here so fail-closed ownership is assigned from the restored Store, never
        # from a test fallback or ambient request state.
        await db.flush()


async def _record_invoice_payment(db: AsyncSession, sub: StoreSubscription, data: dict, *, succeeded: bool, event_time: datetime) -> None:
    amount = Decimal(str(data.get("amount", sub.unit_amount)))
    invoice_ref = str(data.get("invoice_ref") or f"{sub.provider}_inv_{data.get('payment_ref', uuid.uuid4())}")
    invoice = await db.scalar(select(BillingInvoice).where(BillingInvoice.provider == sub.provider, BillingInvoice.provider_invoice_ref == invoice_ref))
    if invoice is None:
        invoice = BillingInvoice(
            billing_account_id=sub.billing_account_id, subscription_id=sub.id,
            invoice_number=f"AMAR-{event_time:%Y%m}-{uuid.uuid4().hex[:10].upper()}",
            status="paid" if succeeded else "open", currency=sub.currency, subtotal=amount,
            total=amount, amount_paid=amount if succeeded else Decimal("0"), amount_due=Decimal("0") if succeeded else amount,
            period_start=sub.current_period_start, period_end=sub.current_period_end,
            paid_at=event_time if succeeded else None, provider=sub.provider, provider_invoice_ref=invoice_ref,
        )
        db.add(invoice)
        await db.flush()
        db.add(BillingInvoiceLine(invoice_id=invoice.id, description=f"{sub.plan_key_snapshot.title()} ({sub.billing_cycle})", quantity=1, unit_amount=amount, amount=amount, plan_id=sub.plan_id, plan_price_id=sub.plan_price_id, period_start=sub.current_period_start, period_end=sub.current_period_end))
    payment_ref = str(data.get("payment_ref") or f"{sub.provider}_pay_{invoice_ref}")
    payment = await db.scalar(select(BillingPayment).where(BillingPayment.provider == sub.provider, BillingPayment.provider_payment_ref == payment_ref))
    if payment is None:
        db.add(BillingPayment(
            billing_account_id=sub.billing_account_id, subscription_id=sub.id, invoice_id=invoice.id,
            provider=sub.provider, provider_payment_ref=payment_ref, amount=amount, currency=sub.currency,
            status="succeeded" if succeeded else "failed", paid_at=event_time if succeeded else None,
            failed_at=None if succeeded else event_time,
        ))
        await db.flush()


async def _apply_refund(db: AsyncSession, sub: StoreSubscription, data: dict) -> None:
    payment = await db.scalar(select(BillingPayment).where(
        BillingPayment.provider == sub.provider,
        BillingPayment.provider_payment_ref == str(data.get("payment_ref")),
    ))
    if payment is None:
        raise ValueError("Refund payment was not found")
    amount = Decimal(str(data.get("refunded_amount", payment.amount)))
    payment.refunded_amount = min(payment.amount, amount)
    payment.status = "refunded" if payment.refunded_amount >= payment.amount else "partially_refunded"


async def schedule_cancellation(db: AsyncSession, subscription: StoreSubscription, *, actor_id: uuid.UUID) -> None:
    if not get_billing_provider(subscription.provider).schedule_cancellation(subscription_ref=subscription.provider_subscription_ref):
        raise HTTPException(409, "Billing provider did not confirm cancellation")
    subscription.cancel_at_period_end = True
    subscription.cancelled_at = utc_now()
    db.add(ActivityLog(user_id=actor_id, action="subscription_cancel_scheduled", module="billing", entity_type="store_subscription", entity_id=str(subscription.id), message=f"Cancellation scheduled for {subscription.current_period_end}."))


async def resume_subscription(db: AsyncSession, subscription: StoreSubscription, *, actor_id: uuid.UUID) -> None:
    if subscription.status not in {"active", "trialing", "past_due"}:
        raise HTTPException(409, "This subscription can no longer be resumed")
    if not get_billing_provider(subscription.provider).resume_subscription(subscription_ref=subscription.provider_subscription_ref):
        raise HTTPException(409, "Billing provider did not confirm resumption")
    subscription.cancel_at_period_end = False
    subscription.cancelled_at = None
    db.add(ActivityLog(user_id=actor_id, action="subscription_resumed", module="billing", entity_type="store_subscription", entity_id=str(subscription.id), message="Scheduled cancellation removed."))


async def change_plan(db: AsyncSession, subscription: StoreSubscription, *, target: PlanPrice, actor_id: uuid.UUID) -> SubscriptionChange:
    target_plan = await db.get(Plan, target.plan_id)
    current_plan = await db.get(Plan, subscription.plan_id)
    if not target_plan or not current_plan or target.status != "active":
        raise HTTPException(404, "Target billing price is unavailable")
    now = utc_now()
    is_upgrade = target_plan.sort_order > current_plan.sort_order
    effective = now if is_upgrade else subscription.current_period_end or now
    change = SubscriptionChange(subscription_id=subscription.id, from_plan_id=current_plan.id, to_plan_id=target_plan.id, target_plan_price_id=target.id, effective_at=effective, status="applied" if is_upgrade else "scheduled", initiated_by_id=actor_id)
    db.add(change)
    if is_upgrade:
        if not get_billing_provider(subscription.provider).confirm_plan_change(subscription_ref=subscription.provider_subscription_ref, price_key=target.key):
            raise HTTPException(409, "Billing provider has not confirmed the plan change")
        await _set_subscription_price(db, subscription, target, target_plan, now)
        await sync_commercial_access_from_subscription(db, subscription, now=now)
    else:
        subscription.pending_plan_price_id = target.id
    return change


async def _set_subscription_price(db: AsyncSession, sub: StoreSubscription, price: PlanPrice, plan: Plan, now: datetime) -> None:
    sub.plan_id = plan.id
    sub.plan_price_id = price.id
    sub.pending_plan_price_id = None
    sub.plan_key_snapshot = plan.key
    sub.plan_version_snapshot = plan.version
    sub.price_key_snapshot = price.key
    sub.billing_cycle = price.billing_cycle
    sub.currency = price.currency
    sub.unit_amount = price.amount
    sub.status = "active"
    sub.current_period_start = now
    sub.current_period_end = period_end(now, price.billing_cycle)


async def _apply_pending_change(db: AsyncSession, sub: StoreSubscription, now: datetime) -> None:
    if sub.pending_plan_price_id is None:
        return
    price = await db.get(PlanPrice, sub.pending_plan_price_id)
    plan = await db.get(Plan, price.plan_id) if price else None
    if price and plan:
        await _set_subscription_price(db, sub, price, plan, now)
        change = await db.scalar(select(SubscriptionChange).where(SubscriptionChange.subscription_id == sub.id, SubscriptionChange.status == "scheduled").order_by(SubscriptionChange.created_at.desc()))
        if change:
            change.status = "applied"


async def reconcile_subscription(db: AsyncSession, subscription: StoreSubscription, *, now: datetime | None = None) -> None:
    moment = now or utc_now()
    if subscription.cancel_at_period_end and subscription.current_period_end and subscription.current_period_end <= moment:
        subscription.status = "cancelled"
        subscription.ended_at = subscription.current_period_end
    elif subscription.status == "past_due" and subscription.grace_ends_at and subscription.grace_ends_at <= moment:
        subscription.status = "suspended"
        subscription.ended_at = moment
    await sync_commercial_access_from_subscription(db, subscription, now=moment)
