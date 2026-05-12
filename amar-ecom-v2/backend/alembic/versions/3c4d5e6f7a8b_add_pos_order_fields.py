"""add pos order fields

Revision ID: 3c4d5e6f7a8b
Revises: 2b3c4d5e6f7a
Create Date: 2026-05-12 19:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "3c4d5e6f7a8b"
down_revision: Union[str, Sequence[str], None] = "2b3c4d5e6f7a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("orders", sa.Column("customer_name", sa.String(length=255), nullable=True))
    op.add_column("orders", sa.Column("payment_method", sa.String(length=50), nullable=True))
    op.add_column("orders", sa.Column("paid_amount", sa.Numeric(12, 2), server_default="0", nullable=False))
    op.create_index(op.f("ix_orders_customer_name"), "orders", ["customer_name"], unique=False)
    op.create_index(op.f("ix_orders_payment_method"), "orders", ["payment_method"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_orders_payment_method"), table_name="orders")
    op.drop_index(op.f("ix_orders_customer_name"), table_name="orders")
    op.drop_column("orders", "paid_amount")
    op.drop_column("orders", "payment_method")
    op.drop_column("orders", "customer_name")
