"""add authoritative hosted Store domains

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
"""

from collections.abc import Sequence
from datetime import datetime, timezone
import os
import re
import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "b2c3d4e5f6a7"
down_revision: str | None = "a1b2c3d4e5f6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

UUID = postgresql.UUID(as_uuid=True)
LABEL = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")


def _hostname(slug: str, base_domain: str) -> str:
    base = base_domain.strip().lower().rstrip(".")
    value = f"{slug}.{base}"
    if len(value) > 253 or any(not LABEL.fullmatch(label) for label in value.split(".")):
        raise RuntimeError(f"Cannot create hosted domain for Store slug {slug!r}")
    return value


def upgrade() -> None:
    op.create_table(
        "store_domains",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("store_id", UUID, sa.ForeignKey("stores.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("hostname", sa.String(253), nullable=False),
        sa.Column("domain_type", sa.String(30), nullable=False, server_default="platform_subdomain"),
        sa.Column("status", sa.String(30), nullable=False, server_default="active"),
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("redirect_to_primary", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("verification_status", sa.String(30), nullable=False, server_default="pending"),
        sa.Column("ssl_status", sa.String(30), nullable=False, server_default="pending"),
        sa.Column("verified_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("hostname", name="uq_store_domains_hostname"),
        sa.CheckConstraint("domain_type IN ('platform_subdomain', 'custom')", name="ck_store_domains_type"),
        sa.CheckConstraint("status IN ('pending', 'active', 'disabled', 'error')", name="ck_store_domains_status"),
        sa.CheckConstraint("verification_status IN ('not_required', 'pending', 'verified', 'failed')", name="ck_store_domains_verification"),
        sa.CheckConstraint("ssl_status IN ('pending', 'active', 'failed', 'not_applicable')", name="ck_store_domains_ssl"),
    )
    op.create_index("ix_store_domains_store_id", "store_domains", ["store_id"])
    op.create_index("ix_store_domains_status", "store_domains", ["status"])
    op.create_index("ix_store_domains_store_type", "store_domains", ["store_id", "domain_type"])
    op.create_index(
        "uq_store_domains_platform_per_store", "store_domains", ["store_id"], unique=True,
        postgresql_where=sa.text("domain_type = 'platform_subdomain'"),
    )
    op.create_index(
        "uq_store_domains_primary_per_store", "store_domains", ["store_id"], unique=True,
        postgresql_where=sa.text("is_primary = true"),
    )

    bind = op.get_bind()
    base_domain = os.getenv("STOREFRONT_BASE_DOMAIN", "amar-ecom.com")
    stores = list(bind.execute(sa.text("SELECT id, slug FROM stores ORDER BY created_at")).mappings())
    hostnames = [_hostname(row["slug"], base_domain) for row in stores]
    if len(hostnames) != len(set(hostnames)):
        raise RuntimeError("Historical Store slugs produce duplicate hosted domains; migration aborted")
    now = datetime.now(timezone.utc)
    wildcard_tls = os.getenv("STOREFRONT_WILDCARD_TLS_ACTIVE", "false").lower() in {"1", "true", "yes"}
    if stores:
        table = sa.table(
            "store_domains",
            sa.column("id", UUID), sa.column("store_id", UUID), sa.column("hostname"),
            sa.column("domain_type"), sa.column("status"), sa.column("is_primary"),
            sa.column("redirect_to_primary"), sa.column("verification_status"),
            sa.column("ssl_status"), sa.column("verified_at"),
        )
        op.bulk_insert(table, [
            {
                "id": uuid.uuid4(), "store_id": row["id"], "hostname": hostname,
                "domain_type": "platform_subdomain", "status": "active", "is_primary": True,
                "redirect_to_primary": False, "verification_status": "not_required",
                "ssl_status": "active" if wildcard_tls else "pending", "verified_at": now,
            }
            for row, hostname in zip(stores, hostnames, strict=True)
        ])
    missing = bind.scalar(sa.text(
        "SELECT count(*) FROM stores s WHERE s.status='active' AND NOT EXISTS "
        "(SELECT 1 FROM store_domains d WHERE d.store_id=s.id AND d.domain_type='platform_subdomain')"
    ))
    if missing:
        raise RuntimeError(f"Hosted-domain backfill left {missing} active Stores without a domain")


def downgrade() -> None:
    op.drop_table("store_domains")
