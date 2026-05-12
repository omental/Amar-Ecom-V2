from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import DBSession, get_current_user
from app.api.utils import commit_or_409, fetch_one_or_404, normalize_pagination
from app.models.finance import SupplierPayment
from app.models.user import User
from app.schemas.finance import SupplierPaymentCreate, SupplierPaymentRead
from app.services.activity_log_service import log_activity
from app.services.finance_service import record_supplier_payment


router = APIRouter(dependencies=[Depends(get_current_user)])


def _supplier_payment_query():
    return select(SupplierPayment).options(
        selectinload(SupplierPayment.supplier),
        selectinload(SupplierPayment.account),
    )


@router.get("", response_model=list[SupplierPaymentRead])
async def list_supplier_payments(
    db: DBSession,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=100),
) -> list[SupplierPayment]:
    skip, limit = normalize_pagination(skip, limit)
    result = await db.execute(
        _supplier_payment_query().order_by(SupplierPayment.payment_date.desc(), SupplierPayment.created_at.desc()).offset(skip).limit(limit)
    )
    return list(result.scalars().all())


@router.get("/{payment_id}", response_model=SupplierPaymentRead)
async def get_supplier_payment(payment_id: UUID, db: DBSession) -> SupplierPayment:
    return await fetch_one_or_404(db, _supplier_payment_query().where(SupplierPayment.id == payment_id), "Supplier payment not found")


@router.post("", response_model=SupplierPaymentRead, status_code=status.HTTP_201_CREATED)
async def create_supplier_payment_entry(
    payment_in: SupplierPaymentCreate,
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> SupplierPayment:
    payment = await record_supplier_payment(db, payment_in)
    await log_activity(
        db,
        user_id=current_user.id,
        action="supplier_payment_created",
        module="finance",
        entity_type="supplier_payment",
        entity_id=payment.id,
        message=f"Created supplier payment {payment.payment_number}.",
        request=request,
    )
    await commit_or_409(db, "Could not create supplier payment")
    return await fetch_one_or_404(db, _supplier_payment_query().where(SupplierPayment.id == payment.id), "Supplier payment not found")
