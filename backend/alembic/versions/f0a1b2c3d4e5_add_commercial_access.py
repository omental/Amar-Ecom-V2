"""add commercial plans, entitlements, trials, and overrides

Revision ID: f0a1b2c3d4e5
Revises: e9f0a1b2c3d4
"""

from collections.abc import Sequence
import json
import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "f0a1b2c3d4e5"
down_revision: str | None = "e9f0a1b2c3d4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


FEATURES = {
    "advanced_builder": ("Advanced builder", "storefront", "boolean", False, "feature"),
    "advanced_styles": ("Advanced visual styles", "storefront", "boolean", False, "feature"),
    "custom_fields": ("Custom fields", "storefront", "boolean", False, "feature"),
    "content_models": ("Content models", "storefront", "boolean", False, "feature"),
    "saved_sections": ("Saved sections", "storefront", "boolean", False, "feature"),
    "product_limit": ("Products", "operations", "integer", 0, "limit"),
    "staff_limit": ("Staff members", "operations", "integer", 0, "limit"),
    "warehouse_limit": ("Warehouses", "operations", "integer", 0, "limit"),
    "store_limit": ("Stores", "operations", "integer", 1, "limit"),
    "theme_count_limit": ("Themes", "storefront", "integer", 1, "limit"),
    "media_storage_mb": ("Media storage", "operations", "integer", 0, "metered"),
    "custom_domain": ("Custom domains", "future", "boolean", False, "feature"),
    "amar_dns": ("Amar DNS", "future", "boolean", False, "feature"),
    "api_access": ("API access", "future", "boolean", False, "feature"),
    "automation": ("Automation", "future", "boolean", False, "feature"),
    "facebook_messaging": ("Facebook messaging", "future", "boolean", False, "feature"),
    "whatsapp_messaging": ("WhatsApp messaging", "future", "boolean", False, "feature"),
    "ai_commerce": ("AI commerce", "future", "boolean", False, "feature"),
    "ai_messages_monthly": ("AI messages", "future", "integer", 0, "metered"),
}


def upgrade() -> None:
    op.add_column("users", sa.Column("is_platform_admin", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.create_table(
        "feature_definitions",
        sa.Column("key", sa.String(100), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("category", sa.String(100), nullable=False),
        sa.Column("value_type", sa.String(30), nullable=False),
        sa.Column("default_value", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("enforcement_type", sa.String(30), nullable=False, server_default="feature"),
        sa.Column("platform_available", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_feature_definitions_category", "feature_definitions", ["category"])
    op.create_table(
        "plans",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("key", sa.String(100), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="active"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_public", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("monthly_price_display", sa.String(100), nullable=True),
        sa.Column("annual_price_display", sa.String(100), nullable=True),
        sa.Column("trial_days", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("key", "version", name="uq_plans_key_version"),
    )
    op.create_index("ix_plans_key", "plans", ["key"])
    op.create_index("ix_plans_status", "plans", ["status"])
    op.create_index("ix_plans_is_public", "plans", ["is_public"])
    op.create_table(
        "plan_entitlements",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("plans.id", ondelete="CASCADE"), nullable=False),
        sa.Column("feature_key", sa.String(100), sa.ForeignKey("feature_definitions.key", ondelete="RESTRICT"), nullable=False),
        sa.Column("value", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("plan_id", "feature_key", name="uq_plan_entitlement_feature"),
    )
    op.create_index("ix_plan_entitlements_plan_id", "plan_entitlements", ["plan_id"])
    op.create_index("ix_plan_entitlements_feature_key", "plan_entitlements", ["feature_key"])
    op.create_table(
        "store_plan_assignments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("store_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("stores.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("plan_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("plans.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="active"),
        sa.Column("source", sa.String(50), nullable=False, server_default="provisioning"),
        sa.Column("plan_key_snapshot", sa.String(100), nullable=False),
        sa.Column("plan_name_snapshot", sa.String(255), nullable=False),
        sa.Column("plan_version_snapshot", sa.Integer(), nullable=False),
        sa.Column("entitlement_snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="{}"),
        sa.Column("trial_started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("trial_ends_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("access_started_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("access_ends_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("store_id", name="uq_store_plan_assignment_store"),
    )
    op.create_index("ix_store_plan_assignments_store_id", "store_plan_assignments", ["store_id"])
    op.create_index("ix_store_plan_assignments_plan_id", "store_plan_assignments", ["plan_id"])
    op.create_index("ix_store_plan_assignments_status", "store_plan_assignments", ["status"])
    op.create_table(
        "store_entitlement_overrides",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("store_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("stores.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("feature_key", sa.String(100), sa.ForeignKey("feature_definitions.key", ondelete="RESTRICT"), nullable=False),
        sa.Column("value", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("store_id", "feature_key", "starts_at", name="uq_store_entitlement_override_window"),
    )
    op.create_index("ix_store_entitlement_overrides_store_id", "store_entitlement_overrides", ["store_id"])
    op.create_index("ix_store_entitlement_overrides_feature_key", "store_entitlement_overrides", ["feature_key"])

    bind = op.get_bind()
    feature_table = sa.table("feature_definitions", sa.column("key"), sa.column("name"), sa.column("description"), sa.column("category"), sa.column("value_type"), sa.column("default_value", postgresql.JSONB()), sa.column("enforcement_type"))
    op.bulk_insert(feature_table, [
        {"key": key, "name": values[0], "description": None, "category": values[1], "value_type": values[2], "default_value": values[3], "enforcement_type": values[4]}
        for key, values in FEATURES.items()
    ])
    plan_ids = {key: uuid.uuid4() for key in ("legacy", "starter", "growth", "pro", "enterprise")}
    plan_table = sa.table("plans", sa.column("id"), sa.column("key"), sa.column("version"), sa.column("name"), sa.column("description"), sa.column("status"), sa.column("sort_order"), sa.column("is_public"), sa.column("monthly_price_display"), sa.column("trial_days"), sa.column("metadata", postgresql.JSONB()))
    plan_rows = [
        ("legacy", "Legacy Full Access", "Compatibility access for existing stores.", 0, False, 0),
        ("starter", "Starter", "Core commerce tools for a new storefront.", 10, True, 0),
        ("growth", "Growth", "Advanced storefront and operations for growing merchants.", 20, True, 14),
        ("pro", "Pro", "Higher limits and advanced platform access.", 30, True, 14),
        ("enterprise", "Enterprise", "Configurable access for complex organizations.", 40, False, 0),
    ]
    op.bulk_insert(plan_table, [{"id": plan_ids[key], "key": key, "version": 1, "name": name, "description": description, "status": "active", "sort_order": order, "is_public": public, "monthly_price_display": None if not public else "Contact us", "trial_days": trial, "metadata": {"seed": "development"}} for key, name, description, order, public, trial in plan_rows])
    from app.services.commercial_registry import PLAN_DEFAULTS, complete_entitlements
    entitlement_table = sa.table("plan_entitlements", sa.column("id"), sa.column("plan_id"), sa.column("feature_key"), sa.column("value", postgresql.JSONB()))
    op.bulk_insert(entitlement_table, [{"id": uuid.uuid4(), "plan_id": plan_ids[plan_key], "feature_key": feature_key, "value": value} for plan_key, defaults in PLAN_DEFAULTS.items() for feature_key, value in complete_entitlements(defaults).items()])
    legacy_snapshot = json.dumps(complete_entitlements(PLAN_DEFAULTS["legacy"]))
    bind.execute(sa.text("""
        INSERT INTO store_plan_assignments (
            id, store_id, plan_id, status, source, plan_key_snapshot, plan_name_snapshot,
            plan_version_snapshot, entitlement_snapshot, access_started_at
        )
        SELECT gen_random_uuid(), id, :plan_id, 'active', 'legacy_migration', 'legacy',
               'Legacy Full Access', 1, CAST(:snapshot AS JSONB), now()
        FROM stores
    """), {"plan_id": plan_ids["legacy"], "snapshot": legacy_snapshot})
    orphaned = bind.execute(sa.text("SELECT count(*) FROM stores s LEFT JOIN store_plan_assignments a ON a.store_id = s.id WHERE a.id IS NULL")).scalar_one()
    if orphaned:
        raise RuntimeError(f"Commercial access migration left {orphaned} stores unassigned")


def downgrade() -> None:
    op.drop_table("store_entitlement_overrides")
    op.drop_table("store_plan_assignments")
    op.drop_table("plan_entitlements")
    op.drop_table("plans")
    op.drop_table("feature_definitions")
    op.drop_column("users", "is_platform_admin")
