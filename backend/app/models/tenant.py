import re
import unicodedata
import uuid
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Index, JSON, String, Text, UniqueConstraint, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship, validates

from app.core.database import Base
from app.core.domains import RESERVED_PLATFORM_LABELS, normalize_hostname


RESERVED_STORE_SLUGS = RESERVED_PLATFORM_LABELS
STORE_SLUG_PATTERN = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")


def is_valid_store_slug(value: str) -> bool:
    return 2 <= len(value) <= 63 and bool(STORE_SLUG_PATTERN.fullmatch(value)) and value not in RESERVED_STORE_SLUGS


def normalize_store_slug(value: str) -> str:
    ascii_value = unicodedata.normalize("NFKD", value.strip().lower()).encode("ascii", "ignore").decode("ascii")
    normalized = re.sub(r"[^a-z0-9]+", "-", ascii_value).strip("-")
    return normalized[:63].rstrip("-")


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", server_default="active", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    stores = relationship("Store", back_populates="organization")
    members = relationship("OrganizationMember", back_populates="organization")


class Store(Base):
    __tablename__ = "stores"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="RESTRICT"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", server_default="active", index=True)
    timezone: Mapped[str] = mapped_column(String(100), nullable=False, default="Asia/Dhaka", server_default="Asia/Dhaka")
    locale: Mapped[str] = mapped_column(String(20), nullable=False, default="en-BD", server_default="en-BD")
    default_currency: Mapped[str] = mapped_column(String(10), nullable=False, default="BDT", server_default="BDT")
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    organization = relationship("Organization", back_populates="stores")
    members = relationship("StoreMember", back_populates="store")
    domains = relationship("StoreDomain", back_populates="store")


class StoreDomain(Base):
    __tablename__ = "store_domains"
    __table_args__ = (
        UniqueConstraint("hostname", name="uq_store_domains_hostname"),
        CheckConstraint("domain_type IN ('platform_subdomain', 'custom')", name="ck_store_domains_type"),
        CheckConstraint("status IN ('pending', 'active', 'disabled', 'error')", name="ck_store_domains_status"),
        CheckConstraint("verification_status IN ('not_required', 'pending', 'verifying', 'verified', 'failed')", name="ck_store_domains_verification"),
        CheckConstraint("routing_status IN ('not_required', 'pending', 'valid', 'invalid')", name="ck_store_domains_routing"),
        CheckConstraint("ssl_status IN ('pending', 'provisioning', 'active', 'failed', 'renewal_due', 'revoked', 'not_applicable')", name="ck_store_domains_ssl"),
        Index(
            "uq_store_domains_platform_per_store",
            "store_id",
            unique=True,
            postgresql_where=text("domain_type = 'platform_subdomain'"),
        ),
        Index(
            "uq_store_domains_primary_per_store",
            "store_id",
            unique=True,
            postgresql_where=text("is_primary = true"),
        ),
        Index("ix_store_domains_store_type", "store_id", "domain_type"),
        Index("ix_store_domains_status", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    store_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("stores.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    hostname: Mapped[str] = mapped_column(String(253), nullable=False)
    domain_type: Mapped[str] = mapped_column(String(30), nullable=False, default="platform_subdomain")
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", server_default="active")
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    redirect_to_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    verification_status: Mapped[str] = mapped_column(String(30), nullable=False, default="pending", server_default="pending")
    routing_status: Mapped[str] = mapped_column(String(30), nullable=False, default="pending", server_default="pending")
    ssl_status: Mapped[str] = mapped_column(String(30), nullable=False, default="pending", server_default="pending")
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    verification_token_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    verification_token_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    verification_token_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_verification_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_routing_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    verification_failure_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    store = relationship("Store", back_populates="domains")
    certificate = relationship("StoreDomainCertificate", back_populates="store_domain", uselist=False)
    dns_zone = relationship("DnsZone", back_populates="store_domain", uselist=False)

    @validates("hostname")
    def validate_hostname(self, _key: str, value: str) -> str:
        return normalize_hostname(value)


class StoreDomainCertificate(Base):
    __tablename__ = "store_domain_certificates"
    __table_args__ = (
        UniqueConstraint("store_domain_id", name="uq_store_domain_certificates_domain"),
        CheckConstraint(
            "status IN ('pending', 'provisioning', 'active', 'failed', 'renewal_due', 'revoked')",
            name="ck_store_domain_certificates_status",
        ),
        Index("ix_store_domain_certificates_status", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    store_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("stores.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    store_domain_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("store_domains.id", ondelete="RESTRICT"), nullable=False
    )
    provider: Mapped[str] = mapped_column(String(50), nullable=False)
    provider_certificate_ref: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="pending", server_default="pending")
    requested_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    issued_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    failure_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    store_domain = relationship("StoreDomain", back_populates="certificate")


class OrganizationMember(Base):
    __tablename__ = "organization_members"
    __table_args__ = (UniqueConstraint("organization_id", "user_id", name="uq_organization_member_user"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="RESTRICT"), nullable=False, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(30), nullable=False, default="member", server_default="member")
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", server_default="active", index=True)
    invited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    joined_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, server_default=func.now())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    organization = relationship("Organization", back_populates="members")
    user = relationship("User", back_populates="organization_memberships")


class StoreMember(Base):
    __tablename__ = "store_members"
    __table_args__ = (UniqueConstraint("store_id", "user_id", name="uq_store_member_user"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    store_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("stores.id", ondelete="RESTRICT"), nullable=False, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(30), nullable=False, default="staff", server_default="staff")
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active", server_default="active", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    store = relationship("Store", back_populates="members")
    user = relationship("User", back_populates="store_memberships")


class StoreOnboarding(Base):
    __tablename__ = "store_onboarding"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    store_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("stores.id", ondelete="RESTRICT"), nullable=False, unique=True, index=True
    )
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="in_progress", server_default="in_progress", index=True)
    current_step: Mapped[str] = mapped_column(String(100), nullable=False, default="add_product", server_default="add_product")
    completed_steps: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list, server_default="[]")
    dismissed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    store = relationship("Store")
