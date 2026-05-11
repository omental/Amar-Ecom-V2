"use client";

import { useEffect, useState } from "react";
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
import { formatCurrency, formatLabel } from "@/lib/format";

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

type FilterState = {
  date_from: string;
  date_to: string;
};

const initialFilters: FilterState = {
  date_from: "",
  date_to: "",
};

function buildDateQuery(filters: FilterState) {
  const params = new URLSearchParams();
  if (filters.date_from) {
    params.set("date_from", filters.date_from);
  }
  if (filters.date_to) {
    params.set("date_to", filters.date_to);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
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

export default function ReportsPage() {
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [salesSummary, setSalesSummary] = useState<SalesSummary | null>(null);
  const [orderStatus, setOrderStatus] = useState<OrderStatusReportItem[]>([]);
  const [inventoryReport, setInventoryReport] = useState<InventoryReport | null>(null);
  const [stockMovementSummary, setStockMovementSummary] = useState<StockMovementSummaryItem[]>([]);
  const [customerReport, setCustomerReport] = useState<CustomerReport | null>(null);
  const [logisticsReport, setLogisticsReport] = useState<LogisticsReport | null>(null);
  const [topProducts, setTopProducts] = useState<TopProductReportItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function fetchInitialReports() {
      setIsLoading(true);
      setError("");

      try {
        const dateQuery = buildDateQuery(initialFilters);
        const [
          salesSummaryData,
          orderStatusData,
          inventoryReportData,
          stockMovementSummaryData,
          customerReportData,
          logisticsReportData,
          topProductsData,
        ] = await Promise.all([
          api.get<SalesSummary>(`/reports/sales-summary${dateQuery}`),
          api.get<OrderStatusReportItem[]>("/reports/order-status"),
          api.get<InventoryReport>("/reports/inventory"),
          api.get<StockMovementSummaryItem[]>(`/reports/stock-movements-summary${dateQuery}`),
          api.get<CustomerReport>("/reports/customers"),
          api.get<LogisticsReport>("/reports/logistics"),
          api.get<TopProductReportItem[]>("/reports/top-products"),
        ]);

        if (!isMounted) {
          return;
        }

        setSalesSummary(salesSummaryData);
        setOrderStatus(orderStatusData);
        setInventoryReport(inventoryReportData);
        setStockMovementSummary(stockMovementSummaryData);
        setCustomerReport(customerReportData);
        setLogisticsReport(logisticsReportData);
        setTopProducts(topProductsData);
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

    void fetchInitialReports();
    return () => {
      isMounted = false;
    };
  }, []);

  async function handleRefresh() {
    setIsRefreshing(true);
    setError("");

    try {
      const dateQuery = buildDateQuery(filters);
      const [
        salesSummaryData,
        orderStatusData,
        inventoryReportData,
        stockMovementSummaryData,
        customerReportData,
        logisticsReportData,
        topProductsData,
      ] = await Promise.all([
        api.get<SalesSummary>(`/reports/sales-summary${dateQuery}`),
        api.get<OrderStatusReportItem[]>("/reports/order-status"),
        api.get<InventoryReport>("/reports/inventory"),
        api.get<StockMovementSummaryItem[]>(`/reports/stock-movements-summary${dateQuery}`),
        api.get<CustomerReport>("/reports/customers"),
        api.get<LogisticsReport>("/reports/logistics"),
        api.get<TopProductReportItem[]>("/reports/top-products"),
      ]);

      setSalesSummary(salesSummaryData);
      setOrderStatus(orderStatusData);
      setInventoryReport(inventoryReportData);
      setStockMovementSummary(stockMovementSummaryData);
      setCustomerReport(customerReportData);
      setLogisticsReport(logisticsReportData);
      setTopProducts(topProductsData);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load reports");
    } finally {
      setIsRefreshing(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)] sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <PageHeader
            eyebrow="Reports Foundation"
            title="Operational reports"
            description="Review sales, order status, inventory health, CRM mix, logistics totals, top products, and stock movement summaries from one reporting workspace."
            meta="Phase 10A foundation"
          />
          <div className="flex flex-wrap gap-3">
            <label className="block">
              <span className="mb-2 block text-xs font-medium uppercase tracking-[0.2em] text-slate-500">Date from</span>
              <input
                type="date"
                value={filters.date_from}
                onChange={(event) => setFilters((current) => ({ ...current, date_from: event.target.value }))}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-medium uppercase tracking-[0.2em] text-slate-500">Date to</span>
              <input
                type="date"
                value={filters.date_to}
                onChange={(event) => setFilters((current) => ({ ...current, date_to: event.target.value }))}
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

      {!isLoading && salesSummary && inventoryReport && customerReport && logisticsReport ? (
        <>
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Total Sales", value: formatCurrency(salesSummary.total_sales), tone: "bg-emerald-50 border-emerald-200 text-emerald-900" },
              { label: "Average Order Value", value: formatCurrency(salesSummary.average_order_value), tone: "bg-sky-50 border-sky-200 text-sky-900" },
              { label: "Inventory Value", value: formatCurrency(inventoryReport.inventory_value_at_cost), tone: "bg-amber-50 border-amber-200 text-amber-900" },
              { label: "Collected COD", value: formatCurrency(logisticsReport.total_collected_amount), tone: "bg-rose-50 border-rose-200 text-rose-900" },
            ].map((card) => (
              <article key={card.label} className={`rounded-[28px] border p-6 shadow-[var(--shadow-soft)] ${card.tone}`}>
                <p className="text-sm opacity-80">{card.label}</p>
                <p className="mt-4 text-3xl font-semibold tracking-tight">{card.value}</p>
              </article>
            ))}
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
            <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
              <div className="flex items-center justify-between">
                <PageHeader
                  eyebrow="Sales Summary"
                  title="Sales overview"
                  description="Core order totals across the selected date range."
                />
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  <TrendingUp className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">Total orders: <span className="font-semibold text-slate-950">{salesSummary.total_orders}</span></div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">Total discount: <span className="font-semibold text-slate-950">{formatCurrency(salesSummary.total_discount)}</span></div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">Delivery charges: <span className="font-semibold text-slate-950">{formatCurrency(salesSummary.total_delivery_charge)}</span></div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">Paid orders: <span className="font-semibold text-slate-950">{salesSummary.paid_orders}</span></div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">Unpaid orders: <span className="font-semibold text-slate-950">{salesSummary.unpaid_orders}</span></div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">Cancelled / Returned: <span className="font-semibold text-slate-950">{salesSummary.cancelled_orders} / {salesSummary.returned_orders}</span></div>
              </div>
            </article>

            <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
              <div className="flex items-center justify-between">
                <PageHeader
                  eyebrow="Inventory Health"
                  title="Inventory pulse"
                  description="Lightweight operational stock health and cost exposure."
                />
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  <PackageSearch className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">Total products: <span className="font-semibold text-slate-950">{inventoryReport.total_products}</span></div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">Inventory rows: <span className="font-semibold text-slate-950">{inventoryReport.total_inventory_items}</span></div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">Stock units: <span className="font-semibold text-slate-950">{inventoryReport.total_stock_units}</span></div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">Low stock: <span className="font-semibold">{inventoryReport.low_stock_count}</span></div>
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-800">Out of stock: <span className="font-semibold">{inventoryReport.out_of_stock_count}</span></div>
                <div className="rounded-2xl border border-slate-950 bg-slate-950 px-4 py-4 text-sm text-white">Value at cost: <span className="font-semibold">{formatCurrency(inventoryReport.inventory_value_at_cost)}</span></div>
              </div>
            </article>
          </section>

          <section className="grid gap-4 xl:grid-cols-2">
            <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
              <PageHeader eyebrow="Customer CRM" title="Customer mix" description="Simple segmentation and follow-up view." />
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">Total customers: <span className="font-semibold text-slate-950">{customerReport.total_customers}</span></div>
                <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-4 text-sm text-sky-800">With follow-up: <span className="font-semibold">{customerReport.customers_with_follow_up}</span></div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">VIP: <span className="font-semibold text-slate-950">{customerReport.vip_customers}</span></div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">Wholesale: <span className="font-semibold text-slate-950">{customerReport.wholesale_customers}</span></div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">Reseller: <span className="font-semibold text-slate-950">{customerReport.reseller_customers}</span></div>
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-800">Blocked: <span className="font-semibold">{customerReport.blocked_customers}</span></div>
              </div>
            </article>

            <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
              <PageHeader eyebrow="Logistics" title="Logistics totals" description="Shipment status and reconciliation overview." />
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">Total shipments: <span className="font-semibold text-slate-950">{logisticsReport.total_shipments}</span></div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">Pending: <span className="font-semibold">{logisticsReport.pending_shipments}</span></div>
                <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-4 text-sm text-sky-800">Shipped: <span className="font-semibold">{logisticsReport.shipped_shipments}</span></div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800">Delivered: <span className="font-semibold">{logisticsReport.delivered_shipments}</span></div>
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-800">Failed: <span className="font-semibold">{logisticsReport.failed_shipments}</span></div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">Unsettled: <span className="font-semibold text-slate-950">{logisticsReport.unsettled_reconciliations}</span></div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">COD total: <span className="font-semibold text-slate-950">{formatCurrency(logisticsReport.total_cod_amount)}</span></div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">Courier charge: <span className="font-semibold text-slate-950">{formatCurrency(logisticsReport.total_courier_charge)}</span></div>
              </div>
            </article>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <PageHeader eyebrow="Order Status" title="Order status report" description="Count and total amount by order status." />
              <button
                type="button"
                onClick={() =>
                  downloadCsv(
                    "order-status-report.csv",
                    ["status", "count", "total_amount"],
                    orderStatus.map((item) => [item.status, item.count, item.total_amount]),
                  )
                }
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </button>
            </div>

            <div className="mt-6">
              {orderStatus.length === 0 ? (
                <EmptyState title="No order status rows yet" description="Create orders to populate this status report." />
              ) : (
                <DataTable columns={["Status", "Count", "Total Amount"]}>
                  {orderStatus.map((item) => (
                    <div key={item.status} className="grid grid-cols-1 gap-3 px-5 py-4 text-sm text-slate-600 md:grid-cols-3 md:gap-4">
                      <span><StatusBadge status={item.status} /></span>
                      <span>{item.count}</span>
                      <span>{formatCurrency(item.total_amount)}</span>
                    </div>
                  ))}
                </DataTable>
              )}
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.02fr_0.98fr]">
            <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <PageHeader eyebrow="Top Products" title="Best sellers" description="Top products by ordered quantity and revenue." />
                <button
                  type="button"
                  onClick={() =>
                    downloadCsv(
                      "top-products-report.csv",
                      ["product_id", "product_name", "sku", "total_quantity", "total_revenue"],
                      topProducts.map((item) => [
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
                {topProducts.length === 0 ? (
                  <EmptyState title="No top products yet" description="Create orders to populate the product ranking report." />
                ) : (
                  <DataTable columns={["Product", "SKU", "Quantity", "Revenue"]}>
                    {topProducts.map((item) => (
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
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <PageHeader eyebrow="Stock Movements" title="Movement summary" description="Grouped stock movement totals across the selected date range." />
                <button
                  type="button"
                  onClick={() =>
                    downloadCsv(
                      "stock-movement-summary.csv",
                      ["movement_type", "movement_count", "total_quantity"],
                      stockMovementSummary.map((item) => [
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
                {stockMovementSummary.length === 0 ? (
                  <EmptyState title="No movement summary rows yet" description="Create stock activity to populate the movement summary." />
                ) : (
                  <DataTable columns={["Movement Type", "Movement Count", "Total Quantity"]}>
                    {stockMovementSummary.map((item) => (
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

          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
            <div className="flex items-center justify-between">
              <PageHeader eyebrow="Navigation" title="Next reporting step" description="Use this foundation as the bridge between operational parity and deeper management reporting." />
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <BarChart3 className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-6 text-sm leading-7 text-slate-500">
              This phase is intentionally focused on operational reporting rather than full finance. The next step after this foundation is deeper reporting slices and finance-linked reporting once those modules exist.
            </p>
          </section>
        </>
      ) : null}
    </div>
  );
}
