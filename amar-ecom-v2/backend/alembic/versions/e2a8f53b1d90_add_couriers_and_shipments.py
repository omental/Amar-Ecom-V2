"""add_couriers_and_shipments

Revision ID: e2a8f53b1d90
Revises: c1d9e7d4b3a2
Create Date: 2026-05-11 17:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e2a8f53b1d90"
down_revision: Union[str, Sequence[str], None] = "c1d9e7d4b3a2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "couriers",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("code", sa.String(length=100), nullable=False),
        sa.Column("contact_phone", sa.String(length=50), nullable=True),
        sa.Column("website", sa.String(length=500), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_couriers_code"), "couriers", ["code"], unique=True)

    op.create_table(
        "shipments",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("shipment_number", sa.String(length=100), nullable=False),
        sa.Column("order_id", sa.UUID(), nullable=False),
        sa.Column("courier_id", sa.UUID(), nullable=True),
        sa.Column("tracking_number", sa.String(length=150), nullable=True),
        sa.Column("status", sa.String(length=50), server_default="pending", nullable=False),
        sa.Column("delivery_charge", sa.Numeric(12, 2), server_default="0", nullable=False),
        sa.Column("cod_amount", sa.Numeric(12, 2), server_default="0", nullable=False),
        sa.Column("shipped_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["courier_id"], ["couriers.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["order_id"], ["orders.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_shipments_order_id"), "shipments", ["order_id"], unique=False)
    op.create_index(op.f("ix_shipments_shipment_number"), "shipments", ["shipment_number"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_shipments_shipment_number"), table_name="shipments")
    op.drop_index(op.f("ix_shipments_order_id"), table_name="shipments")
    op.drop_table("shipments")
    op.drop_index(op.f("ix_couriers_code"), table_name="couriers")
    op.drop_table("couriers")
