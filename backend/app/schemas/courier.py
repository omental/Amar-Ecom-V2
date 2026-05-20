from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import AliasChoices, BaseModel, Field, computed_field

from app.schemas.common import ORMBaseSchema
from app.schemas.customer import CustomerListRead
from app.schemas.user import UserRead
from app.schemas.warehouse import WarehouseRead


class CourierCreate(BaseModel):
    name: str = Field(validation_alias=AliasChoices("name", "courierName"))
    code: str
    contact_phone: str | None = Field(default=None, validation_alias=AliasChoices("contact_phone", "contactPhone", "phone"))
    website: str | None = None
    is_active: bool = Field(default=True, validation_alias=AliasChoices("is_active", "isActive"))


class CourierUpdate(BaseModel):
    name: str | None = Field(default=None, validation_alias=AliasChoices("name", "courierName"))
    code: str | None = None
    contact_phone: str | None = Field(default=None, validation_alias=AliasChoices("contact_phone", "contactPhone", "phone"))
    website: str | None = None
    is_active: bool | None = Field(default=None, validation_alias=AliasChoices("is_active", "isActive"))


class CourierRead(ORMBaseSchema):
    id: UUID
    name: str
    code: str
    contact_phone: str | None
    website: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    active_shipment_count: int = 0
    delivered_count: int = 0
    pending_reconciliation_count: int = 0

    @computed_field(return_type=str)
    @property
    def courierName(self) -> str:
        return self.name

    @computed_field(return_type=str | None)
    @property
    def contactPhone(self) -> str | None:
        return self.contact_phone

    @computed_field(return_type=str)
    @property
    def status(self) -> str:
        return "Active" if self.is_active else "Inactive"

    @computed_field(return_type=int)
    @property
    def activeShipmentCount(self) -> int:
        return self.active_shipment_count

    @computed_field(return_type=int)
    @property
    def deliveredCount(self) -> int:
        return self.delivered_count

    @computed_field(return_type=int)
    @property
    def pendingReconciliationCount(self) -> int:
        return self.pending_reconciliation_count

    @computed_field(return_type=datetime)
    @property
    def createdAt(self) -> datetime:
        return self.created_at

    @computed_field(return_type=datetime)
    @property
    def updatedAt(self) -> datetime:
        return self.updated_at


class ShipmentCreate(BaseModel):
    shipment_number: str = Field(validation_alias=AliasChoices("shipment_number", "shipmentNumber"))
    order_id: UUID = Field(validation_alias=AliasChoices("order_id", "orderId"))
    courier_id: UUID | None = Field(default=None, validation_alias=AliasChoices("courier_id", "courierId"))
    recipient_name: str | None = Field(default=None, validation_alias=AliasChoices("recipient_name", "recipientName"))
    recipient_phone: str | None = Field(default=None, validation_alias=AliasChoices("recipient_phone", "recipientPhone"))
    delivery_address: str | None = Field(default=None, validation_alias=AliasChoices("delivery_address", "deliveryAddress"))
    tracking_number: str | None = Field(default=None, validation_alias=AliasChoices("tracking_number", "trackingNumber"))
    status: str = "pending"
    delivery_charge: Decimal = Field(default=Decimal("0.00"), validation_alias=AliasChoices("delivery_charge", "deliveryCharge"))
    courier_charge: Decimal = Field(default=Decimal("0.00"), validation_alias=AliasChoices("courier_charge", "courierCharge"))
    cod_amount: Decimal = Field(default=Decimal("0.00"), validation_alias=AliasChoices("cod_amount", "codAmount"))
    collected_amount: Decimal = Field(default=Decimal("0.00"), validation_alias=AliasChoices("collected_amount", "collectedAmount"))
    reconciliation_status: str = Field(default="pending", validation_alias=AliasChoices("reconciliation_status", "reconciliationStatus"))
    notes: str | None = None


class ShipmentUpdate(BaseModel):
    courier_id: UUID | None = Field(default=None, validation_alias=AliasChoices("courier_id", "courierId"))
    recipient_name: str | None = Field(default=None, validation_alias=AliasChoices("recipient_name", "recipientName"))
    recipient_phone: str | None = Field(default=None, validation_alias=AliasChoices("recipient_phone", "recipientPhone"))
    delivery_address: str | None = Field(default=None, validation_alias=AliasChoices("delivery_address", "deliveryAddress"))
    tracking_number: str | None = Field(default=None, validation_alias=AliasChoices("tracking_number", "trackingNumber"))
    status: str | None = None
    delivery_charge: Decimal | None = Field(default=None, ge=0, validation_alias=AliasChoices("delivery_charge", "deliveryCharge"))
    courier_charge: Decimal | None = Field(default=None, ge=0, validation_alias=AliasChoices("courier_charge", "courierCharge"))
    cod_amount: Decimal | None = Field(default=None, ge=0, validation_alias=AliasChoices("cod_amount", "codAmount"))
    collected_amount: Decimal | None = Field(default=None, ge=0, validation_alias=AliasChoices("collected_amount", "collectedAmount"))
    reconciliation_status: str | None = Field(default=None, validation_alias=AliasChoices("reconciliation_status", "reconciliationStatus"))
    notes: str | None = None


class ShipmentOrderSummary(ORMBaseSchema):
    id: UUID
    order_number: str
    customer_name: str | None = None
    customer_phone: str | None = None
    shipping_address: str | None = None
    total: Decimal | None = None
    customer: CustomerListRead | None = None
    warehouse: WarehouseRead | None = None


class ShipmentEventRead(ORMBaseSchema):
    id: UUID
    shipment_id: UUID
    event_type: str
    message: str
    created_by_id: UUID | None
    created_at: datetime
    created_by: UserRead | None = None

    @computed_field(return_type=str)
    @property
    def activityType(self) -> str:
        return self.event_type

    @computed_field(return_type=datetime)
    @property
    def createdAt(self) -> datetime:
        return self.created_at

    @computed_field(return_type=str | None)
    @property
    def createdBy(self) -> str | None:
        if self.created_by is None:
            return None
        return self.created_by.full_name or self.created_by.email


class ShipmentCreateFromOrder(BaseModel):
    courier_id: UUID | None = Field(default=None, validation_alias=AliasChoices("courier_id", "courierId"))
    tracking_number: str | None = Field(default=None, validation_alias=AliasChoices("tracking_number", "trackingNumber"))
    shipment_number: str | None = Field(default=None, validation_alias=AliasChoices("shipment_number", "shipmentNumber"))
    delivery_charge: Decimal = Field(default=Decimal("0.00"), validation_alias=AliasChoices("delivery_charge", "deliveryCharge"))
    courier_charge: Decimal = Field(default=Decimal("0.00"), validation_alias=AliasChoices("courier_charge", "courierCharge"))
    cod_amount: Decimal = Field(default=Decimal("0.00"), validation_alias=AliasChoices("cod_amount", "codAmount"))
    collected_amount: Decimal = Field(default=Decimal("0.00"), validation_alias=AliasChoices("collected_amount", "collectedAmount"))
    notes: str | None = None
    order_status: str | None = Field(default=None, validation_alias=AliasChoices("order_status", "orderStatus"))


class PendingDispatchOrderRead(ORMBaseSchema):
    id: UUID
    order_number: str
    customer_id: UUID | None
    warehouse_id: UUID | None
    customer_name: str | None = None
    customer_phone: str | None
    shipping_address: str | None
    status: str
    payment_status: str
    source: str
    total: Decimal
    created_at: datetime
    customer: CustomerListRead | None = None
    warehouse: WarehouseRead | None = None
    item_count: int = 0
    has_shipment: bool = False

    @computed_field(return_type=str)
    @property
    def orderNumber(self) -> str:
        return self.order_number

    @computed_field(return_type=str | None)
    @property
    def customerName(self) -> str | None:
        return self.customer_name or (self.customer.name if self.customer else None)

    @computed_field(return_type=str | None)
    @property
    def customerPhone(self) -> str | None:
        return self.customer_phone or (self.customer.phone if self.customer else None)

    @computed_field(return_type=str | None)
    @property
    def customerAddress(self) -> str | None:
        return self.shipping_address or (self.customer.address if self.customer else None)

    @computed_field(return_type=str | None)
    @property
    def shippingAddress(self) -> str | None:
        return self.shipping_address

    @computed_field(return_type=str | None)
    @property
    def warehouseName(self) -> str | None:
        return self.warehouse.name if self.warehouse else None

    @computed_field(return_type=int)
    @property
    def itemCount(self) -> int:
        return self.item_count

    @computed_field(return_type=Decimal)
    @property
    def totalAmount(self) -> Decimal:
        return self.total

    @computed_field(return_type=str)
    @property
    def paymentStatus(self) -> str:
        return self.payment_status

    @computed_field(return_type=str)
    @property
    def orderStatus(self) -> str:
        return self.status

    @computed_field(return_type=datetime)
    @property
    def createdAt(self) -> datetime:
        return self.created_at

    @computed_field(return_type=bool)
    @property
    def courierReady(self) -> bool:
        return self.status in {"confirmed", "processing", "ready_to_ship"}

    @computed_field(return_type=bool)
    @property
    def hasShipment(self) -> bool:
        return self.has_shipment

    @computed_field(return_type=bool)
    @property
    def canCreateShipment(self) -> bool:
        return self.courierReady and not self.has_shipment

    @computed_field(return_type=bool)
    @property
    def canPrint(self) -> bool:
        return True

    @computed_field(return_type=bool)
    @property
    def canOpenOrder(self) -> bool:
        return True


class ShipmentListRead(ORMBaseSchema):
    id: UUID
    shipment_number: str
    order_id: UUID
    courier_id: UUID | None
    recipient_name: str | None
    recipient_phone: str | None
    delivery_address: str | None
    tracking_number: str | None
    external_provider: str | None = None
    external_consignment_id: str | None = None
    external_tracking_number: str | None = None
    external_status: str | None = None
    external_synced_at: datetime | None = None
    external_payload_snapshot: str | None = None
    sent_to_courier_at: datetime | None = None
    status: str
    delivery_charge: Decimal
    courier_charge: Decimal
    cod_amount: Decimal
    collected_amount: Decimal
    reconciliation_status: str
    reconciled_at: datetime | None
    shipped_at: datetime | None
    delivered_at: datetime | None
    notes: str | None
    created_at: datetime
    updated_at: datetime
    order: ShipmentOrderSummary | None = None
    courier: CourierRead | None = None

    @computed_field(return_type=str)
    @property
    def shipmentNumber(self) -> str:
        return self.shipment_number

    @computed_field(return_type=str | None)
    @property
    def orderNumber(self) -> str | None:
        return self.order.order_number if self.order else None

    @computed_field(return_type=str | None)
    @property
    def customerName(self) -> str | None:
        if self.order:
            if self.order.customer_name:
                return self.order.customer_name
            if self.order.customer:
                return self.order.customer.name
        return None

    @computed_field(return_type=str | None)
    @property
    def recipientName(self) -> str | None:
        return self.recipient_name

    @computed_field(return_type=str | None)
    @property
    def recipientPhone(self) -> str | None:
        return self.recipient_phone

    @computed_field(return_type=str | None)
    @property
    def deliveryAddress(self) -> str | None:
        return self.delivery_address

    @computed_field(return_type=str | None)
    @property
    def courierName(self) -> str | None:
        return self.courier.name if self.courier else None

    @computed_field(return_type=str | None)
    @property
    def trackingNumber(self) -> str | None:
        return self.tracking_number or self.external_tracking_number or self.external_consignment_id

    @computed_field(return_type=str)
    @property
    def statusLabel(self) -> str:
        return self.status.replace("_", " ").title()

    @computed_field(return_type=str)
    @property
    def reconciliationStatus(self) -> str:
        return self.reconciliation_status

    @computed_field(return_type=Decimal)
    @property
    def codAmount(self) -> Decimal:
        return self.cod_amount

    @computed_field(return_type=Decimal)
    @property
    def collectedAmount(self) -> Decimal:
        return self.collected_amount

    @computed_field(return_type=Decimal)
    @property
    def courierCharge(self) -> Decimal:
        return self.courier_charge

    @computed_field(return_type=Decimal)
    @property
    def pendingAmount(self) -> Decimal:
        base_amount = self.collected_amount if self.collected_amount > 0 else self.cod_amount
        pending = base_amount - self.courier_charge
        return pending if pending > Decimal("0.00") else Decimal("0.00")

    @computed_field(return_type=str | None)
    @property
    def externalProvider(self) -> str | None:
        return self.external_provider

    @computed_field(return_type=str | None)
    @property
    def externalStatus(self) -> str | None:
        return self.external_status

    @computed_field(return_type=datetime | None)
    @property
    def externalSyncedAt(self) -> datetime | None:
        return self.external_synced_at

    @computed_field(return_type=bool)
    @property
    def sentToCourier(self) -> bool:
        return self.sent_to_courier_at is not None

    @computed_field(return_type=datetime)
    @property
    def createdAt(self) -> datetime:
        return self.created_at

    @computed_field(return_type=datetime)
    @property
    def updatedAt(self) -> datetime:
        return self.updated_at

    @computed_field(return_type=datetime | None)
    @property
    def shippedAt(self) -> datetime | None:
        return self.shipped_at

    @computed_field(return_type=datetime | None)
    @property
    def deliveredAt(self) -> datetime | None:
        return self.delivered_at

    @computed_field(return_type=datetime | None)
    @property
    def reconciledAt(self) -> datetime | None:
        return self.reconciled_at

    @computed_field(return_type=dict[str, bool])
    @property
    def action_flags(self) -> dict[str, bool]:
        is_closed = self.status in {"delivered", "cancelled", "returned", "failed"}
        has_external_link = bool(self.external_provider or self.sent_to_courier_at)
        return {
            "can_send_to_courier": not is_closed and self.courier_id is not None and not self.sentToCourier,
            "can_sync_status": has_external_link,
            "can_mark_shipped": self.status in {"pending", "ready_to_ship", "in_transit"},
            "can_mark_delivered": self.status in {"pending", "ready_to_ship", "shipped", "in_transit"},
            "can_reconcile": self.status not in {"cancelled"} and self.reconciliation_status != "settled",
        }

    @computed_field(return_type=bool)
    @property
    def canSendToCourier(self) -> bool:
        return self.action_flags["can_send_to_courier"]

    @computed_field(return_type=bool)
    @property
    def canSyncStatus(self) -> bool:
        return self.action_flags["can_sync_status"]

    @computed_field(return_type=bool)
    @property
    def canMarkShipped(self) -> bool:
        return self.action_flags["can_mark_shipped"]

    @computed_field(return_type=bool)
    @property
    def canMarkDelivered(self) -> bool:
        return self.action_flags["can_mark_delivered"]

    @computed_field(return_type=bool)
    @property
    def canReconcile(self) -> bool:
        return self.action_flags["can_reconcile"]


class ShipmentRead(ShipmentListRead):
    events: list[ShipmentEventRead] = []

    @computed_field(return_type=list[dict[str, object]])
    @property
    def logs(self) -> list[dict[str, object]]:
        return [
            {
                "id": event.id,
                "activityType": event.event_type,
                "message": event.message,
                "createdBy": event.createdBy,
                "createdAt": event.created_at,
            }
            for event in self.events
        ]


class LogisticsOperationsSummaryRead(BaseModel):
    pending_dispatch_count: int
    sent_to_external_courier_count: int
    external_delivered_unsettled_count: int
    external_failed_returned_count: int
    unsettled_reconciliation_count: int
    shipments_missing_tracking_count: int
    shipments_waiting_status_sync_count: int
    delivered_shipments: int
    failed_shipments: int


class LogisticsCommandSummaryRead(BaseModel):
    pending_dispatch_count: int = 0
    ready_to_ship_count: int = 0
    active_shipments: int = 0
    shipped_shipments: int = 0
    delivered_shipments: int = 0
    failed_shipments: int = 0
    returned_shipments: int = 0
    pending_reconciliation: int = 0
    settled_reconciliation: int = 0
    total_cod_amount: Decimal = Decimal("0.00")
    total_collected_amount: Decimal = Decimal("0.00")
    total_courier_charge: Decimal = Decimal("0.00")
    external_sent_count: int = 0
    external_pending_sync_count: int = 0
    external_failed_count: int = 0
    courier_count: int = 0
    active_courier_count: int = 0
    returns_pending: int = 0
    returns_restocked: int = 0
    purchase_orders_pending: int = 0
    suppliers_count: int = 0


class ShipmentBatchStatusUpdateRequest(BaseModel):
    shipment_ids: list[UUID]
    status: str


class ShipmentBatchStatusUpdateRowRead(BaseModel):
    shipment_id: UUID
    status: str
    message: str


class ShipmentBatchStatusUpdateResultRead(BaseModel):
    status: str
    success_count: int
    skipped_count: int
    failed_count: int
    rows: list[ShipmentBatchStatusUpdateRowRead]
