"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Boxes,
  Building2,
  ClipboardList,
  Package,
  PackageCheck,
  RotateCcw,
  ShoppingCart,
  Store,
  TicketCheck,
  UserCheck,
  Users,
  Wallet,
  Wifi,
  WifiOff,
} from "lucide-react";

import { OpsFilterBar } from "@/components/ui/ops-filter-bar";
import { OpsPageHeader } from "@/components/ui/ops-page-header";
import { OpsStatusBadge } from "@/components/ui/ops-status-badge";
import { OpsSummaryCard } from "@/components/ui/ops-summary-card";
import { api, ApiError } from "@/lib/api";
import { getUser } from "@/lib/auth";

type HealthResponse = {
  status: string;
  service: string;
  environment: string;
};

type BusinessSettingsResponse = {
  company_name: string;
};

type StatsState = {
  orders: number;
  shipments: number;
  pendingShipments: number;
  deliveredShipments: number;
  pendingDispatch: number;
  unsettledReconciliation: number;
  customersWithFollowUp: number;
  returns: number;
  suppliers: number;
  purchaseOrders: number;
  products: number;
  customers: number;
  inventory: number;
  lowStockInventory: number;
  outOfStockInventory: number;
  recentStockMovements: number;
  financeCashBalance: number;
  totalTasks: number;
  totalEmployees: number;
  posTodaySales: number;
};

type FinanceSummaryResponse = {
  total_cash_bank_balance: number | string;
};

type TaskSummaryResponse = {
  total_tasks: number;
};

type HrSummaryResponse = {
  total_employees: number;
};

type PosSummaryResponse = {
  today_pos_sales: number | string;
};

type OrderOperationsSummary = {
  ready_to_ship_orders: number;
  orders_without_shipments_ready_to_ship: number;
};

type LogisticsOperationsSummary = {
  shipments_waiting_status_sync_count: number;
};

type IntegrationSummary = {
  woo_recent_sync_failures: number;
  courier_recent_failures: number;
};

function getCollectionCount(payload: unknown) {
  if (Array.isArray(payload)) {
    return payload.length;
  }

  if (payload && typeof payload === "object") {
    if ("items" in payload && Array.isArray(payload.items)) {
      return payload.items.length;
    }

    if ("data" in payload && Array.isArray(payload.data)) {
      return payload.data.length;
    }

    if ("results" in payload && Array.isArray(payload.results)) {
      return payload.results.length;
    }
  }

  return 0;
}

function formatCurrency(value: number) {
  return `BDT ${value.toLocaleString()}`;
}

export default function DashboardPage() {
  const user = getUser();
  const [companyName, setCompanyName] = useState("Amar eCom");
  const [stats, setStats] = useState<StatsState>({
    orders: 0,
    shipments: 0,
    pendingShipments: 0,
    deliveredShipments: 0,
    pendingDispatch: 0,
    unsettledReconciliation: 0,
    customersWithFollowUp: 0,
    returns: 0,
    suppliers: 0,
    purchaseOrders: 0,
    products: 0,
    customers: 0,
    inventory: 0,
    lowStockInventory: 0,
    outOfStockInventory: 0,
    recentStockMovements: 0,
    financeCashBalance: 0,
    totalTasks: 0,
    totalEmployees: 0,
    posTodaySales: 0,
  });
  const [statsError, setStatsError] = useState("");
  const [backendStatus, setBackendStatus] = useState({
    ok: false,
    message: "Checking backend connection...",
  });
  const [orderOps, setOrderOps] = useState<OrderOperationsSummary | null>(null);
  const [logisticsOps, setLogisticsOps] = useState<LogisticsOperationsSummary | null>(null);
  const [integrationSummary, setIntegrationSummary] = useState<IntegrationSummary | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function checkBackend() {
      try {
        const [
          health,
          products,
          customers,
          followUpCustomers,
          orders,
          shipments,
          pendingDispatchOrders,
          returns,
          inventory,
          movements,
          suppliers,
          purchaseOrders,
          businessSettings,
          financeSummary,
          taskSummary,
          hrSummary,
          posSummary,
          orderOpsSummary,
          logisticsOpsSummary,
          integrationData,
        ] = await Promise.all([
          api.get<HealthResponse>("/health"),
          api.get<unknown>("/products?skip=0&limit=100"),
          api.get<unknown>("/customers?skip=0&limit=100"),
          api.get<unknown>("/customers?skip=0&limit=100&has_follow_up=true"),
          api.get<unknown>("/orders?skip=0&limit=100"),
          api.get<unknown>("/shipments?skip=0&limit=100"),
          api.get<unknown>("/logistics/pending-dispatch?skip=0&limit=100"),
          api.get<unknown>("/returns?skip=0&limit=100"),
          api.get<unknown>("/inventory?skip=0&limit=100"),
          api.get<unknown>("/stock-movements?skip=0&limit=20"),
          api.get<unknown>("/suppliers?skip=0&limit=100"),
          api.get<unknown>("/purchase-orders?skip=0&limit=100"),
          api.get<BusinessSettingsResponse>("/settings/business"),
          api.get<FinanceSummaryResponse>("/finance/summary").catch(() => null),
          api.get<TaskSummaryResponse>("/tasks/summary").catch(() => null),
          api.get<HrSummaryResponse>("/hr/summary").catch(() => null),
          api.get<PosSummaryResponse>("/pos/summary").catch(() => null),
          api.get<OrderOperationsSummary>("/orders/operations-summary").catch(() => null),
          api.get<LogisticsOperationsSummary>("/logistics/operations-summary").catch(() => null),
          api.get<IntegrationSummary>("/reports/integration-summary").catch(() => null),
        ]);

        if (!isMounted) return;

        setBackendStatus({
          ok: health.status === "ok",
          message: `${health.service} (${health.environment})`,
        });

        const inventoryRows = Array.isArray(inventory) ? inventory : [];
        const shipmentsRows = Array.isArray(shipments) ? shipments : [];

        setStats({
          products: getCollectionCount(products),
          customers: getCollectionCount(customers),
          customersWithFollowUp: getCollectionCount(followUpCustomers),
          orders: getCollectionCount(orders),
          shipments: getCollectionCount(shipments),
          pendingShipments: shipmentsRows.filter(
            (shipment) =>
              shipment &&
              typeof shipment === "object" &&
              "status" in shipment &&
              shipment.status === "pending",
          ).length,
          deliveredShipments: shipmentsRows.filter(
            (shipment) =>
              shipment &&
              typeof shipment === "object" &&
              "status" in shipment &&
              shipment.status === "delivered",
          ).length,
          pendingDispatch: getCollectionCount(pendingDispatchOrders),
          unsettledReconciliation: shipmentsRows.filter(
            (shipment) =>
              shipment &&
              typeof shipment === "object" &&
              "reconciliation_status" in shipment &&
              shipment.reconciliation_status !== "settled" &&
              shipment.reconciliation_status !== "cancelled",
          ).length,
          returns: getCollectionCount(returns),
          suppliers: getCollectionCount(suppliers),
          purchaseOrders: getCollectionCount(purchaseOrders),
          inventory: getCollectionCount(inventory),
          lowStockInventory: inventoryRows.filter(
            (item) =>
              item &&
              typeof item === "object" &&
              "quantity" in item &&
              "low_stock_threshold" in item &&
              typeof item.quantity === "number" &&
              typeof item.low_stock_threshold === "number" &&
              item.quantity > 0 &&
              item.quantity <= item.low_stock_threshold,
          ).length,
          outOfStockInventory: inventoryRows.filter(
            (item) =>
              item &&
              typeof item === "object" &&
              "quantity" in item &&
              typeof item.quantity === "number" &&
              item.quantity <= 0,
          ).length,
          recentStockMovements: Array.isArray(movements) ? movements.length : 0,
          financeCashBalance: Number(financeSummary?.total_cash_bank_balance || 0),
          totalTasks: Number(taskSummary?.total_tasks || 0),
          totalEmployees: Number(hrSummary?.total_employees || 0),
          posTodaySales: Number(posSummary?.today_pos_sales || 0),
        });
        setCompanyName(businessSettings.company_name || "Amar eCom");
        setOrderOps(orderOpsSummary);
        setLogisticsOps(logisticsOpsSummary);
        setIntegrationSummary(integrationData);
        setStatsError("");
      } catch (error) {
        if (!isMounted) return;

        setBackendStatus({
          ok: false,
          message: error instanceof ApiError ? error.message : "Backend connection failed",
        });
        setStatsError("Could not load live dashboard counts.");
      }
    }

    void checkBackend();
    return () => {
      isMounted = false;
    };
  }, []);

  const topCards = useMemo(
    () => [
      { label: "Orders", value: stats.orders.toLocaleString(), icon: ShoppingCart, tone: "info" as const },
      { label: "Shipments", value: stats.shipments.toLocaleString(), icon: PackageCheck, tone: "default" as const },
      { label: "Products", value: stats.products.toLocaleString(), icon: Package, tone: "default" as const },
      { label: "Customers", value: stats.customers.toLocaleString(), icon: Users, tone: "info" as const },
      { label: "Returns", value: stats.returns.toLocaleString(), icon: RotateCcw, tone: "warning" as const },
      { label: "Suppliers", value: stats.suppliers.toLocaleString(), icon: Building2, tone: "default" as const },
      { label: "Finance Cash", value: formatCurrency(stats.financeCashBalance), icon: Wallet, tone: "success" as const },
      { label: "POS Sales", value: formatCurrency(stats.posTodaySales), icon: Store, tone: "success" as const },
    ],
    [stats],
  );

  return (
    <div className="space-y-5">
      <section className="card-base px-6 py-7 sm:px-8">
        <OpsPageHeader
          eyebrow="Morning Overview"
          title={user?.full_name || "Amar eCom Operator"}
          description={`${companyName} is connected and ready for day-to-day operations across orders, inventory, customers, logistics, finance, HR, tasks, and POS. This shell now leans into the denser v1 console language while preserving the modular v2 route architecture.`}
          meta={
            <div className="flex items-center gap-2">
              {backendStatus.ok ? <Wifi className="h-4 w-4 text-emerald-600" /> : <WifiOff className="h-4 w-4 text-amber-600" />}
              <span>{backendStatus.message}</span>
            </div>
          }
          actions={
            <>
              <Link href="/dashboard/orders" className="btn-primary">
                <ShoppingCart className="h-4 w-4" />
                Open Orders
              </Link>
              <Link
                href="/dashboard/logistics"
                className="inline-flex items-center gap-2 rounded-full border border-[var(--color-brd)] bg-white px-4 py-3 text-sm font-semibold text-[var(--color-txt-sec)] shadow-[var(--shadow-subtle)] transition hover:bg-[var(--color-surf-hover)]"
              >
                <PackageCheck className="h-4 w-4" />
                Open Logistics
              </Link>
            </>
          }
        />
      </section>

      <OpsFilterBar
        title="Quick Paths"
        description="Keep the landing screen acting like an operations console by surfacing high-frequency routes directly under the header."
      >
        {[
          { href: "/dashboard/reports", label: "Reports" },
          { href: "/dashboard/finance", label: "Finance" },
          { href: "/dashboard/tasks", label: "Tasks" },
          { href: "/dashboard/hr", label: "HR" },
          { href: "/dashboard/admin-tools", label: "Admin Tools" },
          { href: "/dashboard/woocommerce", label: "WooCommerce" },
          { href: "/dashboard/courier-integrations", label: "Courier Integrations" },
        ].map((item) => (
          <Link key={item.href} href={item.href} className="ops-filter-chip">
            {item.label}
          </Link>
        ))}
      </OpsFilterBar>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {topCards.map((card) => (
          <OpsSummaryCard
            key={card.label}
            eyebrow="Live Metric"
            label={card.label}
            value={backendStatus.ok ? card.value : "--"}
            icon={card.icon}
            tone={card.tone}
          />
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <article className="card-base p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="ops-micro-label">Operations Snapshot</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--color-txt-pri)]">
                Orders, sync, and dispatch
              </h2>
            </div>
            <OpsStatusBadge label={backendStatus.ok ? "Live" : "Offline"} tone={backendStatus.ok ? "success" : "warning"} dot />
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[20px] border border-sky-200 bg-sky-50 px-4 py-4">
              <p className="ops-micro-label text-sky-600">Ready Queue</p>
              <p className="mt-2 text-3xl font-semibold text-sky-900">{backendStatus.ok ? (orderOps?.ready_to_ship_orders ?? "--") : "--"}</p>
              <p className="mt-2 text-sm text-sky-800">Orders ready for dispatch.</p>
            </div>
            <div className="rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-4">
              <p className="ops-micro-label text-amber-600">Need Shipment</p>
              <p className="mt-2 text-3xl font-semibold text-amber-900">{backendStatus.ok ? (orderOps?.orders_without_shipments_ready_to_ship ?? "--") : "--"}</p>
              <p className="mt-2 text-sm text-amber-800">Ready orders missing shipment creation.</p>
            </div>
            <div className="rounded-[20px] border border-violet-200 bg-violet-50 px-4 py-4">
              <p className="ops-micro-label text-violet-600">Woo Health</p>
              <p className="mt-2 text-3xl font-semibold text-violet-900">{backendStatus.ok ? (integrationSummary?.woo_recent_sync_failures ?? "--") : "--"}</p>
              <p className="mt-2 text-sm text-violet-800">Recent Woo sync failure count.</p>
            </div>
            <div className="rounded-[20px] border border-indigo-200 bg-indigo-50 px-4 py-4">
              <p className="ops-micro-label text-indigo-600">Courier Sync</p>
              <p className="mt-2 text-3xl font-semibold text-indigo-900">
                {backendStatus.ok ? (logisticsOps?.shipments_waiting_status_sync_count ?? integrationSummary?.courier_recent_failures ?? "--") : "--"}
              </p>
              <p className="mt-2 text-sm text-indigo-800">Shipments waiting for safe status sync.</p>
            </div>
          </div>
        </article>

        <article className="card-base p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="ops-micro-label">Operator Focus</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--color-txt-pri)]">
                Today&apos;s next actions
              </h2>
            </div>
            <div className="rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-3 py-2 text-sm font-medium text-[var(--color-txt-sec)]">
              Manual + safe
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {[
              "Review ready-to-ship orders and create missing shipments.",
              "Check WooCommerce manual sync health before order refreshes.",
              "Review courier status sync backlog before reconciliation work.",
              "Confirm low-stock and out-of-stock items before procurement follow-up.",
            ].map((item) => (
              <div key={item} className="flex items-start gap-3 rounded-[20px] border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-4 text-sm text-[var(--color-txt-sec)]">
                <span className="mt-0.5 inline-block h-2 w-2 rounded-full bg-[var(--color-accent)]" />
                <span>{item}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/dashboard/orders" className="inline-flex items-center gap-2 rounded-full border border-[var(--color-brd)] bg-white px-4 py-3 text-sm font-semibold text-[var(--color-txt-sec)] shadow-[var(--shadow-subtle)] transition hover:bg-[var(--color-surf-hover)]">
              Review orders
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/dashboard/logistics" className="inline-flex items-center gap-2 rounded-full border border-[var(--color-brd)] bg-white px-4 py-3 text-sm font-semibold text-[var(--color-txt-sec)] shadow-[var(--shadow-subtle)] transition hover:bg-[var(--color-surf-hover)]">
              Open logistics
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <OpsSummaryCard eyebrow="Inventory Pulse" label="Low-stock watch" value={backendStatus.ok ? stats.lowStockInventory.toLocaleString() : "--"} icon={Boxes} tone="warning" helper="Inventory rows at or below threshold." />
        <OpsSummaryCard eyebrow="Inventory Pulse" label="Out-of-stock count" value={backendStatus.ok ? stats.outOfStockInventory.toLocaleString() : "--"} icon={Boxes} tone="danger" helper="Rows currently out of stock." />
        <OpsSummaryCard eyebrow="Inventory Pulse" label="Recent movements" value={backendStatus.ok ? stats.recentStockMovements.toLocaleString() : "--"} icon={Boxes} tone="info" helper="Latest stock movement rows loaded from the ledger." />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <article className="card-base p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="ops-micro-label">Module Pulse</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--color-txt-pri)]">
                Daily workspace mix
              </h2>
            </div>
            <OpsStatusBadge label={backendStatus.ok ? "Connected" : "Retrying"} tone={backendStatus.ok ? "info" : "warning"} />
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {[
              { label: "Purchase Orders", value: stats.purchaseOrders, icon: ClipboardList },
              { label: "Tasks", value: stats.totalTasks, icon: TicketCheck },
              { label: "Employees", value: stats.totalEmployees, icon: UserCheck },
              { label: "POS Sales", value: stats.posTodaySales, icon: Store },
            ].map((item) => (
              <div key={item.label} className="rounded-[20px] border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="ops-micro-label">{item.label}</p>
                    <p className="mt-2 text-2xl font-semibold text-[var(--color-txt-pri)]">
                      {backendStatus.ok
                        ? item.label === "POS Sales"
                          ? formatCurrency(item.value)
                          : item.value.toLocaleString()
                        : "--"}
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--color-brd)] bg-white text-[var(--color-txt-sec)]">
                    <item.icon className="h-4 w-4" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {statsError ? <p className="mt-4 text-sm font-medium text-amber-700">{statsError}</p> : null}
        </article>

        <article className="card-base p-6">
          <div>
            <p className="ops-micro-label">Workspace Note</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--color-txt-pri)]">
              Phase 14H polish
            </h2>
            <p className="mt-3 text-sm leading-7 text-[var(--color-txt-sec)]">
              The shared shell, cards, badges, and spacing language now carry through orders, logistics, inventory, CRM, reports, finance, HR, POS, settings, and integration routes. The remaining work is primarily regression QA and optional deeper exact-v1 recreation.
            </p>
          </div>

          <div className="mt-6 space-y-3">
            {[
              { status: "complete", label: "Shell density and grouped sidebar" },
              { status: "complete", label: "Topbar visual parity foundation" },
              { status: "complete", label: "Dashboard visual language pass" },
              { status: "complete", label: "Orders, logistics, inventory, CRM, and reports parity passes" },
              { status: "next", label: "Cross-route UI regression QA" },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-[20px] border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3">
                <span className="text-sm font-medium text-[var(--color-txt-pri)]">{item.label}</span>
                <OpsStatusBadge
                  label={item.status === "complete" ? "Complete" : "Next"}
                  tone={item.status === "complete" ? "success" : "info"}
                />
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/dashboard/reports" className="ops-filter-chip">Reports</Link>
            <Link href="/dashboard/finance" className="ops-filter-chip">Finance</Link>
            <Link href="/dashboard/tasks" className="ops-filter-chip">Tasks</Link>
            <Link href="/dashboard/hr" className="ops-filter-chip">HR</Link>
          </div>
        </article>
      </section>
    </div>
  );
}
