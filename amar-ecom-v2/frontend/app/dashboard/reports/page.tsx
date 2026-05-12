"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Download,
  Loader2,
  PackageSearch,
  RefreshCcw,
  TrendingUp,
} from "lucide-react";

import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { api, ApiError } from "@/lib/api";
import { formatCurrency, formatDate, formatLabel } from "@/lib/format";

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
  topProducts: TopProductReportItem[];
  lowStockProducts: LowStockProductReportItem[];
  revenueByDate: RevenueByDateReportItem[];
  recentOrderActivity: RecentOrderActivityItem[];
};

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

export default function ReportsPage() {
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [reports, setReports] = useState<ReportsState>(initialReportsState);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");

  const orderStatusMax = useMemo(
    () => Math.max(0, ...reports.orderStatus.map((item) => item.count)),
    [reports.orderStatus],
  );
  const paymentStatusMax = useMemo(
    () => Math.max(0, ...reports.paymentStatus.map((item) => item.count)),
    [reports.paymentStatus],
  );
  const revenueMax = useMemo(
    () => Math.max(0, ...reports.revenueByDate.map((item) => Number(item.total_sales ?? 0))),
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
      api.get<TopProductReportItem[]>(appendLimit(`/reports/top-products${dateQuery}`, 10)),
      api.get<LowStockProductReportItem[]>(appendLimit("/reports/low-stock-products", 10)),
      api.get<RevenueByDateReportItem[]>(appendLimit(`/reports/revenue-by-date${dateQuery}`, 14)),
      api.get<RecentOrderActivityItem[]>(appendLimit(`/reports/recent-order-activity${dateQuery}`, 10)),
    ]);

    return {
      salesSummary,
      orderStatus,
      paymentStatus,
      inventoryReport,
      stockMovementSummary,
      customerReport,
      logisticsReport,
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

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)] sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <PageHeader
            eyebrow="Reports Enhancement"
            title="Admin analytics workspace"
            description="Review sales, revenue trends, order and payment mix, top sellers, low-stock risks, logistics totals, and recent order activity from one reporting page."
            meta="Phase 10A-2"
          />
          <div className="flex flex-wrap gap-3">
            <label className="block">
              <span className="mb-2 block text-xs font-medium uppercase tracking-[0.2em] text-slate-500">Start date</span>
              <input
                type="date"
                value={filters.start_date}
                onChange={(event) => setFilters((current) => ({ ...current, start_date: event.target.value }))}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-medium uppercase tracking-[0.2em] text-slate-500">End date</span>
              <input
                type="date"
                value={filters.end_date}
                onChange={(event) => setFilters((current) => ({ ...current, end_date: event.target.value }))}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
              />
            </label>
            <button
              type="button"
              onClick={() => void handleRefresh()}
              disabled={isRefreshing}
              className="mt-auto inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              Refresh
            </button>
          </div>
        </div>
      </section>

      {error ? <ErrorAlert message={error} /> : null}
      {isLoading ? <LoadingState label="Loading reports..." /> : null}

      {!isLoading && reports.salesSummary && reports.inventoryReport && reports.customerReport && reports.logisticsReport ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: "Total Sales",
                value: formatCurrency(reports.salesSummary.total_sales),
                hint: `${reports.salesSummary.total_orders} orders`,
                tone: "border-emerald-200 bg-emerald-50 text-emerald-900",
              },
              {
                label: "Average Order Value",
                value: formatCurrency(reports.salesSummary.average_order_value),
                hint: `${reports.salesSummary.paid_orders} paid orders`,
                tone: "border-sky-200 bg-sky-50 text-sky-900",
              },
              {
                label: "Inventory Value",
                value: formatCurrency(reports.inventoryReport.inventory_value_at_cost),
                hint: `${reports.inventoryReport.total_stock_units} stock units`,
                tone: "border-amber-200 bg-amber-50 text-amber-900",
              },
              {
                label: "Collected COD",
                value: formatCurrency(reports.logisticsReport.total_collected_amount),
                hint: `${reports.logisticsReport.unsettled_reconciliations} unsettled shipments`,
                tone: "border-rose-200 bg-rose-50 text-rose-900",
              },
            ].map((card) => (
              <article key={card.label} className={`rounded-[28px] border p-6 shadow-[var(--shadow-soft)] ${card.tone}`}>
                <p className="text-sm opacity-80">{card.label}</p>
                <p className="mt-4 text-3xl font-semibold tracking-tight">{card.value}</p>
                <p className="mt-2 text-sm opacity-75">{card.hint}</p>
              </article>
            ))}
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
            <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
              <div className="flex items-center justify-between">
                <PageHeader
                  eyebrow="Revenue Overview"
                  title="Revenue by date"
                  description="A lightweight visual view of revenue and order count over the selected date range."
                />
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  <TrendingUp className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {reports.revenueByDate.length === 0 ? (
                  <EmptyState title="No revenue data yet" description="Create orders inside the selected date range to build the revenue overview." />
                ) : (
                  reports.revenueByDate.map((item) => (
                    <div key={item.report_date} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-950">{formatDate(item.report_date)}</p>
                          <p className="mt-1 text-xs text-slate-500">{item.order_count} orders</p>
                        </div>
                        <div className="w-full md:max-w-[280px]">
                          <div className="h-3 rounded-full bg-slate-200">
                            <div
                              className="h-3 rounded-full bg-slate-950 transition-all"
                              style={{ width: `${getBarWidth(Number(item.total_sales), revenueMax)}%` }}
                            />
                          </div>
                        </div>
                        <p className="text-sm font-semibold text-slate-950">{formatCurrency(item.total_sales)}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </article>

            <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
              <div className="flex items-center justify-between">
                <PageHeader
                  eyebrow="Sales Summary"
                  title="Core order metrics"
                  description="Quick headline sales numbers for the selected date range."
                />
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  <BarChart3 className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">Total orders: <span className="font-semibold text-slate-950">{reports.salesSummary.total_orders}</span></div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">Total sales: <span className="font-semibold text-slate-950">{formatCurrency(reports.salesSummary.total_sales)}</span></div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">Discount: <span className="font-semibold text-slate-950">{formatCurrency(reports.salesSummary.total_discount)}</span></div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">Delivery charge: <span className="font-semibold text-slate-950">{formatCurrency(reports.salesSummary.total_delivery_charge)}</span></div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800">Paid: <span className="font-semibold">{reports.salesSummary.paid_orders}</span></div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">Unpaid: <span className="font-semibold">{reports.salesSummary.unpaid_orders}</span></div>
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-800">Cancelled: <span className="font-semibold">{reports.salesSummary.cancelled_orders}</span></div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">Returned: <span className="font-semibold text-slate-950">{reports.salesSummary.returned_orders}</span></div>
              </div>
            </article>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <PageHeader eyebrow="Order Status" title="Order status breakdown" description="Status count and total amount with quick visual weighting." />
                <button
                  type="button"
                  onClick={() =>
                    downloadCsv(
                      "order-status-report.csv",
                      ["status", "count", "total_amount"],
                      reports.orderStatus.map((item) => [item.status, item.count, item.total_amount]),
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                >
                  <Download className="h-4 w-4" />
                  Export CSV
                </button>
              </div>
              <div className="mt-6 space-y-3">
                {reports.orderStatus.length === 0 ? (
                  <EmptyState title="No order status data" description="Create orders to build the status breakdown." />
                ) : (
                  reports.orderStatus.map((item) => (
                    <div key={item.status} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-[160px]">
                          <StatusBadge status={item.status} />
                        </div>
                        <div className="w-full md:max-w-[260px]">
                          <div className="h-3 rounded-full bg-slate-200">
                            <div
                              className="h-3 rounded-full bg-slate-950 transition-all"
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

            <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
              <PageHeader eyebrow="Payment Status" title="Payment status breakdown" description="Track paid and unpaid mix over the selected date range." />
              <div className="mt-6 space-y-3">
                {reports.paymentStatus.length === 0 ? (
                  <EmptyState title="No payment status data" description="Create orders to build the payment status breakdown." />
                ) : (
                  reports.paymentStatus.map((item) => (
                    <div key={item.payment_status} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-[160px]">
                          <StatusBadge status={item.payment_status} />
                        </div>
                        <div className="w-full md:max-w-[260px]">
                          <div className="h-3 rounded-full bg-slate-200">
                            <div
                              className="h-3 rounded-full bg-sky-600 transition-all"
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

          <section className="grid gap-4 xl:grid-cols-[1.02fr_0.98fr]">
            <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <PageHeader eyebrow="Top Selling Products" title="Best sellers" description="Top products by quantity sold and revenue." />
                <button
                  type="button"
                  onClick={() =>
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
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                >
                  <Download className="h-4 w-4" />
                  Export CSV
                </button>
              </div>

              <div className="mt-6">
                {reports.topProducts.length === 0 ? (
                  <EmptyState title="No top products yet" description="Create orders to populate the top selling products table." />
                ) : (
                  <DataTable columns={["Product", "SKU", "Quantity", "Revenue"]}>
                    {reports.topProducts.map((item) => (
                      <div key={`${item.product_id ?? item.product_name}-${item.sku ?? "no-sku"}`} className="grid grid-cols-1 gap-3 px-5 py-4 text-sm text-slate-600 md:grid-cols-4 md:gap-4">
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

            <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
              <div className="flex items-center justify-between">
                <PageHeader eyebrow="Low Stock Products" title="Reorder risk" description="Products at or below threshold with warehouse context." />
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  <PackageSearch className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-6">
                {reports.lowStockProducts.length === 0 ? (
                  <EmptyState title="No low stock products" description="Inventory rows at or below threshold will appear here." />
                ) : (
                  <DataTable columns={["Product", "Warehouse", "Quantity", "Threshold", "Status"]}>
                    {reports.lowStockProducts.map((item) => (
                      <div key={item.inventory_item_id} className="grid grid-cols-1 gap-3 px-5 py-4 text-sm text-slate-600 md:grid-cols-5 md:gap-4">
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
          </section>

          <section className="grid gap-4 xl:grid-cols-[0.98fr_1.02fr]">
            <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
              <PageHeader eyebrow="Recent Orders" title="Recent order activity" description="Latest order creation activity for admin monitoring." />
              <div className="mt-6">
                {reports.recentOrderActivity.length === 0 ? (
                  <EmptyState title="No recent order activity" description="Recent orders will appear here once the system is active." />
                ) : (
                  <DataTable columns={["Order", "Customer", "Status", "Payment", "Total", "Created"]}>
                    {reports.recentOrderActivity.map((item) => (
                      <div key={item.order_id} className="grid grid-cols-1 gap-3 px-5 py-4 text-sm text-slate-600 2xl:grid-cols-6 2xl:gap-4">
                        <span className="font-medium text-slate-950">{item.order_number}</span>
                        <span>{item.customer_name || "Guest customer"}</span>
                        <span><StatusBadge status={item.status} /></span>
                        <span><StatusBadge status={item.payment_status} /></span>
                        <span>{formatCurrency(item.total)}</span>
                        <span>{formatDate(item.created_at)}</span>
                      </div>
                    ))}
                  </DataTable>
                )}
              </div>
            </article>

            <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <PageHeader eyebrow="Stock Movement Summary" title="Movement rollup" description="Grouped stock movement counts and quantities over the selected date range." />
                <button
                  type="button"
                  onClick={() =>
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
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                >
                  <Download className="h-4 w-4" />
                  Export CSV
                </button>
              </div>

              <div className="mt-6">
                {reports.stockMovementSummary.length === 0 ? (
                  <EmptyState title="No stock movement summary yet" description="Stock activity will populate this table." />
                ) : (
                  <DataTable columns={["Movement Type", "Movement Count", "Total Quantity"]}>
                    {reports.stockMovementSummary.map((item) => (
                      <div key={item.movement_type} className="grid grid-cols-1 gap-3 px-5 py-4 text-sm text-slate-600 md:grid-cols-3 md:gap-4">
                        <span><StatusBadge status={item.movement_type} label={formatLabel(item.movement_type)} /></span>
                        <span>{item.movement_count}</span>
                        <span>{item.total_quantity}</span>
                      </div>
                    ))}
                  </DataTable>
                )}
              </div>
            </article>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
              <PageHeader eyebrow="Customer CRM" title="Customer mix" description="Simple segmentation and follow-up visibility for admin reporting." />
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">Total customers: <span className="font-semibold text-slate-950">{reports.customerReport.total_customers}</span></div>
                <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-4 text-sm text-sky-800">With follow-up: <span className="font-semibold">{reports.customerReport.customers_with_follow_up}</span></div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">VIP: <span className="font-semibold text-slate-950">{reports.customerReport.vip_customers}</span></div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">Wholesale: <span className="font-semibold text-slate-950">{reports.customerReport.wholesale_customers}</span></div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">Reseller: <span className="font-semibold text-slate-950">{reports.customerReport.reseller_customers}</span></div>
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-800">Blocked: <span className="font-semibold">{reports.customerReport.blocked_customers}</span></div>
              </div>
            </article>

            <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
              <PageHeader eyebrow="Logistics" title="Logistics summary" description="Shipment and reconciliation totals for operations leadership." />
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">Total shipments: <span className="font-semibold text-slate-950">{reports.logisticsReport.total_shipments}</span></div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">Pending: <span className="font-semibold">{reports.logisticsReport.pending_shipments}</span></div>
                <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-4 text-sm text-sky-800">Shipped: <span className="font-semibold">{reports.logisticsReport.shipped_shipments}</span></div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800">Delivered: <span className="font-semibold">{reports.logisticsReport.delivered_shipments}</span></div>
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-800">Failed: <span className="font-semibold">{reports.logisticsReport.failed_shipments}</span></div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">Unsettled: <span className="font-semibold text-slate-950">{reports.logisticsReport.unsettled_reconciliations}</span></div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">COD total: <span className="font-semibold text-slate-950">{formatCurrency(reports.logisticsReport.total_cod_amount)}</span></div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">Courier charge: <span className="font-semibold text-slate-950">{formatCurrency(reports.logisticsReport.total_courier_charge)}</span></div>
              </div>
            </article>
          </section>
        </>
      ) : null}
    </div>
  );
}
