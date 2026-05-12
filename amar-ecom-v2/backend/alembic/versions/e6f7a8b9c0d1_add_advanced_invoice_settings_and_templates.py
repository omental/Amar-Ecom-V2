"""add advanced invoice settings and templates

Revision ID: e6f7a8b9c0d1
Revises: d8f9a0b1c2d3
Create Date: 2026-05-12 12:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e6f7a8b9c0d1"
down_revision: Union[str, Sequence[str], None] = "d8f9a0b1c2d3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "business_settings",
        sa.Column("invoice_title", sa.String(length=255), server_default="Invoice", nullable=False),
    )
    op.add_column("business_settings", sa.Column("invoice_footer_note", sa.Text(), nullable=True))
    op.add_column("business_settings", sa.Column("invoice_terms", sa.Text(), nullable=True))
    op.add_column("business_settings", sa.Column("payment_instructions", sa.Text(), nullable=True))
    op.add_column(
        "business_settings",
        sa.Column("show_logo_on_invoice", sa.Boolean(), server_default="true", nullable=False),
    )
    op.add_column(
        "business_settings",
        sa.Column("show_business_address_on_invoice", sa.Boolean(), server_default="true", nullable=False),
    )
    op.add_column(
        "business_settings",
        sa.Column("show_customer_phone_on_invoice", sa.Boolean(), server_default="true", nullable=False),
    )
    op.add_column(
        "business_settings",
        sa.Column("show_payment_status_on_invoice", sa.Boolean(), server_default="true", nullable=False),
    )
    op.add_column(
        "business_settings",
        sa.Column("show_warehouse_on_invoice", sa.Boolean(), server_default="false", nullable=False),
    )
    op.add_column(
        "business_settings",
        sa.Column("invoice_template", sa.String(length=100), server_default="standard", nullable=False),
    )
    op.add_column("business_settings", sa.Column("invoice_accent_color", sa.String(length=50), nullable=True))
    op.add_column("business_settings", sa.Column("invoice_signature_label", sa.String(length=255), nullable=True))

    op.create_table(
        "invoice_templates",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("slug", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("template_type", sa.String(length=50), server_default="invoice", nullable=False),
        sa.Column("is_default", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("accent_color", sa.String(length=50), nullable=True),
        sa.Column("header_text", sa.Text(), nullable=True),
        sa.Column("footer_text", sa.Text(), nullable=True),
        sa.Column("terms_text", sa.Text(), nullable=True),
        sa.Column("payment_instructions", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_invoice_templates_slug"), "invoice_templates", ["slug"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_invoice_templates_slug"), table_name="invoice_templates")
    op.drop_table("invoice_templates")

    op.drop_column("business_settings", "invoice_signature_label")
    op.drop_column("business_settings", "invoice_accent_color")
    op.drop_column("business_settings", "invoice_template")
    op.drop_column("business_settings", "show_warehouse_on_invoice")
    op.drop_column("business_settings", "show_payment_status_on_invoice")
    op.drop_column("business_settings", "show_customer_phone_on_invoice")
    op.drop_column("business_settings", "show_business_address_on_invoice")
    op.drop_column("business_settings", "show_logo_on_invoice")
    op.drop_column("business_settings", "payment_instructions")
    op.drop_column("business_settings", "invoice_terms")
    op.drop_column("business_settings", "invoice_footer_note")
    op.drop_column("business_settings", "invoice_title")
