"""add product gallery and size guide media URLs

Revision ID: d8a9c7b6e5f4
Revises: c9d4e8a1f2b7
Create Date: 2026-08-09
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "d8a9c7b6e5f4"
down_revision = "c9d4e8a1f2b7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "products",
        sa.Column(
            "gallery_image_urls",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
    )
    op.add_column("products", sa.Column("size_guide_image_url", sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column("products", "size_guide_image_url")
    op.drop_column("products", "gallery_image_urls")
