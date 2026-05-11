from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, Response, status
from sqlalchemy import Select, or_, select
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
    CustomerCreate,
    CustomerListRead,
    CustomerRead,
    CustomerUpdate,
)
from app.services.activity_log_service import log_activity


router = APIRouter(dependencies=[Depends(get_current_user)])


def _customer_detail_query(customer_id: UUID) -> Select[tuple[Customer]]:
    return (
        select(Customer)
        .where(Customer.id == customer_id)
        .options(
            selectinload(Customer.orders),
            selectinload(Customer.activities).selectinload(CustomerActivity.created_by),
            selectinload(Customer.return_requests),
        )
    )


def _customer_to_detail_payload(customer: Customer) -> dict:
    orders = sorted(customer.orders or [], key=lambda order: order.created_at, reverse=True)
    activities = sorted(customer.activities or [], key=lambda activity: activity.created_at, reverse=True)
    total_spend = sum((order.total for order in orders), Decimal("0.00"))
    pending_follow_up_count = sum(
        1
        for activity in activities
        if activity.activity_type == "follow_up" and activity.completed_at is None
    )

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
        "last_contacted_at": customer.last_contacted_at,
        "created_at": customer.created_at,
        "updated_at": customer.updated_at,
        "orders": orders[:10],
        "activities": activities,
        "total_order_count": len(orders),
        "total_spend": total_spend,
        "pending_follow_up_count": pending_follow_up_count,
    }


def _touch_customer_from_activity(customer: Customer, activity: CustomerActivity) -> None:
    if activity.activity_type != "system":
        customer.last_contacted_at = datetime.now(timezone.utc)

    if activity.due_date and (
        customer.follow_up_date is None or activity.due_date.date() < customer.follow_up_date
    ):
        customer.follow_up_date = activity.due_date.date()


@router.get("", response_model=list[CustomerListRead])
async def list_customers(
    db: DBSession,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
    search: str | None = Query(default=None),
    customer_type: str | None = Query(default=None),
    has_follow_up: bool | None = Query(default=None),
) -> list[Customer]:
    skip, limit = normalize_pagination(skip, limit)
    stmt = select(Customer).order_by(Customer.created_at.desc())

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

    if has_follow_up is True:
        stmt = stmt.where(Customer.follow_up_date.is_not(None))
    elif has_follow_up is False:
        stmt = stmt.where(Customer.follow_up_date.is_(None))

    result = await db.execute(stmt.offset(skip).limit(limit))
    return list(result.scalars().all())


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
