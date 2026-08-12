import os

from sqlalchemy import event, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Session, declared_attr, mapped_column, with_loader_criteria
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.core.tenant import current_organization_id, current_store_id


TENANT_OWNED_TABLES = frozenset({
    "accounts", "activity_logs", "attendance_records", "brands", "business_settings",
    "categories", "courier_api_logs", "courier_provider_settings", "couriers", "customer_activities",
    "customers", "designations", "employees", "inventory_items", "invoice_templates", "media_assets",
    "notifications", "order_events", "order_items", "orders", "petty_cash_entries", "product_variants",
    "products", "purchase_order_items", "purchase_orders", "return_items", "return_requests",
    "salary_advances", "salary_records", "shipment_events", "shipments", "stock_movements",
    "stock_transfer_items", "stock_transfers", "storefront_banners", "storefront_content_entries",
    "storefront_content_field_definitions", "storefront_content_models", "storefront_coupons",
    "storefront_custom_field_definitions", "storefront_custom_field_values", "storefront_media",
    "storefront_menu_items", "storefront_menus", "storefront_pages", "storefront_revisions",
    "storefront_saved_sections", "storefront_section_groups", "storefront_sections", "storefront_settings",
    "storefront_style_classes", "storefront_templates", "storefront_themes", "store_onboarding",
    "store_plan_assignments", "store_entitlement_overrides", "supplier_payments", "suppliers",
    "tasks", "transactions", "warehouses", "wastage_logs",
    "woocommerce_settings", "woocommerce_sync_logs",
    "store_subscriptions", "billing_checkout_sessions", "billing_payments",
    "billing_invoices", "billing_invoice_lines", "subscription_changes",
    "store_domains", "store_domain_certificates", "dns_zones", "dns_records", "dns_zone_revisions",
    "messaging_channels", "messaging_channel_secrets", "customer_channel_identities", "conversations",
    "conversation_messages", "conversation_attachments", "conversation_notes", "conversation_tags",
    "conversation_tag_links", "conversation_read_states", "conversation_order_links", "saved_replies",
    "messaging_oauth_states", "messaging_templates",
    "commerce_ai_settings", "ai_executions", "ai_tool_calls", "ai_usage_events", "ai_response_suggestions",
})


engine_options = {
    "echo": True if settings.APP_ENV == "development" else False,
}
if os.environ.get("AMAR_ECOM_TESTING") == "1":
    # TestClient creates independent event loops. NullPool prevents asyncpg
    # connections created by one portal loop from leaking into the next.
    engine_options["poolclass"] = NullPool

engine = create_async_engine(settings.DATABASE_URL, **engine_options)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    @declared_attr
    def store_id(cls):
        if getattr(cls, "__tablename__", None) not in TENANT_OWNED_TABLES:
            return None
        return mapped_column(UUID(as_uuid=True), nullable=False, index=True)


@event.listens_for(Session, "do_orm_execute")
def _scope_store_owned_selects(execute_state) -> None:
    store_id = current_store_id.get()
    if store_id is None or not execute_state.is_select or execute_state.execution_options.get("include_all_stores"):
        return
    tenant_classes = {
        entity
        for description in getattr(execute_state.statement, "column_descriptions", ())
        if (entity := description.get("entity")) is not None
        and getattr(entity, "__tablename__", None) in TENANT_OWNED_TABLES
    }
    for tenant_class in tenant_classes:
        execute_state.statement = execute_state.statement.options(
            with_loader_criteria(
                tenant_class,
                lambda entity: entity.store_id == store_id,
                include_aliases=True,
                track_closure_variables=False,
            )
        )
    if tenant_classes:
        return

    # Aggregate/projection statements such as ``select(func.count()).select_from(Product)``
    # do not expose an ORM entity in column_descriptions, so loader criteria cannot
    # protect them. Scope every tenant-owned FROM element explicitly as a second
    # boundary. This also covers aggregate joins without changing callers.
    tenant_froms = []
    seen: set[int] = set()

    def has_tenant_lineage(value, lineage_seen: set[int] | None = None) -> bool:
        lineage_seen = lineage_seen or set()
        if value is None or id(value) in lineage_seen:
            return False
        lineage_seen.add(id(value))
        if getattr(value, "name", None) in TENANT_OWNED_TABLES:
            return True
        return any(has_tenant_lineage(child, lineage_seen) for child in getattr(value, "get_children", lambda: ())())

    def collect(value) -> None:
        if value is None or id(value) in seen:
            return
        seen.add(id(value))
        columns = getattr(value, "c", None)
        name = getattr(value, "name", None)
        original = getattr(value, "original", None)
        if original is None:
            original = getattr(value, "element", None)
        original_name = getattr(original, "name", None)
        if columns is not None and "store_id" in columns and (
            name in TENANT_OWNED_TABLES
            or original_name in TENANT_OWNED_TABLES
            or has_tenant_lineage(original)
        ):
            tenant_froms.append(value)
            return
        for child in getattr(value, "get_children", lambda: ())():
            collect(child)

    for from_clause in execute_state.statement.get_final_froms():
        collect(from_clause)
    if tenant_froms:
        execute_state.statement = execute_state.statement.where(
            *(value.c.store_id == store_id for value in tenant_froms)
        )


@event.listens_for(Session, "before_flush")
def _assign_store_ownership(session, _flush_context, _instances) -> None:
    store_id = current_store_id.get()
    organization_id = current_organization_id.get()
    tenant_instances = [
        instance for instance in session.new
        if getattr(instance, "__tablename__", None) in TENANT_OWNED_TABLES
    ]
    if store_id is None and tenant_instances and os.environ.get("AMAR_ECOM_TESTING") == "1":
        # Legacy tests and data fixtures may construct rows outside an HTTP request.
        # Production code deliberately has no fallback: missing TenantContext must fail.
        fallback = session.connection().execute(
            text("SELECT id, organization_id FROM stores WHERE is_primary = true ORDER BY created_at LIMIT 1")
        ).one_or_none()
        if fallback:
            store_id, organization_id = fallback
    if store_id is None:
        if tenant_instances:
            raise RuntimeError("Store-owned writes require an active TenantContext")
        return
    for instance in tenant_instances:
        existing = getattr(instance, "store_id", None)
        if existing is not None and existing != store_id:
            raise ValueError("Cross-store ownership assignment is not allowed")
        instance.store_id = store_id
        if hasattr(instance, "organization_id") and getattr(instance, "organization_id", None) is None:
            if organization_id is not None:
                instance.organization_id = organization_id


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
