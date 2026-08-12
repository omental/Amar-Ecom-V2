"""add Amar AI commerce agent

Revision ID: h8c9d0e1f2g3
Revises: g7b8c9d0e1f2
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

from app.models.ai_commerce import AIExecution, AIResponseSuggestion, AIToolCall, AIUsageEvent, CommerceAISettings

revision: str = "h8c9d0e1f2g3"
down_revision: str | None = "g7b8c9d0e1f2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    for table in (
        CommerceAISettings.__table__, AIExecution.__table__, AIToolCall.__table__,
        AIUsageEvent.__table__, AIResponseSuggestion.__table__,
    ):
        table.create(bind, checkfirst=False)

    op.drop_constraint("ck_conversation_messages_sender", "conversation_messages", type_="check")
    op.create_check_constraint(
        "ck_conversation_messages_sender", "conversation_messages",
        "sender_type IN ('customer','agent','system','future_ai','ai')",
    )
    op.execute(sa.text("""
        INSERT INTO commerce_ai_settings
            (id, organization_id, store_id, enabled, mode, tone, language_preferences,
             merchant_instructions, handoff_rules, disclose_ai)
        SELECT gen_random_uuid(), organization_id, id, false, 'off', 'concise and helpful',
               '[]'::jsonb, NULL, '{}'::jsonb, true
        FROM stores
        ON CONFLICT (store_id) DO NOTHING
    """))


def downgrade() -> None:
    op.drop_constraint("ck_conversation_messages_sender", "conversation_messages", type_="check")
    op.create_check_constraint(
        "ck_conversation_messages_sender", "conversation_messages",
        "sender_type IN ('customer','agent','system','future_ai')",
    )
    bind = op.get_bind()
    for table in (
        AIResponseSuggestion.__table__, AIUsageEvent.__table__, AIToolCall.__table__,
        AIExecution.__table__, CommerceAISettings.__table__,
    ):
        table.drop(bind, checkfirst=False)
