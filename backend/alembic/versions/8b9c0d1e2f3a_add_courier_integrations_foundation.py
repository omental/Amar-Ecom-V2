"""add courier integrations foundation

Revision ID: 8b9c0d1e2f3a
Revises: 7a8b9c0d1e2f
Create Date: 2026-05-16 12:30:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "8b9c0d1e2f3a"
down_revision: str | Sequence[str] | None = "7a8b9c0d1e2f"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "courier_provider_settings",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("provider", sa.String(length=50), nullable=False),
        sa.Column("display_name", sa.String(length=255), nullable=False),
        sa.Column("base_url", sa.String(length=500), nullable=True),
        sa.Column("api_key_encrypted", sa.Text(), nullable=True),
        sa.Column("api_secret_encrypted", sa.Text(), nullable=True),
        sa.Column("merchant_id_encrypted", sa.Text(), nullable=True),
        sa.Column("username_encrypted", sa.Text(), nullable=True),
        sa.Column("password_encrypted", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("is_sandbox", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("last_tested_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_test_success", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("last_test_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_courier_provider_settings_provider"), "courier_provider_settings", ["provider"], unique=True)

    op.create_table(
        "courier_api_logs",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("provider", sa.String(length=50), nullable=False),
        sa.Column("action", sa.String(length=50), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("shipment_id", sa.UUID(), nullable=True),
        sa.Column("external_id", sa.String(length=150), nullable=True),
        sa.Column("request_snapshot", sa.Text(), nullable=True),
        sa.Column("response_snapshot", sa.Text(), nullable=True),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("created_by_id", sa.UUID(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["shipment_id"], ["shipments.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_courier_api_logs_action"), "courier_api_logs", ["action"], unique=False)
    op.create_index(op.f("ix_courier_api_logs_created_by_id"), "courier_api_logs", ["created_by_id"], unique=False)
    op.create_index(op.f("ix_courier_api_logs_external_id"), "courier_api_logs", ["external_id"], unique=False)
    op.create_index(op.f("ix_courier_api_logs_provider"), "courier_api_logs", ["provider"], unique=False)
    op.create_index(op.f("ix_courier_api_logs_shipment_id"), "courier_api_logs", ["shipment_id"], unique=False)
    op.create_index(op.f("ix_courier_api_logs_status"), "courier_api_logs", ["status"], unique=False)

    op.add_column("shipments", sa.Column("external_provider", sa.String(length=50), nullable=True))
    op.add_column("shipments", sa.Column("external_consignment_id", sa.String(length=150), nullable=True))
    op.add_column("shipments", sa.Column("external_tracking_number", sa.String(length=150), nullable=True))
    op.add_column("shipments", sa.Column("external_status", sa.String(length=100), nullable=True))
    op.add_column("shipments", sa.Column("external_synced_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("shipments", sa.Column("external_payload_snapshot", sa.Text(), nullable=True))
    op.add_column("shipments", sa.Column("sent_to_courier_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index(op.f("ix_shipments_external_provider"), "shipments", ["external_provider"], unique=False)
    op.create_index(op.f("ix_shipments_external_consignment_id"), "shipments", ["external_consignment_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_shipments_external_consignment_id"), table_name="shipments")
    op.drop_index(op.f("ix_shipments_external_provider"), table_name="shipments")
    op.drop_column("shipments", "sent_to_courier_at")
    op.drop_column("shipments", "external_payload_snapshot")
    op.drop_column("shipments", "external_synced_at")
    op.drop_column("shipments", "external_status")
    op.drop_column("shipments", "external_tracking_number")
    op.drop_column("shipments", "external_consignment_id")
    op.drop_column("shipments", "external_provider")

    op.drop_index(op.f("ix_courier_api_logs_status"), table_name="courier_api_logs")
    op.drop_index(op.f("ix_courier_api_logs_shipment_id"), table_name="courier_api_logs")
    op.drop_index(op.f("ix_courier_api_logs_provider"), table_name="courier_api_logs")
    op.drop_index(op.f("ix_courier_api_logs_external_id"), table_name="courier_api_logs")
    op.drop_index(op.f("ix_courier_api_logs_created_by_id"), table_name="courier_api_logs")
    op.drop_index(op.f("ix_courier_api_logs_action"), table_name="courier_api_logs")
    op.drop_table("courier_api_logs")

    op.drop_index(op.f("ix_courier_provider_settings_provider"), table_name="courier_provider_settings")
    op.drop_table("courier_provider_settings")
