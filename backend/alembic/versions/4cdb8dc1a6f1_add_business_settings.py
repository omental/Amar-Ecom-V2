"""add_business_settings

Revision ID: 4cdb8dc1a6f1
Revises: 2b876236efde
Create Date: 2026-05-11 14:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "4cdb8dc1a6f1"
down_revision: Union[str, Sequence[str], None] = "2b876236efde"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "business_settings",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("company_name", sa.String(length=255), server_default="Amar eCom", nullable=False),
        sa.Column("business_email", sa.String(length=255), nullable=True),
        sa.Column("business_phone", sa.String(length=100), nullable=True),
        sa.Column("business_address", sa.Text(), nullable=True),
        sa.Column("website", sa.String(length=500), nullable=True),
        sa.Column("currency", sa.String(length=10), server_default="BDT", nullable=False),
        sa.Column("timezone", sa.String(length=100), server_default="Asia/Dhaka", nullable=False),
        sa.Column("invoice_prefix", sa.String(length=20), server_default="INV", nullable=False),
        sa.Column("order_prefix", sa.String(length=20), server_default="ORD", nullable=False),
        sa.Column("low_stock_default_threshold", sa.Integer(), server_default="5", nullable=False),
        sa.Column("tax_rate", sa.Numeric(5, 2), server_default="0", nullable=False),
        sa.Column("logo_url", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("business_settings")
