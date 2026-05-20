"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  DollarSign,
  Loader2,
  Package,
  Plus,
  RotateCcw,
  ShoppingCart,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ErrorAlert } from "@/components/ui/error-alert";
import { api } from "@/lib/api";
import { getUser } from "@/lib/auth";

type BusinessSettingsResponse = {
  company_name: string;
  currency: string;
};

type SalesSummaryResponse = {
  total_orders: number;
  total_sales: number | string;
};

type InventoryReportResponse = {
  total_products: number;
  low_stock_count: number;
};

type CustomerReportResponse = {
  total_customers: number;
};

type LowStockProduct = {
  inventory_item_id: string;
  product_name: string;
  quantity: number;
};

type TopProduct = {
  product_id: string | null;
  product_name: string;
  sku: string | null;
  total_quantity: number;
  total_revenue: number | string;
};

type RecentOrderActivity = {
  order_id: string;
  order_number: string;
  status: string;
  payment_status: string;
  total: number | string;
  customer_name: string | null;
  created_at: string;
};

type RevenueByDate = {
  report_date: string;
  order_count: number;
  total_sales: number | string;
};

type OrderListItem = {
  id: string;
  total: number | string;
  paid_amount: number | string;
  status: string;
  created_at: string;
};

type DashboardSnapshot = {
  companyName: string;
  currency: string;
  totalOrders: number;
  totalSales: number;
  totalProducts: number;
  totalCustomers: number;
  totalCollection: number;
  outstanding: number;
  salesGrowth: number;
  lowStockProducts: LowStockProduct[];
  bestSellingProducts: TopProduct[];
  recentOrders: RecentOrderActivity[];
  revenueByMonth: Array<{
    name: string;
    orders: number;
    profit: number;
  }>;
};

type FilterPreset = "all" | "month";

type StatCardProps = {
  title: string;
  value: string;
  icon: LucideIcon;
  trend: "up" | "down";
  trendValue: string;
  iconBgClass: string;
  iconColorClass: string;
};

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const YEAR_OPTIONS = [2024, 2025, 2026];

function getCurrencySymbol(currency: string) {
  if (currency === "BDT") {
    return "BDT ";
  }

  if (currency === "USD") {
    return "$";
  }

  if (currency === "EUR") {
    return "EUR ";
  }

  return `${currency} `;
}

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(amount: number, currency: string) {
  const symbol = getCurrencySymbol(currency);
  return `${symbol}${amount.toLocaleString()}`;
}

function formatCompactCurrency(amount: number, currency: string) {
  const symbol = getCurrencySymbol(currency);
  return `${symbol}${amount.toLocaleString()}`;
}

function formatMonthFilterLabel(filter: string) {
  if (filter === "all") {
    return "All Time";
  }

  const [year, month] = filter.split("-").map(Number);
  const label = MONTH_NAMES[(month || 1) - 1] ?? "Month";
  return `${label} ${year}`;
}

function buildDateParams(filter: string) {
  if (filter === "all") {
    return "";
  }

  const [year, month] = filter.split("-").map(Number);
  if (!year || !month) {
    return "";
  }

  const lastDay = new Date(year, month, 0).getDate();
  return `?start_date=${year}-${String(month).padStart(2, "0")}-01T00:00:00Z&end_date=${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}T23:59:59Z`;
}

function buildYearParams(year: number) {
  return `?start_date=${year}-01-01T00:00:00Z&end_date=${year}-12-31T23:59:59Z&limit=366`;
}

function orderMatchesMonthFilter(order: OrderListItem, filter: string) {
  if (filter === "all") {
    return true;
  }

  const createdAt = new Date(order.created_at);
  if (Number.isNaN(createdAt.getTime())) {
    return false;
  }

  const [year, month] = filter.split("-").map(Number);
  return createdAt.getFullYear() === year && createdAt.getMonth() + 1 === month;
}

function getStatusBadgeClass(status: string) {
  const normalizedStatus = status.toLowerCase();

  if (normalizedStatus === "delivered") {
    return "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400";
  }

  if (normalizedStatus === "shipped") {
    return "bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)] text-[var(--color-accent)]";
  }

  if (normalizedStatus === "cancelled" || normalizedStatus === "returned") {
    return "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400";
  }

  return "bg-orange-50 text-orange-500 dark:bg-orange-500/10 dark:text-orange-400";
}

function DashboardStatCard({
  title,
  value,
  icon: Icon,
  trend,
  trendValue,
  iconBgClass,
  iconColorClass,
}: StatCardProps) {
  return (
    <div className="relative flex flex-col justify-between overflow-hidden rounded-[20px] border border-[var(--color-brd)] bg-[var(--color-surf)] p-4 shadow-[var(--shadow-subtle)] transition-shadow hover:shadow-[var(--shadow-premium)] lg:p-5">
      <div className="mb-2 flex flex-col lg:mb-4">
        <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-[14px] lg:h-12 lg:w-12 ${iconBgClass}`}>
          <Icon size={20} className={iconColorClass} strokeWidth={2} />
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-txt-mut)] lg:text-[11px]">
            {title}
          </p>
          <h3 className="mt-1 text-xl font-black tracking-tight text-[var(--color-txt-pri)] lg:text-2xl 2xl:text-3xl">
            {value}
          </h3>
        </div>
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-1 text-[10px] font-medium lg:text-[11px] 2xl:text-[12px]">
        <span className={trend === "up" ? "font-bold text-[var(--color-success)]" : "font-bold text-[var(--color-danger)]"}>
          {trend === "up" ? "↗" : "↘"} {trendValue}
        </span>
        <span className="text-[var(--color-txt-mut)]">vs month</span>
      </div>
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
  currency,
}: {
  active?: boolean;
  payload?: Array<{ color: string; name: string; value: number }>;
  label?: string;
  currency: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="glass-morphism rounded-2xl border border-white/50 p-4 shadow-2xl">
      <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--color-txt-mut)]">
        {label}
      </p>
      <div className="space-y-3">
        {payload.map((entry, index) => (
          <div key={`${entry.name}-${index}`} className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-[11px] font-bold text-[var(--color-txt-sec)]">{entry.name}</span>
            </div>
            <span className="text-xs font-black text-[var(--color-txt-pri)]">
              {formatCurrency(entry.value, currency)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const user = getUser();
  const currentDate = new Date();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedYear, setSelectedYear] = useState(2026);
  const [monthFilter, setMonthFilter] = useState<string>(
    `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`,
  );
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [tempFilterType, setTempFilterType] = useState<FilterPreset>("month");
  const [tempSelectedMonth, setTempSelectedMonth] = useState<number>(currentDate.getMonth());
  const [tempSelectedYear, setTempSelectedYear] = useState<number>(currentDate.getFullYear());
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>({
    companyName: "Amar eCom",
    currency: "BDT",
    totalOrders: 0,
    totalSales: 0,
    totalProducts: 0,
    totalCustomers: 0,
    totalCollection: 0,
    outstanding: 0,
    salesGrowth: 0,
    lowStockProducts: [],
    bestSellingProducts: [],
    recentOrders: [],
    revenueByMonth: MONTH_NAMES.map((month) => ({ name: month, orders: 0, profit: 0 })),
  });

  useEffect(() => {
    let isMounted = true;
    const dateParams = buildDateParams(monthFilter);
    const yearParams = buildYearParams(selectedYear);

    async function loadDashboard() {
      setLoading(true);
      setError("");

      try {
        const [
          businessSettings,
          salesSummary,
          inventoryReport,
          customerReport,
          lowStockProducts,
          topProducts,
          recentOrders,
          revenueByDate,
          orders,
        ] = await Promise.all([
          api.get<BusinessSettingsResponse>("/settings/business"),
          api.get<SalesSummaryResponse>(`/reports/sales-summary${dateParams}`),
          api.get<InventoryReportResponse>("/reports/inventory"),
          api.get<CustomerReportResponse>("/reports/customers"),
          api.get<LowStockProduct[]>("/reports/low-stock-products?limit=5"),
          api.get<TopProduct[]>(`/reports/top-products${dateParams ? `${dateParams}&limit=5` : "?limit=5"}`),
          api.get<RecentOrderActivity[]>(`/reports/recent-order-activity${dateParams ? `${dateParams}&limit=10` : "?limit=10"}`),
          api.get<RevenueByDate[]>(`/reports/revenue-by-date${yearParams}`),
          api.get<OrderListItem[]>("/orders?skip=0&limit=100"),
        ]);

        if (!isMounted) {
          return;
        }

        const currency = businessSettings.currency || "BDT";
        const monthlyRevenueMap = new Map<number, number>();

        revenueByDate.forEach((entry) => {
          const reportDate = new Date(entry.report_date);
          if (Number.isNaN(reportDate.getTime())) {
            return;
          }

          const monthIndex = reportDate.getMonth();
          monthlyRevenueMap.set(
            monthIndex,
            (monthlyRevenueMap.get(monthIndex) || 0) + toNumber(entry.total_sales),
          );
        });

        const revenueByMonth = MONTH_NAMES.map((month, index) => {
          const revenue = monthlyRevenueMap.get(index) || 0;
          return {
            name: month,
            orders: revenue,
            profit: revenue * 0.45,
          };
        });

        const filteredOrders = orders.filter((order) => orderMatchesMonthFilter(order, monthFilter));

        const totalCollection = filteredOrders.reduce((sum, order) => sum + toNumber(order.paid_amount), 0);
        const outstanding = filteredOrders.reduce(
          (sum, order) => sum + Math.max(0, toNumber(order.total) - toNumber(order.paid_amount)),
          0,
        );

        const todayKey = new Date().toISOString().split("T")[0];
        const yesterdayDate = new Date();
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        const yesterdayKey = yesterdayDate.toISOString().split("T")[0];

        const todaySales = filteredOrders.reduce((sum, order) => {
          const createdAtKey = new Date(order.created_at).toISOString().split("T")[0];
          return createdAtKey === todayKey ? sum + toNumber(order.total) : sum;
        }, 0);

        const yesterdaySales = filteredOrders.reduce((sum, order) => {
          const createdAtKey = new Date(order.created_at).toISOString().split("T")[0];
          return createdAtKey === yesterdayKey ? sum + toNumber(order.total) : sum;
        }, 0);

        let salesGrowth = 0;
        if (yesterdaySales > 0) {
          salesGrowth = ((todaySales - yesterdaySales) / yesterdaySales) * 100;
        } else if (todaySales > 0) {
          salesGrowth = 100;
        }

        setSnapshot({
          companyName: businessSettings.company_name || "Amar eCom",
          currency,
          totalOrders: salesSummary.total_orders || 0,
          totalSales: toNumber(salesSummary.total_sales),
          totalProducts: inventoryReport.total_products || 0,
          totalCustomers: customerReport.total_customers || 0,
          totalCollection,
          outstanding,
          salesGrowth: Number(salesGrowth.toFixed(1)),
          lowStockProducts: lowStockProducts.slice(0, 5),
          bestSellingProducts: topProducts.slice(0, 5),
          recentOrders: recentOrders.slice(0, 10),
          revenueByMonth,
        });
      } catch {
        if (!isMounted) {
          return;
        }

        setError("Could not load live dashboard data.");
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadDashboard();

    return () => {
      isMounted = false;
    };
  }, [monthFilter, selectedYear]);

  const statCards = useMemo(
    () => [
      {
        title: "TOTAL ORDERS",
        value: snapshot.totalOrders.toLocaleString(),
        icon: ShoppingCart,
        trend: "up" as const,
        trendValue: `${snapshot.salesGrowth}%`,
        iconBgClass: "bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)]",
        iconColorClass: "text-[var(--color-accent)]",
      },
      {
        title: "TOTAL SALES",
        value: formatCompactCurrency(snapshot.totalSales, snapshot.currency),
        icon: DollarSign,
        trend: "down" as const,
        trendValue: "7.2%",
        iconBgClass: "bg-emerald-50 dark:bg-emerald-500/10",
        iconColorClass: "text-emerald-500 dark:text-emerald-400",
      },
      {
        title: "TOTAL PRODUCTS",
        value: snapshot.totalProducts.toLocaleString(),
        icon: Package,
        trend: "up" as const,
        trendValue: "4.7%",
        iconBgClass: "bg-orange-50 dark:bg-orange-500/10",
        iconColorClass: "text-orange-500 dark:text-orange-400",
      },
      {
        title: "TOTAL CUSTOMERS",
        value: snapshot.totalCustomers.toLocaleString(),
        icon: Users,
        trend: "up" as const,
        trendValue: "2.1%",
        iconBgClass: "bg-purple-50 dark:bg-purple-500/10",
        iconColorClass: "text-purple-500 dark:text-purple-400",
      },
      {
        title: "TOTAL COLLECTION",
        value: formatCompactCurrency(snapshot.totalCollection, snapshot.currency),
        icon: CheckCircle2,
        trend: "up" as const,
        trendValue: "2.6%",
        iconBgClass: "bg-pink-50 dark:bg-pink-500/10",
        iconColorClass: "text-pink-500 dark:text-pink-400",
      },
      {
        title: "OUTSTANDING",
        value: formatCompactCurrency(snapshot.outstanding, snapshot.currency),
        icon: Clock,
        trend: "up" as const,
        trendValue: "1.9%",
        iconBgClass: "bg-red-50 dark:bg-rose-500/10",
        iconColorClass: "text-red-500 dark:text-rose-400",
      },
    ],
    [snapshot],
  );

  if (loading) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center gap-4 bg-[var(--color-surf)]">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border-4 border-[color-mix(in_srgb,var(--color-accent)_12%,transparent)] border-t-[var(--color-accent)]">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--color-accent)]" />
        </div>
        <p className="ops-micro-label animate-pulse">Syncing Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-8 px-4 pb-20 pt-4 sm:px-6 lg:px-8 lg:pt-8">
      {error ? <ErrorAlert message={error} /> : null}

      <div className="mb-8 flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold tracking-tight text-[var(--color-txt-pri)]">Dashboard</h2>
          <p className="text-sm font-medium text-[var(--color-txt-sec)]">
            Welcome back,{" "}
            <span className="font-semibold text-[var(--color-accent)]">
              {user?.name || user?.display_name || user?.full_name || "Mahmudul"}
            </span>
            ! Here&apos;s what&apos;s happening with your business today.
          </p>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 sm:flex-nowrap lg:w-auto lg:gap-3">
          <div className="relative flex min-w-[180px] items-center justify-between gap-2 overflow-visible rounded-lg border border-[var(--color-brd)] bg-[var(--color-surf)] px-3 py-2 text-xs font-semibold text-[var(--color-txt-sec)] shadow-[var(--shadow-subtle)] transition-all hover:border-[color-mix(in_srgb,var(--color-accent)_30%,transparent)] hover:text-[var(--color-txt-pri)] lg:min-w-[200px] lg:px-4 lg:py-2.5 lg:text-sm">
            <button
              type="button"
              onClick={() => {
                if (!isFilterOpen) {
                  if (monthFilter === "all") {
                    setTempFilterType("all");
                    setTempSelectedMonth(currentDate.getMonth());
                    setTempSelectedYear(currentDate.getFullYear());
                  } else {
                    const [year, month] = monthFilter.split("-").map(Number);
                    setTempFilterType("month");
                    setTempSelectedMonth((month || 1) - 1);
                    setTempSelectedYear(year || currentDate.getFullYear());
                  }
                }
                setIsFilterOpen((current) => !current);
              }}
              className="flex w-full items-center justify-between gap-2 text-left"
            >
              <span>{formatMonthFilterLabel(monthFilter)}</span>
              <ChevronDown
                size={16}
                className={`transition-transform ${isFilterOpen ? "rotate-180" : ""}`}
              />
            </button>

            {isFilterOpen ? (
              <div className="absolute right-0 top-[calc(100%+0.75rem)] z-20 w-[320px] rounded-[20px] border border-[var(--color-brd)] bg-[var(--color-surf)] p-5 shadow-2xl">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="ops-micro-label">Dashboard Filter</p>
                    <h3 className="mt-2 text-lg font-bold text-[var(--color-txt-pri)]">Select period</h3>
                  </div>
                </div>

                <div className="mb-5 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setTempFilterType("all")}
                    className={`flex-1 rounded-xl px-3 py-2 text-xs font-bold transition-colors ${
                      tempFilterType === "all"
                        ? "bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)] text-[var(--color-accent)]"
                        : "bg-[var(--color-surf-hover)] text-[var(--color-txt-sec)]"
                    }`}
                  >
                    All Time
                  </button>
                  <button
                    type="button"
                    onClick={() => setTempFilterType("month")}
                    className={`flex-1 rounded-xl px-3 py-2 text-xs font-bold transition-colors ${
                      tempFilterType === "month"
                        ? "bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)] text-[var(--color-accent)]"
                        : "bg-[var(--color-surf-hover)] text-[var(--color-txt-sec)]"
                    }`}
                  >
                    By Month
                  </button>
                </div>

                {tempFilterType === "month" ? (
                  <div className="space-y-4">
                    <div>
                      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--color-txt-mut)]">
                        Month
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {MONTH_NAMES.map((month, index) => (
                          <button
                            key={month}
                            type="button"
                            onClick={() => setTempSelectedMonth(index)}
                            className={`rounded-xl px-3 py-2 text-xs font-bold transition-colors ${
                              tempSelectedMonth === index
                                ? "bg-[var(--color-accent)] text-white"
                                : "bg-[var(--color-surf-hover)] text-[var(--color-txt-sec)] hover:text-[var(--color-txt-pri)]"
                            }`}
                          >
                            {month}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--color-txt-mut)]">
                        Year
                      </p>
                      <div className="flex items-center justify-between rounded-xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] p-2">
                        <button
                          type="button"
                          onClick={() => setTempSelectedYear((current) => current - 1)}
                          className="rounded-lg p-2 text-[var(--color-txt-sec)] transition-colors hover:bg-white hover:text-[var(--color-txt-pri)]"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <span className="text-sm font-bold text-[var(--color-txt-pri)]">{tempSelectedYear}</span>
                        <button
                          type="button"
                          onClick={() => setTempSelectedYear((current) => current + 1)}
                          className="rounded-lg p-2 text-[var(--color-txt-sec)] transition-colors hover:bg-white hover:text-[var(--color-txt-pri)]"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="mt-5 flex justify-between gap-3 border-t border-[var(--color-brd)] pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setTempFilterType("all");
                      setTempSelectedMonth(currentDate.getMonth());
                      setTempSelectedYear(currentDate.getFullYear());
                    }}
                    className="flex w-[100px] items-center justify-center gap-1.5 rounded-xl border border-pink-200 px-4 py-2.5 text-xs font-bold text-pink-500 transition-colors hover:bg-pink-50"
                  >
                    <RotateCcw size={14} />
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (tempFilterType === "all") {
                        setMonthFilter("all");
                      } else {
                        setMonthFilter(
                          `${tempSelectedYear}-${String(tempSelectedMonth + 1).padStart(2, "0")}`,
                        );
                      }
                      setIsFilterOpen(false);
                    }}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--color-accent)] px-4 py-2.5 text-xs font-bold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:bg-[var(--color-accent-hover)]"
                  >
                    <Check size={14} strokeWidth={3} />
                    Apply
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-[var(--color-brd)] bg-[var(--color-surf)] p-1 shadow-[var(--shadow-subtle)]">
            <button
              type="button"
              className="rounded-md p-1.5 text-[var(--color-txt-mut)] transition-colors hover:text-[var(--color-txt-sec)] lg:p-2"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect width="18" height="18" x="3" y="3" rx="2" />
                <path d="M9 3v18" />
              </svg>
            </button>
            <button
              type="button"
              className="rounded-md bg-[var(--color-surf-hover)] p-1.5 text-[var(--color-txt-pri)] transition-colors lg:p-2"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect width="7" height="7" x="3" y="3" rx="1" />
                <rect width="7" height="7" x="14" y="3" rx="1" />
                <rect width="7" height="7" x="14" y="14" rx="1" />
                <rect width="7" height="7" x="3" y="14" rx="1" />
              </svg>
            </button>
          </div>

          <Link
            href="/dashboard/orders"
            className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg bg-[var(--color-accent)] px-4 py-2 text-xs font-semibold text-white shadow-[var(--shadow-subtle)] transition-colors hover:bg-[var(--color-accent-hover)] lg:px-5 lg:py-2.5 lg:text-sm"
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>New Order</span>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {statCards.map((card) => (
          <DashboardStatCard key={card.title} {...card} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:gap-8 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-[20px] border border-[var(--color-brd)] bg-[var(--color-surf)] p-6 shadow-[var(--shadow-subtle)]">
          <div className="mb-6 flex items-center justify-between border-b border-[var(--color-brd)] pb-4">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-red-50 text-red-500 dark:bg-rose-500/10 dark:text-rose-400">
                <AlertCircle size={14} />
              </div>
              <h3 className="text-[16px] font-bold text-[var(--color-txt-pri)]">Stock Alerts</h3>
            </div>
            <Link href="/dashboard/inventory" className="text-[13px] font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]">
              View All
            </Link>
          </div>

          <div className="space-y-4">
            {snapshot.lowStockProducts.length > 0 ? (
              snapshot.lowStockProducts.map((product) => (
                <div key={product.inventory_item_id} className="flex cursor-pointer items-center gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-500 dark:bg-rose-500/10 dark:text-rose-400">
                    <Package size={18} />
                  </div>
                  <div className="min-w-0">
                    <h4 className="mb-0.5 truncate text-[13px] font-bold text-[var(--color-txt-pri)]">
                      {product.product_name}
                    </h4>
                    <p className="text-[11px] font-medium text-red-500 dark:text-rose-400">
                      {product.quantity} units left
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center">
                <p className="text-sm italic text-[var(--color-txt-mut)]">Inventory healthy</p>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[20px] border border-[var(--color-brd)] bg-[var(--color-surf)] p-6 shadow-[var(--shadow-subtle)]">
          <div className="mb-6 flex items-center justify-between border-b border-[var(--color-brd)] pb-4">
            <h3 className="text-[16px] font-bold text-[var(--color-txt-pri)]">Top Sellers</h3>
            <Link href="/dashboard/products" className="text-[13px] font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]">
              View All
            </Link>
          </div>

          <div className="space-y-5">
            {snapshot.bestSellingProducts.length > 0 ? (
              snapshot.bestSellingProducts.map((product, index) => (
                <div key={`${product.product_id ?? product.product_name}-${index}`} className="flex cursor-pointer items-center gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)] text-xs font-bold text-[var(--color-accent)]">
                    #{index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="mb-0.5 truncate text-[13px] font-bold text-[var(--color-txt-pri)]">
                      {product.product_name}
                    </h4>
                    <p className="text-[11px] font-medium text-[var(--color-txt-sec)]">
                      {product.total_quantity} units · {formatCurrency(toNumber(product.total_revenue), snapshot.currency)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center">
                <p className="text-sm italic text-[var(--color-txt-mut)]">No sales activity yet</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex h-full flex-col rounded-[20px] border border-[var(--color-brd)] bg-[var(--color-surf)] p-6 shadow-[var(--shadow-subtle)]">
          <div className="mb-6 flex items-center justify-between border-b border-[var(--color-brd)] pb-4">
            <h3 className="text-[16px] font-bold text-[var(--color-txt-pri)]">Recent Order</h3>
            <Link
              href="/dashboard/orders"
              className="rounded-full bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)] px-3 py-1 text-[13px] font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]"
            >
              View All
            </Link>
          </div>

          <div className="flex-1 space-y-5">
            {snapshot.recentOrders.length > 0 ? (
              snapshot.recentOrders.slice(0, 5).map((order) => (
                <div key={order.order_id} className="flex cursor-pointer items-center justify-between gap-2">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-surf-hover)] text-[var(--color-txt-mut)]">
                      <ShoppingCart size={18} />
                    </div>
                    <div>
                      <h4 className="mb-0.5 max-w-[120px] truncate text-[13px] font-bold leading-tight text-[var(--color-txt-pri)]">
                        {order.customer_name || "Walk-in Customer"}
                      </h4>
                      <p className="text-[11px] text-[var(--color-txt-mut)]">
                        #{order.order_number}
                      </p>
                    </div>
                  </div>
                  <div className="flex-1 text-right">
                    <div className="flex items-center justify-end gap-4">
                      <span className="text-[13px] font-bold text-[var(--color-txt-pri)]">
                        {formatCurrency(toNumber(order.total), snapshot.currency)}
                      </span>
                      <span className={`rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${getStatusBadgeClass(order.status)}`}>
                        {order.status || "PENDING"}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center">
                <p className="text-sm italic text-[var(--color-txt-mut)]">No recent orders found</p>
              </div>
            )}
          </div>

          <div className="mt-6 flex items-center justify-center gap-2 border-t border-[var(--color-brd)] pt-4">
            <div className="flex gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
              <div className="h-1.5 w-1.5 rounded-full bg-gray-200" />
              <div className="h-1.5 w-1.5 rounded-full bg-gray-200" />
            </div>
            <span className="text-[11px] font-medium text-[var(--color-txt-mut)]">
              Live data sync
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-[20px] border border-[var(--color-brd)] bg-[var(--color-surf)] p-8 shadow-[var(--shadow-subtle)] lg:col-span-8">
          <div className="mb-8 flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-[16px] font-bold text-[var(--color-txt-pri)]">Store Performance</h3>
              <p className="mt-1 text-sm font-medium text-[var(--color-txt-sec)]">
                Order volume and revenue trends
              </p>
            </div>

            <div className="flex items-center rounded-lg border border-[var(--color-brd)] p-1">
              {YEAR_OPTIONS.map((year) => (
                <button
                  key={year}
                  type="button"
                  onClick={() => setSelectedYear(year)}
                  className={`rounded-md px-4 py-1.5 text-[13px] font-semibold transition-colors ${
                    selectedYear === year
                      ? "bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)] text-[var(--color-accent)]"
                      : "text-[var(--color-txt-sec)] hover:text-[var(--color-txt-pri)]"
                  }`}
                >
                  {year}
                </button>
              ))}
            </div>
          </div>

          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={snapshot.revenueByMonth} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="velocityGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--color-brd)" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "var(--color-txt-mut)", fontWeight: 500 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) =>
                    `${getCurrencySymbol(snapshot.currency)}${value > 999 ? `${Math.round(value / 1000)}k` : value}`
                  }
                  tick={{ fontSize: 11, fill: "var(--color-txt-mut)", fontWeight: 500 }}
                />
                <Tooltip content={<ChartTooltip currency={snapshot.currency} />} cursor={false} />
                <Area
                  type="monotone"
                  dataKey="orders"
                  name="Revenue"
                  stroke="var(--color-accent)"
                  strokeWidth={3}
                  fill="url(#velocityGrad)"
                  animationDuration={1500}
                />
                <Area
                  type="monotone"
                  dataKey="profit"
                  name="Target"
                  stroke="var(--color-txt-mut)"
                  strokeWidth={2}
                  strokeDasharray="6 6"
                  fill="transparent"
                  animationDuration={2000}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 flex items-center justify-center gap-6">
            <div className="flex items-center gap-2">
              <div className="h-0.5 w-4 bg-[var(--color-accent)]" />
              <span className="text-[12px] font-medium text-[var(--color-txt-sec)]">Revenue</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-0.5 w-4 border-t-2 border-dashed border-[var(--color-txt-mut)]" />
              <span className="text-[12px] font-medium text-[var(--color-txt-sec)]">Target</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col rounded-[20px] border border-[var(--color-brd)] bg-[var(--color-surf)] p-8 shadow-[var(--shadow-subtle)] lg:col-span-4">
          <div className="mb-8">
            <h3 className="text-[16px] font-bold text-[var(--color-txt-pri)]">Staff Performance</h3>
            <p className="mt-1 text-sm font-medium text-[var(--color-txt-sec)]">
              Order processing efficiency
            </p>
          </div>

          <div className="flex-1">
            <div className="flex flex-col items-center justify-center py-10 text-[var(--color-txt-mut)]">
              <Users size={32} />
              <p className="mt-4 text-sm font-medium uppercase tracking-[0.18em]">
                Awaiting Data
              </p>
              <p className="mt-3 text-center text-sm leading-6 text-[var(--color-txt-sec)]">
                v1 treated this as a light performance widget. v2 does not yet expose safe per-staff order ownership data for an exact live clone.
              </p>
            </div>
          </div>

          <Link
            href="/dashboard/users"
            className="group mt-auto flex items-center justify-between border-t border-[var(--color-brd)] pt-6 text-[var(--color-txt-sec)] transition-colors hover:text-[var(--color-txt-pri)]"
          >
            <span className="text-[13px] font-medium">Full Report</span>
            <ChevronRight size={18} className="translate-x-0 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </div>
  );
}
