"""add woocommerce sync foundation

Revision ID: 4d5e6f7a8b9c
Revises: 3c4d5e6f7a8b
Create Date: 2026-05-13 22:30:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "4d5e6f7a8b9c"
down_revision: str | Sequence[str] | None = "3c4d5e6f7a8b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "woocommerce_settings",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("store_url", sa.String(length=500), nullable=True),
        sa.Column("consumer_key_encrypted", sa.Text(), nullable=True),
        sa.Column("consumer_secret_encrypted", sa.Text(), nullable=True),
        sa.Column("api_version", sa.String(length=50), nullable=False, server_default="wc/v3"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("last_tested_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_test_success", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("last_test_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "woocommerce_sync_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("sync_type", sa.String(length=50), nullable=False),
        sa.Column("direction", sa.String(length=20), nullable=False, server_default="import"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"),
        sa.Column("external_id", sa.String(length=100), nullable=True),
        sa.Column("local_entity_type", sa.String(length=100), nullable=True),
        sa.Column("local_entity_id", sa.String(length=100), nullable=True),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("payload_snapshot", sa.Text(), nullable=True),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_woocommerce_sync_logs_created_by_id"), "woocommerce_sync_logs", ["created_by_id"], unique=False)
    op.create_index(op.f("ix_woocommerce_sync_logs_external_id"), "woocommerce_sync_logs", ["external_id"], unique=False)
    op.create_index(op.f("ix_woocommerce_sync_logs_local_entity_id"), "woocommerce_sync_logs", ["local_entity_id"], unique=False)
    op.create_index(op.f("ix_woocommerce_sync_logs_local_entity_type"), "woocommerce_sync_logs", ["local_entity_type"], unique=False)
    op.create_index(op.f("ix_woocommerce_sync_logs_status"), "woocommerce_sync_logs", ["status"], unique=False)
    op.create_index(op.f("ix_woocommerce_sync_logs_sync_type"), "woocommerce_sync_logs", ["sync_type"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_woocommerce_sync_logs_sync_type"), table_name="woocommerce_sync_logs")
    op.drop_index(op.f("ix_woocommerce_sync_logs_status"), table_name="woocommerce_sync_logs")
    op.drop_index(op.f("ix_woocommerce_sync_logs_local_entity_type"), table_name="woocommerce_sync_logs")
    op.drop_index(op.f("ix_woocommerce_sync_logs_local_entity_id"), table_name="woocommerce_sync_logs")
    op.drop_index(op.f("ix_woocommerce_sync_logs_external_id"), table_name="woocommerce_sync_logs")
    op.drop_index(op.f("ix_woocommerce_sync_logs_created_by_id"), table_name="woocommerce_sync_logs")
    op.drop_table("woocommerce_sync_logs")
    op.drop_table("woocommerce_settings")
