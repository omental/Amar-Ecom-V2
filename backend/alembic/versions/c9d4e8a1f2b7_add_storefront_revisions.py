"""add storefront revisions

Revision ID: c9d4e8a1f2b7
Revises: b284c5d1e3f2
Create Date: 2026-05-22
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "c9d4e8a1f2b7"
down_revision = "b284c5d1e3f2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "storefront_revisions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("page_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("revision_type", sa.String(length=50), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("snapshot", sa.JSON(), nullable=False),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["page_id"], ["storefront_pages.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_storefront_revisions_page_id"), "storefront_revisions", ["page_id"], unique=False)
    op.create_index(op.f("ix_storefront_revisions_revision_type"), "storefront_revisions", ["revision_type"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_storefront_revisions_revision_type"), table_name="storefront_revisions")
    op.drop_index(op.f("ix_storefront_revisions_page_id"), table_name="storefront_revisions")
    op.drop_table("storefront_revisions")
