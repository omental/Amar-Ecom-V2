"""add merchant verification and store onboarding

Revision ID: e9f0a1b2c3d4
Revises: d8e9f0a1b2c3
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "e9f0a1b2c3d4"
down_revision: str | None = "d8e9f0a1b2c3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("email_verification_token_hash", sa.String(64), nullable=True))
    op.add_column("users", sa.Column("email_verification_expires_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index(
        "ix_users_email_verification_token_hash",
        "users",
        ["email_verification_token_hash"],
        unique=False,
    )
    # Existing accounts predate verification and must remain able to sign in.
    op.execute("UPDATE users SET email_verified_at = created_at WHERE email_verified_at IS NULL")

    op.create_table(
        "store_onboarding",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "store_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("stores.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("status", sa.String(30), nullable=False, server_default="in_progress"),
        sa.Column("current_step", sa.String(100), nullable=False, server_default="add_product"),
        sa.Column("completed_steps", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("dismissed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("store_id", name="uq_store_onboarding_store_id"),
    )
    op.create_index("ix_store_onboarding_store_id", "store_onboarding", ["store_id"], unique=True)
    op.create_index("ix_store_onboarding_status", "store_onboarding", ["status"])

    # Migrated stores are already established; record completion without displaying onboarding.
    op.execute(
        """
        INSERT INTO store_onboarding (
            id, store_id, status, current_step, completed_steps, dismissed_at, completed_at
        )
        SELECT gen_random_uuid(), id, 'completed', 'completed',
               '["add_product", "customize_storefront", "configure_delivery", "business_information", "preview_store", "publish_storefront"]'::json,
               now(), now()
        FROM stores
        """
    )


def downgrade() -> None:
    op.drop_index("ix_store_onboarding_status", table_name="store_onboarding")
    op.drop_index("ix_store_onboarding_store_id", table_name="store_onboarding")
    op.drop_table("store_onboarding")
    op.drop_index("ix_users_email_verification_token_hash", table_name="users")
    op.drop_column("users", "email_verification_expires_at")
    op.drop_column("users", "email_verification_token_hash")
    op.drop_column("users", "email_verified_at")
