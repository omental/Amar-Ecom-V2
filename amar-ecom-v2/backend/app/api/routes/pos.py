from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload

from app.api.deps import DBSession, get_current_user
from app.api.utils import commit_or_409, ensure_unique, fetch_one_or_404
from app.models.customer import Customer
from app.models.inventory import InventoryItem
from app.models.order import Order, OrderEvent, OrderItem
from app.models.product import Product, ProductVariant
from app.models.user import User
from app.models.warehouse import Warehouse
from app.schemas.finance import TransactionCreate
from app.schemas.pos import PosCheckoutCreate, PosCheckoutRead, PosProductRead, PosSummaryRead
from app.services.activity_log_service import log_activity
from app.services.finance_service import create_transaction
from app.services.inventory_service import decrease_stock, get_inventory_item_for_fulfillment


router = APIRouter(dependencies=[Depends(get_current_user)])


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _generate_order_number() -> str:
    return f"ORD-POS-{_now().strftime('%Y%m%d%H%M%S%f')}"


def _generate_transaction_number() -> str:
    return f"TXN-POS-{_now().strftime('%Y%m%d%H%M%S%f')}"


def _quantize(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"))


def _pos_order_query():
    return select(Order).options(
        selectinload(Order.items),
        selectinload(Order.customer),
        selectinload(Order.warehouse),
        selectinload(Order.events).selectinload(OrderEvent.created_by),
        selectinload(Order.stock_movements),
    )


@router.get("/products", response_model=list[PosProductRead])
async def search_pos_products(
    db: DBSession,
    search: str | None = Query(default=None),
    warehouse_id: UUID | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
) -> list[PosProductRead]:
    term = search.strip() if search else None

    if warehouse_id is not None:
        await fetch_one_or_404(db, select(Warehouse).where(Warehouse.id == warehouse_id), "Warehouse not found")
        stmt = (
            select(InventoryItem)
            .options(
                selectinload(InventoryItem.product),
                selectinload(InventoryItem.variant).selectinload(ProductVariant.product),
            )
            .where(InventoryItem.warehouse_id == warehouse_id)
            .order_by(InventoryItem.updated_at.desc())
        )
        if term:
            like_term = f"%{term}%"
            stmt = (
                stmt.join(Product, InventoryItem.product_id == Product.id, isouter=True)
                .join(ProductVariant, InventoryItem.variant_id == ProductVariant.id, isouter=True)
                .where(
                    or_(
                        Product.name.ilike(like_term),
                        Product.sku.ilike(like_term),
                        ProductVariant.name.ilike(like_term),
                        ProductVariant.sku.ilike(like_term),
                    )
                )
            )
        result = await db.execute(stmt.limit(limit))
        rows = list(result.scalars().unique().all())
        payload: list[PosProductRead] = []
        for inventory_item in rows:
            product = inventory_item.product or (inventory_item.variant.product if inventory_item.variant else None)
            variant = inventory_item.variant
            if product is None:
                continue
            payload.append(
                PosProductRead(
                    product_id=product.id,
                    variant_id=variant.id if variant else None,
                    name=f"{product.name} - {variant.name}" if variant else product.name,
                    sku=variant.sku if variant else product.sku,
                    price=variant.price if variant else product.price,
                    stock_quantity=inventory_item.quantity,
                    image_url=product.image_url,
                )
            )
        return payload

    stmt = select(Product).options(selectinload(Product.variants)).where(Product.status == "active").order_by(Product.name.asc())
    if term:
        like_term = f"%{term}%"
        stmt = stmt.where(or_(Product.name.ilike(like_term), Product.sku.ilike(like_term)))
    result = await db.execute(stmt.limit(limit))
    products = list(result.scalars().unique().all())

    payload: list[PosProductRead] = []
    for product in products:
        if product.variants:
            for variant in product.variants:
                payload.append(
                    PosProductRead(
                        product_id=product.id,
                        variant_id=variant.id,
                        name=f"{product.name} - {variant.name}",
                        sku=variant.sku,
                        price=variant.price,
                        stock_quantity=variant.stock_quantity,
                        image_url=product.image_url,
                    )
                )
        else:
            payload.append(
                PosProductRead(
                    product_id=product.id,
                    variant_id=None,
                    name=product.name,
                    sku=product.sku,
                    price=product.price,
                    stock_quantity=0,
                    image_url=product.image_url,
                )
            )
    return payload[:limit]


@router.post("/checkout", response_model=PosCheckoutRead, status_code=status.HTTP_201_CREATED)
async def create_pos_checkout(
    checkout_in: PosCheckoutCreate,
    db: DBSession,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> PosCheckoutRead:
    warehouse = await fetch_one_or_404(
        db,
        select(Warehouse).where(Warehouse.id == checkout_in.warehouse_id),
        "Warehouse not found",
    )
    if not warehouse.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Selected warehouse is inactive.")
    if not checkout_in.items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="POS cart must contain at least one item.")

    customer = None
    if checkout_in.customer_id is not None:
        customer = await fetch_one_or_404(
            db,
            select(Customer).where(Customer.id == checkout_in.customer_id),
            "Customer not found",
        )

    subtotal = Decimal("0.00")
    for item in checkout_in.items:
        line_total = _quantize(item.unit_price * item.quantity)
        subtotal += line_total
    subtotal = _quantize(subtotal)
    discount = _quantize(checkout_in.discount)
    total = _quantize(max(subtotal - discount, Decimal("0.00")))
    actual_paid_amount = _quantize(min(checkout_in.paid_amount, total))
    due_amount = _quantize(max(total - actual_paid_amount, Decimal("0.00")))
    change_amount = _quantize(max(checkout_in.paid_amount - total, Decimal("0.00")))

    if actual_paid_amount >= total:
        payment_status = "paid"
    elif actual_paid_amount > Decimal("0.00"):
        payment_status = "partial"
    else:
        payment_status = "unpaid"

    order_number = _generate_order_number()
    await ensure_unique(db, Order, "order_number", order_number, "Generated POS order number already exists")

    resolved_customer_name = (
        (checkout_in.customer_name or "").strip()
        or (customer.name if customer else "")
        or "Walk-in Customer"
    )
    resolved_customer_phone = (checkout_in.customer_phone or "").strip() or (customer.phone if customer else None)

    order = Order(
        order_number=order_number,
        customer_id=customer.id if customer else None,
        warehouse_id=warehouse.id,
        customer_name=resolved_customer_name,
        customer_phone=resolved_customer_phone,
        notes=checkout_in.notes,
        tags="pos",
        status="delivered",
        payment_status=payment_status,
        payment_method=checkout_in.payment_method,
        source="pos",
        subtotal=subtotal,
        discount=discount,
        delivery_charge=Decimal("0.00"),
        paid_amount=actual_paid_amount,
        total=total,
        stock_deducted=False,
    )
    order.events.append(
        OrderEvent(
            event_type="pos_checkout_created",
            message=f"POS checkout created in {warehouse.name}.",
            created_by_id=current_user.id,
        )
    )
    for item in checkout_in.items:
        line_total = _quantize(item.unit_price * item.quantity)
        order.items.append(
            OrderItem(
                product_id=item.product_id,
                variant_id=item.variant_id,
                product_name=item.product_name,
                sku=item.sku,
                quantity=item.quantity,
                unit_price=_quantize(item.unit_price),
                total_price=line_total,
            )
        )

    db.add(order)
    await db.flush()

    for item in order.items:
        inventory_item = await get_inventory_item_for_fulfillment(
            db,
            product_id=item.product_id,
            variant_id=item.variant_id,
            warehouse_id=warehouse.id,
            required_quantity=item.quantity,
        )
        await decrease_stock(
            db,
            inventory_item=inventory_item,
            quantity=item.quantity,
            movement_type="pos_sale",
            order_id=order.id,
            note=f"POS sale stock deduction for {order.order_number}",
        )
    order.stock_deducted = True

    if checkout_in.account_id is not None and actual_paid_amount > Decimal("0.00"):
        await create_transaction(
            db,
            TransactionCreate(
                transaction_number=_generate_transaction_number(),
                account_id=checkout_in.account_id,
                related_account_id=None,
                transaction_type="customer_payment",
                category=checkout_in.payment_method,
                amount=actual_paid_amount,
                direction="in",
                reference_type="order",
                reference_id=str(order.id),
                description=f"POS payment for {order.order_number}",
                transaction_date=_now(),
            ),
            created_by=current_user,
        )

    await log_activity(
        db,
        user_id=current_user.id,
        action="pos_checkout_created",
        module="pos",
        entity_type="order",
        entity_id=order.id,
        message=f"Created POS order {order.order_number} for {resolved_customer_name}.",
        request=request,
    )
    await commit_or_409(db, "Could not complete POS checkout")

    created_order = await fetch_one_or_404(db, _pos_order_query().where(Order.id == order.id), "Order not found")
    return PosCheckoutRead(
        order=created_order,
        payment_status=payment_status,
        change_amount=change_amount,
        due_amount=due_amount,
        receipt_url=f"/dashboard/orders/{order.id}/invoice",
        order_id=order.id,
    )


@router.get("/summary", response_model=PosSummaryRead)
async def get_pos_summary(db: DBSession) -> PosSummaryRead:
    start_of_day = _now().replace(hour=0, minute=0, second=0, microsecond=0)
    result = await db.execute(
        select(
            func.count(Order.id),
            func.coalesce(func.sum(Order.total), 0),
            func.coalesce(func.sum(Order.paid_amount), 0),
            func.coalesce(func.sum(Order.total - Order.paid_amount), 0),
        ).where(Order.source == "pos", Order.created_at >= start_of_day)
    )
    count, sales, paid, due = result.one()
    return PosSummaryRead(
        today_pos_orders=int(count or 0),
        today_pos_sales=_quantize(Decimal(sales or 0)),
        today_paid_amount=_quantize(Decimal(paid or 0)),
        today_due_amount=_quantize(Decimal(due or 0)),
    )
