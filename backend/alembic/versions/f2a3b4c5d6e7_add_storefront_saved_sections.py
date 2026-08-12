"""add storefront saved sections

Revision ID: f2a3b4c5d6e7
Revises: e1f2a3b4c5d6
Create Date: 2026-08-11
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "f2a3b4c5d6e7"
down_revision = "e1f2a3b4c5d6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "storefront_saved_sections",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("category", sa.String(length=100), nullable=False, server_default="custom"),
        sa.Column("snapshot", sa.JSON(), nullable=False),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_storefront_saved_sections_name"), "storefront_saved_sections", ["name"], unique=False)
    op.create_index(op.f("ix_storefront_saved_sections_category"), "storefront_saved_sections", ["category"], unique=False)
    op.create_index(op.f("ix_storefront_saved_sections_created_by_id"), "storefront_saved_sections", ["created_by_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_storefront_saved_sections_created_by_id"), table_name="storefront_saved_sections")
    op.drop_index(op.f("ix_storefront_saved_sections_category"), table_name="storefront_saved_sections")
    op.drop_index(op.f("ix_storefront_saved_sections_name"), table_name="storefront_saved_sections")
    op.drop_table("storefront_saved_sections")
