"""add storefront theme builder fields

Revision ID: b284c5d1e3f2
Revises: a13f5c9d8e71
Create Date: 2026-05-22
"""

from alembic import op
import sqlalchemy as sa


revision = "b284c5d1e3f2"
down_revision = "a13f5c9d8e71"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "storefront_settings",
        sa.Column("active_template_key", sa.String(length=100), nullable=False, server_default="live_shopping_classic"),
    )
    op.add_column(
        "storefront_settings",
        sa.Column("typography_preset", sa.String(length=100), nullable=False, server_default="modern_commerce"),
    )
    op.add_column(
        "storefront_settings",
        sa.Column("color_preset", sa.String(length=100), nullable=False, server_default="live_red"),
    )
    op.add_column(
        "storefront_settings",
        sa.Column("animation_preset", sa.String(length=100), nullable=False, server_default="subtle_fade"),
    )
    op.add_column(
        "storefront_settings",
        sa.Column("product_card_style", sa.String(length=100), nullable=False, server_default="compact_deal"),
    )
    op.add_column(
        "storefront_settings",
        sa.Column("button_style", sa.String(length=100), nullable=False, server_default="rounded"),
    )
    op.add_column(
        "storefront_settings",
        sa.Column("header_layout", sa.String(length=100), nullable=False, server_default="search_heavy"),
    )
    op.add_column(
        "storefront_settings",
        sa.Column("footer_layout", sa.String(length=100), nullable=False, server_default="multi_column"),
    )
    op.add_column(
        "storefront_settings",
        sa.Column("spacing_density", sa.String(length=100), nullable=False, server_default="compact"),
    )
    op.add_column(
        "storefront_settings",
        sa.Column("corner_radius", sa.String(length=100), nullable=False, server_default="soft"),
    )
    op.add_column(
        "storefront_settings",
        sa.Column("shadow_style", sa.String(length=100), nullable=False, server_default="soft"),
    )
    op.add_column(
        "storefront_settings",
        sa.Column("accent_color", sa.String(length=20), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("storefront_settings", "accent_color")
    op.drop_column("storefront_settings", "shadow_style")
    op.drop_column("storefront_settings", "corner_radius")
    op.drop_column("storefront_settings", "spacing_density")
    op.drop_column("storefront_settings", "footer_layout")
    op.drop_column("storefront_settings", "header_layout")
    op.drop_column("storefront_settings", "button_style")
    op.drop_column("storefront_settings", "product_card_style")
    op.drop_column("storefront_settings", "animation_preset")
    op.drop_column("storefront_settings", "color_preset")
    op.drop_column("storefront_settings", "typography_preset")
    op.drop_column("storefront_settings", "active_template_key")
