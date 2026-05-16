"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
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

import { api, ApiError } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { formatLabel } from "@/lib/format";

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
  financeNetCashFlow: number;
  totalTasks: number;
  overdueTasks: number;
  myOpenTasks: number;
  totalEmployees: number;
  presentToday: number;
  pendingAdvances: number;
  posTodayOrders: number;
  posTodaySales: number;
};

type FinanceSummaryResponse = {
  total_cash_bank_balance: number | string;
  net_cash_flow: number | string;
};

type TaskSummaryResponse = {
  total_tasks: number;
  overdue_tasks: number;
  my_open_tasks: number;
};

type HrSummaryResponse = {
  total_employees: number;
  present_today: number;
  pending_advances: number;
};

type PosSummaryResponse = {
  today_pos_orders: number;
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

    if ("count" in payload && typeof payload.count === "number") {
      return payload.count;
    }

    if ("total" in payload && typeof payload.total === "number") {
      return payload.total;
    }
  }

  return 0;
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
    financeNetCashFlow: 0,
    totalTasks: 0,
    overdueTasks: 0,
    myOpenTasks: 0,
    totalEmployees: 0,
    presentToday: 0,
    pendingAdvances: 0,
    posTodayOrders: 0,
    posTodaySales: 0,
  });
  const [statsError, setStatsError] = useState("");
  const [backendStatus, setBackendStatus] = useState<{
    ok: boolean;
    message: string;
  }>({
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
        const [health, products, customers, followUpCustomers, orders, shipments, pendingDispatchOrders, returns, inventory, movements, suppliers, purchaseOrders, businessSettings, financeSummary, taskSummary, hrSummary, posSummary, orderOpsSummary, logisticsOpsSummary, integrationData] = await Promise.all([
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
        const movementRows = Array.isArray(movements) ? movements : [];

        setStats({
          products: getCollectionCount(products),
          customers: getCollectionCount(customers),
          customersWithFollowUp: getCollectionCount(followUpCustomers),
          orders: getCollectionCount(orders),
          shipments: getCollectionCount(shipments),
          pendingShipments: Array.isArray(shipments)
            ? shipments.filter(
                (shipment) =>
                  shipment &&
                  typeof shipment === "object" &&
                  "status" in shipment &&
                  shipment.status === "pending",
              ).length
            : 0,
          deliveredShipments: Array.isArray(shipments)
            ? shipments.filter(
                (shipment) =>
                  shipment &&
                  typeof shipment === "object" &&
                  "status" in shipment &&
                  shipment.status === "delivered",
              ).length
            : 0,
          pendingDispatch: getCollectionCount(pendingDispatchOrders),
          unsettledReconciliation: Array.isArray(shipments)
            ? shipments.filter(
                (shipment) =>
                  shipment &&
                  typeof shipment === "object" &&
                  "reconciliation_status" in shipment &&
                  shipment.reconciliation_status !== "settled" &&
                  shipment.reconciliation_status !== "cancelled",
              ).length
            : 0,
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
          recentStockMovements: movementRows.length,
          financeCashBalance: Number(financeSummary?.total_cash_bank_balance || 0),
          financeNetCashFlow: Number(financeSummary?.net_cash_flow || 0),
          totalTasks: Number(taskSummary?.total_tasks || 0),
          overdueTasks: Number(taskSummary?.overdue_tasks || 0),
          myOpenTasks: Number(taskSummary?.my_open_tasks || 0),
          totalEmployees: Number(hrSummary?.total_employees || 0),
          presentToday: Number(hrSummary?.present_today || 0),
          pendingAdvances: Number(hrSummary?.pending_advances || 0),
          posTodayOrders: Number(posSummary?.today_pos_orders || 0),
          posTodaySales: Number(posSummary?.today_pos_sales || 0),
        });
        setCompanyName(businessSettings.company_name || "Amar eCom");
        setOrderOps(orderOpsSummary);
        setLogisticsOps(logisticsOpsSummary);
        setIntegrationSummary(integrationData);
        setStatsError("");
      } catch (error) {
        if (!isMounted) return;

        const message =
          error instanceof ApiError
            ? error.message
            : "Backend connection failed";

        setBackendStatus({
          ok: false,
          message,
        });
        setStatsError("Could not load live dashboard counts.");
      }
    }

    checkBackend();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)] sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
              Welcome Back
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              {user?.full_name || "Amar eCom Operator"}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500">
              {companyName} is connected to the backend and ready for daily operational work across catalog, inventory, and order modules.
            </p>
          </div>

          <div
            className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium ${
              backendStatus.ok
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-700"
            }`}
          >
            {backendStatus.ok ? (
              <Wifi className="h-4 w-4" />
            ) : (
              <WifiOff className="h-4 w-4" />
            )}
            <span>{backendStatus.message}</span>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Orders", value: stats.orders, icon: ShoppingCart },
          { label: "Purchase Orders", value: stats.purchaseOrders, icon: ClipboardList },
          { label: "Shipments", value: stats.shipments, icon: PackageCheck },
          { label: "Returns", value: stats.returns, icon: RotateCcw },
          { label: "Suppliers", value: stats.suppliers, icon: Building2 },
          { label: "Products", value: stats.products, icon: Package },
          { label: "Customers", value: stats.customers, icon: Users },
          { label: "Inventory", value: stats.inventory, icon: Boxes },
          { label: "Finance Cash", value: stats.financeCashBalance, icon: Wallet, isCurrency: true },
          { label: "POS Sales", value: stats.posTodaySales, icon: Store, isCurrency: true },
          { label: "Tasks", value: stats.totalTasks, icon: TicketCheck },
          { label: "Employees", value: stats.totalEmployees, icon: UserCheck },
        ].map(({ label, value, icon: Icon, isCurrency }) => (
          <article
            key={label}
            className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">{label}</p>
                <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
                  {backendStatus.ok ? (typeof value === "number" && isCurrency ? `BDT ${value.toLocaleString()}` : value) : "--"}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <Icon className="h-5 w-5" />
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                Operations Snapshot
              </p>
              <h2 className="mt-3 text-xl font-semibold text-slate-950">
                Orders and integrations
              </h2>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <ShoppingCart className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-4">
              <p className="text-sm text-sky-700">Ready to ship</p>
              <p className="mt-2 text-2xl font-semibold text-sky-900">{backendStatus.ok ? (orderOps?.ready_to_ship_orders ?? "--") : "--"}</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
              <p className="text-sm text-amber-700">Need shipment</p>
              <p className="mt-2 text-2xl font-semibold text-amber-900">{backendStatus.ok ? (orderOps?.orders_without_shipments_ready_to_ship ?? "--") : "--"}</p>
            </div>
            <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-4">
              <p className="text-sm text-violet-700">Woo sync health</p>
              <p className="mt-2 text-2xl font-semibold text-violet-900">{backendStatus.ok ? (integrationSummary?.woo_recent_sync_failures ?? "--") : "--"}</p>
            </div>
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-4">
              <p className="text-sm text-indigo-700">Courier sync health</p>
              <p className="mt-2 text-2xl font-semibold text-indigo-900">{backendStatus.ok ? (logisticsOps?.shipments_waiting_status_sync_count ?? integrationSummary?.courier_recent_failures ?? "--") : "--"}</p>
            </div>
          </div>
        </article>

        <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                Logistics Snapshot
              </p>
              <h2 className="mt-3 text-xl font-semibold text-slate-950">
                Shipment status mix
              </h2>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <PackageCheck className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
              <p className="text-sm text-amber-700">Pending shipments</p>
              <p className="mt-2 text-2xl font-semibold text-amber-900">
                {backendStatus.ok ? stats.pendingShipments : "--"}
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
              <p className="text-sm text-emerald-700">Delivered shipments</p>
              <p className="mt-2 text-2xl font-semibold text-emerald-900">
                {backendStatus.ok ? stats.deliveredShipments : "--"}
              </p>
            </div>
            <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-4">
              <p className="text-sm text-sky-700">Pending dispatch</p>
              <p className="mt-2 text-2xl font-semibold text-sky-900">
                {backendStatus.ok ? stats.pendingDispatch : "--"}
              </p>
            </div>
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4">
              <p className="text-sm text-rose-700">Unsettled reconciliation</p>
              <p className="mt-2 text-2xl font-semibold text-rose-900">
                {backendStatus.ok ? stats.unsettledReconciliation : "--"}
              </p>
            </div>
          </div>
        </article>

        <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                CRM Snapshot
              </p>
              <h2 className="mt-3 text-xl font-semibold text-slate-950">
                Follow-up workload
              </h2>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <Users className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-4">
            <p className="text-sm text-sky-700">Customers with follow-up dates</p>
            <p className="mt-2 text-2xl font-semibold text-sky-900">
              {backendStatus.ok ? stats.customersWithFollowUp : "--"}
            </p>
          </div>

          <p className="mt-4 text-sm leading-7 text-slate-500">
            This gives the team a lightweight CRM pulse while customer activities and order history grow into a fuller workspace.
          </p>
        </article>

        <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                Tasks Snapshot
              </p>
              <h2 className="mt-3 text-xl font-semibold text-slate-950">
                Team task workload
              </h2>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <TicketCheck className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-sm text-slate-600">Total tasks</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">
                {backendStatus.ok ? stats.totalTasks : "--"}
              </p>
            </div>
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4">
              <p className="text-sm text-rose-700">Overdue tasks</p>
              <p className="mt-2 text-2xl font-semibold text-rose-900">
                {backendStatus.ok ? stats.overdueTasks : "--"}
              </p>
            </div>
            <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-4 sm:col-span-2">
              <p className="text-sm text-sky-700">My open tasks</p>
              <p className="mt-2 text-2xl font-semibold text-sky-900">
                {backendStatus.ok ? stats.myOpenTasks : "--"}
              </p>
            </div>
          </div>
        </article>

        <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                POS Snapshot
              </p>
              <h2 className="mt-3 text-xl font-semibold text-slate-950">
                Walk-in sales pulse
              </h2>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <Store className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-sm text-slate-600">Today POS orders</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">
                {backendStatus.ok ? stats.posTodayOrders : "--"}
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
              <p className="text-sm text-emerald-700">Today POS sales</p>
              <p className="mt-2 text-2xl font-semibold text-emerald-900">
                {backendStatus.ok ? `BDT ${stats.posTodaySales.toLocaleString()}` : "--"}
              </p>
            </div>
          </div>
        </article>

        <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                HR Snapshot
              </p>
              <h2 className="mt-3 text-xl font-semibold text-slate-950">
                People operations
              </h2>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <UserCheck className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-sm text-slate-600">Total employees</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">
                {backendStatus.ok ? stats.totalEmployees : "--"}
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
              <p className="text-sm text-emerald-700">Present today</p>
              <p className="mt-2 text-2xl font-semibold text-emerald-900">
                {backendStatus.ok ? stats.presentToday : "--"}
              </p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 sm:col-span-2">
              <p className="text-sm text-amber-700">Pending salary advances</p>
              <p className="mt-2 text-2xl font-semibold text-amber-900">
                {backendStatus.ok ? stats.pendingAdvances : "--"}
              </p>
            </div>
          </div>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                Inventory Pulse
              </p>
              <h2 className="mt-3 text-xl font-semibold text-slate-950">
                Low-stock watch
              </h2>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
              <Boxes className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
            <p className="text-sm text-amber-700">Low-stock inventory rows</p>
            <p className="mt-2 text-2xl font-semibold text-amber-900">
              {backendStatus.ok ? stats.lowStockInventory : "--"}
            </p>
          </div>
        </article>

        <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                Inventory Pulse
              </p>
              <h2 className="mt-3 text-xl font-semibold text-slate-950">
                Out-of-stock count
              </h2>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-700">
              <Boxes className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4">
            <p className="text-sm text-rose-700">Out-of-stock inventory rows</p>
            <p className="mt-2 text-2xl font-semibold text-rose-900">
              {backendStatus.ok ? stats.outOfStockInventory : "--"}
            </p>
          </div>
        </article>

        <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                Inventory Pulse
              </p>
              <h2 className="mt-3 text-xl font-semibold text-slate-950">
                Recent movements
              </h2>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
              <Boxes className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-4">
            <p className="text-sm text-sky-700">Latest stock movement rows</p>
            <p className="mt-2 text-2xl font-semibold text-sky-900">
              {backendStatus.ok ? stats.recentStockMovements : "--"}
            </p>
          </div>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
          <h2 className="text-lg font-semibold text-slate-950">
            Frontend foundation status
          </h2>
          <div className="mt-5 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              Login page connected to FastAPI auth
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              Protected dashboard shell enabled
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              API client with bearer token support
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              Inventory and orders ready for live testing
            </div>
          </div>
          {statsError ? (
            <p className="mt-4 text-sm text-amber-600">{statsError}</p>
          ) : null}
        </article>

        <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
          <h2 className="text-lg font-semibold text-slate-950">
            Suggested next test
          </h2>
          <p className="mt-4 text-sm leading-7 text-slate-500">
            Sign in, create an inventory record for a warehouse product, then
            create an order and confirm the dashboard counts update from live API
            responses.
          </p>
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
            Backend environment: {formatLabel(backendStatus.ok ? "development" : "offline")}
          </div>
          <Link
            href="/dashboard/reports"
            className="mt-5 inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
          >
            Open Reports
          </Link>
          <Link
            href="/dashboard/finance"
            className="mt-3 inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
          >
            Open Finance
          </Link>
          <Link
            href="/dashboard/tasks"
            className="mt-3 inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
          >
            Open Tasks
          </Link>
          <Link
            href="/dashboard/pos"
            className="mt-3 inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
          >
            Open POS
          </Link>
          <Link
            href="/dashboard/hr"
            className="mt-3 inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
          >
            Open HR
          </Link>
          <Link
            href="/dashboard/admin-tools"
            className="mt-3 inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
          >
            Open Admin Tools
          </Link>
        </article>
      </section>
    </div>
  );
}
