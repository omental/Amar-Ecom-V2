"""add storefront dynamic data

Revision ID: c5d6e7f8a9b0
Revises: b4c5d6e7f8a9
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "c5d6e7f8a9b0"
down_revision = "b4c5d6e7f8a9"
branch_labels = None
depends_on = None


def upgrade():
    uuid = postgresql.UUID(as_uuid=True)
    op.create_table("storefront_custom_field_definitions",
        sa.Column("id", uuid, primary_key=True), sa.Column("namespace", sa.String(100), nullable=False, server_default="custom"),
        sa.Column("key", sa.String(100), nullable=False), sa.Column("name", sa.String(255), nullable=False), sa.Column("description", sa.Text()),
        sa.Column("owner_type", sa.String(30), nullable=False), sa.Column("value_type", sa.String(30), nullable=False),
        sa.Column("validation", sa.JSON(), nullable=False, server_default="{}"), sa.Column("is_required", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("is_public", sa.Boolean(), nullable=False, server_default=sa.true()), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("owner_type", "namespace", "key", name="uq_storefront_custom_field_owner_key"))
    op.create_index("ix_storefront_custom_field_definitions_owner_type", "storefront_custom_field_definitions", ["owner_type"])
    op.create_table("storefront_custom_field_values",
        sa.Column("id", uuid, primary_key=True), sa.Column("definition_id", uuid, sa.ForeignKey("storefront_custom_field_definitions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("owner_type", sa.String(30), nullable=False), sa.Column("owner_id", uuid, nullable=False), sa.Column("value", sa.JSON()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()), sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("definition_id", "owner_id", name="uq_storefront_custom_field_value_owner"))
    for name, cols in [("definition_id", ["definition_id"]), ("owner_type", ["owner_type"]), ("owner_id", ["owner_id"])]: op.create_index(f"ix_storefront_custom_field_values_{name}", "storefront_custom_field_values", cols)
    op.create_table("storefront_content_models",
        sa.Column("id", uuid, primary_key=True), sa.Column("name", sa.String(255), nullable=False), sa.Column("key", sa.String(100), nullable=False, unique=True), sa.Column("description", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()), sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()))
    op.create_index("ix_storefront_content_models_key", "storefront_content_models", ["key"], unique=True)
    op.create_table("storefront_content_field_definitions",
        sa.Column("id", uuid, primary_key=True), sa.Column("model_id", uuid, sa.ForeignKey("storefront_content_models.id", ondelete="CASCADE"), nullable=False), sa.Column("key", sa.String(100), nullable=False),
        sa.Column("name", sa.String(255), nullable=False), sa.Column("description", sa.Text()), sa.Column("value_type", sa.String(30), nullable=False), sa.Column("validation", sa.JSON(), nullable=False, server_default="{}"),
        sa.Column("is_required", sa.Boolean(), nullable=False, server_default=sa.false()), sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()), sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("model_id", "key", name="uq_storefront_content_field_model_key"))
    op.create_index("ix_storefront_content_field_definitions_model_id", "storefront_content_field_definitions", ["model_id"])
    op.create_table("storefront_content_entries",
        sa.Column("id", uuid, primary_key=True), sa.Column("model_id", uuid, sa.ForeignKey("storefront_content_models.id", ondelete="CASCADE"), nullable=False), sa.Column("handle", sa.String(120), nullable=False),
        sa.Column("values", sa.JSON(), nullable=False, server_default="{}"), sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()), sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("model_id", "handle", name="uq_storefront_content_entry_model_handle"))
    op.create_index("ix_storefront_content_entries_model_id", "storefront_content_entries", ["model_id"])
    op.create_index("ix_storefront_content_entries_status", "storefront_content_entries", ["status"])


def downgrade():
    op.drop_table("storefront_content_entries")
    op.drop_table("storefront_content_field_definitions")
    op.drop_index("ix_storefront_content_models_key", table_name="storefront_content_models")
    op.drop_table("storefront_content_models")
    op.drop_table("storefront_custom_field_values")
    op.drop_table("storefront_custom_field_definitions")
