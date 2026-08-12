import uuid
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Index, Integer, JSON, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class DnsZone(Base):
    __tablename__ = "dns_zones"
    __table_args__ = (
        UniqueConstraint("store_id", "zone_name", name="uq_dns_zones_store_name"),
        UniqueConstraint("store_domain_id", name="uq_dns_zones_store_domain"),
        CheckConstraint("status IN ('preparing', 'pending', 'active', 'error', 'disabled', 'deactivating')", name="ck_dns_zones_status"),
        CheckConstraint("delegation_status IN ('pending', 'partial', 'active', 'incorrect', 'error')", name="ck_dns_zones_delegation"),
        CheckConstraint("dnssec_status IN ('disabled', 'pending', 'zone_signed', 'ds_required', 'active', 'broken', 'error')", name="ck_dns_zones_dnssec"),
        CheckConstraint("sync_status IN ('pending', 'syncing', 'synced', 'error', 'drifted')", name="ck_dns_zones_sync"),
        Index("ix_dns_zones_status", "status"),
        Index("ix_dns_zones_delegation_status", "delegation_status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="RESTRICT"), nullable=False, index=True)
    store_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("stores.id", ondelete="RESTRICT"), nullable=False, index=True)
    store_domain_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("store_domains.id", ondelete="RESTRICT"), nullable=False, index=True)
    zone_name: Mapped[str] = mapped_column(String(253), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="preparing", server_default="preparing")
    provider: Mapped[str] = mapped_column(String(50), nullable=False)
    provider_zone_ref: Mapped[str | None] = mapped_column(String(255), nullable=True)
    nameservers: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list, server_default="[]")
    soa_serial: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    delegation_status: Mapped[str] = mapped_column(String(30), nullable=False, default="pending", server_default="pending")
    dnssec_status: Mapped[str] = mapped_column(String(30), nullable=False, default="disabled", server_default="disabled")
    dnssec_ds_records: Mapped[list[dict]] = mapped_column(JSON, nullable=False, default=list, server_default="[]")
    sync_status: Mapped[str] = mapped_column(String(30), nullable=False, default="pending", server_default="pending")
    provider_error: Mapped[str | None] = mapped_column(String(500), nullable=True)
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_delegation_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    activated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deactivated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    store_domain = relationship("StoreDomain", back_populates="dns_zone")
    records = relationship("DnsRecord", back_populates="zone", order_by="DnsRecord.name, DnsRecord.record_type")
    revisions = relationship("DnsZoneRevision", back_populates="zone", order_by="DnsZoneRevision.revision_number.desc()")


class DnsRecord(Base):
    __tablename__ = "dns_records"
    __table_args__ = (
        CheckConstraint("record_type IN ('A', 'AAAA', 'CNAME', 'TXT', 'MX', 'CAA', 'SRV', 'ALIAS')", name="ck_dns_records_type"),
        CheckConstraint("managed_by IN ('merchant', 'amar_system')", name="ck_dns_records_managed_by"),
        CheckConstraint("sync_status IN ('pending', 'synced', 'error')", name="ck_dns_records_sync"),
        CheckConstraint("ttl BETWEEN 60 AND 86400", name="ck_dns_records_ttl"),
        Index("ix_dns_records_zone_name_type", "zone_id", "name", "record_type"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    store_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("stores.id", ondelete="RESTRICT"), nullable=False, index=True)
    zone_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("dns_zones.id", ondelete="RESTRICT"), nullable=False, index=True)
    record_type: Mapped[str] = mapped_column(String(10), nullable=False)
    name: Mapped[str] = mapped_column(String(253), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    ttl: Mapped[int] = mapped_column(Integer, nullable=False, default=3600, server_default="3600")
    priority: Mapped[int | None] = mapped_column(Integer, nullable=True)
    weight: Mapped[int | None] = mapped_column(Integer, nullable=True)
    port: Mapped[int | None] = mapped_column(Integer, nullable=True)
    disabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    managed_by: Mapped[str] = mapped_column(String(30), nullable=False, default="merchant", server_default="merchant")
    purpose: Mapped[str | None] = mapped_column(String(100), nullable=True)
    sync_status: Mapped[str] = mapped_column(String(30), nullable=False, default="pending", server_default="pending")
    provider_record_ref: Mapped[str | None] = mapped_column(String(255), nullable=True)
    provider_error: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    zone = relationship("DnsZone", back_populates="records")


class DnsZoneRevision(Base):
    __tablename__ = "dns_zone_revisions"
    __table_args__ = (UniqueConstraint("zone_id", "revision_number", name="uq_dns_zone_revision_number"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    store_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("stores.id", ondelete="RESTRICT"), nullable=False, index=True)
    zone_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("dns_zones.id", ondelete="RESTRICT"), nullable=False, index=True)
    revision_number: Mapped[int] = mapped_column(Integer, nullable=False)
    records_snapshot: Mapped[list[dict]] = mapped_column(JSON, nullable=False)
    reason: Mapped[str] = mapped_column(String(255), nullable=False)
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    zone = relationship("DnsZone", back_populates="revisions")
