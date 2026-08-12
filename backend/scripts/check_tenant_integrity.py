"""Read-only tenant ownership diagnostic.

Run from backend with: venv/bin/python scripts/check_tenant_integrity.py
"""
import asyncio
import sys
from pathlib import Path

from sqlalchemy import text

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.database import AsyncSessionLocal, TENANT_OWNED_TABLES


CROSS_STORE_CHECKS = {
    "product_category": "SELECT count(*) FROM products p JOIN categories c ON c.id=p.category_id WHERE p.store_id<>c.store_id",
    "product_brand": "SELECT count(*) FROM products p JOIN brands b ON b.id=p.brand_id WHERE p.store_id<>b.store_id",
    "inventory_product": "SELECT count(*) FROM inventory_items i JOIN products p ON p.id=i.product_id WHERE i.store_id<>p.store_id",
    "inventory_warehouse": "SELECT count(*) FROM inventory_items i JOIN warehouses w ON w.id=i.warehouse_id WHERE i.store_id<>w.store_id",
    "order_customer": "SELECT count(*) FROM orders o JOIN customers c ON c.id=o.customer_id WHERE o.store_id<>c.store_id",
    "order_warehouse": "SELECT count(*) FROM orders o JOIN warehouses w ON w.id=o.warehouse_id WHERE o.store_id<>w.store_id",
    "product_template": "SELECT count(*) FROM products p JOIN storefront_templates t ON t.id=p.storefront_template_id WHERE p.store_id<>t.store_id",
    "category_template": "SELECT count(*) FROM categories c JOIN storefront_templates t ON t.id=c.storefront_template_id WHERE c.store_id<>t.store_id",
    "page_template": "SELECT count(*) FROM storefront_pages p JOIN storefront_templates t ON t.id=p.template_id WHERE p.store_id<>t.store_id",
    "billing_subscription_account": "SELECT count(*) FROM store_subscriptions s JOIN stores st ON st.id=s.store_id JOIN billing_accounts a ON a.id=s.billing_account_id WHERE st.organization_id<>a.organization_id",
    "billing_invoice_subscription": "SELECT count(*) FROM billing_invoices i JOIN store_subscriptions s ON s.id=i.subscription_id WHERE i.store_id<>s.store_id",
    "billing_invoice_account": "SELECT count(*) FROM billing_invoices i JOIN stores st ON st.id=i.store_id JOIN billing_accounts a ON a.id=i.billing_account_id WHERE st.organization_id<>a.organization_id",
    "billing_payment_subscription": "SELECT count(*) FROM billing_payments p JOIN store_subscriptions s ON s.id=p.subscription_id WHERE p.store_id<>s.store_id",
    "billing_line_invoice": "SELECT count(*) FROM billing_invoice_lines l JOIN billing_invoices i ON i.id=l.invoice_id WHERE l.store_id<>i.store_id",
    "billing_change_subscription": "SELECT count(*) FROM subscription_changes c JOIN store_subscriptions s ON s.id=c.subscription_id WHERE c.store_id<>s.store_id",
    "active_store_platform_domain": "SELECT count(*) FROM stores s WHERE s.status='active' AND NOT EXISTS (SELECT 1 FROM store_domains d WHERE d.store_id=s.id AND d.domain_type='platform_subdomain')",
    "domain_hostname_duplicate": "SELECT count(*) FROM (SELECT hostname FROM store_domains GROUP BY hostname HAVING count(*)>1) duplicates",
    "domain_primary_duplicate": "SELECT count(*) FROM (SELECT store_id FROM store_domains WHERE is_primary=true GROUP BY store_id HAVING count(*)>1) duplicates",
    "domain_certificate_store": "SELECT count(*) FROM store_domain_certificates c JOIN store_domains d ON d.id=c.store_domain_id WHERE c.store_id<>d.store_id",
    "active_custom_domain_readiness": "SELECT count(*) FROM store_domains WHERE domain_type='custom' AND status='active' AND (verification_status<>'verified' OR routing_status<>'valid' OR ssl_status<>'active')",
    "primary_domain_redirect": "SELECT count(*) FROM store_domains WHERE is_primary=true AND redirect_to_primary=true",
    "dns_zone_domain_store": "SELECT count(*) FROM dns_zones z JOIN store_domains d ON d.id=z.store_domain_id WHERE z.store_id<>d.store_id",
    "dns_zone_organization": "SELECT count(*) FROM dns_zones z JOIN stores s ON s.id=z.store_id WHERE z.organization_id<>s.organization_id",
    "dns_record_zone_store": "SELECT count(*) FROM dns_records r JOIN dns_zones z ON z.id=r.zone_id WHERE r.store_id<>z.store_id",
    "dns_revision_zone_store": "SELECT count(*) FROM dns_zone_revisions r JOIN dns_zones z ON z.id=r.zone_id WHERE r.store_id<>z.store_id",
    "messaging_channel_organization": "SELECT count(*) FROM messaging_channels c JOIN stores s ON s.id=c.store_id WHERE c.organization_id<>s.organization_id",
    "messaging_secret_channel": "SELECT count(*) FROM messaging_channel_secrets s JOIN messaging_channels c ON c.id=s.channel_id WHERE s.store_id<>c.store_id",
    "messaging_identity_channel": "SELECT count(*) FROM customer_channel_identities i JOIN messaging_channels c ON c.id=i.channel_id WHERE i.store_id<>c.store_id",
    "messaging_identity_customer": "SELECT count(*) FROM customer_channel_identities i JOIN customers c ON c.id=i.customer_id WHERE i.store_id<>c.store_id",
    "messaging_conversation_channel": "SELECT count(*) FROM conversations v JOIN messaging_channels c ON c.id=v.channel_id WHERE v.store_id<>c.store_id OR v.organization_id<>c.organization_id",
    "messaging_conversation_identity": "SELECT count(*) FROM conversations v JOIN customer_channel_identities i ON i.id=v.identity_id WHERE v.store_id<>i.store_id",
    "messaging_conversation_customer": "SELECT count(*) FROM conversations v JOIN customers c ON c.id=v.customer_id WHERE v.store_id<>c.store_id",
    "messaging_message_conversation": "SELECT count(*) FROM conversation_messages m JOIN conversations v ON v.id=m.conversation_id WHERE m.store_id<>v.store_id OR m.channel_id<>v.channel_id",
    "messaging_note_conversation": "SELECT count(*) FROM conversation_notes n JOIN conversations v ON v.id=n.conversation_id WHERE n.store_id<>v.store_id",
    "messaging_tag_link": "SELECT count(*) FROM conversation_tag_links l JOIN conversations v ON v.id=l.conversation_id JOIN conversation_tags t ON t.id=l.tag_id WHERE l.store_id<>v.store_id OR l.store_id<>t.store_id",
    "messaging_read_state": "SELECT count(*) FROM conversation_read_states r JOIN conversations v ON v.id=r.conversation_id WHERE r.store_id<>v.store_id",
    "messaging_order_link": "SELECT count(*) FROM conversation_order_links l JOIN conversations v ON v.id=l.conversation_id JOIN orders o ON o.id=l.order_id WHERE l.store_id<>v.store_id OR l.store_id<>o.store_id",
    "messaging_oauth_state": "SELECT count(*) FROM messaging_oauth_states o JOIN stores s ON s.id=o.store_id WHERE o.organization_id<>s.organization_id",
    "messaging_template_channel": "SELECT count(*) FROM messaging_templates t JOIN messaging_channels c ON c.id=t.channel_id WHERE t.store_id<>c.store_id",
    "messaging_event_channel": "SELECT count(*) FROM messaging_provider_events e JOIN messaging_channels c ON c.id=e.channel_id WHERE e.channel_id IS NOT NULL AND (e.store_id<>c.store_id OR e.external_asset_ref<>c.external_account_ref)",
    "ai_settings_organization": "SELECT count(*) FROM commerce_ai_settings a JOIN stores s ON s.id=a.store_id WHERE a.organization_id<>s.organization_id",
    "ai_execution_conversation": "SELECT count(*) FROM ai_executions a JOIN conversations c ON c.id=a.conversation_id WHERE a.store_id<>c.store_id OR a.organization_id<>c.organization_id",
    "ai_execution_trigger": "SELECT count(*) FROM ai_executions a JOIN conversation_messages m ON m.id=a.triggering_message_id WHERE a.store_id<>m.store_id OR a.conversation_id<>m.conversation_id",
    "ai_tool_execution": "SELECT count(*) FROM ai_tool_calls t JOIN ai_executions a ON a.id=t.execution_id WHERE t.store_id<>a.store_id",
    "ai_usage_execution": "SELECT count(*) FROM ai_usage_events u JOIN ai_executions a ON a.id=u.execution_id WHERE u.store_id<>a.store_id OR u.organization_id<>a.organization_id",
    "ai_suggestion_execution": "SELECT count(*) FROM ai_response_suggestions s JOIN ai_executions a ON a.id=s.execution_id WHERE s.store_id<>a.store_id OR s.conversation_id<>a.conversation_id",
}


async def main() -> int:
    problems: list[str] = []
    async with AsyncSessionLocal() as db:
        for table in sorted(TENANT_OWNED_TABLES):
            count = await db.scalar(text(f'SELECT count(*) FROM "{table}" WHERE store_id IS NULL'))
            if count:
                problems.append(f"{table}: {count} rows have NULL store_id")
        for label, query in CROSS_STORE_CHECKS.items():
            count = await db.scalar(text(query))
            if count:
                problems.append(f"{label}: {count} cross-store relationships")
    if problems:
        print("Tenant integrity check FAILED")
        for problem in problems:
            print(f"- {problem}")
        return 1
    print(f"Tenant integrity check passed for {len(TENANT_OWNED_TABLES)} tenant-owned tables.")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
