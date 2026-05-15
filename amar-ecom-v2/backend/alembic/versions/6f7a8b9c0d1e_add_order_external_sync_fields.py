"""add order external sync fields

Revision ID: 6f7a8b9c0d1e
Revises: 5e6f7a8b9c0d
Create Date: 2026-05-15 20:15:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "6f7a8b9c0d1e"
down_revision: str | Sequence[str] | None = "5e6f7a8b9c0d"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("orders", sa.Column("external_id", sa.String(length=100), nullable=True))
    op.add_column("orders", sa.Column("external_number", sa.String(length=100), nullable=True))
    op.add_column("orders", sa.Column("external_status", sa.String(length=100), nullable=True))
    op.add_column("orders", sa.Column("external_synced_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("orders", sa.Column("external_payload_snapshot", sa.Text(), nullable=True))
    op.create_index(op.f("ix_orders_external_id"), "orders", ["external_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_orders_external_id"), table_name="orders")
    op.drop_column("orders", "external_payload_snapshot")
    op.drop_column("orders", "external_synced_at")
    op.drop_column("orders", "external_status")
    op.drop_column("orders", "external_number")
    op.drop_column("orders", "external_id")
