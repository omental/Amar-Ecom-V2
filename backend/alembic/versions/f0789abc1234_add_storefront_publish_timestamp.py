"""add storefront publish timestamp

Revision ID: f0789abc1234
Revises: ef56ab78cd90
Create Date: 2026-05-22 13:10:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "f0789abc1234"
down_revision: str | Sequence[str] | None = "ef56ab78cd90"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("storefront_pages", sa.Column("last_published_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("storefront_pages", "last_published_at")
