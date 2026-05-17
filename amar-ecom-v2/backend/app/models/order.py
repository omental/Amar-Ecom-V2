import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_number: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    customer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="SET NULL"),
        nullable=True,
    )
    warehouse_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("warehouses.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    customer_name: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    customer_phone: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    shipping_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="pending", server_default="pending")
    payment_status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="unpaid",
        server_default="unpaid",
    )
    payment_method: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    source: Mapped[str] = mapped_column(String(50), nullable=False, default="manual", server_default="manual")
    external_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    external_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    external_status: Mapped[str | None] = mapped_column(String(100), nullable=True)
    external_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    external_payload_snapshot: Mapped[str | None] = mapped_column(Text, nullable=True)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    discount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    delivery_charge: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    paid_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0, server_default="0")
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    stock_deducted: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )
    printed_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )
    last_printed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    customer = relationship("Customer", back_populates="orders")
    warehouse = relationship("Warehouse", back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    events = relationship(
        "OrderEvent",
        back_populates="order",
        cascade="all, delete-orphan",
        order_by="OrderEvent.created_at.desc()",
    )
    shipments = relationship("Shipment", back_populates="order", cascade="all, delete-orphan")
    stock_movements = relationship("StockMovement", back_populates="order")
    return_requests = relationship("ReturnRequest", back_populates="order")

    @property
    def customer_address(self) -> str | None:
        return self.shipping_address or (self.customer.address if self.customer else None)

    @property
    def customerAddress(self) -> str | None:
        return self.customer_address

    @property
    def customerName(self) -> str | None:
        return self.customer_name or (self.customer.name if self.customer else None)

    @property
    def customerPhone(self) -> str | None:
        return self.customer_phone or (self.customer.phone if self.customer else None)

    @property
    def orderNumber(self) -> str:
        return self.order_number

    @property
    def paymentMethod(self) -> str | None:
        return self.payment_method

    @property
    def deliveryCharge(self) -> Decimal:
        return self.delivery_charge

    @property
    def paidAmount(self) -> Decimal:
        return self.paid_amount

    @property
    def totalAmount(self) -> Decimal:
        return self.total

    @property
    def due_amount(self) -> Decimal:
        outstanding = (self.total or Decimal("0")) - (self.paid_amount or Decimal("0"))
        return outstanding if outstanding > 0 else Decimal("0")

    @property
    def dueAmount(self) -> Decimal:
        return self.due_amount

    @property
    def createdAt(self) -> datetime:
        return self.created_at

    @property
    def updatedAt(self) -> datetime:
        return self.updated_at

    @property
    def lastPrintedAt(self) -> datetime | None:
        return self.last_printed_at

    @property
    def item_count(self) -> int:
        return len(self.items or [])

    @property
    def first_item_summary(self) -> dict[str, object] | None:
        if not self.items:
            return None
        item = self.items[0]
        return {
            "product_id": item.product_id,
            "variant_id": item.variant_id,
            "product_name": item.product_name,
            "sku": item.sku,
            "quantity": item.quantity,
            "unit_price": item.unit_price,
            "total_price": item.total_price,
        }

    @property
    def warehouse_summary(self) -> dict[str, object] | None:
        if not self.warehouse:
            return None
        return {
            "id": self.warehouse.id,
            "name": self.warehouse.name,
            "code": self.warehouse.code,
            "address": self.warehouse.address,
            "is_active": self.warehouse.is_active,
        }

    @property
    def active_shipment(self):
        return next(
            (
                shipment
                for shipment in self.shipments or []
                if shipment.status not in {"cancelled", "returned"}
            ),
            None,
        )

    @property
    def shipment_summary(self) -> dict[str, object] | None:
        shipment = self.active_shipment
        if shipment is None:
            return None
        return {
            "id": shipment.id,
            "shipment_number": shipment.shipment_number,
            "status": shipment.status,
            "tracking_number": shipment.tracking_number,
            "external_tracking_number": shipment.external_tracking_number,
            "external_consignment_id": shipment.external_consignment_id,
            "external_status": shipment.external_status,
            "courier_id": shipment.courier_id,
            "courier_name": shipment.courier.name if shipment.courier else None,
            "delivery_charge": shipment.delivery_charge,
            "courier_charge": shipment.courier_charge,
            "cod_amount": shipment.cod_amount,
            "collected_amount": shipment.collected_amount,
            "reconciliation_status": shipment.reconciliation_status,
            "sent_to_courier_at": shipment.sent_to_courier_at,
            "shipped_at": shipment.shipped_at,
            "delivered_at": shipment.delivered_at,
        }

    @property
    def courierName(self) -> str | None:
        shipment = self.active_shipment
        if shipment and shipment.courier:
            return shipment.courier.name
        return None

    @property
    def trackingNumber(self) -> str | None:
        shipment = self.active_shipment
        if shipment is None:
            return None
        return shipment.tracking_number or shipment.external_tracking_number

    @property
    def customer_summary(self) -> dict[str, object]:
        return {
            "id": self.customer_id,
            "name": self.customerName,
            "phone": self.customerPhone,
            "email": self.customer.email if self.customer else None,
            "address": self.customer_address,
            "city": self.customer.city if self.customer else None,
            "customer_type": self.customer.customer_type if self.customer else None,
            "tags": self.customer.tags if self.customer else None,
            "notes": self.customer.notes if self.customer else None,
        }

    @property
    def shipping_summary(self) -> dict[str, object]:
        return {
            "recipient_name": self.customerName,
            "recipient_phone": self.customerPhone,
            "address": self.customer_address,
            "shipping_address": self.shipping_address,
            "warehouse_id": self.warehouse_id,
        }

    @property
    def totals_summary(self) -> dict[str, object]:
        return {
            "subtotal": self.subtotal,
            "discount": self.discount,
            "delivery_charge": self.delivery_charge,
            "total": self.total,
            "paid_amount": self.paid_amount,
            "due_amount": self.due_amount,
        }

    @property
    def logs(self) -> list[dict[str, object]]:
        entries: list[dict[str, object]] = []
        for event in self.events or []:
            actor = None
            if event.created_by:
                actor = event.created_by.email or event.created_by.full_name
            entries.append(
                {
                    "id": event.id,
                    "action": event.event_type,
                    "details": event.message,
                    "user": actor,
                    "timestamp": event.created_at,
                }
            )
        return entries

    @property
    def action_flags(self) -> dict[str, bool]:
        has_active_shipment = self.active_shipment is not None
        return {
            "can_print": True,
            "can_edit": self.status not in {"delivered", "cancelled", "returned"},
            "can_create_shipment": (not has_active_shipment) and self.status not in {"cancelled", "returned", "delivered"},
            "can_refresh_woo": self.source == "woocommerce" and bool(self.external_id),
            "can_deduct_stock_by_status": self.status in {"shipped", "delivered"} and not self.stock_deducted,
            "can_cancel": self.status not in {"cancelled", "returned", "delivered"},
            "can_mark_delivered": self.status in {"shipped", "partial_delivered"},
        }


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
    )
    product_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="SET NULL"),
        nullable=True,
    )
    variant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("product_variants.id", ondelete="SET NULL"),
        nullable=True,
    )
    product_name: Mapped[str] = mapped_column(String(255), nullable=False)
    sku: Mapped[str | None] = mapped_column(String(100), nullable=True)
    quantity: Mapped[int] = mapped_column(nullable=False, default=1, server_default="1")
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    total_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    order = relationship("Order", back_populates="items")


class OrderEvent(Base):
    __tablename__ = "order_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    event_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    order = relationship("Order", back_populates="events")
    created_by = relationship("User", back_populates="order_events_created")
