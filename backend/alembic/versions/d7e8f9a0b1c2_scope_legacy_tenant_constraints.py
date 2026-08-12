"""scope legacy tenant constraints

Revision ID: d7e8f9a0b1c2
Revises: d6e7f8a9b0c1
"""
from alembic import op

revision = "d7e8f9a0b1c2"
down_revision = "d6e7f8a9b0c1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # These two tables historically had both a unique index and a separate
    # column-level unique constraint. Phase 6 replaced the indexes in the
    # foundation migration; remove the remaining global constraints too.
    op.drop_constraint("storefront_themes_key_key", "storefront_themes", type_="unique")
    op.drop_constraint("storefront_content_models_key_key", "storefront_content_models", type_="unique")


def downgrade() -> None:
    op.create_unique_constraint("storefront_content_models_key_key", "storefront_content_models", ["key"])
    op.create_unique_constraint("storefront_themes_key_key", "storefront_themes", ["key"])
