"""Repeatable, non-destructive full-platform QA against the Phase 15.5A seed."""

from __future__ import annotations

import json
import os
import subprocess
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from enum import StrEnum
from pathlib import Path
from typing import Any, Awaitable, Callable
from uuid import UUID, uuid4

from fastapi import HTTPException
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.tenant import tenant_scope
from app.models import (
    AIExecution, AIUsageEvent, AttendanceRecord, BillingInvoice, BillingPayment, Brand,
    Category, CommerceAISettings, Conversation, ConversationMessage, ConversationNote,
    ConversationOrderLink, Courier, Customer, CustomerActivity, DnsRecord, DnsZone,
    Employee, InventoryItem, MediaAsset, MessagingChannel, MessagingChannelSecret,
    MessagingTemplate, Order, OrderItem, Product, ProductVariant, PurchaseOrder,
    ReturnRequest, SalaryRecord, Shipment, StockTransfer, Store, StoreDomain,
    StorePlanAssignment, StoreSubscription, StorefrontContentModel,
    StorefrontCustomFieldDefinition, StorefrontSavedSection, StorefrontSection,
    StorefrontStyleClass, StorefrontTemplate, StorefrontTheme, Supplier, Transaction,
    User, WastageLog, Warehouse,
)
from app.services.ai_agent import CommerceAIAgent
from app.services.ai_provider import AIProviderTurn, AIToolRequest, TestAIProvider
from app.services.ai_tools import AI_TOOL_REGISTRY, AIToolContext, AIToolValidationError, validate_tool_arguments
from app.services.billing_service import reconcile_subscription
from app.services.commercial_access_service import EntitlementService, UsageService
from app.services.demo_seed_service import DemoSeedSafetyError, assert_demo_seed_allowed, verify_demo_platform
from app.services.dns_provider import ProviderZone, TestDnsProvider
from app.services.dns_service import DnsService
from app.services.messaging_credentials import MessagingCredentialVault
from app.services.messaging_provider import InboundMessage
from app.services.messaging_service import (
    add_note, commerce_context, ingest_inbound, list_conversations, search_products, send_message,
)
from app.services.permission_service import get_user_permissions
from app.services.store_domain_service import get_primary_domain, get_storefront_url_for_hostname
from app.services.storefront_theme_service import resolve_template, theme_graph_stmt, theme_snapshot
from app.services.tenant_service import StoreResolver
from scripts.demo_seed_manifest import CANONICAL, SEED_VERSION, TECHNEST, URBAN, fixture_uuid


class QAStatus(StrEnum):
    PASS = "PASS"
    FAIL = "FAIL"
    SKIP = "SKIP"
    WARN = "WARN"


@dataclass(slots=True)
class QAEvidence:
    expected: Any = None
    actual: Any = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class QACheckResult:
    key: str
    group: str
    description: str
    status: QAStatus
    duration_seconds: float
    expected: Any = None
    actual: Any = None
    error: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


CheckHandler = Callable[[], Awaitable[QAEvidence]]


@dataclass(frozen=True, slots=True)
class QACheck:
    key: str
    group: str
    description: str
    handler: CheckHandler
    required: bool = True


@dataclass(slots=True)
class QAReport:
    environment: str
    mode: str
    started_at: str
    completed_at: str
    duration_seconds: float
    git_head: str | None
    alembic_head: str
    seed_version: str
    seed_verification: dict[str, Any]
    results: list[QACheckResult]
    known_external_limitations: list[str]

    @property
    def totals(self) -> dict[str, int]:
        return {status.value: sum(row.status == status for row in self.results) for status in QAStatus}

    @property
    def failed(self) -> bool:
        return any(row.status == QAStatus.FAIL for row in self.results)

    @property
    def groups(self) -> list[dict[str, Any]]:
        summaries = []
        for group in dict.fromkeys(row.group for row in self.results):
            rows = [row for row in self.results if row.group == group]
            summaries.append({
                "name": group,
                "duration_seconds": sum(row.duration_seconds for row in rows),
                "totals": {status.value: sum(row.status == status for row in rows) for status in QAStatus},
            })
        return summaries

    def as_dict(self) -> dict[str, Any]:
        value = asdict(self)
        value["totals"] = self.totals
        value["groups"] = self.groups
        value["results"] = [{**asdict(row), "status": row.status.value} for row in self.results]
        return _json_safe(value)

    def markdown(self) -> str:
        totals = self.totals
        lines = [
            "# Amar deterministic full-platform QA",
            "",
            f"- Environment: `{self.environment}`",
            f"- Mode: `{self.mode}`",
            f"- Seed: `{self.seed_version}`",
            f"- Alembic: `{self.alembic_head}`",
            f"- Git: `{self.git_head or 'unavailable'}`",
            f"- Duration: `{self.duration_seconds:.3f}s`",
            f"- Totals: **{totals['PASS']} PASS / {totals['FAIL']} FAIL / {totals['WARN']} WARN / {totals['SKIP']} SKIP**",
            "",
        ]
        for group in dict.fromkeys(row.group for row in self.results):
            lines.extend((f"## {group}", ""))
            for row in (item for item in self.results if item.group == group):
                lines.append(f"- **{row.status.value}** `{row.key}` — {row.description} ({row.duration_seconds:.3f}s)")
                if row.status == QAStatus.FAIL:
                    lines.append(f"  - Expected: `{_compact(row.expected)}`")
                    lines.append(f"  - Actual: `{_compact(row.actual)}`")
                    lines.append(f"  - Error: {row.error or 'assertion failed'}")
                elif row.status in {QAStatus.WARN, QAStatus.SKIP} and row.error:
                    lines.append(f"  - Reason: {row.error}")
            lines.append("")
        lines.extend(("## External limitations", ""))
        lines.extend(f"- {item}" for item in self.known_external_limitations)
        lines.append("")
        return "\n".join(lines)


class QAFailure(AssertionError):
    def __init__(self, message: str, *, expected: Any = None, actual: Any = None) -> None:
        super().__init__(message)
        self.expected = expected
        self.actual = actual


class QASkip(RuntimeError):
    pass


class QAWarn(RuntimeError):
    pass


def require(condition: bool, message: str, *, expected: Any = None, actual: Any = None) -> None:
    if not condition:
        raise QAFailure(message, expected=expected, actual=actual)


def _json_safe(value: Any) -> Any:
    return json.loads(json.dumps(value, default=str))


def _compact(value: Any) -> str:
    return json.dumps(_json_safe(value), separators=(",", ":"), ensure_ascii=False)[:1000]


def _git_head() -> str | None:
    try:
        return subprocess.run(
            ["git", "rev-parse", "HEAD"], cwd=Path(__file__).resolve().parents[3],
            check=True, capture_output=True, text=True, timeout=2,
        ).stdout.strip() or None
    except Exception:
        return None


class DemoPlatformQARunner:
    EXTERNAL_LIMITATIONS = [
        "Real Meta Page/WABA connectivity is not exercised; deterministic test channels only.",
        "Real OpenAI is forbidden in deterministic QA; TestAIProvider only.",
        "PowerDNS, public DNS delegation, DNSSEC, and public TLS are not externally verified.",
        "Production billing, courier, SMTP, and certificate providers are not contacted.",
        "Interactive browser QA requires a separately available browser runtime.",
    ]

    def __init__(self, *, mode: str = "full", checks: list[QACheck] | None = None, require_seed: bool = True) -> None:
        assert_demo_seed_allowed()
        self.mode = mode
        self.require_seed = require_seed
        self.checks = checks if checks is not None else self._checks(mode)

    async def run(self) -> QAReport:
        started = datetime.now(timezone.utc)
        seed_facts: dict[str, Any] = {}
        alembic_head = "unavailable"
        if self.require_seed:
            async with AsyncSessionLocal() as db:
                seed_facts = await verify_demo_platform(db)
                alembic_head = str(await db.scalar(text("SELECT version_num FROM alembic_version")) or "unavailable")
        results = [await self._execute(check) for check in self.checks]
        completed = datetime.now(timezone.utc)
        return QAReport(
            environment=settings.APP_ENV, mode=self.mode, started_at=started.isoformat(), completed_at=completed.isoformat(),
            duration_seconds=(completed - started).total_seconds(), git_head=_git_head(), alembic_head=alembic_head,
            seed_version=str(seed_facts.get("seed_version") or SEED_VERSION), seed_verification=seed_facts,
            results=results, known_external_limitations=list(self.EXTERNAL_LIMITATIONS),
        )

    async def _execute(self, check: QACheck) -> QACheckResult:
        started = time.perf_counter()
        try:
            evidence = await check.handler()
            status, error = QAStatus.PASS, None
        except QASkip as exc:
            evidence, status, error = QAEvidence(), QAStatus.SKIP, str(exc)
        except QAWarn as exc:
            evidence, status, error = QAEvidence(), QAStatus.WARN, str(exc)
        except QAFailure as exc:
            evidence = QAEvidence(exc.expected, exc.actual)
            status, error = (QAStatus.FAIL if check.required else QAStatus.WARN), str(exc)
        except Exception as exc:
            evidence = QAEvidence()
            status, error = (QAStatus.FAIL if check.required else QAStatus.WARN), f"{exc.__class__.__name__}: {str(exc)[:500]}"
        return QACheckResult(
            check.key, check.group, check.description, status, time.perf_counter() - started,
            evidence.expected, evidence.actual, error, evidence.metadata,
        )

    def _checks(self, mode: str) -> list[QACheck]:
        tenant = [
            QACheck("seed.canonical", "00 Seed", "Canonical seed truth is present", self.check_seed),
            QACheck("tenancy.relationships", "01 Tenancy", "Organizations, Stores, and switching contexts are isolated", self.check_tenancy),
            QACheck("permissions.matrix", "02 Permissions", "Demo staff permission matrix enforces least privilege", self.check_permissions),
            QACheck("tenant.gauntlet", "23 Cross-Tenant Gauntlet", "TechNest cannot resolve Urban resources across tenant-owned models", self.check_cross_tenant),
            QACheck("tenant.reverse", "23 Cross-Tenant Gauntlet", "Urban cannot resolve representative TechNest resources", self.check_reverse_tenant),
        ]
        ai = [
            QACheck("ai.defaults-boundary", "22 AI", "AI modes, entitlements, usage, and tool allowlist are safe", self.check_ai_defaults),
            QACheck("ai.grounded-product", "22 AI", "Deterministic AI grounds canonical stock and price", self.check_ai_grounding),
            QACheck("ai.stock-price-refresh", "22 AI", "AI observes temporary current stock and price then rollback restores truth", self.check_ai_mutation),
            QACheck("ai.order-privacy", "22 AI", "Order status is grounded and unrelated orders remain private", self.check_ai_orders),
            QACheck("ai.handoff-injection", "22 AI", "Human, mutation, cancellation, and injection inputs hand off safely", self.check_ai_handoffs),
            QACheck("ai.channel-race-limits", "22 AI", "Closed windows, malformed tools, loops, quota, idempotency, and stale responses are safe", self.check_ai_policy_edges),
        ]
        core = [
            QACheck("products.canonical", "03 Products", "Canonical Product, Variant, overlapping slug, and search are Store-scoped", self.check_products),
            QACheck("inventory.truth", "04 Inventory", "Warehouse truth, low-stock, and out-of-stock agree with AI inventory", self.check_inventory),
            QACheck("inventory.mutation", "04 Inventory", "Stock mutation is visible and rolled back", self.check_inventory_mutation),
            QACheck("procurement.fixtures", "05 Procurement", "Suppliers, POs, transfers, and wastage are internally consistent", self.check_procurement),
            QACheck("orders.canonical", "06 Orders", "UT-1042, checkout scoping, and privacy fixtures are correct", self.check_orders),
            QACheck("returns.relationships", "07 Returns", "Returns reference same-Store orders, customers, and items", self.check_returns),
            QACheck("logistics.tracking", "08 Logistics", "UT-1042 resolves deterministic courier tracking", self.check_logistics),
            QACheck("pos.scoped", "09 POS", "POS-sourced Orders use supported Store-scoped representation", self.check_pos),
            QACheck("crm.rahim", "10 CRM", "Rahim CRM, orders, and Inbox identity are connected", self.check_crm),
            QACheck("finance.scoped", "11 Finance", "Finance fixtures are valid and Store-scoped", self.check_finance),
            QACheck("hr.scoped", "12 HR", "Employees, attendance, payroll, and HR permissions are coherent", self.check_hr),
            QACheck("builder.graph", "13 Builder", "Published/draft Theme graphs and Builder features load safely", self.check_builder),
            QACheck("storefront.resolution", "14 Storefront", "Domain resolver, template, canonical URL, and unknown hosts are safe", self.check_storefront),
            QACheck("dynamic-data.scoped", "15 Dynamic Data", "Custom fields, content model, and query loops remain Store-scoped", self.check_dynamic_data),
            QACheck("commercial.effective", "16 Commercial", "Effective entitlements come from the commercial service", self.check_commercial),
            QACheck("billing.lifecycle", "17 Billing", "Subscription, invoice, payment, grace, and bridge state are deterministic", self.check_billing),
            QACheck("domains.invariants", "18 Domains", "Hosted/custom primary domain invariants are intact", self.check_domains),
            QACheck("dns.control-plane", "19 Amar DNS", "Test DNS records, locking, reconciliation, and mail preservation pass", self.check_dns),
            QACheck("inbox.integration", "20 Inbox", "Filters, notes, commerce context, search, and links operate Store-safely", self.check_inbox),
            QACheck("meta.deterministic", "21 Meta", "Test Meta channels, templates, vault, and inbound idempotency pass", self.check_meta),
            QACheck("security.host-provider", "24 Security Regression", "Host, provider, and tool authority boundaries fail closed", self.check_security),
            QACheck("browser.runtime", "25 Browser", "Interactive browser QA", self.check_browser, required=False),
            QACheck("external.providers", "26 External", "External production providers are explicitly not claimed", self.check_external, required=False),
        ]
        if mode == "tenant": return tenant
        if mode == "ai": return [core[0], core[1], core[12], core[17], core[18], *ai]
        if mode == "quick": return [*tenant[:3], *core[0:2], core[4], core[12], core[13], core[15], core[17], core[18], ai[0]]
        return [*tenant[:3], *core, *ai, *tenant[3:]]

    async def check_seed(self) -> QAEvidence:
        async with AsyncSessionLocal() as db:
            facts = await verify_demo_platform(db)
        return QAEvidence({"stock_total": 15, "price": "2490.00", "order_status": "shipped"}, facts)

    async def check_tenancy(self) -> QAEvidence:
        async with AsyncSessionLocal() as db:
            urban, tech = await db.get(Store, URBAN["store_id"]), await db.get(Store, TECHNEST["store_id"])
            require(urban is not None and tech is not None, "Demo Stores missing")
            require(urban.organization_id == URBAN["organization_id"] and tech.organization_id == TECHNEST["organization_id"], "Store ownership mismatch")
            with tenant_scope(store_id=urban.id, organization_id=urban.organization_id):
                urban_count = int(await db.scalar(select(func.count()).select_from(Product)) or 0)
            with tenant_scope(store_id=tech.id, organization_id=tech.organization_id):
                tech_count = int(await db.scalar(select(func.count()).select_from(Product)) or 0)
            require((urban_count, tech_count) == (40, 12), "Tenant switching returned stale Product state", expected=[40, 12], actual=[urban_count, tech_count])
        return QAEvidence([40, 12], [urban_count, tech_count])

    async def check_permissions(self) -> QAEvidence:
        expectations = {
            URBAN["owner_email"]: ({"inbox.channels", "finance.view", "hr.view", "online_store.update"}, set()),
            URBAN["manager_email"]: ({"orders.update", "inbox.channels", "hr.view"}, {"permissions.view"}),
            URBAN["support_email"]: ({"inbox.view", "inbox.reply", "inbox.notes", "customers.view"}, {"inbox.channels", "finance.view", "hr.view", "settings.update"}),
            URBAN["inventory_email"]: ({"products.view", "inventory.update", "warehouses.update", "purchase_orders.update"}, {"finance.view", "hr.view", "inbox.channels"}),
            URBAN["hr_email"]: ({"hr.view", "tasks.view"}, {"inbox.channels", "finance.view", "settings.update"}),
            URBAN["restricted_email"]: ({"dashboard.view"}, {"orders.view", "inbox.view", "hr.view", "finance.view"}),
        }
        actual: dict[str, int] = {}
        async with AsyncSessionLocal() as db:
            for email, (allowed, denied) in expectations.items():
                user = await db.scalar(select(User).where(User.email == email))
                keys = set(await get_user_permissions(db, user.id)) if user else set()
                require(user is not None and allowed.issubset(keys) and keys.isdisjoint(denied), f"Permission matrix mismatch for {email}", expected={"allow": sorted(allowed), "deny": sorted(denied)}, actual=sorted(keys))
                actual[email] = len(keys)
        return QAEvidence("all allow/deny sets enforced", actual)

    async def check_products(self) -> QAEvidence:
        async with AsyncSessionLocal() as db:
            with tenant_scope(store_id=URBAN["store_id"], organization_id=URBAN["organization_id"]):
                product = await db.get(Product, URBAN["oxford_product_id"])
                variant = await db.get(ProductVariant, URBAN["oxford_variant_id"])
                found = await search_products(db, store_id=URBAN["store_id"], query="Classic Oxford", limit=5)
                urban_gift = await db.scalar(select(Product).where(Product.slug == "gift-card"))
                category = await db.get(Category, product.category_id) if product else None
                brand = await db.get(Brand, product.brand_id) if product else None
                require(product is not None and variant is not None and category is not None and brand is not None, "Canonical Product relationships missing")
                require(variant.product_id == product.id and variant.sku == CANONICAL["sku"] and variant.price == Decimal("2490.00"), "Canonical Variant mismatch")
                require(any(row["product"].id == product.id for row in found), "Production Inbox Product search did not find Oxford")
            with tenant_scope(store_id=TECHNEST["store_id"], organization_id=TECHNEST["organization_id"]):
                tech_gift = await db.scalar(select(Product).where(Product.slug == "gift-card"))
                leaked = await db.scalar(select(Product).where(Product.id == URBAN["oxford_product_id"]))
                tech_search = await search_products(db, store_id=TECHNEST["store_id"], query="Classic Oxford", limit=5)
                require(tech_gift is not None and urban_gift is not None and tech_gift.id != urban_gift.id, "Same-slug fixtures are not independent")
                require(leaked is None and not tech_search, "Oxford leaked into TechNest search")
        return QAEvidence(CANONICAL["sku"], variant.sku, {"category": category.name, "brand": brand.name, "overlap_slug": "gift-card"})

    async def _tool_context(self, db: AsyncSession, subject: str) -> tuple[Conversation, AIToolContext]:
        conversation = await db.scalar(select(Conversation).where(Conversation.subject == subject).options(selectinload(Conversation.channel)))
        require(conversation is not None, f"Conversation {subject} missing")
        return conversation, AIToolContext(db, conversation.store_id, conversation.organization_id, conversation)

    async def check_inventory(self) -> QAEvidence:
        async with AsyncSessionLocal() as db:
            with tenant_scope(store_id=URBAN["store_id"], organization_id=URBAN["organization_id"]):
                rows = (await db.execute(select(Warehouse.name, InventoryItem.quantity).join(InventoryItem, InventoryItem.warehouse_id == Warehouse.id).where(InventoryItem.variant_id == URBAN["oxford_variant_id"]))).all()
                stock = {name: quantity for name, quantity in rows}
                _, ctx = await self._tool_context(db, "Stock")
                ai_stock = await AI_TOOL_REGISTRY["check_stock"].handler(ctx, AI_TOOL_REGISTRY["check_stock"].input_model(variant_ref=URBAN["oxford_variant_id"]))
                low_variant = await db.scalar(select(ProductVariant).where(ProductVariant.sku == "UT-POLO-NVY-M"))
                zero_variant = await db.scalar(select(ProductVariant).where(ProductVariant.sku == "UT-DEN-BLK-XL"))
                low = await AI_TOOL_REGISTRY["check_stock"].handler(ctx, AI_TOOL_REGISTRY["check_stock"].input_model(variant_ref=low_variant.id))
                zero = await AI_TOOL_REGISTRY["check_stock"].handler(ctx, AI_TOOL_REGISTRY["check_stock"].input_model(variant_ref=zero_variant.id))
                require(stock == CANONICAL["warehouses"] and sum(stock.values()) == 15, "Canonical warehouse truth mismatch", expected=CANONICAL["warehouses"], actual=stock)
                require(ai_stock.get("in_stock") is True and low.get("availability") == "low_stock" and zero.get("availability") == "out_of_stock", "Production AI inventory projections disagree")
        return QAEvidence({"total": 15, "low": "low_stock", "zero": "out_of_stock"}, {"total": sum(stock.values()), "low": low["availability"], "zero": zero["availability"]})

    async def check_inventory_mutation(self) -> QAEvidence:
        async with AsyncSessionLocal() as db:
            with tenant_scope(store_id=URBAN["store_id"], organization_id=URBAN["organization_id"]):
                rows = list((await db.execute(select(InventoryItem).where(InventoryItem.variant_id == URBAN["oxford_variant_id"]))).scalars())
                original = [row.quantity for row in rows]
                for row in rows: row.quantity = 0
                await db.flush()
                _, ctx = await self._tool_context(db, "Stock")
                current = await AI_TOOL_REGISTRY["check_stock"].handler(ctx, AI_TOOL_REGISTRY["check_stock"].input_model(variant_ref=URBAN["oxford_variant_id"]))
                require(current.get("availability") == "out_of_stock", "Inventory mutation was not visible through production AI tool", expected="out_of_stock", actual=current)
            await db.rollback()
        async with AsyncSessionLocal() as db:
            with tenant_scope(store_id=URBAN["store_id"], organization_id=URBAN["organization_id"]):
                restored = int(await db.scalar(select(func.sum(InventoryItem.quantity)).where(InventoryItem.variant_id == URBAN["oxford_variant_id"])) or 0)
        require(restored == 15, "Transaction rollback did not restore canonical stock", expected=15, actual=restored)
        return QAEvidence({"mutated": 0, "restored": 15}, {"mutated": current["availability"], "restored": restored}, {"original_split": original})

    async def check_procurement(self) -> QAEvidence:
        async with AsyncSessionLocal() as db:
            with tenant_scope(store_id=URBAN["store_id"], organization_id=URBAN["organization_id"]):
                suppliers = list((await db.execute(select(Supplier))).scalars())
                pos = list((await db.execute(select(PurchaseOrder))).scalars())
                transfers = list((await db.execute(select(StockTransfer))).scalars())
                wastage = list((await db.execute(select(WastageLog))).scalars())
                warehouses = {row.id for row in (await db.execute(select(Warehouse))).scalars()}
                require(len(suppliers) == 3 and {row.status for row in pos} == {"draft", "ordered", "received"}, "Supplier/PO fixtures mismatch")
                require({row.status for row in transfers} == {"pending", "completed"} and all(row.from_warehouse_id in warehouses and row.to_warehouse_id in warehouses for row in transfers), "Transfer fixtures invalid")
                require(len(wastage) == 3 and all(row.warehouse_id in warehouses for row in wastage), "Wastage fixtures invalid")
        return QAEvidence({"suppliers": 3, "po_states": 3, "transfers": 2, "wastage": 3}, {"suppliers": len(suppliers), "po_states": len({x.status for x in pos}), "transfers": len(transfers), "wastage": len(wastage)})

    async def check_orders(self) -> QAEvidence:
        from app.api.routes.public_storefront import _load_public_products_by_ids
        async with AsyncSessionLocal() as db:
            with tenant_scope(store_id=URBAN["store_id"], organization_id=URBAN["organization_id"]):
                order = await db.get(Order, URBAN["order_1042_id"])
                item = await db.scalar(select(OrderItem).where(OrderItem.order_id == order.id)) if order else None
                privacy = await db.scalar(select(Order).where(Order.order_number == "UT-1043"))
                accepted = await _load_public_products_by_ids(db, [URBAN["oxford_product_id"], fixture_uuid("technest.product.gift-card")])
                require(order is not None and item is not None and privacy is not None, "Canonical or privacy Order missing")
                require(order.customer_id == URBAN["rahim_customer_id"] and order.status == "shipped" and item.variant_id == URBAN["oxford_variant_id"] and item.quantity == 1, "UT-1042 truth mismatch")
                require(set(accepted) == {str(URBAN["oxford_product_id"])}, "Checkout Product loading accepted a cross-Store ID", actual=list(accepted))
        return QAEvidence({"order": "UT-1042", "privacy_order": "UT-1043", "qty": 1, "status": "shipped", "accepted_products": 1}, {"order": order.order_number, "privacy_order": privacy.order_number, "qty": item.quantity, "status": order.status, "accepted_products": len(accepted)})

    async def check_returns(self) -> QAEvidence:
        async with AsyncSessionLocal() as db:
            with tenant_scope(store_id=URBAN["store_id"], organization_id=URBAN["organization_id"]):
                rows = list((await db.execute(select(ReturnRequest).options(selectinload(ReturnRequest.items)))).scalars())
                order_ids = {row.id for row in (await db.execute(select(Order))).scalars()}
                customer_ids = {row.id for row in (await db.execute(select(Customer))).scalars()}
                require(len(rows) == 2 and {row.status for row in rows} == {"requested", "completed"}, "Return fixture states mismatch")
                require(all(row.order_id in order_ids and row.customer_id in customer_ids and row.items for row in rows), "Return relationships cross Store or are missing")
        return QAEvidence(2, len(rows), {"statuses": sorted(row.status for row in rows)})

    async def check_logistics(self) -> QAEvidence:
        async with AsyncSessionLocal() as db:
            with tenant_scope(store_id=URBAN["store_id"], organization_id=URBAN["organization_id"]):
                shipment = await db.scalar(select(Shipment).where(Shipment.order_id == URBAN["order_1042_id"]))
                courier = await db.get(Courier, shipment.courier_id) if shipment else None
                require(shipment is not None and courier is not None and shipment.tracking_number == CANONICAL["tracking"] and shipment.status == "shipped" and courier.name == "Pathao Demo", "Canonical logistics mismatch")
        return QAEvidence(CANONICAL["tracking"], shipment.tracking_number, {"courier": courier.name, "provider": shipment.external_provider})

    async def check_pos(self) -> QAEvidence:
        async with AsyncSessionLocal() as db:
            with tenant_scope(store_id=URBAN["store_id"], organization_id=URBAN["organization_id"]):
                rows = list((await db.execute(select(Order).where(Order.source == "pos"))).scalars())
                require(len(rows) == 3 and {row.payment_method for row in rows}.issubset({"cash", "cash_on_delivery"}), "POS representation mismatch")
        return QAEvidence(3, len(rows), {"payment_methods": sorted({row.payment_method for row in rows})})

    async def check_crm(self) -> QAEvidence:
        async with AsyncSessionLocal() as db:
            with tenant_scope(store_id=URBAN["store_id"], organization_id=URBAN["organization_id"]):
                activities = list((await db.execute(select(CustomerActivity).where(CustomerActivity.customer_id == URBAN["rahim_customer_id"]))).scalars())
                order_count = int(await db.scalar(select(func.count()).select_from(Order).where(Order.customer_id == URBAN["rahim_customer_id"])) or 0)
                conversations = int(await db.scalar(select(func.count()).select_from(Conversation).where(Conversation.customer_id == URBAN["rahim_customer_id"])) or 0)
                require(len(activities) == 2 and order_count > 0 and conversations > 0, "Rahim CRM graph incomplete")
        return QAEvidence("CRM + Orders + Inbox linked", {"activities": len(activities), "orders": order_count, "conversations": conversations})

    async def check_finance(self) -> QAEvidence:
        async with AsyncSessionLocal() as db:
            with tenant_scope(store_id=URBAN["store_id"], organization_id=URBAN["organization_id"]):
                rows = list((await db.execute(select(Transaction))).scalars())
                require(len(rows) == 4 and {row.direction for row in rows} == {"in", "out"} and all(row.amount > 0 for row in rows), "Finance fixtures invalid")
        return QAEvidence({"count": 4, "directions": ["in", "out"]}, {"count": len(rows), "directions": sorted({x.direction for x in rows})})

    async def check_hr(self) -> QAEvidence:
        async with AsyncSessionLocal() as db:
            with tenant_scope(store_id=URBAN["store_id"], organization_id=URBAN["organization_id"]):
                employees = list((await db.execute(select(Employee))).scalars())
                attendance = int(await db.scalar(select(func.count()).select_from(AttendanceRecord)) or 0)
                salaries = int(await db.scalar(select(func.count()).select_from(SalaryRecord)) or 0)
                support = await db.scalar(select(User).where(User.email == URBAN["support_email"]))
                support_keys = set(await get_user_permissions(db, support.id))
                require((len(employees), attendance, salaries) == (5, 15, 5), "HR fixture counts mismatch", expected=[5, 15, 5], actual=[len(employees), attendance, salaries])
                require("hr.view" not in support_keys, "Support Agent received payroll/HR access")
        return QAEvidence([5, 15, 5], [len(employees), attendance, salaries])

    async def check_builder(self) -> QAEvidence:
        async with AsyncSessionLocal() as db:
            with tenant_scope(store_id=URBAN["store_id"], organization_id=URBAN["organization_id"]):
                themes = list((await db.execute(theme_graph_stmt().where(StorefrontTheme.store_id == URBAN["store_id"]))).scalars().unique())
                live = next((row for row in themes if row.status == "published"), None)
                draft = next((row for row in themes if row.status == "draft"), None)
                require(live is not None and draft is not None and len([row for row in themes if row.status == "published"]) == 1, "Published/draft Theme invariant failed")
                snapshot = theme_snapshot(live)
                sections = list((await db.execute(select(StorefrontSection))).scalars())
                styles = list((await db.execute(select(StorefrontStyleClass))).scalars())
                saved = await db.scalar(select(StorefrontSavedSection).where(StorefrontSavedSection.name == "Promo CTA"))
                ids = [str(row.id) for row in sections]
                settings_values = [row.settings or {} for row in sections]
                types = {row.type for row in sections}
                require(len(ids) == len(set(ids)) and snapshot.get("templates"), "Theme graph contains duplicate IDs or cannot serialize")
                require({"product-query", "content-model", "promo-banner"}.issubset(types), "Dynamic/Query/conditional Builder blocks missing", actual=sorted(types))
                require(any("responsive" in value for value in settings_values) and any("hover" in value for value in settings_values), "Responsive/hover Builder state missing")
                require(styles and saved is not None and saved.snapshot.get("styles", {}).get("layout") == "stack", "Global class or saved Stack section missing")
        return QAEvidence("loadable published graph + draft + dynamic features", {"themes": len(themes), "sections": len(sections), "styles": len(styles), "snapshot_templates": len(snapshot["templates"])})

    async def check_storefront(self) -> QAEvidence:
        async with AsyncSessionLocal() as db:
            custom = await StoreResolver.resolve_by_hostname(db, URBAN["custom_hostname"])
            hosted_domain = await db.scalar(select(StoreDomain).where(StoreDomain.store_id == URBAN["store_id"], StoreDomain.domain_type == "platform_subdomain").execution_options(include_all_stores=True))
            hosted = await StoreResolver.resolve_by_hostname(db, hosted_domain.hostname)
            with tenant_scope(store_id=URBAN["store_id"], organization_id=URBAN["organization_id"]):
                theme, template = await resolve_template(db, "product")
                primary = await get_primary_domain(db, URBAN["store_id"])
                url = f"{get_storefront_url_for_hostname(primary.hostname)}/products/{CANONICAL['product_slug']}"
            failures = 0
            for hostname in ("unknown-demo-host.example.com", settings.STOREFRONT_BASE_DOMAIN, f"api.{settings.STOREFRONT_BASE_DOMAIN}"):
                try: await StoreResolver.resolve_by_hostname(db, hostname)
                except HTTPException as exc: failures += int(exc.status_code == 404)
            require(custom.store.id == URBAN["store_id"] and hosted.store.id == URBAN["store_id"] and theme.status == "published" and template.resource_type == "product", "Storefront Host→Theme→Template resolution mismatch")
            require(failures == 3 and url == f"https://{URBAN['custom_hostname']}/products/{CANONICAL['product_slug']}", "Unknown/reserved host or canonical URL policy failed", actual={"failures": failures, "url": url})
        return QAEvidence("Urban Host -> published product template", {"custom": custom.domain.hostname, "hosted": hosted.domain.hostname, "theme": theme.key, "template": template.key, "canonical": url})

    async def check_dynamic_data(self) -> QAEvidence:
        async with AsyncSessionLocal() as db:
            with tenant_scope(store_id=URBAN["store_id"], organization_id=URBAN["organization_id"]):
                fields = list((await db.execute(select(StorefrontCustomFieldDefinition))).scalars())
                model = await db.scalar(select(StorefrontContentModel).where(StorefrontContentModel.key == "lookbook"))
                loop = await db.scalar(select(StorefrontSection).where(StorefrontSection.type == "product-query"))
                products = list((await db.execute(select(Product).order_by(Product.name).limit(int(loop.settings["query"]["limit"])))) .scalars())
                require({row.key for row in fields} == {"material", "fit", "care_instructions", "country_of_origin"} and model is not None, "Custom field/content fixtures missing")
                require(products and all(row.store_id == URBAN["store_id"] for row in products), "Query Loop leaked another Store")
        return QAEvidence({"fields": 4, "model": "lookbook"}, {"fields": len(fields), "model": model.key, "query_products": len(products)})

    async def check_commercial(self) -> QAEvidence:
        features = ("custom_domain", "amar_dns", "unified_inbox", "facebook_messaging", "whatsapp_messaging", "ai_commerce")
        async with AsyncSessionLocal() as db:
            with tenant_scope(store_id=URBAN["store_id"], organization_id=URBAN["organization_id"]):
                urban = await EntitlementService(db, store_id=URBAN["store_id"], organization_id=URBAN["organization_id"]).resolve()
                enabled = {key: urban.entitlements.get(key) for key in features}
                usage = await UsageService(db, store_id=URBAN["store_id"], organization_id=URBAN["organization_id"]).get_usage("ai_messages_monthly")
            with tenant_scope(store_id=TECHNEST["store_id"], organization_id=TECHNEST["organization_id"]):
                tech = await EntitlementService(db, store_id=TECHNEST["store_id"], organization_id=TECHNEST["organization_id"]).resolve()
            require(urban.status == "active" and all(value is True for value in enabled.values()), "Urban effective demo entitlements mismatch", actual=enabled)
            require(tech.status == "trialing" and tech.assignment.plan_key_snapshot == "growth" and tech.trial_days_remaining is not None, "TechNest trial state invalid")
        return QAEvidence({"urban": "active", "tech": "trialing"}, {"urban": urban.status, "tech": tech.status, "ai_usage": usage, "features": enabled})

    async def check_billing(self) -> QAEvidence:
        async with AsyncSessionLocal() as db:
            with tenant_scope(store_id=URBAN["store_id"], organization_id=URBAN["organization_id"]):
                sub = await db.scalar(select(StoreSubscription))
                invoice = await db.scalar(select(BillingInvoice))
                payment = await db.scalar(select(BillingPayment))
                assignment = await db.scalar(select(StorePlanAssignment))
                require(sub is not None and invoice is not None and payment is not None and assignment is not None, "Billing graph missing")
                canonical = {"plan": sub.plan_key_snapshot, "invoice": invoice.status, "payment": payment.status}
                original = (sub.status, sub.grace_ends_at, assignment.status)
                require(sub.status == "active" and sub.billing_cycle == "monthly" and sub.provider == "test" and invoice.status == "paid" and payment.status == "succeeded", "Canonical billing state mismatch")
                sub.status = "past_due"; sub.grace_ends_at = datetime.now(timezone.utc) + timedelta(days=3)
                await reconcile_subscription(db, sub, now=datetime.now(timezone.utc))
                require(sub.status == "past_due" and assignment.status == "active", "Past-due grace incorrectly removed commercial access", actual={"subscription": sub.status, "assignment": assignment.status})
                sub.status, sub.grace_ends_at, assignment.status = original
            await db.rollback()
        return QAEvidence("active monthly test + paid invoice/payment + grace preserves access", {**canonical, "grace_assignment": "active"})

    async def check_domains(self) -> QAEvidence:
        async with AsyncSessionLocal() as db:
            with tenant_scope(store_id=URBAN["store_id"], organization_id=URBAN["organization_id"]):
                rows = list((await db.execute(select(StoreDomain))).scalars())
                hosted = next(row for row in rows if row.domain_type == "platform_subdomain")
                custom = next(row for row in rows if row.domain_type == "custom")
                require(len(rows) == 2 and custom.is_primary and custom.status == "active" and custom.verification_status == "verified" and custom.routing_status == "valid" and custom.ssl_status == "active", "Custom domain state mismatch")
                require(not hosted.is_primary and hosted.redirect_to_primary and hosted.status == "active", "Mandatory hosted alias invariant mismatch")
        return QAEvidence("one custom primary + retained hosted redirect", {"hosted": hosted.hostname, "custom": custom.hostname, "ssl": custom.ssl_status})

    async def check_dns(self) -> QAEvidence:
        async with AsyncSessionLocal() as db:
            with tenant_scope(store_id=URBAN["store_id"], organization_id=URBAN["organization_id"]):
                zone = await db.scalar(select(DnsZone))
                domain = await db.get(StoreDomain, zone.store_domain_id) if zone else None
                records = list((await db.execute(select(DnsRecord).where(DnsRecord.zone_id == zone.id))).scalars()) if zone else []
                signature = {(row.record_type, row.name, row.managed_by) for row in records}
                required = {("ALIAS", "@", "amar_system"), ("CNAME", "www", "amar_system"), ("MX", "@", "merchant"), ("TXT", "@", "merchant"), ("TXT", "_dmarc", "merchant"), ("CAA", "@", "merchant")}
                require(zone is not None and domain is not None and required.issubset(signature), "DNS canonical records missing", expected=sorted(required), actual=sorted(signature))
                provider = TestDnsProvider()
                provider.zones[zone.provider_zone_ref] = ProviderZone(zone.provider_zone_ref, zone.zone_name, tuple(zone.nameservers), zone.soa_serial)
                provider.records[zone.provider_zone_ref] = []
                service = DnsService(db, provider=provider)
                locked = next(row for row in records if row.managed_by == "amar_system" and row.purpose == "storefront_routing")
                try: await service.delete_record(zone, locked, actor_id=None)
                except HTTPException as exc: protected = exc.status_code == 409
                else: protected = False
                mail_before = {(row.record_type, row.name, row.content) for row in records if row.record_type in {"MX", "TXT"}}
                await service._ensure_store_routing(zone, domain)
                await service.reconcile(zone)
                refreshed = list((await db.execute(select(DnsRecord).where(DnsRecord.zone_id == zone.id))).scalars())
                mail_after = {(row.record_type, row.name, row.content) for row in refreshed if row.record_type in {"MX", "TXT"}}
                health = await service.health(zone, domain)
                require(protected and mail_before == mail_after and zone.sync_status == "synced", "DNS protection/reconciliation/mail preservation failed", actual={"protected": protected, "mail_equal": mail_before == mail_after, "sync": zone.sync_status})
            await db.rollback()
        return QAEvidence("protected routing + preserved MX/TXT + synced TestDnsProvider", {"records": len(records), "health": health})

    async def check_inbox(self) -> QAEvidence:
        async with AsyncSessionLocal() as db:
            with tenant_scope(store_id=URBAN["store_id"], organization_id=URBAN["organization_id"]):
                support = await db.scalar(select(User).where(User.email == URBAN["support_email"]))
                all_rows, total, _counts, _previews, _unread = await list_conversations(db, store_id=URBAN["store_id"], user_id=support.id, view="all", page=1, page_size=50)
                mine, *_ = await list_conversations(db, store_id=URBAN["store_id"], user_id=support.id, view="mine", page=1, page_size=50)
                unassigned, *_ = await list_conversations(db, store_id=URBAN["store_id"], user_id=support.id, view="unassigned", page=1, page_size=50)
                resolved, *_ = await list_conversations(db, store_id=URBAN["store_id"], user_id=support.id, view="resolved", page=1, page_size=50)
                order_conv = await db.scalar(select(Conversation).where(Conversation.subject == "Order Status").options(selectinload(Conversation.channel)))
                context = await commerce_context(db, conversation=order_conv)
                products = await search_products(db, store_id=URBAN["store_id"], query="Classic Oxford", limit=5)
                before_notes = int(await db.scalar(select(func.count()).select_from(ConversationNote).where(ConversationNote.conversation_id == order_conv.id)) or 0)
                await add_note(db, conversation=order_conv, actor=support, content="QA rollback-only internal note")
                after_notes = int(await db.scalar(select(func.count()).select_from(ConversationNote).where(ConversationNote.conversation_id == order_conv.id)) or 0)
                outbound_notes = int(await db.scalar(select(func.count()).select_from(ConversationMessage).where(ConversationMessage.conversation_id == order_conv.id, ConversationMessage.text_content == "QA rollback-only internal note")) or 0)
                require(total == 15 and mine and unassigned and len(resolved) == 1, "Inbox views/filters mismatch", actual={"all": total, "mine": len(mine), "unassigned": len(unassigned), "resolved": len(resolved)})
                customer = context.get("customer")
                require(
                    customer is not None
                    and customer.id == URBAN["rahim_customer_id"]
                    and any(row.order_number == "UT-1042" for row in context.get("recent_orders", [])),
                    "Inbox commerce context missing Rahim/UT-1042",
                )
                require(products and products[0]["product"].store_id == URBAN["store_id"] and after_notes == before_notes + 1 and outbound_notes == 0, "Inbox search or internal-note boundary failed")
            await db.rollback()
        return QAEvidence({"conversations": 15, "resolved": 1, "internal_provider_sends": 0}, {"conversations": total, "mine": len(mine), "unassigned": len(unassigned), "resolved": len(resolved), "internal_provider_sends": outbound_notes})

    async def check_meta(self) -> QAEvidence:
        async with AsyncSessionLocal() as db:
            with tenant_scope(store_id=URBAN["store_id"], organization_id=URBAN["organization_id"]):
                channels = list((await db.execute(select(MessagingChannel).order_by(MessagingChannel.channel_type))).scalars())
                template = await db.scalar(select(MessagingTemplate).where(MessagingTemplate.status == "approved"))
                require(len(channels) == 2 and all(row.provider == "test" and row.status == "connected" for row in channels), "Deterministic Meta channel state mismatch")
                require(template is not None and template.channel_id == next(row.id for row in channels if row.channel_type == "whatsapp"), "Approved deterministic WhatsApp template missing")
                vault = MessagingCredentialVault(db)
                statuses = [await vault.masked_status(row) for row in channels]
                roundtrip = [await vault.load_for_provider(row) for row in channels]
                secret_rows = list((await db.execute(select(MessagingChannelSecret))).scalars())
                require(all(row["configured"] for row in statuses) and all("test_credential" in row for row in roundtrip), "Credential vault roundtrip failed")
                require(all("demo-only" not in secret.credentials_encrypted for secret in secret_rows), "Plaintext provider credential stored at rest")
                channel = next(row for row in channels if row.channel_type == "whatsapp")
                value = InboundMessage(channel.external_account_ref, "qa-idempotent-thread", "qa-idempotent-user", "qa-idempotent-message", "QA duplicate", datetime.now(timezone.utc))
                _, first, created_first = await ingest_inbound(db, channel=channel, value=value)
                _, second, created_second = await ingest_inbound(db, channel=channel, value=value)
                require(first.id == second.id and created_first and not created_second, "Provider inbound idempotency failed")
            await db.rollback()
        return QAEvidence({"channels": 2, "templates": 1, "messages_created": 1}, {"channels": len(channels), "templates": int(template is not None), "messages_created": int(created_first) + int(created_second)})

    async def check_ai_defaults(self) -> QAEvidence:
        forbidden = {"sql", "shell", "filesystem", "http", "payroll", "dns_secret", "billing_secret", "create_order", "cancel_order", "refund_order", "modify_inventory"}
        async with AsyncSessionLocal() as db:
            with tenant_scope(store_id=URBAN["store_id"], organization_id=URBAN["organization_id"]):
                urban = await db.scalar(select(CommerceAISettings))
                access = EntitlementService(db, store_id=URBAN["store_id"], organization_id=URBAN["organization_id"])
                ai_allowed = await access.has_feature("ai_commerce")
                usage = await UsageService(db, store_id=URBAN["store_id"], organization_id=URBAN["organization_id"]).get_usage("ai_messages_monthly")
            with tenant_scope(store_id=TECHNEST["store_id"], organization_id=TECHNEST["organization_id"]):
                tech = await db.scalar(select(CommerceAISettings))
            require(urban.enabled and urban.mode == "copilot" and not tech.enabled and tech.mode == "off" and ai_allowed, "AI default modes/entitlement mismatch")
            require(forbidden.isdisjoint(AI_TOOL_REGISTRY) and all(row.read_only for key, row in AI_TOOL_REGISTRY.items() if key != "handoff_to_agent"), "AI tool authority expanded beyond Phase 15", actual=sorted(AI_TOOL_REGISTRY))
        return QAEvidence({"urban": "copilot", "tech": "off", "provider": "test boundary"}, {"urban": urban.mode, "tech": tech.mode, "usage": usage, "tools": sorted(AI_TOOL_REGISTRY)})

    async def _conversation_trigger(self, db: AsyncSession, subject: str) -> tuple[Conversation, ConversationMessage]:
        conversation = await db.scalar(select(Conversation).where(Conversation.subject == subject).options(selectinload(Conversation.channel)))
        trigger = await db.scalar(select(ConversationMessage).where(ConversationMessage.conversation_id == conversation.id, ConversationMessage.direction == "inbound").order_by(ConversationMessage.sent_at.desc())) if conversation else None
        require(conversation is not None and trigger is not None, f"AI fixture {subject} missing")
        return conversation, trigger

    async def check_ai_grounding(self) -> QAEvidence:
        async with AsyncSessionLocal() as db:
            with tenant_scope(store_id=URBAN["store_id"], organization_id=URBAN["organization_id"]):
                conversation, trigger = await self._conversation_trigger(db, "Stock")
                provider = TestAIProvider(script=[
                    AIProviderTurn(tool_calls=(AIToolRequest("s", "search_products", {"query": "Classic Oxford", "limit": 5}),)),
                    AIProviderTurn(tool_calls=(AIToolRequest("v", "list_variants", {"product_ref": str(URBAN["oxford_product_id"])}),)),
                    AIProviderTurn(tool_calls=(AIToolRequest("i", "check_stock", {"variant_ref": str(URBAN["oxford_variant_id"])}), AIToolRequest("p", "get_price", {"variant_ref": str(URBAN["oxford_variant_id"])}))),
                    AIProviderTurn(text="জি, Black / XL এখন available আছে। দাম BDT 2490.00।"),
                ])
                execution = await CommerceAIAgent(db, provider=provider).generate(conversation=conversation, triggering_message=trigger, mode="copilot", idempotency_key=f"qa-ground:{uuid4()}")
                require(execution.status == "completed" and execution.tool_calls_count == 4, "Grounded Copilot execution failed", actual={"status": execution.status, "tools": execution.tool_calls_count})
            await db.rollback()
        return QAEvidence({"status": "completed", "tool_calls": 4, "price": "2490.00"}, {"status": execution.status, "tool_calls": execution.tool_calls_count})

    async def check_ai_mutation(self) -> QAEvidence:
        async with AsyncSessionLocal() as db:
            with tenant_scope(store_id=URBAN["store_id"], organization_id=URBAN["organization_id"]):
                conversation, trigger = await self._conversation_trigger(db, "Stock")
                inventory = list((await db.execute(select(InventoryItem).where(InventoryItem.variant_id == URBAN["oxford_variant_id"]))).scalars())
                variant = await db.get(ProductVariant, URBAN["oxford_variant_id"])
                for row in inventory: row.quantity = 0
                variant.price = Decimal("2591.00")
                await db.flush()
                provider = TestAIProvider(script=[
                    AIProviderTurn(tool_calls=(AIToolRequest("i", "check_stock", {"variant_ref": str(variant.id)}), AIToolRequest("p", "get_price", {"variant_ref": str(variant.id)}))),
                    AIProviderTurn(text="Black / XL is currently out of stock. The current price is BDT 2591.00."),
                ])
                execution = await CommerceAIAgent(db, provider=provider).generate(conversation=conversation, triggering_message=trigger, mode="copilot", idempotency_key=f"qa-mutation:{uuid4()}")
                require(execution.status == "completed" and execution.tool_calls_count == 2, "AI did not ground temporary stock/price")
            await db.rollback()
        async with AsyncSessionLocal() as db:
            with tenant_scope(store_id=URBAN["store_id"], organization_id=URBAN["organization_id"]):
                total = int(await db.scalar(select(func.sum(InventoryItem.quantity)).where(InventoryItem.variant_id == URBAN["oxford_variant_id"])) or 0)
                price = await db.scalar(select(ProductVariant.price).where(ProductVariant.id == URBAN["oxford_variant_id"]))
        require(total == 15 and price == Decimal("2490.00"), "AI mutation QA failed to restore canonical truth", expected=[15, "2490.00"], actual=[total, str(price)])
        return QAEvidence({"temporary_stock": 0, "temporary_price": "2591.00", "restored": [15, "2490.00"]}, {"execution": execution.status, "restored": [total, str(price)]})

    async def check_ai_orders(self) -> QAEvidence:
        async with AsyncSessionLocal() as db:
            with tenant_scope(store_id=URBAN["store_id"], organization_id=URBAN["organization_id"]):
                conversation, trigger = await self._conversation_trigger(db, "Order Status")
                execution = await CommerceAIAgent(db, provider=TestAIProvider()).generate(conversation=conversation, triggering_message=trigger, mode="copilot", idempotency_key=f"qa-order:{uuid4()}")
                _, ctx = await self._tool_context(db, "Order Status")
                privacy = await AI_TOOL_REGISTRY["lookup_order"].handler(ctx, AI_TOOL_REGISTRY["lookup_order"].input_model(order_number="UT-1043"))
                require(execution.status == "completed" and execution.tool_calls_count == 2, "AI order-status grounding failed")
                require(privacy == {"found": False, "privacy_verified": False}, "AI exposed another Customer's Order", actual=privacy)
            await db.rollback()
        return QAEvidence({"UT-1042": "shipped", "UT-1043": "not exposed"}, {"execution": execution.status, "private_lookup": privacy})

    async def check_ai_handoffs(self) -> QAEvidence:
        subjects = ("Human", "Modify", "Cancel", "Prompt Injection")
        outcomes: dict[str, str] = {}
        async with AsyncSessionLocal() as db:
            with tenant_scope(store_id=URBAN["store_id"], organization_id=URBAN["organization_id"]):
                original_order = await db.get(Order, URBAN["order_1042_id"])
                original = (original_order.status, [(row.variant_id, row.quantity) for row in (await db.execute(select(OrderItem).where(OrderItem.order_id == original_order.id))).scalars()])
                for subject in subjects:
                    conversation, trigger = await self._conversation_trigger(db, subject)
                    provider = TestAIProvider()
                    execution = await CommerceAIAgent(db, provider=provider).generate(conversation=conversation, triggering_message=trigger, mode="copilot", idempotency_key=f"qa-handoff:{subject}:{uuid4()}")
                    require(execution.status == "handoff" and provider.calls == 0, f"{subject} did not short-circuit to safe handoff")
                    outcomes[subject] = execution.status
                require((original_order.status, [(row.variant_id, row.quantity) for row in (await db.execute(select(OrderItem).where(OrderItem.order_id == original_order.id))).scalars()]) == original, "AI handoff inputs modified UT-1042")
            await db.rollback()
        return QAEvidence({subject: "handoff" for subject in subjects}, outcomes)

    async def check_ai_policy_edges(self) -> QAEvidence:
        results: dict[str, Any] = {}
        async with AsyncSessionLocal() as db:
            with tenant_scope(store_id=URBAN["store_id"], organization_id=URBAN["organization_id"]):
                support = await db.scalar(select(User).where(User.email == URBAN["support_email"]))
                closed, _ = await self._conversation_trigger(db, "Closed Window")
                try: await send_message(db, conversation=closed, actor=support, text="QA blocked", idempotency_key=f"qa-closed:{uuid4()}")
                except HTTPException as exc: results["closed_window"] = exc.status_code
                else: raise QAFailure("WhatsApp closed window allowed a free-form send")

                stock, trigger = await self._conversation_trigger(db, "Stock")
                malformed = TestAIProvider(script=[AIProviderTurn(tool_calls=(AIToolRequest("bad", "check_stock", {"variant_ref": "not-a-uuid", "extra": True}),)), AIProviderTurn(text="No grounded claim available.")])
                malformed_exec = await CommerceAIAgent(db, provider=malformed).generate(conversation=stock, triggering_message=trigger, mode="copilot", idempotency_key=f"qa-malformed:{uuid4()}")
                results["malformed"] = malformed_exec.status

                loop = TestAIProvider(script=[AIProviderTurn(tool_calls=(AIToolRequest(f"loop-{i}", "search_products", {"query": "Oxford", "limit": 1}),)) for i in range(settings.AI_MAX_STEPS + 1)])
                loop_exec = await CommerceAIAgent(db, provider=loop).generate(conversation=stock, triggering_message=trigger, mode="copilot", idempotency_key=f"qa-loop:{uuid4()}")
                results["loop"] = loop_exec.status

                human_conv, human_trigger = await self._conversation_trigger(db, "Human")
                agent = CommerceAIAgent(db, provider=TestAIProvider())
                first = await agent.generate(conversation=human_conv, triggering_message=human_trigger, mode="copilot", idempotency_key="qa-idempotent-execution")
                second = await agent.generate(conversation=human_conv, triggering_message=human_trigger, mode="copilot", idempotency_key="qa-idempotent-execution")
                results["idempotent"] = first.id == second.id

                before = int(await db.scalar(select(func.count()).select_from(AIExecution)) or 0)
                note_conv, _ = await self._conversation_trigger(db, "Internal Note")
                await add_note(db, conversation=note_conv, actor=support, content="QA note must not trigger AI")
                after = int(await db.scalar(select(func.count()).select_from(AIExecution)) or 0)
                results["note_triggered"] = after - before

                settings_row = await db.scalar(select(CommerceAISettings))
                settings_row.mode = "assist"
                stock.handling_mode = "ai"
                class RaceProvider:
                    key, model = "test", "qa-race"
                    calls = 0
                    async def generate(inner_self, _request):
                        inner_self.calls += 1
                        if inner_self.calls == 1:
                            db.add(ConversationMessage(conversation_id=stock.id, channel_id=stock.channel_id, direction="outbound", message_type="text", sender_type="agent", sender_user_id=support.id, text_content="Human answered first", status="sent", sent_at=datetime.now(timezone.utc)))
                            await db.flush()
                            return AIProviderTurn(tool_calls=(AIToolRequest("i", "check_stock", {"variant_ref": str(URBAN["oxford_variant_id"])}),))
                        return AIProviderTurn(text="Black / XL is currently available.")
                race_exec = await CommerceAIAgent(db, provider=RaceProvider()).generate(conversation=stock, triggering_message=trigger, mode="assist", idempotency_key=f"qa-race:{uuid4()}")
                results["race"] = race_exec.status

                access = EntitlementService(db, store_id=URBAN["store_id"], organization_id=URBAN["organization_id"])
                limit = int(await access.get_limit("ai_messages_monthly") or 0)
                db.add(AIUsageEvent(organization_id=URBAN["organization_id"], execution_id=first.id, provider="test", model="quota-probe", input_tokens=0, output_tokens=0, tool_calls=0, billable_units=limit, occurred_at=datetime.now(timezone.utc)))
                await db.flush()
                try: await CommerceAIAgent(db, provider=TestAIProvider()).generate(conversation=stock, triggering_message=trigger, mode="copilot", idempotency_key=f"qa-quota:{uuid4()}")
                except HTTPException as exc: results["quota"] = exc.status_code
                else: raise QAFailure("AI quota did not block a new execution")

                product_ctx = AIToolContext(db, URBAN["store_id"], URBAN["organization_id"], stock)
                adversarial = await db.scalar(select(Product).where(Product.name == "Adversarial Prompt Data Tee"))
                data = await AI_TOOL_REGISTRY["get_product"].handler(product_ctx, AI_TOOL_REGISTRY["get_product"].input_model(product_ref=adversarial.id))
                results["tool_result_is_data"] = "SYSTEM MESSAGE" in data["description"] and "sql" not in AI_TOOL_REGISTRY
                try: validate_tool_arguments(AI_TOOL_REGISTRY["check_stock"], {"variant_ref": "bad", "extra": True})
                except AIToolValidationError: results["strict_validation"] = True
            await db.rollback()
        require(results == {"closed_window": 409, "malformed": "handoff", "loop": "handoff", "idempotent": True, "note_triggered": 0, "race": "cancelled", "quota": 409, "tool_result_is_data": True, "strict_validation": True}, "AI edge-policy result mismatch", actual=results)
        return QAEvidence("all edge policies block safely", results)

    async def _resource_ids(self, store_id: UUID) -> dict[type, UUID]:
        models = (Product, ProductVariant, Category, Brand, InventoryItem, Warehouse, Supplier, PurchaseOrder, StockTransfer, WastageLog, Customer, CustomerActivity, Order, ReturnRequest, Courier, Shipment, Transaction, Employee, SalaryRecord, AttendanceRecord, StorefrontTheme, StorefrontTemplate, StorefrontSavedSection, StorefrontCustomFieldDefinition, StorefrontContentModel, MediaAsset, StoreDomain, DnsZone, DnsRecord, Conversation, ConversationMessage, MessagingChannel, MessagingTemplate, AIExecution)
        found: dict[type, UUID] = {}
        async with AsyncSessionLocal() as db:
            for model in models:
                value = await db.scalar(select(model.id).where(model.store_id == store_id).execution_options(include_all_stores=True).limit(1))
                require(value is not None, f"Cross-tenant gauntlet fixture missing for {model.__name__}")
                found[model] = value
        return found

    async def check_cross_tenant(self) -> QAEvidence:
        ids = await self._resource_ids(URBAN["store_id"])
        leaks = []
        async with AsyncSessionLocal() as db:
            with tenant_scope(store_id=TECHNEST["store_id"], organization_id=TECHNEST["organization_id"]):
                for model, value in ids.items():
                    if await db.scalar(select(model.id).where(model.id == value)) is not None: leaks.append(model.__name__)
        require(not leaks, "Urban resources leaked in TechNest context", expected=[], actual=leaks)
        return QAEvidence(0, len(leaks), {"attacked": len(ids), "resource_types": sorted(model.__name__ for model in ids)})

    async def check_reverse_tenant(self) -> QAEvidence:
        models = (Product, ProductVariant, Customer, Order, StorefrontTheme, MessagingChannel, CommerceAISettings)
        ids = {}
        async with AsyncSessionLocal() as db:
            for model in models:
                ids[model] = await db.scalar(select(model.id).where(model.store_id == TECHNEST["store_id"]).execution_options(include_all_stores=True).limit(1))
        leaks = []
        async with AsyncSessionLocal() as db:
            with tenant_scope(store_id=URBAN["store_id"], organization_id=URBAN["organization_id"]):
                for model, value in ids.items():
                    if await db.scalar(select(model.id).where(model.id == value)) is not None: leaks.append(model.__name__)
        require(not leaks, "TechNest resources leaked in Urban context", expected=[], actual=leaks)
        return QAEvidence(0, len(leaks), {"attacked": len(ids), "resource_types": sorted(model.__name__ for model in ids)})

    async def check_security(self) -> QAEvidence:
        async with AsyncSessionLocal() as db:
            unknown_assets = int(await db.scalar(select(func.count()).select_from(MessagingChannel).where(MessagingChannel.external_account_ref.in_(["unknown-page", "unknown-phone"])).execution_options(include_all_stores=True)) or 0)
            host_failures = 0
            for host in ("random.invalid", settings.STOREFRONT_BASE_DOMAIN, f"dashboard.{settings.STOREFRONT_BASE_DOMAIN}"):
                try: await StoreResolver.resolve_by_hostname(db, host)
                except HTTPException as exc: host_failures += int(exc.status_code == 404)
            secret_fields = {column.name for column in MessagingChannel.__table__.columns}
            require(unknown_assets == 0 and host_failures == 3 and "credentials_encrypted" not in secret_fields, "Host/provider/credential boundary regression", actual={"unknown_assets": unknown_assets, "host_failures": host_failures, "channel_fields": sorted(secret_fields)})
        return QAEvidence({"unknown_assets": 0, "host_failures": 3, "credential_on_channel": False}, {"unknown_assets": unknown_assets, "host_failures": host_failures, "credential_on_channel": "credentials_encrypted" in secret_fields})

    async def check_browser(self) -> QAEvidence:
        raise QASkip("No browser runtime was invoked by the deterministic backend QA runner; use the generated manual checklist.")

    async def check_external(self) -> QAEvidence:
        raise QAWarn("Deterministic QA intentionally performs no real Meta, OpenAI, PowerDNS, DNS, TLS, billing, courier, or SMTP calls.")


def write_qa_report(report: QAReport, json_path: Path) -> tuple[Path, Path]:
    json_path = json_path.resolve()
    markdown_path = json_path.with_suffix(".md")
    json_path.parent.mkdir(parents=True, exist_ok=True)
    json_path.write_text(json.dumps(report.as_dict(), indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    markdown_path.write_text(report.markdown(), encoding="utf-8")
    return json_path, markdown_path


__all__ = [
    "DemoPlatformQARunner", "QACheck", "QACheckResult", "QAEvidence", "QAFailure",
    "QAReport", "QASkip", "QAStatus", "QAWarn", "require", "write_qa_report",
]
