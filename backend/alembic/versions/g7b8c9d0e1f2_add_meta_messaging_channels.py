"""add Meta messaging channel connectivity

Revision ID: g7b8c9d0e1f2
Revises: f6a7b8c9d0e1
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

from app.models.messaging import MessagingOAuthState, MessagingProviderEvent, MessagingTemplate

revision: str = "g7b8c9d0e1f2"
down_revision: str | None = "f6a7b8c9d0e1"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    op.drop_constraint("ck_messaging_channels_status", "messaging_channels", type_="check")
    op.create_check_constraint(
        "ck_messaging_channels_status", "messaging_channels",
        "status IN ('pending','connected','needs_attention','authorization_expired','permissions_revoked','webhook_error','registration_incomplete','provider_error','disconnected','error','disabled')",
    )
    op.add_column("conversations", sa.Column("provider_reply_window_ends_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("conversation_messages", sa.Column("provider_status_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("conversation_messages", sa.Column("provider_metadata", sa.JSON(), server_default=sa.text("'{}'::jsonb"), nullable=False))
    for table in (MessagingOAuthState.__table__, MessagingProviderEvent.__table__, MessagingTemplate.__table__):
        table.create(bind, checkfirst=False)


def downgrade() -> None:
    bind = op.get_bind()
    for table in (MessagingTemplate.__table__, MessagingProviderEvent.__table__, MessagingOAuthState.__table__):
        table.drop(bind, checkfirst=False)
    op.drop_column("conversation_messages", "provider_metadata")
    op.drop_column("conversation_messages", "provider_status_at")
    op.drop_column("conversations", "provider_reply_window_ends_at")
    op.drop_constraint("ck_messaging_channels_status", "messaging_channels", type_="check")
    op.create_check_constraint(
        "ck_messaging_channels_status", "messaging_channels",
        "status IN ('pending','connected','disconnected','error','disabled')",
    )
