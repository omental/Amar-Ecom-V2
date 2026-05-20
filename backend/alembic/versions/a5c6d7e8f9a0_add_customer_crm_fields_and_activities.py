"""add customer crm fields and activities

Revision ID: a5c6d7e8f9a0
Revises: f4a1b2c3d4e5
Create Date: 2026-05-11 16:15:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "a5c6d7e8f9a0"
down_revision: str | Sequence[str] | None = "f4a1b2c3d4e5"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("customers", sa.Column("customer_type", sa.String(length=50), nullable=True))
    op.add_column("customers", sa.Column("tags", sa.Text(), nullable=True))
    op.add_column("customers", sa.Column("follow_up_date", sa.Date(), nullable=True))
    op.add_column("customers", sa.Column("last_contacted_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index(op.f("ix_customers_customer_type"), "customers", ["customer_type"], unique=False)
    op.create_index(op.f("ix_customers_follow_up_date"), "customers", ["follow_up_date"], unique=False)

    op.create_table(
        "customer_activities",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("customer_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("activity_type", sa.String(length=50), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("due_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_customer_activities_activity_type"), "customer_activities", ["activity_type"], unique=False)
    op.create_index(op.f("ix_customer_activities_created_by_id"), "customer_activities", ["created_by_id"], unique=False)
    op.create_index(op.f("ix_customer_activities_customer_id"), "customer_activities", ["customer_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_customer_activities_customer_id"), table_name="customer_activities")
    op.drop_index(op.f("ix_customer_activities_created_by_id"), table_name="customer_activities")
    op.drop_index(op.f("ix_customer_activities_activity_type"), table_name="customer_activities")
    op.drop_table("customer_activities")

    op.drop_index(op.f("ix_customers_follow_up_date"), table_name="customers")
    op.drop_index(op.f("ix_customers_customer_type"), table_name="customers")
    op.drop_column("customers", "last_contacted_at")
    op.drop_column("customers", "follow_up_date")
    op.drop_column("customers", "tags")
    op.drop_column("customers", "customer_type")
