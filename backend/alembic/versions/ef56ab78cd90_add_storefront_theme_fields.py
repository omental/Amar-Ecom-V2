"""add storefront theme fields

Revision ID: ef56ab78cd90
Revises: cd34ef56ab78
Create Date: 2026-05-22 12:15:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "ef56ab78cd90"
down_revision: str | Sequence[str] | None = "cd34ef56ab78"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("storefront_settings", sa.Column("footer_description", sa.Text(), nullable=True))
    op.add_column("storefront_settings", sa.Column("footer_copyright_text", sa.String(length=255), nullable=True))
    op.add_column("storefront_settings", sa.Column("social_share_image_url", sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column("storefront_settings", "social_share_image_url")
    op.drop_column("storefront_settings", "footer_copyright_text")
    op.drop_column("storefront_settings", "footer_description")
