"""add woocommerce sync schedule fields

Revision ID: 5e6f7a8b9c0d
Revises: 4d5e6f7a8b9c
Create Date: 2026-05-15 12:30:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "5e6f7a8b9c0d"
down_revision: str | Sequence[str] | None = "4d5e6f7a8b9c"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("woocommerce_settings", sa.Column("auto_sync_enabled", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("woocommerce_settings", sa.Column("sync_products_enabled", sa.Boolean(), nullable=False, server_default="true"))
    op.add_column("woocommerce_settings", sa.Column("sync_orders_enabled", sa.Boolean(), nullable=False, server_default="true"))
    op.add_column("woocommerce_settings", sa.Column("sync_interval_minutes", sa.Integer(), nullable=False, server_default="60"))
    op.add_column("woocommerce_settings", sa.Column("last_product_sync_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("woocommerce_settings", sa.Column("last_order_sync_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("woocommerce_settings", sa.Column("last_sync_started_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("woocommerce_settings", sa.Column("last_sync_finished_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("woocommerce_settings", sa.Column("last_sync_status", sa.String(length=50), nullable=True))
    op.add_column("woocommerce_settings", sa.Column("last_sync_message", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("woocommerce_settings", "last_sync_message")
    op.drop_column("woocommerce_settings", "last_sync_status")
    op.drop_column("woocommerce_settings", "last_sync_finished_at")
    op.drop_column("woocommerce_settings", "last_sync_started_at")
    op.drop_column("woocommerce_settings", "last_order_sync_at")
    op.drop_column("woocommerce_settings", "last_product_sync_at")
    op.drop_column("woocommerce_settings", "sync_interval_minutes")
    op.drop_column("woocommerce_settings", "sync_orders_enabled")
    op.drop_column("woocommerce_settings", "sync_products_enabled")
    op.drop_column("woocommerce_settings", "auto_sync_enabled")
