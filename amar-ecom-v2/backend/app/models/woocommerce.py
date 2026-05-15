import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class WooCommerceSetting(Base):
    __tablename__ = "woocommerce_settings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    store_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # TODO: Replace plaintext credential storage with proper encryption before production use.
    consumer_key_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    # TODO: Replace plaintext credential storage with proper encryption before production use.
    consumer_secret_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    api_version: Mapped[str] = mapped_column(String(50), nullable=False, default="wc/v3", server_default="wc/v3")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    auto_sync_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    sync_products_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    sync_orders_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    sync_interval_minutes: Mapped[int] = mapped_column(nullable=False, default=60, server_default="60")
    last_tested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_test_success: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    last_test_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_product_sync_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_order_sync_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_sync_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_sync_finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_sync_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    last_sync_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class WooCommerceSyncLog(Base):
    __tablename__ = "woocommerce_sync_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sync_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    direction: Mapped[str] = mapped_column(String(20), nullable=False, default="import", server_default="import")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending", server_default="pending", index=True)
    external_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    local_entity_type: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    local_entity_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    payload_snapshot: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    created_by = relationship("User", back_populates="woocommerce_sync_logs_created")
