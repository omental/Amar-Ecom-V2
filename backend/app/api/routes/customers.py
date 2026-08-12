from datetime import datetime, time, timedelta, timezone
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, Response, status
from sqlalchemy import Select, case, func, or_, select
from sqlalchemy.orm import selectinload

from app.api.deps import DBSession, get_current_user
from app.api.utils import commit_or_409, fetch_one_or_404, normalize_pagination
from app.models.customer import Customer, CustomerActivity
from app.models.order import Order
from app.models.user import User
from app.schemas.customer import (
    CustomerActivityCreate,
    CustomerActivityRead,
    CustomerActivityUpdate,
    CustomerCRMSummaryRead,
    CustomerCreate,
    CustomerListRead,
    CustomerRead,
    CustomerUpdate,
)
from app.services.activity_log_service import log_activity


router = APIRouter(dependencies=[Depends(get_current_user)])


def _customer_list_query() -> Select[tuple[Customer]]:
    return select(Customer).options(
        selectinload(Customer.orders),
        selectinload(Customer.activities).selectinload(CustomerActivity.created_by),
    )


def _customer_detail_query(customer_id: UUID) -> Select[tuple[Customer]]:
    return (
        _customer_list_query()
        .where(Customer.id == customer_id)
        .options(
            selectinload(Customer.return_requests),
        )
    )


def _tag_list(raw_tags: str | None) -> list[str]:
    return [tag.strip() for tag in (raw_tags or "").split(",") if tag.strip()]


def _segment_label(customer: Customer, orders: list[Order]) -> str:
    customer_type = (customer.customer_type or "").strip().lower()
    if customer_type == "vip":
        return "VIP"
    if customer.follow_up_date is not None and customer.follow_up_date < datetime.now(timezone.utc).date():
        return "At Risk"
    if len(orders) > 1:
        return "Repeat"
    return "New"


def _follow_up_state(customer: Customer, pending_follow_up_count: int) -> str:
    if customer.follow_up_date is None and pending_follow_up_count <= 0:
        return "none"

    today = datetime.now(timezone.utc).date()
    if customer.follow_up_date is not None:
        if customer.follow_up_date < today:
            return "overdue"
        if customer.follow_up_date == today:
            return "today"
        return "scheduled"

    return "open"


def _customer_to_list_payload(customer: Customer) -> dict:
    orders = sorted(customer.orders or [], key=lambda order: order.created_at, reverse=True)
    activities = sorted(customer.activities or [], key=lambda activity: activity.created_at, reverse=True)
    total_spend = sum((order.total for order in orders), Decimal("0.00"))
    pending_follow_up_count = sum(1 for activity in activities if activity.completed_at is None)
    latest_activity = activities[0] if activities else None
    last_contacted_at = customer.last_contacted_at or (latest_activity.created_at if latest_activity else None)
    last_order = orders[0] if orders else None
    segment = _segment_label(customer, orders)
    tag_list = _tag_list(customer.tags)

    return {
        "id": customer.id,
        "name": customer.name,
        "phone": customer.phone,
        "email": customer.email,
        "address": customer.address,
        "city": customer.city,
        "customer_type": customer.customer_type,
        "tags": customer.tags,
        "notes": customer.notes,
        "follow_up_date": customer.follow_up_date,
        "last_contacted_at": last_contacted_at,
        "created_at": customer.created_at,
        "updated_at": customer.updated_at,
        "customerName": customer.name,
        "customerPhone": customer.phone,
        "customerType": customer.customer_type,
        "segment": segment,
        "tagList": tag_list,
        "followUpDate": customer.follow_up_date,
        "lastContactedAt": last_contacted_at,
        "total_order_count": len(orders),
        "totalOrderCount": len(orders),
        "total_spend": total_spend,
        "totalSpend": total_spend,
        "lastOrderAt": last_order.created_at if last_order else None,
        "lastOrderNumber": last_order.order_number if last_order else None,
        "activityCount": len(activities),
        "openActivityCount": pending_follow_up_count,
        "createdAt": customer.created_at,
        "updatedAt": customer.updated_at,
    }


def _customer_to_detail_payload(customer: Customer) -> dict:
    orders = sorted(customer.orders or [], key=lambda order: order.created_at, reverse=True)
    activities = sorted(customer.activities or [], key=lambda activity: activity.created_at, reverse=True)
    total_spend = sum((order.total for order in orders), Decimal("0.00"))
    pending_follow_up_count = sum(
        1
        for activity in activities
        if activity.activity_type == "follow_up" and activity.completed_at is None
    )
    last_order = orders[0] if orders else None
    average_order_value = (
        total_spend / len(orders)
        if orders
        else Decimal("0.00")
    )
    list_payload = _customer_to_list_payload(customer)
    follow_up_state = _follow_up_state(customer, pending_follow_up_count)

    return {
        **list_payload,
        "orders": orders[:10],
        "activities": activities,
        "total_order_count": len(orders),
        "total_spend": total_spend,
        "pending_follow_up_count": pending_follow_up_count,
        "averageOrderValue": average_order_value,
        "lastOrderAt": last_order.created_at if last_order else None,
        "lastOrderNumber": last_order.order_number if last_order else None,
        "lastContactedAt": list_payload["lastContactedAt"],
        "followUpState": follow_up_state,
        "stats": {
            "totalOrderCount": len(orders),
            "totalSpend": total_spend,
            "averageOrderValue": average_order_value,
            "lastOrderAt": last_order.created_at if last_order else None,
            "lastContactedAt": list_payload["lastContactedAt"],
            "followUpState": follow_up_state,
        },
    }


def _touch_customer_from_activity(customer: Customer, activity: CustomerActivity) -> None:
    if activity.activity_type != "system":
        customer.last_contacted_at = datetime.now(timezone.utc)

    if activity.due_date and (
        customer.follow_up_date is None or activity.due_date.date() < customer.follow_up_date
    ):
        customer.follow_up_date = activity.due_date.date()


def _date_end_of_day(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.time() == time.min:
        return value.replace(hour=23, minute=59, second=59, microsecond=999999)
    return value


@router.get("/crm-summary", response_model=CustomerCRMSummaryRead)
async def get_customer_crm_summary(db: DBSession) -> CustomerCRMSummaryRead:
    today = datetime.now(timezone.utc).date()
    now = datetime.now(timezone.utc)
    recent_threshold = now - timedelta(days=7)

    customer_stats = await db.execute(
        select(
            func.count(Customer.id),
            func.coalesce(
                func.sum(case((~Customer.orders.any(), 1), else_=0)),
                0,
            ),
            func.coalesce(
                func.sum(
                    case(
                        (
                            (
                                (Customer.customer_type.is_(None))
                                | (Customer.customer_type == "regular")
                            )
                            & Customer.orders.any(),
                            1,
                        ),
                        else_=0,
                    )
                ),
                0,
            ),
            func.coalesce(func.sum(case((Customer.customer_type == "vip", 1), else_=0)), 0),
            func.coalesce(func.sum(case((Customer.customer_type == "wholesale", 1), else_=0)), 0),
            func.coalesce(func.sum(case((Customer.customer_type == "reseller", 1), else_=0)), 0),
            func.coalesce(func.sum(case((Customer.customer_type == "blocked", 1), else_=0)), 0),
            func.coalesce(func.sum(case((Customer.follow_up_date.is_not(None), 1), else_=0)), 0),
            func.coalesce(func.sum(case((Customer.follow_up_date == today, 1), else_=0)), 0),
            func.coalesce(func.sum(case((Customer.follow_up_date < today, 1), else_=0)), 0),
            func.coalesce(func.sum(case((Customer.orders.any(), 1), else_=0)), 0),
        )
    )
    customer_row = customer_stats.one()

    spend_result = await db.execute(
        select(
            func.coalesce(func.sum(Order.total), 0),
            func.coalesce(func.avg(Order.total), 0),
        ).select_from(Order)
    )
    spend_row = spend_result.one()

    recent_activity_count = await db.scalar(
        select(func.count(CustomerActivity.id)).where(CustomerActivity.created_at >= recent_threshold)
    )

    total_customers = customer_row[0] or 0
    total_customer_spend = spend_row[0] or Decimal("0.00")
    average_customer_value = (
        (total_customer_spend / total_customers) if total_customers > 0 else Decimal("0.00")
    )

    return CustomerCRMSummaryRead(
        total_customers=total_customers,
        leads=customer_row[1] or 0,
        regular_customers=customer_row[2] or 0,
        vip_customers=customer_row[3] or 0,
        wholesale_customers=customer_row[4] or 0,
        reseller_customers=customer_row[5] or 0,
        blocked_customers=customer_row[6] or 0,
        followups_due=customer_row[7] or 0,
        followups_today=customer_row[8] or 0,
        overdue_followups=customer_row[9] or 0,
        recent_activity_count=recent_activity_count or 0,
        customers_with_orders=customer_row[10] or 0,
        total_customer_spend=total_customer_spend,
        average_customer_value=average_customer_value,
    )


@router.get("", response_model=list[CustomerListRead])
async def list_customers(
    db: DBSession,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    search: str | None = Query(default=None),
    customer_type: str | None = Query(default=None),
    segment: str | None = Query(default=None),
    has_follow_up: bool | None = Query(default=None),
    follow_up_due: bool | None = Query(default=None),
    tag: str | None = Query(default=None),
    city: str | None = Query(default=None),
    created_from: datetime | None = Query(default=None),
    created_to: datetime | None = Query(default=None),
) -> list[dict]:
    skip, limit = normalize_pagination(skip, limit)
    stmt = _customer_list_query().order_by(Customer.created_at.desc())

    if search:
        search_term = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                Customer.name.ilike(search_term),
                Customer.phone.ilike(search_term),
                Customer.email.ilike(search_term),
                Customer.city.ilike(search_term),
                Customer.tags.ilike(search_term),
                Customer.notes.ilike(search_term),
            )
        )

    if customer_type:
        stmt = stmt.where(Customer.customer_type == customer_type)

    if segment:
        normalized_segment = segment.strip().lower().replace(" ", "_")
        if normalized_segment == "vip":
            stmt = stmt.where(Customer.customer_type == "vip")
        elif normalized_segment == "at_risk":
            stmt = stmt.where(Customer.follow_up_date.is_not(None), Customer.follow_up_date < datetime.now(timezone.utc).date())
        elif normalized_segment == "repeat":
            stmt = stmt.where(Customer.orders.any())
        elif normalized_segment == "new":
            stmt = stmt.where(~Customer.orders.any())
        elif normalized_segment in {"regular", "lead", "leads"}:
            stmt = stmt.where(
                or_(Customer.customer_type.is_(None), Customer.customer_type == "regular")
            )

    if has_follow_up is True:
        stmt = stmt.where(Customer.follow_up_date.is_not(None))
    elif has_follow_up is False:
        stmt = stmt.where(Customer.follow_up_date.is_(None))

    if follow_up_due is True:
        stmt = stmt.where(Customer.follow_up_date.is_not(None), Customer.follow_up_date <= datetime.now(timezone.utc).date())
    elif follow_up_due is False:
        stmt = stmt.where(or_(Customer.follow_up_date.is_(None), Customer.follow_up_date > datetime.now(timezone.utc).date()))

    if tag:
        stmt = stmt.where(Customer.tags.ilike(f"%{tag.strip()}%"))

    if city:
        stmt = stmt.where(Customer.city.ilike(f"%{city.strip()}%"))

    if created_from is not None:
        stmt = stmt.where(Customer.created_at >= created_from)
    if created_to is not None:
        stmt = stmt.where(Customer.created_at <= _date_end_of_day(created_to))

    result = await db.execute(stmt.offset(skip).limit(limit))
    customers = list(result.scalars().unique().all())
    return [_customer_to_list_payload(customer) for customer in customers]


@router.get("/{customer_id}", response_model=CustomerRead)
async def get_customer(customer_id: UUID, db: DBSession) -> dict:
    customer = await fetch_one_or_404(db, _customer_detail_query(customer_id), "Customer not found")
    return _customer_to_detail_payload(customer)


@router.post("", response_model=CustomerRead, status_code=status.HTTP_201_CREATED)
async def create_customer(customer_in: CustomerCreate, db: DBSession) -> dict:
    customer = Customer(**customer_in.model_dump())
    db.add(customer)
    await commit_or_409(db, "Could not create customer")
    customer = await fetch_one_or_404(db, _customer_detail_query(customer.id), "Customer not found")
    return _customer_to_detail_payload(customer)


@router.patch("/{customer_id}", response_model=CustomerRead)
async def update_customer(customer_id: UUID, customer_in: CustomerUpdate, db: DBSession) -> dict:
    customer = await fetch_one_or_404(db, select(Customer).where(Customer.id == customer_id), "Customer not found")
    for field, value in customer_in.model_dump(exclude_unset=True).items():
        setattr(customer, field, value)
    await commit_or_409(db, "Could not update customer")
    customer = await fetch_one_or_404(db, _customer_detail_query(customer_id), "Customer not found")
    return _customer_to_detail_payload(customer)


@router.get("/{customer_id}/activities", response_model=list[CustomerActivityRead])
async def list_customer_activities(customer_id: UUID, db: DBSession) -> list[CustomerActivity]:
    await fetch_one_or_404(db, select(Customer).where(Customer.id == customer_id), "Customer not found")
    result = await db.execute(
        select(CustomerActivity)
        .where(CustomerActivity.customer_id == customer_id)
        .options(selectinload(CustomerActivity.created_by))
        .order_by(CustomerActivity.created_at.desc())
    )
    return list(result.scalars().all())


@router.post("/{customer_id}/activities", response_model=CustomerActivityRead, status_code=status.HTTP_201_CREATED)
async def create_customer_activity(
    customer_id: UUID,
    activity_in: CustomerActivityCreate,
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> CustomerActivity:
    customer = await fetch_one_or_404(db, select(Customer).where(Customer.id == customer_id), "Customer not found")
    activity = CustomerActivity(
        customer_id=customer.id,
        created_by_id=current_user.id,
        **activity_in.model_dump(),
    )
    _touch_customer_from_activity(customer, activity)
    db.add(activity)
    await db.flush()
    await log_activity(
        db,
        user_id=current_user.id,
        action="customer_activity_created",
        module="customers",
        entity_type="customer_activity",
        entity_id=activity.id,
        message=f"Added {activity.activity_type} activity for customer {customer.name}.",
        request=request,
    )
    await commit_or_409(db, "Could not create customer activity")
    activity = await fetch_one_or_404(
        db,
        select(CustomerActivity)
        .where(CustomerActivity.id == activity.id)
        .options(selectinload(CustomerActivity.created_by)),
        "Customer activity not found",
    )
    return activity


@router.patch("/{customer_id}/activities/{activity_id}", response_model=CustomerActivityRead)
async def update_customer_activity(
    customer_id: UUID,
    activity_id: UUID,
    activity_in: CustomerActivityUpdate,
    db: DBSession,
) -> CustomerActivity:
    customer = await fetch_one_or_404(db, select(Customer).where(Customer.id == customer_id), "Customer not found")
    activity = await fetch_one_or_404(
        db,
        select(CustomerActivity).where(
            CustomerActivity.id == activity_id,
            CustomerActivity.customer_id == customer_id,
        ),
        "Customer activity not found",
    )
    for field, value in activity_in.model_dump(exclude_unset=True).items():
        setattr(activity, field, value)

    _touch_customer_from_activity(customer, activity)
    await commit_or_409(db, "Could not update customer activity")
    activity = await fetch_one_or_404(
        db,
        select(CustomerActivity)
        .where(CustomerActivity.id == activity.id)
        .options(selectinload(CustomerActivity.created_by)),
        "Customer activity not found",
    )
    return activity


@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_customer(customer_id: UUID, db: DBSession) -> Response:
    customer = await fetch_one_or_404(db, select(Customer).where(Customer.id == customer_id), "Customer not found")
    await db.delete(customer)
    await commit_or_409(db, "Customer cannot be deleted because it is in use")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
