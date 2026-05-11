"""add logistics shipment events and reconciliation

Revision ID: d8f9a0b1c2d3
Revises: c7e8f9a0b1c2
Create Date: 2026-05-11 15:20:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "d8f9a0b1c2d3"
down_revision: str | None = "c7e8f9a0b1c2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("shipments", sa.Column("recipient_name", sa.String(length=255), nullable=True))
    op.add_column("shipments", sa.Column("recipient_phone", sa.String(length=50), nullable=True))
    op.add_column("shipments", sa.Column("delivery_address", sa.Text(), nullable=True))
    op.add_column(
        "shipments",
        sa.Column("courier_charge", sa.Numeric(precision=12, scale=2), nullable=False, server_default="0"),
    )
    op.add_column(
        "shipments",
        sa.Column("collected_amount", sa.Numeric(precision=12, scale=2), nullable=False, server_default="0"),
    )
    op.add_column(
        "shipments",
        sa.Column("reconciliation_status", sa.String(length=50), nullable=False, server_default="pending"),
    )
    op.add_column("shipments", sa.Column("reconciled_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index(op.f("ix_shipments_recipient_phone"), "shipments", ["recipient_phone"], unique=False)
    op.create_index(
        op.f("ix_shipments_reconciliation_status"),
        "shipments",
        ["reconciliation_status"],
        unique=False,
    )

    op.create_table(
        "shipment_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("shipment_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("event_type", sa.String(length=100), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["shipment_id"], ["shipments.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_shipment_events_created_by_id"), "shipment_events", ["created_by_id"], unique=False)
    op.create_index(op.f("ix_shipment_events_event_type"), "shipment_events", ["event_type"], unique=False)
    op.create_index(op.f("ix_shipment_events_shipment_id"), "shipment_events", ["shipment_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_shipment_events_shipment_id"), table_name="shipment_events")
    op.drop_index(op.f("ix_shipment_events_event_type"), table_name="shipment_events")
    op.drop_index(op.f("ix_shipment_events_created_by_id"), table_name="shipment_events")
    op.drop_table("shipment_events")

    op.drop_index(op.f("ix_shipments_reconciliation_status"), table_name="shipments")
    op.drop_index(op.f("ix_shipments_recipient_phone"), table_name="shipments")
    op.drop_column("shipments", "reconciled_at")
    op.drop_column("shipments", "reconciliation_status")
    op.drop_column("shipments", "collected_amount")
    op.drop_column("shipments", "courier_charge")
    op.drop_column("shipments", "delivery_address")
    op.drop_column("shipments", "recipient_phone")
    op.drop_column("shipments", "recipient_name")
