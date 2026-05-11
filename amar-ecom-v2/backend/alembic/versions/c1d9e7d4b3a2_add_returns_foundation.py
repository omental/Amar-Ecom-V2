"""add_returns_foundation

Revision ID: c1d9e7d4b3a2
Revises: 36f3f4b72fa9
Create Date: 2026-05-11 16:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c1d9e7d4b3a2"
down_revision: Union[str, Sequence[str], None] = "36f3f4b72fa9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "return_requests",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("return_number", sa.String(length=100), nullable=False),
        sa.Column("order_id", sa.UUID(), nullable=False),
        sa.Column("customer_id", sa.UUID(), nullable=True),
        sa.Column("warehouse_id", sa.UUID(), nullable=True),
        sa.Column("status", sa.String(length=50), server_default="requested", nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("resolution", sa.String(length=50), nullable=True),
        sa.Column("refund_amount", sa.Numeric(12, 2), server_default="0", nullable=False),
        sa.Column("restock_items", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("stock_restocked", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["order_id"], ["orders.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["warehouse_id"], ["warehouses.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_return_requests_return_number"), "return_requests", ["return_number"], unique=True)
    op.create_index(op.f("ix_return_requests_warehouse_id"), "return_requests", ["warehouse_id"], unique=False)

    op.create_table(
        "return_items",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("return_request_id", sa.UUID(), nullable=False),
        sa.Column("order_item_id", sa.UUID(), nullable=True),
        sa.Column("product_id", sa.UUID(), nullable=True),
        sa.Column("variant_id", sa.UUID(), nullable=True),
        sa.Column("product_name", sa.String(length=255), nullable=False),
        sa.Column("sku", sa.String(length=100), nullable=True),
        sa.Column("quantity", sa.Integer(), server_default="1", nullable=False),
        sa.Column("condition", sa.String(length=100), nullable=True),
        sa.Column("restocked_quantity", sa.Integer(), server_default="0", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["order_item_id"], ["order_items.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["return_request_id"], ["return_requests.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["variant_id"], ["product_variants.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("return_items")
    op.drop_index(op.f("ix_return_requests_warehouse_id"), table_name="return_requests")
    op.drop_index(op.f("ix_return_requests_return_number"), table_name="return_requests")
    op.drop_table("return_requests")
