"""add custom domain verification and certificate lifecycle

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "d4e5f6a7b8c9"
down_revision: str | None = "c3d4e5f6a7b8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("store_domains", sa.Column("routing_status", sa.String(30), nullable=False, server_default="pending"))
    op.add_column("store_domains", sa.Column("verification_token_hash", sa.String(64), nullable=True))
    op.add_column("store_domains", sa.Column("verification_token_encrypted", sa.Text(), nullable=True))
    op.add_column("store_domains", sa.Column("verification_token_expires_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("store_domains", sa.Column("last_verification_attempt_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("store_domains", sa.Column("last_routing_checked_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("store_domains", sa.Column("verification_failure_reason", sa.String(500), nullable=True))
    op.execute("UPDATE store_domains SET routing_status='not_required' WHERE domain_type='platform_subdomain'")
    op.drop_constraint("ck_store_domains_verification", "store_domains", type_="check")
    op.drop_constraint("ck_store_domains_ssl", "store_domains", type_="check")
    op.create_check_constraint(
        "ck_store_domains_verification",
        "store_domains",
        "verification_status IN ('not_required', 'pending', 'verifying', 'verified', 'failed')",
    )
    op.create_check_constraint(
        "ck_store_domains_routing",
        "store_domains",
        "routing_status IN ('not_required', 'pending', 'valid', 'invalid')",
    )
    op.create_check_constraint(
        "ck_store_domains_ssl",
        "store_domains",
        "ssl_status IN ('pending', 'provisioning', 'active', 'failed', 'renewal_due', 'revoked', 'not_applicable')",
    )
    op.create_table(
        "store_domain_certificates",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("store_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("store_domain_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("provider", sa.String(50), nullable=False),
        sa.Column("provider_certificate_ref", sa.String(255), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="pending"),
        sa.Column("requested_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_checked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("failure_reason", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint(
            "status IN ('pending', 'provisioning', 'active', 'failed', 'renewal_due', 'revoked')",
            name="ck_store_domain_certificates_status",
        ),
        sa.ForeignKeyConstraint(["store_domain_id"], ["store_domains.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["store_id"], ["stores.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("store_domain_id", name="uq_store_domain_certificates_domain"),
    )
    op.create_index("ix_store_domain_certificates_store_id", "store_domain_certificates", ["store_id"])
    op.create_index("ix_store_domain_certificates_status", "store_domain_certificates", ["status"])


def downgrade() -> None:
    op.drop_index("ix_store_domain_certificates_status", table_name="store_domain_certificates")
    op.drop_index("ix_store_domain_certificates_store_id", table_name="store_domain_certificates")
    op.drop_table("store_domain_certificates")
    op.drop_constraint("ck_store_domains_ssl", "store_domains", type_="check")
    op.drop_constraint("ck_store_domains_routing", "store_domains", type_="check")
    op.drop_constraint("ck_store_domains_verification", "store_domains", type_="check")
    op.create_check_constraint(
        "ck_store_domains_verification", "store_domains",
        "verification_status IN ('not_required', 'pending', 'verified', 'failed')",
    )
    op.create_check_constraint(
        "ck_store_domains_ssl", "store_domains",
        "ssl_status IN ('pending', 'active', 'failed', 'not_applicable')",
    )
    for column in (
        "verification_failure_reason", "last_routing_checked_at", "last_verification_attempt_at",
        "verification_token_expires_at", "verification_token_encrypted", "verification_token_hash", "routing_status",
    ):
        op.drop_column("store_domains", column)
