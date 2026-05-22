from datetime import datetime, timezone
from decimal import Decimal

from fastapi import HTTPException, status

from app.models.order import Order
from app.models.storefront import StorefrontCoupon, StorefrontSetting


ORDER_TIMELINE_STEPS = [
    ("pending", "Order placed"),
    ("confirmed", "Confirmed"),
    ("processing", "Processing"),
    ("shipped", "Shipped / Out for delivery"),
    ("delivered", "Delivered"),
]


def calculate_delivery_charge(
    settings: StorefrontSetting,
    *,
    subtotal: Decimal,
    delivery_zone: str,
) -> Decimal:
    free_delivery_minimum = (
        Decimal(str(settings.free_delivery_minimum))
        if settings.free_delivery_minimum is not None
        else None
    )
    if free_delivery_minimum is not None and subtotal >= free_delivery_minimum:
        return Decimal("0.00")

    if delivery_zone == "outside_dhaka":
        return Decimal(str(settings.outside_dhaka_delivery_charge))
    return Decimal(str(settings.inside_dhaka_delivery_charge))


def validate_coupon_for_checkout(
    coupon: StorefrontCoupon | None,
    *,
    subtotal: Decimal,
    now: datetime | None = None,
) -> Decimal:
    if coupon is None:
        return Decimal("0.00")

    now = now or datetime.now(timezone.utc)
    if not coupon.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Coupon is inactive.")
    if coupon.starts_at is not None and coupon.starts_at > now:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Coupon is not active yet.")
    if coupon.ends_at is not None and coupon.ends_at < now:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Coupon has expired.")
    if coupon.usage_limit is not None and coupon.usage_count >= coupon.usage_limit:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Coupon usage limit has been reached.")

    minimum = Decimal(str(coupon.min_order_amount or 0))
    if subtotal < minimum:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Coupon requires a minimum order of {minimum:.0f}.",
        )

    if coupon.type == "percentage":
        discount = (subtotal * Decimal(str(coupon.value))) / Decimal("100")
    else:
        discount = Decimal(str(coupon.value))

    if coupon.max_discount_amount is not None:
        discount = min(discount, Decimal(str(coupon.max_discount_amount)))

    return min(discount, subtotal).quantize(Decimal("0.01"))


def derive_public_order_timeline(order: Order) -> list[dict[str, object]]:
    event_timestamps: dict[str, datetime] = {"pending": order.created_at}
    for event in order.events or []:
        if event.event_type == "status_changed":
            message = event.message.lower()
            for status_key, _label in ORDER_TIMELINE_STEPS:
                if f"to {status_key}" in message:
                    event_timestamps[status_key] = event.created_at

    current_status = order.status
    timeline: list[dict[str, object]] = []
    completed = True
    for status_key, label in ORDER_TIMELINE_STEPS:
        step_completed = completed
        if current_status == "pending" and status_key != "pending":
            step_completed = False
            completed = False
        elif current_status == "confirmed" and status_key not in {"pending", "confirmed"}:
            step_completed = False
            completed = False
        elif current_status == "processing" and status_key not in {"pending", "confirmed", "processing"}:
            step_completed = False
            completed = False
        elif current_status in {"ready_to_ship", "partial_delivered", "shipped"} and status_key == "delivered":
            step_completed = False
            completed = False
        elif current_status in {"cancelled", "returned"} and status_key in {"shipped", "delivered"}:
            step_completed = False
            completed = False

        timeline.append(
            {
                "label": label,
                "status": status_key,
                "completed": step_completed,
                "timestamp": event_timestamps.get(status_key),
            }
        )

    if current_status == "cancelled":
        timeline.append(
            {
                "label": "Cancelled",
                "status": "cancelled",
                "completed": True,
                "timestamp": event_timestamps.get("cancelled") or order.updated_at,
            }
        )

    return timeline
