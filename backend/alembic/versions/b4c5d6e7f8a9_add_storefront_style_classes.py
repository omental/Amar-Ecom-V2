"""add storefront style classes

Revision ID: b4c5d6e7f8a9
Revises: a3b4c5d6e7f8
Create Date: 2026-08-11
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "b4c5d6e7f8a9"
down_revision = "a3b4c5d6e7f8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "storefront_style_classes",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("theme_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("styles", sa.JSON(), nullable=False, server_default=sa.text("'{}'::json")),
        sa.Column("responsive", sa.JSON(), nullable=False, server_default=sa.text("'{}'::json")),
        sa.Column("states", sa.JSON(), nullable=False, server_default=sa.text("'{}'::json")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["theme_id"], ["storefront_themes.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("theme_id", "name", name="uq_storefront_style_class_theme_name"),
    )
    op.create_index("ix_storefront_style_classes_theme_id", "storefront_style_classes", ["theme_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_storefront_style_classes_theme_id", table_name="storefront_style_classes")
    op.drop_table("storefront_style_classes")
