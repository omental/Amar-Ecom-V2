"""add global media assets

Revision ID: e1f2a3b4c5d6
Revises: d8a9c7b6e5f4
Create Date: 2026-08-09
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "e1f2a3b4c5d6"
down_revision = "d8a9c7b6e5f4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "media_assets",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("storage_key", sa.String(length=500), nullable=False),
        sa.Column("mime_type", sa.String(length=100), nullable=False),
        sa.Column("file_size", sa.BigInteger(), nullable=False),
        sa.Column("width", sa.Integer(), nullable=True),
        sa.Column("height", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=True),
        sa.Column("alt_text", sa.String(length=500), nullable=True),
        sa.Column("caption", sa.Text(), nullable=True),
        sa.Column("uploaded_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["uploaded_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("storage_key", name="uq_media_assets_storage_key"),
    )
    op.create_index(op.f("ix_media_assets_created_at"), "media_assets", ["created_at"], unique=False)
    op.create_index(op.f("ix_media_assets_mime_type"), "media_assets", ["mime_type"], unique=False)
    op.create_index(op.f("ix_media_assets_original_filename"), "media_assets", ["original_filename"], unique=False)
    op.create_index(op.f("ix_media_assets_uploaded_by_id"), "media_assets", ["uploaded_by_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_media_assets_uploaded_by_id"), table_name="media_assets")
    op.drop_index(op.f("ix_media_assets_original_filename"), table_name="media_assets")
    op.drop_index(op.f("ix_media_assets_mime_type"), table_name="media_assets")
    op.drop_index(op.f("ix_media_assets_created_at"), table_name="media_assets")
    op.drop_table("media_assets")
