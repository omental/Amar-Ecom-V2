"""add unified commerce inbox

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

from app.models.messaging import (
    Conversation, ConversationAttachment, ConversationMessage, ConversationNote, ConversationOrderLink,
    ConversationReadState, ConversationTag, ConversationTagLink, CustomerChannelIdentity,
    MessagingChannel, MessagingChannelSecret, SavedReply,
)


revision: str = "f6a7b8c9d0e1"
down_revision: str | None = "e5f6a7b8c9d0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


TABLES = (
    MessagingChannel.__table__,
    MessagingChannelSecret.__table__,
    CustomerChannelIdentity.__table__,
    Conversation.__table__,
    ConversationMessage.__table__,
    ConversationAttachment.__table__,
    ConversationNote.__table__,
    ConversationTag.__table__,
    ConversationTagLink.__table__,
    ConversationReadState.__table__,
    ConversationOrderLink.__table__,
    SavedReply.__table__,
)


def upgrade() -> None:
    bind = op.get_bind()
    for table in TABLES:
        table.create(bind, checkfirst=False)
    permissions = (
        ("inbox", "view"), ("inbox", "reply"), ("inbox", "assign"),
        ("inbox", "manage"), ("inbox", "notes"), ("inbox", "channels"),
    )
    for module, action in permissions:
        op.execute(sa.text("""
            INSERT INTO permissions (id, module, action, label)
            VALUES (gen_random_uuid(), :module, :action, :label)
            ON CONFLICT (module, action) DO NOTHING
        """).bindparams(module=module, action=action, label=f"{module.title()} {action.title()}"))
    op.execute(sa.text("""
        UPDATE store_plan_assignments
        SET entitlement_snapshot = entitlement_snapshot::jsonb ||
            jsonb_build_object('unified_inbox', plan_key_snapshot IN ('legacy','growth','pro','enterprise'))
    """))


def downgrade() -> None:
    bind = op.get_bind()
    for table in reversed(TABLES):
        table.drop(bind, checkfirst=False)
    op.execute("DELETE FROM permissions WHERE module='inbox'")
