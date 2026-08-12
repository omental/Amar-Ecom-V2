"""add multitenant foundation

Revision ID: d6e7f8a9b0c1
Revises: c5d6e7f8a9b0
"""
from __future__ import annotations

import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "d6e7f8a9b0c1"
down_revision = "c5d6e7f8a9b0"
branch_labels = None
depends_on = None

TENANT_TABLES = (
    "accounts", "activity_logs", "attendance_records", "brands", "business_settings", "categories",
    "courier_api_logs", "courier_provider_settings", "couriers", "customer_activities", "customers",
    "designations", "employees", "inventory_items", "invoice_templates", "media_assets", "notifications",
    "order_events", "order_items", "orders", "petty_cash_entries", "product_variants", "products",
    "purchase_order_items", "purchase_orders", "return_items", "return_requests", "salary_advances",
    "salary_records", "shipment_events", "shipments", "stock_movements", "stock_transfer_items",
    "stock_transfers", "storefront_banners", "storefront_content_entries",
    "storefront_content_field_definitions", "storefront_content_models", "storefront_coupons",
    "storefront_custom_field_definitions", "storefront_custom_field_values", "storefront_media",
    "storefront_menu_items", "storefront_menus", "storefront_pages", "storefront_revisions",
    "storefront_saved_sections", "storefront_section_groups", "storefront_sections", "storefront_settings",
    "storefront_style_classes", "storefront_templates", "storefront_themes", "supplier_payments",
    "suppliers", "tasks", "transactions", "warehouses", "wastage_logs", "woocommerce_settings",
    "woocommerce_sync_logs",
)

SCOPED_UNIQUE_INDEXES = (
    ("brands", "ix_brands_slug", ("slug",), None),
    ("categories", "ix_categories_slug", ("slug",), None),
    ("warehouses", "ix_warehouses_code", ("code",), None),
    ("orders", "ix_orders_order_number", ("order_number",), None),
    ("products", "ix_products_sku", ("sku",), None),
    ("products", "ix_products_slug", ("slug",), None),
    ("product_variants", "ix_product_variants_sku", ("sku",), None),
    ("couriers", "ix_couriers_code", ("code",), None),
    ("shipments", "ix_shipments_shipment_number", ("shipment_number",), None),
    ("employees", "ix_employees_employee_code", ("employee_code",), None),
    ("accounts", "ix_accounts_code", ("code",), None),
    ("transactions", "ix_transactions_transaction_number", ("transaction_number",), None),
    ("petty_cash_entries", "ix_petty_cash_entries_entry_number", ("entry_number",), None),
    ("supplier_payments", "ix_supplier_payments_payment_number", ("payment_number",), None),
    ("stock_transfers", "ix_stock_transfers_transfer_number", ("transfer_number",), None),
    ("wastage_logs", "ix_wastage_logs_wastage_number", ("wastage_number",), None),
    ("storefront_coupons", "ix_storefront_coupons_code", ("code",), None),
    ("return_requests", "ix_return_requests_return_number", ("return_number",), None),
    ("invoice_templates", "ix_invoice_templates_slug", ("slug",), None),
    ("purchase_orders", "ix_purchase_orders_po_number", ("po_number",), None),
    ("courier_provider_settings", "ix_courier_provider_settings_provider", ("provider",), None),
    ("storefront_pages", "ix_storefront_pages_slug", ("slug",), None),
    ("storefront_content_models", "ix_storefront_content_models_key", ("key",), None),
    ("storefront_themes", "ix_storefront_themes_key", ("key",), None),
    ("storefront_themes", "uq_storefront_one_published_theme", ("status",), "status = 'published'"),
)


def upgrade() -> None:
    bind = op.get_bind()
    organization_id = uuid.uuid4()
    store_id = uuid.uuid4()
    organization_name = bind.execute(
        sa.text("SELECT company_name FROM business_settings ORDER BY created_at LIMIT 1")
    ).scalar() or "Amar-eCom"

    op.create_table(
        "organizations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(100), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("slug", name="uq_organizations_slug"),
    )
    op.create_index("ix_organizations_slug", "organizations", ["slug"], unique=True)
    op.create_index("ix_organizations_status", "organizations", ["status"])
    op.create_table(
        "stores",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(100), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="active"),
        sa.Column("timezone", sa.String(100), nullable=False, server_default="Asia/Dhaka"),
        sa.Column("locale", sa.String(20), nullable=False, server_default="en-BD"),
        sa.Column("default_currency", sa.String(10), nullable=False, server_default="BDT"),
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("slug", name="uq_stores_slug"),
    )
    op.create_index("ix_stores_organization_id", "stores", ["organization_id"])
    op.create_index("ix_stores_slug", "stores", ["slug"], unique=True)
    op.create_index("ix_stores_status", "stores", ["status"])

    bind.execute(sa.text("INSERT INTO organizations (id, name, slug, status) VALUES (:id, :name, 'amar-ecom', 'active')"), {"id": organization_id, "name": organization_name})
    bind.execute(sa.text("""
        INSERT INTO stores (id, organization_id, name, slug, status, timezone, locale, default_currency, is_primary)
        VALUES (:id, :organization_id, :name, 'main-store', 'active',
          COALESCE((SELECT timezone FROM business_settings ORDER BY created_at LIMIT 1), 'Asia/Dhaka'),
          'en-BD', COALESCE((SELECT currency FROM business_settings ORDER BY created_at LIMIT 1), 'BDT'), true)
    """), {"id": store_id, "organization_id": organization_id, "name": organization_name})

    op.create_table(
        "organization_members",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(30), nullable=False, server_default="member"),
        sa.Column("status", sa.String(30), nullable=False, server_default="active"),
        sa.Column("invited_at", sa.DateTime(timezone=True)),
        sa.Column("joined_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("organization_id", "user_id", name="uq_organization_member_user"),
    )
    for column in ("organization_id", "user_id", "status"):
        op.create_index(f"ix_organization_members_{column}", "organization_members", [column])
    op.create_table(
        "store_members",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("store_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("stores.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(30), nullable=False, server_default="staff"),
        sa.Column("status", sa.String(30), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("store_id", "user_id", name="uq_store_member_user"),
    )
    for column in ("store_id", "user_id", "status"):
        op.create_index(f"ix_store_members_{column}", "store_members", [column])

    bind.execute(sa.text("""
        INSERT INTO organization_members (id, organization_id, user_id, role, status, joined_at)
        SELECT gen_random_uuid(), :organization_id, id,
          CASE WHEN role IN ('admin', 'super_admin') THEN 'owner' ELSE 'member' END, 'active', now()
        FROM users
    """), {"organization_id": organization_id})
    bind.execute(sa.text("""
        INSERT INTO store_members (id, store_id, user_id, role, status)
        SELECT gen_random_uuid(), :store_id, id,
          CASE WHEN role IN ('admin', 'super_admin') THEN 'admin' ELSE 'staff' END, 'active'
        FROM users
    """), {"store_id": store_id})

    for table in TENANT_TABLES:
        op.add_column(table, sa.Column("store_id", postgresql.UUID(as_uuid=True), nullable=True))
        bind.execute(sa.text(f'UPDATE "{table}" SET store_id = :store_id WHERE store_id IS NULL'), {"store_id": store_id})
        if bind.execute(sa.text(f'SELECT count(*) FROM "{table}" WHERE store_id IS NULL')).scalar_one():
            raise RuntimeError(f"Tenant migration left unassigned rows in {table}")
        op.alter_column(table, "store_id", nullable=False)
        op.create_foreign_key(f"fk_{table}_store_id", table, "stores", ["store_id"], ["id"], ondelete="RESTRICT")
        op.create_index(f"ix_{table}_store_id", table, ["store_id"])

    for table, old_index, columns, predicate in SCOPED_UNIQUE_INDEXES:
        op.drop_index(old_index, table_name=table)
        op.create_index(f"uq_{table}_store_{'_'.join(columns)}", table, ("store_id", *columns), unique=True, postgresql_where=sa.text(predicate) if predicate else None)

    op.drop_constraint("uq_storefront_custom_field_owner_key", "storefront_custom_field_definitions", type_="unique")
    op.create_unique_constraint("uq_storefront_custom_field_store_owner_key", "storefront_custom_field_definitions", ["store_id", "owner_type", "namespace", "key"])


def downgrade() -> None:
    op.drop_constraint("uq_storefront_custom_field_store_owner_key", "storefront_custom_field_definitions", type_="unique")
    op.create_unique_constraint("uq_storefront_custom_field_owner_key", "storefront_custom_field_definitions", ["owner_type", "namespace", "key"])
    for table, old_index, columns, predicate in reversed(SCOPED_UNIQUE_INDEXES):
        op.drop_index(f"uq_{table}_store_{'_'.join(columns)}", table_name=table)
        op.create_index(old_index, table, columns, unique=True, postgresql_where=sa.text(predicate) if predicate else None)
    for table in reversed(TENANT_TABLES):
        op.drop_index(f"ix_{table}_store_id", table_name=table)
        op.drop_constraint(f"fk_{table}_store_id", table, type_="foreignkey")
        op.drop_column(table, "store_id")
    op.drop_table("store_members")
    op.drop_table("organization_members")
    op.drop_table("stores")
    op.drop_table("organizations")
