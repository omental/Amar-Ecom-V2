"""add auth me compatibility and notifications

Revision ID: 9c0d1e2f3a4b
Revises: 8b9c0d1e2f3a
Create Date: 2026-05-17 18:20:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "9c0d1e2f3a4b"
down_revision: str | Sequence[str] | None = "8b9c0d1e2f3a"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("last_login", sa.DateTime(timezone=True), nullable=True))

    op.create_table(
        "notifications",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("type", sa.String(length=100), nullable=False, server_default="info"),
        sa.Column("read", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("link", sa.String(length=500), nullable=True),
        sa.Column("module", sa.String(length=100), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_notifications_module"), "notifications", ["module"], unique=False)
    op.create_index(op.f("ix_notifications_read"), "notifications", ["read"], unique=False)
    op.create_index(op.f("ix_notifications_type"), "notifications", ["type"], unique=False)
    op.create_index(op.f("ix_notifications_user_id"), "notifications", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_notifications_user_id"), table_name="notifications")
    op.drop_index(op.f("ix_notifications_type"), table_name="notifications")
    op.drop_index(op.f("ix_notifications_read"), table_name="notifications")
    op.drop_index(op.f("ix_notifications_module"), table_name="notifications")
    op.drop_table("notifications")
    op.drop_column("users", "last_login")
