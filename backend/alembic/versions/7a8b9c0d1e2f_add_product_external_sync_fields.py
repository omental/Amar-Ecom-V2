"""add product external sync fields

Revision ID: 7a8b9c0d1e2f
Revises: 6f7a8b9c0d1e
Create Date: 2026-05-16 00:20:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "7a8b9c0d1e2f"
down_revision: str | Sequence[str] | None = "6f7a8b9c0d1e"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("products", sa.Column("source", sa.String(length=50), nullable=True))
    op.add_column("products", sa.Column("external_id", sa.String(length=100), nullable=True))
    op.add_column("products", sa.Column("external_slug", sa.String(length=255), nullable=True))
    op.add_column("products", sa.Column("external_status", sa.String(length=100), nullable=True))
    op.add_column("products", sa.Column("external_synced_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("products", sa.Column("external_payload_snapshot", sa.Text(), nullable=True))
    op.create_index(op.f("ix_products_source"), "products", ["source"], unique=False)
    op.create_index(op.f("ix_products_external_id"), "products", ["external_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_products_external_id"), table_name="products")
    op.drop_index(op.f("ix_products_source"), table_name="products")
    op.drop_column("products", "external_payload_snapshot")
    op.drop_column("products", "external_synced_at")
    op.drop_column("products", "external_status")
    op.drop_column("products", "external_slug")
    op.drop_column("products", "external_id")
    op.drop_column("products", "source")
