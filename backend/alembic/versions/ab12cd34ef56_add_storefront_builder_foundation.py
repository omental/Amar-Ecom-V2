"""add storefront builder foundation

Revision ID: ab12cd34ef56
Revises: 0f1e2d3c4b5a
Create Date: 2026-05-22 12:00:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "ab12cd34ef56"
down_revision: str | Sequence[str] | None = "0f1e2d3c4b5a"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "storefront_settings",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("brand_name", sa.String(length=255), nullable=False, server_default="Amar-eCom"),
        sa.Column("logo_url", sa.String(length=500), nullable=True),
        sa.Column("favicon_url", sa.String(length=500), nullable=True),
        sa.Column("phone", sa.String(length=50), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("address", sa.String(length=500), nullable=True),
        sa.Column("primary_color", sa.String(length=20), nullable=False, server_default="#db011c"),
        sa.Column("secondary_color", sa.String(length=20), nullable=True),
        sa.Column("currency", sa.String(length=20), nullable=False, server_default="BDT"),
        sa.Column("show_topbar", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("show_search", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("show_cart", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("show_track_order", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("social_links", sa.JSON(), nullable=True),
        sa.Column("seo_title", sa.String(length=255), nullable=True),
        sa.Column("seo_description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "storefront_menus",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("location", sa.String(length=100), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_storefront_menus_location"), "storefront_menus", ["location"], unique=False)
    op.create_table(
        "storefront_pages",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("slug", sa.String(length=255), nullable=False),
        sa.Column("page_type", sa.String(length=50), nullable=False, server_default="custom"),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column("seo_title", sa.String(length=255), nullable=True),
        sa.Column("seo_description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="draft"),
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_storefront_pages_slug"), "storefront_pages", ["slug"], unique=True)
    op.create_table(
        "storefront_banners",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("subtitle", sa.Text(), nullable=True),
        sa.Column("image_url", sa.String(length=500), nullable=False),
        sa.Column("mobile_image_url", sa.String(length=500), nullable=True),
        sa.Column("button_text", sa.String(length=100), nullable=True),
        sa.Column("button_url", sa.String(length=500), nullable=True),
        sa.Column("location", sa.String(length=100), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_storefront_banners_location"), "storefront_banners", ["location"], unique=False)
    op.create_table(
        "storefront_menu_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("menu_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("label", sa.String(length=255), nullable=False),
        sa.Column("url", sa.String(length=500), nullable=False),
        sa.Column("target", sa.String(length=20), nullable=False, server_default="_self"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("parent_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["menu_id"], ["storefront_menus.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["parent_id"], ["storefront_menu_items.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_storefront_menu_items_menu_id"), "storefront_menu_items", ["menu_id"], unique=False)
    op.create_index(op.f("ix_storefront_menu_items_parent_id"), "storefront_menu_items", ["parent_id"], unique=False)
    op.create_table(
        "storefront_sections",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("page_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("type", sa.String(length=100), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=True),
        sa.Column("subtitle", sa.Text(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("settings", sa.JSON(), nullable=True),
        sa.Column("content", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["page_id"], ["storefront_pages.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_storefront_sections_page_id"), "storefront_sections", ["page_id"], unique=False)
    op.create_table(
        "storefront_media",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("original_name", sa.String(length=255), nullable=False),
        sa.Column("mime_type", sa.String(length=100), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column("url", sa.String(length=500), nullable=False),
        sa.Column("storage_path", sa.String(length=500), nullable=False),
        sa.Column("media_type", sa.String(length=50), nullable=False),
        sa.Column("alt_text", sa.String(length=255), nullable=True),
        sa.Column("uploaded_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["uploaded_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_storefront_media_media_type"), "storefront_media", ["media_type"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_storefront_media_media_type"), table_name="storefront_media")
    op.drop_table("storefront_media")
    op.drop_index(op.f("ix_storefront_sections_page_id"), table_name="storefront_sections")
    op.drop_table("storefront_sections")
    op.drop_index(op.f("ix_storefront_menu_items_parent_id"), table_name="storefront_menu_items")
    op.drop_index(op.f("ix_storefront_menu_items_menu_id"), table_name="storefront_menu_items")
    op.drop_table("storefront_menu_items")
    op.drop_index(op.f("ix_storefront_banners_location"), table_name="storefront_banners")
    op.drop_table("storefront_banners")
    op.drop_index(op.f("ix_storefront_pages_slug"), table_name="storefront_pages")
    op.drop_table("storefront_pages")
    op.drop_index(op.f("ix_storefront_menus_location"), table_name="storefront_menus")
    op.drop_table("storefront_menus")
    op.drop_table("storefront_settings")
