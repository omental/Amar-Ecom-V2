"""add Amar DNS control-plane models

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "e5f6a7b8c9d0"
down_revision: str | None = "d4e5f6a7b8c9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "dns_zones",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("store_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("store_domain_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("zone_name", sa.String(253), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="preparing"),
        sa.Column("provider", sa.String(50), nullable=False),
        sa.Column("provider_zone_ref", sa.String(255), nullable=True),
        sa.Column("nameservers", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("soa_serial", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("delegation_status", sa.String(30), nullable=False, server_default="pending"),
        sa.Column("dnssec_status", sa.String(30), nullable=False, server_default="disabled"),
        sa.Column("dnssec_ds_records", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("sync_status", sa.String(30), nullable=False, server_default="pending"),
        sa.Column("provider_error", sa.String(500), nullable=True),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_delegation_checked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("activated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deactivated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("status IN ('preparing', 'pending', 'active', 'error', 'disabled', 'deactivating')", name="ck_dns_zones_status"),
        sa.CheckConstraint("delegation_status IN ('pending', 'partial', 'active', 'incorrect', 'error')", name="ck_dns_zones_delegation"),
        sa.CheckConstraint("dnssec_status IN ('disabled', 'pending', 'zone_signed', 'ds_required', 'active', 'broken', 'error')", name="ck_dns_zones_dnssec"),
        sa.CheckConstraint("sync_status IN ('pending', 'syncing', 'synced', 'error', 'drifted')", name="ck_dns_zones_sync"),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["store_domain_id"], ["store_domains.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["store_id"], ["stores.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("store_domain_id", name="uq_dns_zones_store_domain"),
        sa.UniqueConstraint("store_id", "zone_name", name="uq_dns_zones_store_name"),
    )
    op.create_index("ix_dns_zones_organization_id", "dns_zones", ["organization_id"])
    op.create_index("ix_dns_zones_store_id", "dns_zones", ["store_id"])
    op.create_index("ix_dns_zones_store_domain_id", "dns_zones", ["store_domain_id"])
    op.create_index("ix_dns_zones_status", "dns_zones", ["status"])
    op.create_index("ix_dns_zones_delegation_status", "dns_zones", ["delegation_status"])

    op.create_table(
        "dns_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("store_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("zone_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("record_type", sa.String(10), nullable=False),
        sa.Column("name", sa.String(253), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("ttl", sa.Integer(), nullable=False, server_default="3600"),
        sa.Column("priority", sa.Integer(), nullable=True),
        sa.Column("weight", sa.Integer(), nullable=True),
        sa.Column("port", sa.Integer(), nullable=True),
        sa.Column("disabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("managed_by", sa.String(30), nullable=False, server_default="merchant"),
        sa.Column("purpose", sa.String(100), nullable=True),
        sa.Column("sync_status", sa.String(30), nullable=False, server_default="pending"),
        sa.Column("provider_record_ref", sa.String(255), nullable=True),
        sa.Column("provider_error", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("record_type IN ('A', 'AAAA', 'CNAME', 'TXT', 'MX', 'CAA', 'SRV', 'ALIAS')", name="ck_dns_records_type"),
        sa.CheckConstraint("managed_by IN ('merchant', 'amar_system')", name="ck_dns_records_managed_by"),
        sa.CheckConstraint("sync_status IN ('pending', 'synced', 'error')", name="ck_dns_records_sync"),
        sa.CheckConstraint("ttl BETWEEN 60 AND 86400", name="ck_dns_records_ttl"),
        sa.ForeignKeyConstraint(["store_id"], ["stores.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["zone_id"], ["dns_zones.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_dns_records_store_id", "dns_records", ["store_id"])
    op.create_index("ix_dns_records_zone_id", "dns_records", ["zone_id"])
    op.create_index("ix_dns_records_zone_name_type", "dns_records", ["zone_id", "name", "record_type"])

    op.create_table(
        "dns_zone_revisions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("store_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("zone_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("revision_number", sa.Integer(), nullable=False),
        sa.Column("records_snapshot", sa.JSON(), nullable=False),
        sa.Column("reason", sa.String(255), nullable=False),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["store_id"], ["stores.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["zone_id"], ["dns_zones.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("zone_id", "revision_number", name="uq_dns_zone_revision_number"),
    )
    op.create_index("ix_dns_zone_revisions_store_id", "dns_zone_revisions", ["store_id"])
    op.create_index("ix_dns_zone_revisions_zone_id", "dns_zone_revisions", ["zone_id"])


def downgrade() -> None:
    op.drop_index("ix_dns_zone_revisions_zone_id", table_name="dns_zone_revisions")
    op.drop_index("ix_dns_zone_revisions_store_id", table_name="dns_zone_revisions")
    op.drop_table("dns_zone_revisions")
    op.drop_index("ix_dns_records_zone_name_type", table_name="dns_records")
    op.drop_index("ix_dns_records_zone_id", table_name="dns_records")
    op.drop_index("ix_dns_records_store_id", table_name="dns_records")
    op.drop_table("dns_records")
    op.drop_index("ix_dns_zones_delegation_status", table_name="dns_zones")
    op.drop_index("ix_dns_zones_status", table_name="dns_zones")
    op.drop_index("ix_dns_zones_store_domain_id", table_name="dns_zones")
    op.drop_index("ix_dns_zones_store_id", table_name="dns_zones")
    op.drop_index("ix_dns_zones_organization_id", table_name="dns_zones")
    op.drop_table("dns_zones")
