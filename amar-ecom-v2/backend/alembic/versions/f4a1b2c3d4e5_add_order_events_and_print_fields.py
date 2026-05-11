"""add_order_events_and_print_fields

Revision ID: f4a1b2c3d4e5
Revises: 9ddd2d6bfef8
Create Date: 2026-05-11 23:55:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f4a1b2c3d4e5"
down_revision: Union[str, Sequence[str], None] = "9ddd2d6bfef8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("orders", sa.Column("customer_phone", sa.String(length=50), nullable=True))
    op.add_column("orders", sa.Column("shipping_address", sa.Text(), nullable=True))
    op.add_column("orders", sa.Column("notes", sa.Text(), nullable=True))
    op.add_column("orders", sa.Column("tags", sa.Text(), nullable=True))
    op.add_column("orders", sa.Column("printed_count", sa.Integer(), server_default="0", nullable=False))
    op.add_column("orders", sa.Column("last_printed_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index(op.f("ix_orders_customer_phone"), "orders", ["customer_phone"], unique=False)

    op.create_table(
        "order_events",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("order_id", sa.UUID(), nullable=False),
        sa.Column("event_type", sa.String(length=100), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("created_by_id", sa.UUID(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["order_id"], ["orders.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_order_events_created_by_id"), "order_events", ["created_by_id"], unique=False)
    op.create_index(op.f("ix_order_events_event_type"), "order_events", ["event_type"], unique=False)
    op.create_index(op.f("ix_order_events_order_id"), "order_events", ["order_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_order_events_order_id"), table_name="order_events")
    op.drop_index(op.f("ix_order_events_event_type"), table_name="order_events")
    op.drop_index(op.f("ix_order_events_created_by_id"), table_name="order_events")
    op.drop_table("order_events")

    op.drop_index(op.f("ix_orders_customer_phone"), table_name="orders")
    op.drop_column("orders", "last_printed_at")
    op.drop_column("orders", "printed_count")
    op.drop_column("orders", "tags")
    op.drop_column("orders", "notes")
    op.drop_column("orders", "shipping_address")
    op.drop_column("orders", "customer_phone")
