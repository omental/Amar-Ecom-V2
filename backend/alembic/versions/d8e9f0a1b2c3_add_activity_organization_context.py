"""add activity organization context

Revision ID: d8e9f0a1b2c3
Revises: d7e8f9a0b1c2
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "d8e9f0a1b2c3"
down_revision = "d7e8f9a0b1c2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("activity_logs", sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.execute("UPDATE activity_logs a SET organization_id=s.organization_id FROM stores s WHERE s.id=a.store_id")
    op.execute("DO $$ BEGIN IF EXISTS (SELECT 1 FROM activity_logs WHERE organization_id IS NULL) THEN RAISE EXCEPTION 'activity_logs contain orphan tenant rows'; END IF; END $$")
    op.alter_column("activity_logs", "organization_id", nullable=False)
    op.create_foreign_key("fk_activity_logs_organization_id", "activity_logs", "organizations", ["organization_id"], ["id"], ondelete="RESTRICT")
    op.create_index("ix_activity_logs_organization_id", "activity_logs", ["organization_id"])


def downgrade() -> None:
    op.drop_index("ix_activity_logs_organization_id", table_name="activity_logs")
    op.drop_constraint("fk_activity_logs_organization_id", "activity_logs", type_="foreignkey")
    op.drop_column("activity_logs", "organization_id")
