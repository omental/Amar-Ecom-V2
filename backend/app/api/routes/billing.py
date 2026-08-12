from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response
from sqlalchemy import select

from app.api.deps import DBSession, get_current_user, get_tenant_context, require_platform_admin
from app.core.config import settings
from app.core.tenant import TenantContext, tenant_scope
from app.models.access_control import ActivityLog
from app.models.billing import BillingAccount, BillingCheckoutSession, BillingInvoice, BillingInvoiceLine, BillingPayment, BillingProviderEvent, PlanPrice, StoreSubscription
from app.models.commercial import StorePlanAssignment
from app.models.tenant import Store
from app.models.user import User
from app.schemas.billing import (
    BillingSummaryRead, CancellationInput, CheckoutCreate, CheckoutRead, InvoiceLineRead,
    InvoiceRead, PaymentRead, PlanChangeInput, PlanPriceCreate, PlanPriceRead, RefundInput,
    SubscriptionRead, TestEventInput,
)
from app.services.billing_provider import TestBillingProvider
from app.services.billing_service import (
    active_prices, change_plan, create_checkout, process_provider_event, receive_provider_event,
    reconcile_subscription, resume_subscription, schedule_cancellation,
)

router = APIRouter()
platform_router = APIRouter(dependencies=[Depends(require_platform_admin)])


def _require_billing_manager(ctx: TenantContext) -> None:
    if ctx.organization_membership.role not in {"owner", "admin"}:
        raise HTTPException(403, "Organization owner or administrator access required")


def _subscription(value: StoreSubscription) -> SubscriptionRead:
    return SubscriptionRead(
        id=value.id, plan_key=value.plan_key_snapshot, plan_version=value.plan_version_snapshot,
        price_key=value.price_key_snapshot, billing_cycle=value.billing_cycle, status=value.status,
        currency=value.currency, unit_amount=value.unit_amount,
        current_period_start=value.current_period_start, current_period_end=value.current_period_end,
        grace_ends_at=value.grace_ends_at, cancel_at_period_end=value.cancel_at_period_end,
        pending_price_id=value.pending_plan_price_id,
    )


@router.get("/prices", response_model=list[PlanPriceRead])
async def price_catalog(db: DBSession) -> list[PlanPriceRead]:
    return [PlanPriceRead.model_validate(price).model_copy(update={"plan_key": plan.key, "plan_name": plan.name}) for price, plan in await active_prices(db)]


@router.get("/summary", response_model=BillingSummaryRead)
async def billing_summary(db: DBSession, ctx: TenantContext = Depends(get_tenant_context)) -> BillingSummaryRead:
    account = await db.scalar(select(BillingAccount).where(BillingAccount.organization_id == ctx.organization.id))
    subscription = await db.scalar(select(StoreSubscription).where(StoreSubscription.store_id == ctx.store.id))
    assignment = await db.scalar(select(StorePlanAssignment).where(StorePlanAssignment.store_id == ctx.store.id))
    return BillingSummaryRead(
        billing_account_id=account.id if account else None,
        subscription=_subscription(subscription) if subscription else None,
        commercial_status=assignment.status if assignment else "unavailable",
    )


@router.post("/checkouts", response_model=CheckoutRead, status_code=201)
async def start_checkout(payload: CheckoutCreate, db: DBSession, ctx: TenantContext = Depends(get_tenant_context), user: User = Depends(get_current_user)) -> BillingCheckoutSession:
    _require_billing_manager(ctx)
    session = await create_checkout(db, store=ctx.store, organization=ctx.organization, user=user, price_id=payload.plan_price_id, idempotency_key=payload.idempotency_key)
    await db.commit()
    await db.refresh(session)
    return session


@router.get("/checkouts/{session_id}", response_model=CheckoutRead)
async def checkout_status(session_id: UUID, db: DBSession, _ctx: TenantContext = Depends(get_tenant_context)) -> BillingCheckoutSession:
    item = await db.scalar(select(BillingCheckoutSession).where(BillingCheckoutSession.id == session_id))
    if item is None:
        raise HTTPException(404, "Checkout not found")
    return item


@router.post("/checkouts/{session_id}/simulate", response_model=CheckoutRead)
async def simulate_checkout(session_id: UUID, payload: TestEventInput, db: DBSession, ctx: TenantContext = Depends(get_tenant_context)) -> BillingCheckoutSession:
    _require_billing_manager(ctx)
    if settings.APP_ENV not in {"development", "test"} or settings.BILLING_PROVIDER != "test":
        raise HTTPException(404, "Not found")
    session = await db.scalar(select(BillingCheckoutSession).where(BillingCheckoutSession.id == session_id))
    if session is None:
        raise HTTPException(404, "Checkout not found")
    now = datetime.now(timezone.utc)
    event_type = {"success": "checkout.completed", "failed": "payment.failed", "renewal": "subscription.renewed", "refund": "payment.refunded"}[payload.outcome]
    data = {
        "checkout_session_ref": session.provider_session_ref,
        "subscription_ref": f"test_sub_{session.store_id}", "payment_ref": f"test_pay_{uuid.uuid4()}",
        "invoice_ref": f"test_inv_{uuid.uuid4()}",
    }
    body = json.dumps({"id": f"test_evt_{uuid.uuid4()}", "type": event_type, "created_at": now.isoformat(), "data": data}, sort_keys=True).encode()
    await receive_provider_event(db, provider_name="test", payload=body, signature=TestBillingProvider.signature(body))
    await db.commit()
    await db.refresh(session)
    return session


@router.post("/subscription/cancel", response_model=SubscriptionRead)
async def cancel_subscription(payload: CancellationInput, db: DBSession, ctx: TenantContext = Depends(get_tenant_context), user: User = Depends(get_current_user)) -> SubscriptionRead:
    _require_billing_manager(ctx)
    sub = await db.scalar(select(StoreSubscription).where(StoreSubscription.store_id == ctx.store.id))
    if not sub:
        raise HTTPException(404, "Subscription not found")
    if not payload.at_period_end:
        raise HTTPException(422, "Merchant cancellation is scheduled at period end")
    await schedule_cancellation(db, sub, actor_id=user.id)
    await db.commit()
    return _subscription(sub)


@router.post("/subscription/resume", response_model=SubscriptionRead)
async def resume(db: DBSession, ctx: TenantContext = Depends(get_tenant_context), user: User = Depends(get_current_user)) -> SubscriptionRead:
    _require_billing_manager(ctx)
    sub = await db.scalar(select(StoreSubscription).where(StoreSubscription.store_id == ctx.store.id))
    if not sub:
        raise HTTPException(404, "Subscription not found")
    await resume_subscription(db, sub, actor_id=user.id)
    await db.commit()
    return _subscription(sub)


@router.post("/subscription/change", response_model=SubscriptionRead)
async def change(payload: PlanChangeInput, db: DBSession, ctx: TenantContext = Depends(get_tenant_context), user: User = Depends(get_current_user)) -> SubscriptionRead:
    _require_billing_manager(ctx)
    sub = await db.scalar(select(StoreSubscription).where(StoreSubscription.store_id == ctx.store.id))
    price = await db.get(PlanPrice, payload.plan_price_id)
    if not sub or not price:
        raise HTTPException(404, "Subscription or price not found")
    await change_plan(db, sub, target=price, actor_id=user.id)
    await db.commit()
    return _subscription(sub)


@router.get("/invoices", response_model=list[InvoiceRead])
async def invoices(db: DBSession, _ctx: TenantContext = Depends(get_tenant_context)) -> list[InvoiceRead]:
    values = list((await db.execute(select(BillingInvoice).order_by(BillingInvoice.created_at.desc()))).scalars().all())
    return [await _invoice_read(db, item) for item in values]


@router.get("/invoices/{invoice_id}", response_model=InvoiceRead)
async def invoice_detail(invoice_id: UUID, db: DBSession, _ctx: TenantContext = Depends(get_tenant_context)) -> InvoiceRead:
    item = await db.scalar(select(BillingInvoice).where(BillingInvoice.id == invoice_id))
    if item is None:
        raise HTTPException(404, "Invoice not found")
    return await _invoice_read(db, item)


async def _invoice_read(db: DBSession, item: BillingInvoice) -> InvoiceRead:
    lines = list((await db.execute(select(BillingInvoiceLine).where(BillingInvoiceLine.invoice_id == item.id))).scalars().all())
    return InvoiceRead(**{column: getattr(item, column) for column in InvoiceRead.model_fields if column != "lines"}, lines=[InvoiceLineRead.model_validate(line) for line in lines])


@router.get("/payments", response_model=list[PaymentRead])
async def payments(db: DBSession, _ctx: TenantContext = Depends(get_tenant_context)) -> list[BillingPayment]:
    return list((await db.execute(select(BillingPayment).order_by(BillingPayment.created_at.desc()))).scalars().all())


@router.post("/webhooks/{provider_name}")
async def webhook(provider_name: str, request: Request, db: DBSession, x_billing_signature: Annotated[str | None, Header(alias="X-Billing-Signature")] = None) -> dict[str, str]:
    body = await request.body()
    if len(body) > settings.BILLING_MAX_WEBHOOK_BYTES:
        raise HTTPException(413, "Billing webhook is too large")
    try:
        event = await receive_provider_event(db, provider_name=provider_name, payload=body, signature=x_billing_signature)
        await db.commit()
    except ValueError as exc:
        await db.rollback()
        raise HTTPException(400, "Invalid billing webhook") from exc
    return {"status": event.processing_status}


@platform_router.post("/prices", response_model=PlanPriceRead, status_code=201)
async def create_price(payload: PlanPriceCreate, db: DBSession) -> PlanPrice:
    if await db.scalar(select(PlanPrice.id).where(PlanPrice.key == payload.key)):
        raise HTTPException(409, "Price key already exists")
    item = PlanPrice(**payload.model_dump())
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@platform_router.post("/prices/{price_id}/retire", response_model=PlanPriceRead)
async def retire_price(price_id: UUID, db: DBSession) -> PlanPrice:
    item = await db.get(PlanPrice, price_id)
    if item is None:
        raise HTTPException(404, "Price not found")
    item.status = "retired"
    item.retired_at = datetime.now(timezone.utc)
    await db.commit()
    return item


@platform_router.get("/events")
async def provider_events(db: DBSession) -> list[dict]:
    items = (await db.execute(select(BillingProviderEvent).order_by(BillingProviderEvent.received_at.desc()).limit(100))).scalars().all()
    return [{"id": item.id, "provider": item.provider, "provider_event_id": item.provider_event_id, "event_type": item.event_type, "status": item.processing_status, "failure_reason": item.failure_reason} for item in items]


@platform_router.get("/accounts")
async def billing_accounts(db: DBSession) -> list[dict]:
    items = (await db.execute(select(BillingAccount).order_by(BillingAccount.created_at.desc()).limit(100))).scalars().all()
    return [{"id": item.id, "organization_id": item.organization_id, "billing_email": item.billing_email, "status": item.status, "currency": item.default_currency} for item in items]


@platform_router.get("/subscriptions")
async def subscriptions(db: DBSession) -> list[dict]:
    items = (await db.execute(select(StoreSubscription).execution_options(include_all_stores=True).order_by(StoreSubscription.created_at.desc()).limit(100))).scalars().all()
    return [{"id": item.id, "store_id": item.store_id, "billing_account_id": item.billing_account_id, "plan_key": item.plan_key_snapshot, "status": item.status, "provider": item.provider, "period_end": item.current_period_end} for item in items]


@platform_router.post("/events/{event_id}/replay")
async def replay_event(event_id: UUID, db: DBSession) -> dict[str, str]:
    event = await db.get(BillingProviderEvent, event_id)
    if event is None or not event.signature_valid:
        raise HTTPException(404, "Replayable event not found")
    event.retry_count += 1
    event.failure_reason = None
    await process_provider_event(db, event)
    await db.commit()
    return {"status": event.processing_status}


@platform_router.post("/stores/{store_id}/reconcile", response_model=SubscriptionRead)
async def reconcile(store_id: UUID, db: DBSession) -> SubscriptionRead:
    store = await db.scalar(select(Store).where(Store.id == store_id).execution_options(include_all_stores=True))
    if not store:
        raise HTTPException(404, "Store not found")
    with tenant_scope(store_id=store.id, organization_id=store.organization_id):
        sub = await db.scalar(select(StoreSubscription).where(StoreSubscription.store_id == store.id))
        if not sub:
            raise HTTPException(404, "Subscription not found")
        await reconcile_subscription(db, sub)
        await db.commit()
        return _subscription(sub)


@platform_router.post("/payments/{payment_id}/refund", response_model=PaymentRead)
async def refund(payment_id: UUID, payload: RefundInput, db: DBSession, actor: User = Depends(require_platform_admin)) -> BillingPayment:
    payment = await db.scalar(select(BillingPayment).where(BillingPayment.id == payment_id).execution_options(include_all_stores=True))
    if payment is None:
        raise HTTPException(404, "Payment not found")
    if payment.refunded_amount + payload.amount > payment.amount:
        raise HTTPException(422, "Refund exceeds paid amount")
    store = await db.scalar(select(Store).where(Store.id == payment.store_id).execution_options(include_all_stores=True))
    with tenant_scope(store_id=store.id, organization_id=store.organization_id):
        payment.refunded_amount += payload.amount
        payment.status = "refunded" if payment.refunded_amount == payment.amount else "partially_refunded"
        payment.metadata_json = {**payment.metadata_json, "refund_reason": payload.reason}
        db.add(ActivityLog(organization_id=store.organization_id, user_id=actor.id, action="refund_created", module="billing", entity_type="billing_payment", entity_id=str(payment.id), message=f"Platform refund recorded: {payload.reason}"))
        await db.commit()
        return payment
