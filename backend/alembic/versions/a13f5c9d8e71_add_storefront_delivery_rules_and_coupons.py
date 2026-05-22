"""add storefront delivery rules and coupons

Revision ID: a13f5c9d8e71
Revises: f0789abc1234
Create Date: 2026-05-22
"""

from alembic import op
import sqlalchemy as sa


revision = "a13f5c9d8e71"
down_revision = "f0789abc1234"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "storefront_settings",
        sa.Column("inside_dhaka_delivery_charge", sa.Numeric(12, 2), nullable=False, server_default="70"),
    )
    op.add_column(
        "storefront_settings",
        sa.Column("outside_dhaka_delivery_charge", sa.Numeric(12, 2), nullable=False, server_default="120"),
    )
    op.add_column(
        "storefront_settings",
        sa.Column("free_delivery_minimum", sa.Numeric(12, 2), nullable=True),
    )

    op.create_table(
        "storefront_coupons",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("code", sa.String(length=100), nullable=False),
        sa.Column("type", sa.String(length=20), nullable=False),
        sa.Column("value", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("min_order_amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("max_discount_amount", sa.Numeric(12, 2), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("usage_limit", sa.Integer(), nullable=True),
        sa.Column("usage_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_storefront_coupons_code"), "storefront_coupons", ["code"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_storefront_coupons_code"), table_name="storefront_coupons")
    op.drop_table("storefront_coupons")
    op.drop_column("storefront_settings", "free_delivery_minimum")
    op.drop_column("storefront_settings", "outside_dhaka_delivery_charge")
    op.drop_column("storefront_settings", "inside_dhaka_delivery_charge")
