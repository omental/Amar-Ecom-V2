"""add provider-neutral recurring billing

Revision ID: a1b2c3d4e5f6
Revises: f0a1b2c3d4e5
"""

from collections.abc import Sequence
import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "a1b2c3d4e5f6"
down_revision: str | None = "f0a1b2c3d4e5"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

UUID = postgresql.UUID(as_uuid=True)
MONEY = sa.Numeric(14, 2)
JSON = postgresql.JSONB(astext_type=sa.Text())


def upgrade() -> None:
    op.create_table("billing_accounts",
        sa.Column("id", UUID, primary_key=True),
        sa.Column("organization_id", UUID, sa.ForeignKey("organizations.id", ondelete="RESTRICT"), nullable=False, unique=True),
        sa.Column("legal_name", sa.String(255)), sa.Column("billing_email", sa.String(255), nullable=False),
        sa.Column("billing_address", JSON, nullable=False, server_default="{}"), sa.Column("tax_identifier", sa.String(100)),
        sa.Column("default_currency", sa.String(10), nullable=False, server_default="BDT"),
        sa.Column("status", sa.String(30), nullable=False, server_default="active"),
        sa.Column("provider_customer_refs", JSON, nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()))
    op.create_index("ix_billing_accounts_organization_id", "billing_accounts", ["organization_id"])
    op.create_index("ix_billing_accounts_status", "billing_accounts", ["status"])

    op.create_table("plan_prices",
        sa.Column("id", UUID, primary_key=True), sa.Column("plan_id", UUID, sa.ForeignKey("plans.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("key", sa.String(120), nullable=False), sa.Column("billing_cycle", sa.String(20), nullable=False),
        sa.Column("currency", sa.String(10), nullable=False), sa.Column("amount", MONEY, nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="active"),
        sa.Column("provider_mappings", JSON, nullable=False, server_default="{}"),
        sa.Column("effective_from", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("retired_at", sa.DateTime(timezone=True)), sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("key", name="uq_plan_prices_key"))
    op.create_index("ix_plan_prices_plan_id", "plan_prices", ["plan_id"])
    op.create_index("ix_plan_prices_catalog", "plan_prices", ["plan_id", "billing_cycle", "currency", "status"])

    op.create_table("store_subscriptions",
        sa.Column("id", UUID, primary_key=True), sa.Column("store_id", UUID, sa.ForeignKey("stores.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("billing_account_id", UUID, sa.ForeignKey("billing_accounts.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("plan_id", UUID, sa.ForeignKey("plans.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("plan_price_id", UUID, sa.ForeignKey("plan_prices.id", ondelete="RESTRICT")),
        sa.Column("pending_plan_price_id", UUID, sa.ForeignKey("plan_prices.id", ondelete="RESTRICT")),
        sa.Column("plan_key_snapshot", sa.String(100), nullable=False), sa.Column("plan_version_snapshot", sa.Integer(), nullable=False),
        sa.Column("price_key_snapshot", sa.String(120), nullable=False), sa.Column("billing_cycle", sa.String(20), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="pending"), sa.Column("currency", sa.String(10), nullable=False),
        sa.Column("unit_amount", MONEY, nullable=False), sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("current_period_start", sa.DateTime(timezone=True)), sa.Column("current_period_end", sa.DateTime(timezone=True)),
        sa.Column("grace_ends_at", sa.DateTime(timezone=True)), sa.Column("cancel_at_period_end", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("cancelled_at", sa.DateTime(timezone=True)), sa.Column("ended_at", sa.DateTime(timezone=True)),
        sa.Column("trial_ends_at", sa.DateTime(timezone=True)), sa.Column("provider", sa.String(50), nullable=False),
        sa.Column("provider_customer_ref", sa.String(255)), sa.Column("provider_subscription_ref", sa.String(255)),
        sa.Column("last_provider_event_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("store_id", name="uq_store_subscription_store"),
        sa.UniqueConstraint("provider", "provider_subscription_ref", name="uq_store_subscription_provider_ref"))
    for name in ("store_id", "billing_account_id", "plan_id", "plan_price_id", "status", "current_period_end", "grace_ends_at", "provider_customer_ref"):
        op.create_index(f"ix_store_subscriptions_{name}", "store_subscriptions", [name])

    op.create_table("billing_checkout_sessions",
        sa.Column("id", UUID, primary_key=True), sa.Column("store_id", UUID, sa.ForeignKey("stores.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("billing_account_id", UUID, sa.ForeignKey("billing_accounts.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("target_plan_price_id", UUID, sa.ForeignKey("plan_prices.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="pending"), sa.Column("provider", sa.String(50), nullable=False),
        sa.Column("provider_session_ref", sa.String(255)), sa.Column("checkout_url", sa.String(1000)),
        sa.Column("success_url", sa.String(1000), nullable=False), sa.Column("cancel_url", sa.String(1000), nullable=False),
        sa.Column("idempotency_key", sa.String(128), nullable=False), sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True)), sa.Column("created_by_id", UUID, sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("store_id", "idempotency_key", name="uq_billing_checkout_store_idempotency"),
        sa.UniqueConstraint("provider", "provider_session_ref", name="uq_billing_checkout_provider_ref"))
    for name in ("store_id", "billing_account_id", "status", "expires_at"):
        op.create_index(f"ix_billing_checkout_sessions_{name}", "billing_checkout_sessions", [name])

    op.create_table("billing_provider_events",
        sa.Column("id", UUID, primary_key=True), sa.Column("provider", sa.String(50), nullable=False),
        sa.Column("provider_event_id", sa.String(255), nullable=False), sa.Column("event_type", sa.String(100), nullable=False),
        sa.Column("event_created_at", sa.DateTime(timezone=True)), sa.Column("payload", JSON, nullable=False),
        sa.Column("signature_valid", sa.Boolean(), nullable=False), sa.Column("processing_status", sa.String(30), nullable=False, server_default="received"),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("processed_at", sa.DateTime(timezone=True)), sa.Column("failure_reason", sa.Text()),
        sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"),
        sa.UniqueConstraint("provider", "provider_event_id", name="uq_billing_event_provider_id"))
    for name in ("provider", "event_type", "processing_status"):
        op.create_index(f"ix_billing_provider_events_{name}", "billing_provider_events", [name])

    op.create_table("billing_invoices",
        sa.Column("id", UUID, primary_key=True), sa.Column("store_id", UUID, sa.ForeignKey("stores.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("billing_account_id", UUID, sa.ForeignKey("billing_accounts.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("subscription_id", UUID, sa.ForeignKey("store_subscriptions.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("invoice_number", sa.String(100), nullable=False), sa.Column("status", sa.String(30), nullable=False, server_default="open"),
        sa.Column("currency", sa.String(10), nullable=False), sa.Column("subtotal", MONEY, nullable=False),
        sa.Column("discount_total", MONEY, nullable=False, server_default="0"), sa.Column("tax_total", MONEY, nullable=False, server_default="0"),
        sa.Column("total", MONEY, nullable=False), sa.Column("amount_paid", MONEY, nullable=False, server_default="0"),
        sa.Column("amount_due", MONEY, nullable=False), sa.Column("period_start", sa.DateTime(timezone=True)),
        sa.Column("period_end", sa.DateTime(timezone=True)), sa.Column("due_at", sa.DateTime(timezone=True)),
        sa.Column("paid_at", sa.DateTime(timezone=True)), sa.Column("provider", sa.String(50), nullable=False),
        sa.Column("provider_invoice_ref", sa.String(255)), sa.Column("metadata", JSON, nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("invoice_number", name="uq_billing_invoice_number"),
        sa.UniqueConstraint("provider", "provider_invoice_ref", name="uq_billing_invoice_provider_ref"))
    for name in ("store_id", "billing_account_id", "subscription_id", "status"):
        op.create_index(f"ix_billing_invoices_{name}", "billing_invoices", [name])

    op.create_table("billing_invoice_lines",
        sa.Column("id", UUID, primary_key=True), sa.Column("store_id", UUID, sa.ForeignKey("stores.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("invoice_id", UUID, sa.ForeignKey("billing_invoices.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("description", sa.String(500), nullable=False), sa.Column("quantity", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("unit_amount", MONEY, nullable=False), sa.Column("amount", MONEY, nullable=False),
        sa.Column("plan_id", UUID, sa.ForeignKey("plans.id", ondelete="SET NULL")),
        sa.Column("plan_price_id", UUID, sa.ForeignKey("plan_prices.id", ondelete="SET NULL")),
        sa.Column("period_start", sa.DateTime(timezone=True)), sa.Column("period_end", sa.DateTime(timezone=True)),
        sa.Column("metadata", JSON, nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()))
    op.create_index("ix_billing_invoice_lines_store_id", "billing_invoice_lines", ["store_id"])
    op.create_index("ix_billing_invoice_lines_invoice_id", "billing_invoice_lines", ["invoice_id"])

    op.create_table("billing_payments",
        sa.Column("id", UUID, primary_key=True), sa.Column("store_id", UUID, sa.ForeignKey("stores.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("billing_account_id", UUID, sa.ForeignKey("billing_accounts.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("subscription_id", UUID, sa.ForeignKey("store_subscriptions.id", ondelete="RESTRICT")),
        sa.Column("invoice_id", UUID, sa.ForeignKey("billing_invoices.id", ondelete="RESTRICT")),
        sa.Column("provider", sa.String(50), nullable=False), sa.Column("provider_payment_ref", sa.String(255), nullable=False),
        sa.Column("amount", MONEY, nullable=False), sa.Column("currency", sa.String(10), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="pending"),
        sa.Column("payment_type", sa.String(30), nullable=False, server_default="subscription"),
        sa.Column("paid_at", sa.DateTime(timezone=True)), sa.Column("failed_at", sa.DateTime(timezone=True)),
        sa.Column("refunded_amount", MONEY, nullable=False, server_default="0"),
        sa.Column("payment_method_summary", JSON, nullable=False, server_default="{}"),
        sa.Column("metadata", JSON, nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("provider", "provider_payment_ref", name="uq_billing_payment_provider_ref"))
    for name in ("store_id", "billing_account_id", "subscription_id", "invoice_id", "status"):
        op.create_index(f"ix_billing_payments_{name}", "billing_payments", [name])

    op.create_table("subscription_changes",
        sa.Column("id", UUID, primary_key=True), sa.Column("store_id", UUID, sa.ForeignKey("stores.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("subscription_id", UUID, sa.ForeignKey("store_subscriptions.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("from_plan_id", UUID, sa.ForeignKey("plans.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("to_plan_id", UUID, sa.ForeignKey("plans.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("target_plan_price_id", UUID, sa.ForeignKey("plan_prices.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("effective_at", sa.DateTime(timezone=True), nullable=False), sa.Column("status", sa.String(30), nullable=False),
        sa.Column("initiated_by_id", UUID, sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("provider_ref", sa.String(255)), sa.Column("reason", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()))
    for name in ("store_id", "subscription_id", "effective_at", "status"):
        op.create_index(f"ix_subscription_changes_{name}", "subscription_changes", [name])

    prices = {"starter": (0, 0), "growth": (2900, 29000), "pro": (7900, 79000)}
    bind = op.get_bind()
    plan_rows = bind.execute(sa.text("SELECT id, key, version FROM plans WHERE status='active' AND key IN ('starter','growth','pro')")).mappings()
    table = sa.table("plan_prices", sa.column("id"), sa.column("plan_id"), sa.column("key"), sa.column("billing_cycle"), sa.column("currency"), sa.column("amount"), sa.column("status"), sa.column("provider_mappings", JSON))
    rows = []
    for plan in plan_rows:
        for cycle, amount in zip(("monthly", "annual"), prices[plan["key"]], strict=True):
            rows.append({"id": uuid.uuid4(), "plan_id": plan["id"], "key": f"{plan['key']}-{cycle}-bdt-v{plan['version']}", "billing_cycle": cycle, "currency": "BDT", "amount": amount, "status": "active", "provider_mappings": {}})
    if rows:
        op.bulk_insert(table, rows)


def downgrade() -> None:
    for table in ("subscription_changes", "billing_payments", "billing_invoice_lines", "billing_invoices", "billing_provider_events", "billing_checkout_sessions", "store_subscriptions", "plan_prices", "billing_accounts"):
        op.drop_table(table)
