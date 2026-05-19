"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Boxes,
  CircleDollarSign,
  Download,
  Loader2,
  PackageSearch,
  RefreshCcw,
  ShoppingCart,
  Truck,
  Users,
  Wifi,
} from "lucide-react";

import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { api, ApiError } from "@/lib/api";
import { formatCurrency, formatDate, formatDateTime, formatLabel } from "@/lib/format";

type SalesSummary = {
  total_orders: number;
  total_sales: number | string;
  total_discount: number | string;
  total_delivery_charge: number | string;
  average_order_value: number | string;
  paid_orders: number;
  unpaid_orders: number;
  cancelled_orders: number;
  returned_orders: number;
};

type OrderStatusReportItem = {
  status: string;
  count: number;
  total_amount: number | string;
};

type PaymentStatusReportItem = {
  payment_status: string;
  count: number;
  total_amount: number | string;
};

type InventoryReport = {
  total_products: number;
  total_inventory_items: number;
  total_stock_units: number;
  low_stock_count: number;
  out_of_stock_count: number;
  inventory_value_at_cost: number | string;
};

type StockMovementSummaryItem = {
  movement_type: string;
  movement_count: number;
  total_quantity: number;
};

type CustomerReport = {
  total_customers: number;
  customers_with_follow_up: number;
  vip_customers: number;
  wholesale_customers: number;
  reseller_customers: number;
  blocked_customers: number;
};

type LogisticsReport = {
  total_shipments: number;
  pending_shipments: number;
  shipped_shipments: number;
  delivered_shipments: number;
  failed_shipments: number;
  unsettled_reconciliations: number;
  total_cod_amount: number | string;
  total_collected_amount: number | string;
  total_courier_charge: number | string;
};

type TopProductReportItem = {
  product_id: string | null;
  product_name: string;
  sku: string | null;
  total_quantity: number;
  total_revenue: number | string;
};

type LowStockProductReportItem = {
  inventory_item_id: string;
  product_id: string | null;
  warehouse_id: string;
  product_name: string;
  sku: string | null;
  warehouse_name: string | null;
  quantity: number;
  low_stock_threshold: number;
  stock_status: string;
};

type RevenueByDateReportItem = {
  report_date: string;
  order_count: number;
  total_sales: number | string;
};

type RecentOrderActivityItem = {
  order_id: string;
  order_number: string;
  status: string;
  payment_status: string;
  total: number | string;
  customer_name: string | null;
  created_at: string;
};

type IntegrationSummary = {
  woocommerce_orders_count: number;
  woocommerce_products_count: number;
  woo_recent_sync_failures: number;
  woo_last_product_sync_at: string | null;
  woo_last_order_sync_at: string | null;
  courier_sent_count: number;
  courier_recent_failures: number;
  courier_external_delivered_count: number;
  courier_external_failed_returned_count: number;
  pending_integration_actions: number;
};

type CourierFailureLog = {
  id: string;
  provider: string;
  action: string;
  status: string;
  external_id: string | null;
  message: string | null;
  created_at: string;
};

type WooImportedOrder = {
  id: string;
  order_number: string;
  external_status: string | null;
  external_synced_at: string | null;
  total: number | string;
};

type FilterState = {
  start_date: string;
  end_date: string;
};

type ReportsState = {
  salesSummary: SalesSummary | null;
  orderStatus: OrderStatusReportItem[];
  paymentStatus: PaymentStatusReportItem[];
  inventoryReport: InventoryReport | null;
  stockMovementSummary: StockMovementSummaryItem[];
  customerReport: CustomerReport | null;
  logisticsReport: LogisticsReport | null;
  integrationSummary: IntegrationSummary | null;
  courierFailures: CourierFailureLog[];
  wooImportedOrders: WooImportedOrder[];
  topProducts: TopProductReportItem[];
  lowStockProducts: LowStockProductReportItem[];
  revenueByDate: RevenueByDateReportItem[];
  recentOrderActivity: RecentOrderActivityItem[];
};

type ReportTabId = "intelligence" | "assets" | "people";

const reportTabs: Array<{ id: ReportTabId; label: string }> = [
  { id: "intelligence", label: "Intelligence & Assets" },
  { id: "assets", label: "Asset Entry" },
  { id: "people", label: "Human Capital" },
];

const initialFilters: FilterState = {
  start_date: "",
  end_date: "",
};

const initialReportsState: ReportsState = {
  salesSummary: null,
  orderStatus: [],
  paymentStatus: [],
  inventoryReport: null,
  stockMovementSummary: [],
  customerReport: null,
  logisticsReport: null,
  integrationSummary: null,
  courierFailures: [],
  wooImportedOrders: [],
  topProducts: [],
  lowStockProducts: [],
  revenueByDate: [],
  recentOrderActivity: [],
};

function buildDateQuery(filters: FilterState) {
  const params = new URLSearchParams();
  if (filters.start_date) {
    params.set("start_date", filters.start_date);
  }
  if (filters.end_date) {
    params.set("end_date", filters.end_date);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

function appendLimit(path: string, limit: number) {
  return path.includes("?") ? `${path}&limit=${limit}` : `${path}?limit=${limit}`;
}

function downloadCsv(filename: string, columns: string[], rows: Array<Array<string | number | null | undefined>>) {
  const csvLines = [
    columns.join(","),
    ...rows.map((row) =>
      row
        .map((value) => {
          const safe = String(value ?? "").replace(/"/g, '""');
          return `"${safe}"`;
        })
        .join(","),
    ),
  ];

  const blob = new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function getBarWidth(value: number, maxValue: number) {
  if (maxValue <= 0) {
    return 0;
  }
  return Math.max(8, Math.round((value / maxValue) * 100));
}

function numberValue(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function SectionHeader({
  title,
  description,
  exportLabel,
  onExport,
}: {
  title: string;
  description: string;
  exportLabel?: string;
  onExport?: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <h2 className="text-lg font-bold tracking-tight text-slate-950">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      {exportLabel && onExport ? (
        <button
          type="button"
          onClick={onExport}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
        >
          <Download className="h-4 w-4" />
          {exportLabel}
        </button>
      ) : null}
    </div>
  );
}

function SummaryTile({
  label,
  value,
  helper,
  icon: Icon,
}: {
  label: string;
  value: string;
  helper: string;
  icon: typeof CircleDollarSign;
}) {
  return (
    <div className="rounded-[26px] border border-slate-200 bg-white px-5 py-5 shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-500">{label}</p>
          <p className="mt-3 text-2xl font-black tracking-tight text-slate-950">{value}</p>
          <p className="mt-2 text-xs font-medium text-slate-500">{helper}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function MetricBlock({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const toneClasses = {
    default: "border-slate-200 bg-slate-50 text-slate-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    danger: "border-rose-200 bg-rose-50 text-rose-800",
  };

  return (
    <div className={`rounded-2xl border px-4 py-4 ${toneClasses[tone]}`}>
      <p className="text-[10px] font-bold uppercase tracking-[0.22em]">{label}</p>
      <p className="mt-2 text-lg font-bold tracking-tight">{value}</p>
    </div>
  );
}

export default function ReportsPage() {
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [reports, setReports] = useState<ReportsState>(initialReportsState);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<ReportTabId>("intelligence");

  const orderStatusMax = useMemo(
    () => Math.max(0, ...reports.orderStatus.map((item) => item.count)),
    [reports.orderStatus],
  );
  const paymentStatusMax = useMemo(
    () => Math.max(0, ...reports.paymentStatus.map((item) => item.count)),
    [reports.paymentStatus],
  );
  const revenueMax = useMemo(
    () => Math.max(0, ...reports.revenueByDate.map((item) => numberValue(item.total_sales))),
    [reports.revenueByDate],
  );

  async function fetchReports(currentFilters: FilterState) {
    const dateQuery = buildDateQuery(currentFilters);
    const [
      salesSummary,
      orderStatus,
      paymentStatus,
      inventoryReport,
      stockMovementSummary,
      customerReport,
      logisticsReport,
      integrationSummary,
      courierFailures,
      wooImportedOrders,
      topProducts,
      lowStockProducts,
      revenueByDate,
      recentOrderActivity,
    ] = await Promise.all([
      api.get<SalesSummary>(`/reports/sales-summary${dateQuery}`),
      api.get<OrderStatusReportItem[]>(`/reports/order-status${dateQuery}`),
      api.get<PaymentStatusReportItem[]>(`/reports/payment-status${dateQuery}`),
      api.get<InventoryReport>("/reports/inventory"),
      api.get<StockMovementSummaryItem[]>(`/reports/stock-movements-summary${dateQuery}`),
      api.get<CustomerReport>("/reports/customers"),
      api.get<LogisticsReport>("/reports/logistics"),
      api.get<IntegrationSummary>("/reports/integration-summary"),
      api.get<CourierFailureLog[]>("/courier-integrations/logs?status=failed&limit=12").catch(() => []),
      api.get<WooImportedOrder[]>("/orders?source=woocommerce&limit=12").catch(() => []),
      api.get<TopProductReportItem[]>(appendLimit(`/reports/top-products${dateQuery}`, 8)),
      api.get<LowStockProductReportItem[]>(appendLimit("/reports/low-stock-products", 8)),
      api.get<RevenueByDateReportItem[]>(appendLimit(`/reports/revenue-by-date${dateQuery}`, 14)),
      api.get<RecentOrderActivityItem[]>(appendLimit(`/reports/recent-order-activity${dateQuery}`, 8)),
    ]);

    return {
      salesSummary,
      orderStatus,
      paymentStatus,
      inventoryReport,
      stockMovementSummary,
      customerReport,
      logisticsReport,
      integrationSummary,
      courierFailures,
      wooImportedOrders,
      topProducts,
      lowStockProducts,
      revenueByDate,
      recentOrderActivity,
    };
  }

  useEffect(() => {
    let isMounted = true;

    async function loadInitialReports() {
      setIsLoading(true);
      setError("");

      try {
        const nextReports = await fetchReports(initialFilters);
        if (!isMounted) {
          return;
        }
        setReports(nextReports);
      } catch (err) {
        if (!isMounted) {
          return;
        }
        setError(err instanceof ApiError ? err.message : "Failed to load reports");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadInitialReports();
    return () => {
      isMounted = false;
    };
  }, []);

  async function handleRefresh() {
    setIsRefreshing(true);
    setError("");

    try {
      const nextReports = await fetchReports(filters);
      setReports(nextReports);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to refresh reports");
    } finally {
      setIsRefreshing(false);
    }
  }

  const showIntelligence = activeTab === "intelligence";
  const showAssets = activeTab === "assets";
  const showPeople = activeTab === "people";

  return (
    <div className="min-w-0 space-y-5">
      <section className="rounded-[32px] border border-slate-200 bg-white px-6 py-7 shadow-[var(--shadow-soft)] sm:px-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-slate-500">Analytics Workspace</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">Reports</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-500">
              Review sales, assets, customer mix, logistics pressure, and recent movement trends in the tighter v1 reporting loop.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setFilters(initialFilters)}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Clear Dates
            </button>
            <button
              type="button"
              onClick={() => void handleRefresh()}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
          <label className="block">
            <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">Date From</span>
            <input
              type="date"
              value={filters.start_date}
              onChange={(event) => setFilters((current) => ({ ...current, start_date: event.target.value }))}
              className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">Date To</span>
            <input
              type="date"
              value={filters.end_date}
              onChange={(event) => setFilters((current) => ({ ...current, end_date: event.target.value }))}
              className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400"
            />
          </label>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => void handleRefresh()}
              disabled={isRefreshing}
              className="w-full rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 lg:w-auto"
            >
              Apply Range
            </button>
          </div>
        </div>
      </section>

      <section className="overflow-x-auto rounded-[28px] border border-slate-200 bg-white p-2 shadow-[var(--shadow-soft)]">
        <div className="flex min-w-max gap-2">
          {reportTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-[22px] px-5 py-3 text-sm font-bold transition ${
                activeTab === tab.id
                  ? "bg-slate-950 text-white"
                  : "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {error ? <ErrorAlert message={error} /> : null}
      {isLoading ? <LoadingState label="Loading reports..." /> : null}

      {!isLoading && reports.salesSummary && reports.inventoryReport && reports.customerReport && reports.logisticsReport ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-6">
            <SummaryTile
              label="Total Sales"
              value={formatCurrency(reports.salesSummary.total_sales)}
              helper={`${reports.salesSummary.total_orders} orders in range`}
              icon={CircleDollarSign}
            />
            <SummaryTile
              label="Total Orders"
              value={String(reports.salesSummary.total_orders)}
              helper={`${reports.salesSummary.paid_orders} paid`}
              icon={ShoppingCart}
            />
            <SummaryTile
              label="Inventory Value"
              value={formatCurrency(reports.inventoryReport.inventory_value_at_cost)}
              helper={`${reports.inventoryReport.total_stock_units} stock units`}
              icon={Boxes}
            />
            <SummaryTile
              label="Customers"
              value={String(reports.customerReport.total_customers)}
              helper={`${reports.customerReport.customers_with_follow_up} follow-up`}
              icon={Users}
            />
            <SummaryTile
              label="Shipments"
              value={String(reports.logisticsReport.total_shipments)}
              helper={`${reports.logisticsReport.unsettled_reconciliations} unsettled`}
              icon={Truck}
            />
            <SummaryTile
              label="Low Stock"
              value={String(reports.inventoryReport.low_stock_count)}
              helper={`${reports.inventoryReport.out_of_stock_count} out of stock`}
              icon={PackageSearch}
            />
          </section>

          {showIntelligence ? (
            <div className="space-y-5">
              <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
                <SectionHeader
                  title="Sales Summary"
                  description="Primary trading totals and order mix for the selected date window."
                />
                <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <MetricBlock label="Total Sales" value={formatCurrency(reports.salesSummary.total_sales)} tone="success" />
                  <MetricBlock label="Avg. Order Value" value={formatCurrency(reports.salesSummary.average_order_value)} />
                  <MetricBlock label="Discount" value={formatCurrency(reports.salesSummary.total_discount)} />
                  <MetricBlock label="Delivery Charge" value={formatCurrency(reports.salesSummary.total_delivery_charge)} />
                  <MetricBlock label="Paid Orders" value={String(reports.salesSummary.paid_orders)} tone="success" />
                  <MetricBlock label="Unpaid Orders" value={String(reports.salesSummary.unpaid_orders)} tone="warning" />
                  <MetricBlock label="Cancelled Orders" value={String(reports.salesSummary.cancelled_orders)} tone="danger" />
                  <MetricBlock label="Returned Orders" value={String(reports.salesSummary.returned_orders)} tone="danger" />
                </div>
              </section>

              <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
                <article className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
                  <SectionHeader
                    title="Revenue Overview"
                    description="Date-grouped sales with a lightweight visual weight bar."
                  />
                  <div className="mt-6">
                    {reports.revenueByDate.length === 0 ? (
                      <EmptyState title="No revenue rows" description="Sales totals will appear here once orders exist." />
                    ) : (
                      <DataTable columns={["Date", "Orders", "Sales", "Weight"]}>
                        {reports.revenueByDate.map((item) => (
                          <div
                            key={item.report_date}
                            className="grid grid-cols-1 gap-3 px-5 py-4 text-sm text-slate-600 lg:grid-cols-[140px_120px_160px_minmax(180px,1fr)] lg:items-center"
                          >
                            <span className="font-medium text-slate-950">{formatDate(item.report_date)}</span>
                            <span>{item.order_count} orders</span>
                            <span>{formatCurrency(item.total_sales)}</span>
                            <div className="flex items-center gap-3">
                              <div className="h-2 flex-1 rounded-full bg-slate-200">
                                <div
                                  className="h-2 rounded-full bg-slate-950"
                                  style={{ width: `${getBarWidth(numberValue(item.total_sales), revenueMax)}%` }}
                                />
                              </div>
                              <span className="w-12 text-right text-xs font-semibold text-slate-500">
                                {getBarWidth(numberValue(item.total_sales), revenueMax)}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </DataTable>
                    )}
                  </div>
                </article>

                <article className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
                  <SectionHeader
                    title="Top Products"
                    description="Best-selling products by quantity and revenue."
                    exportLabel="Export CSV"
                    onExport={() =>
                      downloadCsv(
                        "top-products-report.csv",
                        ["product_id", "product_name", "sku", "total_quantity", "total_revenue"],
                        reports.topProducts.map((item) => [
                          item.product_id,
                          item.product_name,
                          item.sku,
                          item.total_quantity,
                          item.total_revenue,
                        ]),
                      )
                    }
                  />
                  <div className="mt-6">
                    {reports.topProducts.length === 0 ? (
                      <EmptyState title="No top products yet" description="Create orders to populate this ranking." />
                    ) : (
                      <DataTable columns={["Product", "SKU", "Qty", "Revenue"]}>
                        {reports.topProducts.map((item) => (
                          <div
                            key={`${item.product_id ?? item.product_name}-${item.sku ?? "no-sku"}`}
                            className="grid grid-cols-1 gap-3 px-5 py-4 text-sm text-slate-600 md:grid-cols-4"
                          >
                            <span className="font-medium text-slate-950">{item.product_name}</span>
                            <span>{item.sku || "No SKU"}</span>
                            <span>{item.total_quantity}</span>
                            <span>{formatCurrency(item.total_revenue)}</span>
                          </div>
                        ))}
                      </DataTable>
                    )}
                  </div>
                </article>
              </section>

              <section className="grid gap-5 xl:grid-cols-2">
                <article className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
                  <SectionHeader
                    title="Order Status"
                    description="Status count and total amount with quick visual weighting."
                    exportLabel="Export CSV"
                    onExport={() =>
                      downloadCsv(
                        "order-status-report.csv",
                        ["status", "count", "total_amount"],
                        reports.orderStatus.map((item) => [item.status, item.count, item.total_amount]),
                      )
                    }
                  />
                  <div className="mt-6 space-y-3">
                    {reports.orderStatus.length === 0 ? (
                      <EmptyState title="No order status data" description="Create orders to build the status breakdown." />
                    ) : (
                      reports.orderStatus.map((item) => (
                        <div key={item.status} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div className="min-w-[160px]">
                              <StatusBadge status={item.status} />
                            </div>
                            <div className="w-full lg:max-w-[220px]">
                              <div className="h-2 rounded-full bg-slate-200">
                                <div
                                  className="h-2 rounded-full bg-slate-950"
                                  style={{ width: `${getBarWidth(item.count, orderStatusMax)}%` }}
                                />
                              </div>
                            </div>
                            <p className="text-sm text-slate-600">{item.count} orders</p>
                            <p className="text-sm font-semibold text-slate-950">{formatCurrency(item.total_amount)}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </article>

                <article className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
                  <SectionHeader
                    title="Payment Status"
                    description="Paid and unpaid mix for the same report window."
                  />
                  <div className="mt-6 space-y-3">
                    {reports.paymentStatus.length === 0 ? (
                      <EmptyState title="No payment status data" description="Create orders to build the payment breakdown." />
                    ) : (
                      reports.paymentStatus.map((item) => (
                        <div key={item.payment_status} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div className="min-w-[160px]">
                              <StatusBadge status={item.payment_status} />
                            </div>
                            <div className="w-full lg:max-w-[220px]">
                              <div className="h-2 rounded-full bg-slate-200">
                                <div
                                  className="h-2 rounded-full bg-sky-600"
                                  style={{ width: `${getBarWidth(item.count, paymentStatusMax)}%` }}
                                />
                              </div>
                            </div>
                            <p className="text-sm text-slate-600">{item.count} orders</p>
                            <p className="text-sm font-semibold text-slate-950">{formatCurrency(item.total_amount)}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </article>
              </section>
            </div>
          ) : null}

          {showAssets ? (
            <div className="space-y-5">
              <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
                <SectionHeader
                  title="Inventory Value"
                  description="Asset-level inventory counts, units, and cost visibility."
                />
                <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <MetricBlock label="Inventory Value (Cost)" value={formatCurrency(reports.inventoryReport.inventory_value_at_cost)} tone="success" />
                  <MetricBlock label="Products" value={String(reports.inventoryReport.total_products)} />
                  <MetricBlock label="Inventory Rows" value={String(reports.inventoryReport.total_inventory_items)} />
                  <MetricBlock label="Stock Units" value={String(reports.inventoryReport.total_stock_units)} />
                  <MetricBlock label="Out of Stock" value={String(reports.inventoryReport.out_of_stock_count)} tone="danger" />
                </div>
              </section>

              <section className="grid gap-5 xl:grid-cols-[1.02fr_0.98fr]">
                <article className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
                  <SectionHeader
                    title="Low Stock Products"
                    description="Products at or below threshold with warehouse context."
                    exportLabel="Export CSV"
                    onExport={() =>
                      downloadCsv(
                        "low-stock-products.csv",
                        ["product_name", "sku", "warehouse_name", "quantity", "low_stock_threshold", "stock_status"],
                        reports.lowStockProducts.map((item) => [
                          item.product_name,
                          item.sku,
                          item.warehouse_name,
                          item.quantity,
                          item.low_stock_threshold,
                          item.stock_status,
                        ]),
                      )
                    }
                  />
                  <div className="mt-6">
                    {reports.lowStockProducts.length === 0 ? (
                      <EmptyState title="No low stock products" description="Rows at or below threshold will appear here." />
                    ) : (
                      <DataTable columns={["Product", "Warehouse", "Qty", "Threshold", "Status"]}>
                        {reports.lowStockProducts.map((item) => (
                          <div
                            key={item.inventory_item_id}
                            className="grid grid-cols-1 gap-3 px-5 py-4 text-sm text-slate-600 md:grid-cols-5"
                          >
                            <div>
                              <p className="font-medium text-slate-950">{item.product_name}</p>
                              <p className="mt-1 text-xs text-slate-500">{item.sku || "No SKU"}</p>
                            </div>
                            <span>{item.warehouse_name || "Unknown warehouse"}</span>
                            <span>{item.quantity}</span>
                            <span>{item.low_stock_threshold}</span>
                            <span>
                              <StatusBadge status={item.stock_status} label={formatLabel(item.stock_status)} />
                            </span>
                          </div>
                        ))}
                      </DataTable>
                    )}
                  </div>
                </article>

                <article className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
                  <SectionHeader
                    title="Stock Movement Summary"
                    description="Grouped movement counts and quantities over the selected date range."
                    exportLabel="Export CSV"
                    onExport={() =>
                      downloadCsv(
                        "stock-movement-summary.csv",
                        ["movement_type", "movement_count", "total_quantity"],
                        reports.stockMovementSummary.map((item) => [
                          item.movement_type,
                          item.movement_count,
                          item.total_quantity,
                        ]),
                      )
                    }
                  />
                  <div className="mt-6">
                    {reports.stockMovementSummary.length === 0 ? (
                      <EmptyState title="No stock movement summary yet" description="Stock activity will populate this table." />
                    ) : (
                      <DataTable columns={["Movement Type", "Movement Count", "Total Quantity"]}>
                        {reports.stockMovementSummary.map((item) => (
                          <div
                            key={item.movement_type}
                            className="grid grid-cols-1 gap-3 px-5 py-4 text-sm text-slate-600 md:grid-cols-3"
                          >
                            <span>
                              <StatusBadge status={item.movement_type} label={formatLabel(item.movement_type)} />
                            </span>
                            <span>{item.movement_count}</span>
                            <span>{item.total_quantity}</span>
                          </div>
                        ))}
                      </DataTable>
                    )}
                  </div>
                </article>
              </section>
            </div>
          ) : null}

          {showPeople ? (
            <div className="space-y-5">
              <section className="grid gap-5 xl:grid-cols-[0.98fr_1.02fr]">
                <article className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
                  <SectionHeader
                    title="Customer CRM"
                    description="Customer segmentation and follow-up exposure."
                  />
                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <MetricBlock label="Total Customers" value={String(reports.customerReport.total_customers)} />
                    <MetricBlock label="With Follow-up" value={String(reports.customerReport.customers_with_follow_up)} tone="warning" />
                    <MetricBlock label="VIP" value={String(reports.customerReport.vip_customers)} tone="success" />
                    <MetricBlock label="Wholesale" value={String(reports.customerReport.wholesale_customers)} />
                    <MetricBlock label="Reseller" value={String(reports.customerReport.reseller_customers)} />
                    <MetricBlock label="Blocked" value={String(reports.customerReport.blocked_customers)} tone="danger" />
                  </div>
                </article>

                <article className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
                  <SectionHeader
                    title="Logistics"
                    description="Shipment and reconciliation totals for operational monitoring."
                  />
                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <MetricBlock label="Total Shipments" value={String(reports.logisticsReport.total_shipments)} />
                    <MetricBlock label="Pending" value={String(reports.logisticsReport.pending_shipments)} tone="warning" />
                    <MetricBlock label="Shipped" value={String(reports.logisticsReport.shipped_shipments)} />
                    <MetricBlock label="Delivered" value={String(reports.logisticsReport.delivered_shipments)} tone="success" />
                    <MetricBlock label="Failed" value={String(reports.logisticsReport.failed_shipments)} tone="danger" />
                    <MetricBlock label="Unsettled" value={String(reports.logisticsReport.unsettled_reconciliations)} tone="warning" />
                    <MetricBlock label="COD Amount" value={formatCurrency(reports.logisticsReport.total_cod_amount)} />
                    <MetricBlock label="Courier Charge" value={formatCurrency(reports.logisticsReport.total_courier_charge)} />
                  </div>
                </article>
              </section>

              <section className="grid gap-5 xl:grid-cols-[1.02fr_0.98fr]">
                <article className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
                  <SectionHeader
                    title="Recent Order Activity"
                    description="Latest order creation activity for monitoring."
                    exportLabel="Export CSV"
                    onExport={() =>
                      downloadCsv(
                        "recent-order-activity.csv",
                        ["order_number", "customer_name", "status", "payment_status", "total", "created_at"],
                        reports.recentOrderActivity.map((item) => [
                          item.order_number,
                          item.customer_name,
                          item.status,
                          item.payment_status,
                          item.total,
                          item.created_at,
                        ]),
                      )
                    }
                  />
                  <div className="mt-6">
                    {reports.recentOrderActivity.length === 0 ? (
                      <EmptyState title="No recent order activity" description="Recent orders will appear here once the system is active." />
                    ) : (
                      <DataTable columns={["Order", "Customer", "Status", "Payment", "Total", "Created"]}>
                        {reports.recentOrderActivity.map((item) => (
                          <div
                            key={item.order_id}
                            className="grid grid-cols-1 gap-3 px-5 py-4 text-sm text-slate-600 2xl:grid-cols-6"
                          >
                            <span className="font-medium text-slate-950">{item.order_number}</span>
                            <span>{item.customer_name || "Guest customer"}</span>
                            <span>
                              <StatusBadge status={item.status} />
                            </span>
                            <span>
                              <StatusBadge status={item.payment_status} />
                            </span>
                            <span>{formatCurrency(item.total)}</span>
                            <span>{formatDate(item.created_at)}</span>
                          </div>
                        ))}
                      </DataTable>
                    )}
                  </div>
                </article>

                <article className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
                  <SectionHeader
                    title="Integration Health"
                    description="Safe visibility into WooCommerce imports and courier API failures."
                    exportLabel="Export Summary CSV"
                    onExport={() =>
                      downloadCsv(
                        "integration-summary.csv",
                        ["metric", "value"],
                        reports.integrationSummary
                          ? [
                              ["woocommerce_orders_count", reports.integrationSummary.woocommerce_orders_count],
                              ["woocommerce_products_count", reports.integrationSummary.woocommerce_products_count],
                              ["woo_recent_sync_failures", reports.integrationSummary.woo_recent_sync_failures],
                              ["woo_last_product_sync_at", reports.integrationSummary.woo_last_product_sync_at],
                              ["woo_last_order_sync_at", reports.integrationSummary.woo_last_order_sync_at],
                              ["courier_sent_count", reports.integrationSummary.courier_sent_count],
                              ["courier_recent_failures", reports.integrationSummary.courier_recent_failures],
                              ["courier_external_delivered_count", reports.integrationSummary.courier_external_delivered_count],
                              [
                                "courier_external_failed_returned_count",
                                reports.integrationSummary.courier_external_failed_returned_count,
                              ],
                              ["pending_integration_actions", reports.integrationSummary.pending_integration_actions],
                            ]
                          : [],
                      )
                    }
                  />
                  <div className="mt-6 space-y-4">
                    {reports.integrationSummary ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <MetricBlock
                          label="Woo Orders"
                          value={String(reports.integrationSummary.woocommerce_orders_count)}
                        />
                        <MetricBlock
                          label="Woo Products"
                          value={String(reports.integrationSummary.woocommerce_products_count)}
                        />
                        <MetricBlock
                          label="Woo Failures"
                          value={String(reports.integrationSummary.woo_recent_sync_failures)}
                          tone={reports.integrationSummary.woo_recent_sync_failures > 0 ? "danger" : "success"}
                        />
                        <MetricBlock
                          label="Pending Actions"
                          value={String(reports.integrationSummary.pending_integration_actions)}
                          tone={reports.integrationSummary.pending_integration_actions > 0 ? "warning" : "success"}
                        />
                      </div>
                    ) : (
                      <EmptyState title="No integration summary" description="Integration totals are currently unavailable." />
                    )}

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center gap-2">
                        <Wifi className="h-4 w-4 text-slate-600" />
                        <h3 className="text-sm font-bold text-slate-950">Courier API Logs</h3>
                      </div>
                      <div className="mt-4 space-y-3">
                        {reports.courierFailures.length === 0 ? (
                          <p className="text-sm text-slate-500">No recent courier failures.</p>
                        ) : (
                          reports.courierFailures.slice(0, 4).map((item) => (
                            <div key={item.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                <div>
                                  <p className="text-sm font-semibold text-slate-950">
                                    {formatLabel(item.provider)} · {formatLabel(item.action)}
                                  </p>
                                  <p className="mt-1 text-xs text-slate-500">{item.message || "No message available."}</p>
                                </div>
                                <div className="text-right">
                                  <StatusBadge status={item.status} />
                                  <p className="mt-2 text-xs text-slate-500">{formatDateTime(item.created_at)}</p>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <h3 className="text-sm font-bold text-slate-950">WooCommerce Orders</h3>
                      <div className="mt-4 space-y-3">
                        {reports.wooImportedOrders.length === 0 ? (
                          <p className="text-sm text-slate-500">No WooCommerce-imported orders in the current sample.</p>
                        ) : (
                          reports.wooImportedOrders.slice(0, 4).map((item) => (
                            <div key={item.id} className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 md:flex-row md:items-center md:justify-between">
                              <div>
                                <p className="text-sm font-semibold text-slate-950">{item.order_number}</p>
                                <p className="mt-1 text-xs text-slate-500">
                                  {item.external_synced_at ? formatDateTime(item.external_synced_at) : "Not synced yet"}
                                </p>
                              </div>
                              <div className="text-right">
                                <StatusBadge status={item.external_status || "unknown"} label={formatLabel(item.external_status || "unknown")} />
                                <p className="mt-2 text-sm font-semibold text-slate-950">{formatCurrency(item.total)}</p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              </section>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
