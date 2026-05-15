"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, DownloadCloud, Eye, Loader2, PlugZap, RefreshCw, Search, ShoppingBag, ShoppingCart } from "lucide-react";

import { ErrorAlert } from "@/components/ui/error-alert";
import { EmptyState } from "@/components/ui/empty-state";
import { FormCard } from "@/components/ui/form-card";
import { LoadingState } from "@/components/ui/loading-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { api, ApiError } from "@/lib/api";
import { formatCurrency, formatDateTime, formatLabel } from "@/lib/format";

type WooCommerceSetting = {
  id: string;
  store_url: string | null;
  api_version: string;
  is_active: boolean;
  has_consumer_key: boolean;
  has_consumer_secret: boolean;
  consumer_key_masked: string | null;
  credentials_encrypted: boolean;
  encryption_key_configured: boolean;
  encryption_warning: string | null;
  last_tested_at: string | null;
  last_test_success: boolean;
  last_test_message: string | null;
  created_at: string;
  updated_at: string;
};

type ConnectionTestResult = {
  success: boolean;
  message: string;
  tested_at: string;
};

type ProductPreview = {
  external_id: string;
  name: string;
  slug: string | null;
  sku: string | null;
  price: number | string;
  status: string | null;
  category: string | null;
  image_url: string | null;
  duplicate_status: "new" | "existing_by_sku" | "existing_by_slug" | "missing_sku";
  local_product_id: string | null;
};

type OrderPreview = {
  external_id: string;
  number: string;
  customer: string | null;
  status: string | null;
  total: number | string;
  currency: string | null;
  created_at: string | null;
  duplicate_status: "new" | "existing_by_order_number" | "existing_by_external_id_if_available";
  local_order_id: string | null;
};

type PreviewList<T> = {
  items: T[];
  page: number;
  per_page: number;
  total: number | null;
  total_pages: number | null;
};

type ImportResultRow = {
  external_id: string;
  status: "imported" | "skipped" | "failed";
  local_entity_id: string | null;
  message: string;
};

type ImportResult = {
  imported_count: number;
  skipped_count: number;
  failed_count: number;
  rows: ImportResultRow[];
};

type SyncLog = {
  id: string;
  sync_type: string;
  direction: string;
  status: string;
  external_id: string | null;
  local_entity_type: string | null;
  local_entity_id: string | null;
  message: string | null;
  payload_snapshot: unknown;
  created_by_id: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  created_by: { full_name: string } | null;
};

type SettingsForm = {
  store_url: string;
  consumer_key: string;
  consumer_secret: string;
  api_version: string;
  is_active: boolean;
};

type SyncLogFilters = {
  sync_type: string;
  status: string;
  external_id: string;
};

const tabs = [
  { id: "connection", label: "Connection Settings", icon: PlugZap },
  { id: "products", label: "Product Import", icon: ShoppingBag },
  { id: "orders", label: "Order Import", icon: ShoppingCart },
  { id: "logs", label: "Sync Logs", icon: DownloadCloud },
] as const;

type TabId = (typeof tabs)[number]["id"];

const initialSettingsForm: SettingsForm = {
  store_url: "",
  consumer_key: "",
  consumer_secret: "",
  api_version: "wc/v3",
  is_active: true,
};

const initialLogFilters: SyncLogFilters = {
  sync_type: "",
  status: "",
  external_id: "",
};

function isExistingProductMatch(item: ProductPreview) {
  return item.duplicate_status === "existing_by_sku" || item.duplicate_status === "existing_by_slug";
}

function isExistingOrderMatch(item: OrderPreview) {
  return item.duplicate_status === "existing_by_order_number" || item.duplicate_status === "existing_by_external_id_if_available";
}

function renderPayloadSnapshot(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "No payload snapshot";
  }
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value, null, 2);
}

function duplicateStatusLabel(status: ProductPreview["duplicate_status"] | OrderPreview["duplicate_status"]) {
  switch (status) {
    case "new":
      return "New";
    case "existing_by_sku":
      return "Existing SKU";
    case "existing_by_slug":
      return "Existing Slug";
    case "missing_sku":
      return "Missing SKU";
    case "existing_by_order_number":
    case "existing_by_external_id_if_available":
      return "Existing Order";
    default:
      return formatLabel(status);
  }
}

function LocalEntityLink({ type, id }: { type: "product" | "order"; id: string | null }) {
  if (!id) {
    return <span className="text-slate-400">-</span>;
  }

  const href = type === "product" ? `/dashboard/products/${id}` : `/dashboard/orders/${id}`;
  return (
    <Link href={href} className="text-sm font-medium text-sky-700 underline-offset-2 hover:underline">
      View local {type}
    </Link>
  );
}

export default function WooCommercePage() {
  const [activeTab, setActiveTab] = useState<TabId>("connection");
  const [settings, setSettings] = useState<WooCommerceSetting | null>(null);
  const [settingsForm, setSettingsForm] = useState<SettingsForm>(initialSettingsForm);
  const [productPreview, setProductPreview] = useState<PreviewList<ProductPreview> | null>(null);
  const [orderPreview, setOrderPreview] = useState<PreviewList<OrderPreview> | null>(null);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<SyncLog | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [productPage, setProductPage] = useState(1);
  const [productPerPage, setProductPerPage] = useState(20);
  const [orderStatusFilter, setOrderStatusFilter] = useState("");
  const [orderPage, setOrderPage] = useState(1);
  const [orderPerPage, setOrderPerPage] = useState(20);
  const [logFilters, setLogFilters] = useState<SyncLogFilters>(initialLogFilters);
  const [includeExistingProductMatches, setIncludeExistingProductMatches] = useState(false);
  const [includeExistingOrderMatches, setIncludeExistingOrderMatches] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [lastProductImportResult, setLastProductImportResult] = useState<ImportResult | null>(null);
  const [lastOrderImportResult, setLastOrderImportResult] = useState<ImportResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [isImportingProducts, setIsImportingProducts] = useState(false);
  const [isImportingOrders, setIsImportingOrders] = useState(false);
  const [isRefreshingLogs, setIsRefreshingLogs] = useState(false);
  const [isLoadingLogDetail, setIsLoadingLogDetail] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function refreshLogs(nextFilters: SyncLogFilters = logFilters) {
    const query = new URLSearchParams();
    if (nextFilters.sync_type) {
      query.set("sync_type", nextFilters.sync_type);
    }
    if (nextFilters.status) {
      query.set("status", nextFilters.status);
    }
    if (nextFilters.external_id.trim()) {
      query.set("external_id", nextFilters.external_id.trim());
    }
    query.set("limit", "100");
    const suffix = query.toString();
    const logs = await api.get<SyncLog[]>(`/woocommerce/sync-logs${suffix ? `?${suffix}` : ""}`);
    setSyncLogs(logs);
    if (selectedLog) {
      const refreshedSelected = logs.find((log) => log.id === selectedLog.id);
      if (refreshedSelected) {
        setSelectedLog(refreshedSelected);
      }
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      try {
        const [settingsData, logsData] = await Promise.all([
          api.get<WooCommerceSetting>("/woocommerce/settings"),
          api.get<SyncLog[]>("/woocommerce/sync-logs?limit=100"),
        ]);
        if (!isMounted) return;
        setSettings(settingsData);
        setSettingsForm({
          store_url: settingsData.store_url || "",
          consumer_key: "",
          consumer_secret: "",
          api_version: settingsData.api_version,
          is_active: settingsData.is_active,
        });
        setSyncLogs(logsData);
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof ApiError ? err.message : "Failed to load WooCommerce workspace");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void bootstrap();
    return () => {
      isMounted = false;
    };
  }, []);

  async function loadProductPreview(nextPage = productPage, nextPerPage = productPerPage, nextSearch = productSearch) {
    const query = new URLSearchParams({
      page: String(nextPage),
      per_page: String(nextPerPage),
    });
    if (nextSearch.trim()) {
      query.set("search", nextSearch.trim());
    }
    const payload = await api.get<PreviewList<ProductPreview>>(`/woocommerce/products-preview?${query.toString()}`);
    setProductPreview(payload);
    setSelectedProductIds([]);
  }

  async function loadOrderPreview(nextPage = orderPage, nextPerPage = orderPerPage, nextStatus = orderStatusFilter) {
    const query = new URLSearchParams({
      page: String(nextPage),
      per_page: String(nextPerPage),
    });
    if (nextStatus.trim()) {
      query.set("status", nextStatus.trim());
    }
    const payload = await api.get<PreviewList<OrderPreview>>(`/woocommerce/orders-preview?${query.toString()}`);
    setOrderPreview(payload);
    setSelectedOrderIds([]);
  }

  async function handleSettingsSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSavingSettings(true);
    try {
      const updated = await api.patch<WooCommerceSetting>("/woocommerce/settings", {
        store_url: settingsForm.store_url || null,
        consumer_key: settingsForm.consumer_key || undefined,
        consumer_secret: settingsForm.consumer_secret || undefined,
        api_version: settingsForm.api_version,
        is_active: settingsForm.is_active,
      });
      setSettings(updated);
      setSettingsForm((current) => ({
        ...current,
        consumer_key: "",
        consumer_secret: "",
      }));
      setSuccess("WooCommerce settings saved. Keys are never displayed after saving.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save WooCommerce settings");
    } finally {
      setIsSavingSettings(false);
    }
  }

  async function handleConnectionTest() {
    setError("");
    setSuccess("");
    setIsTestingConnection(true);
    try {
      const result = await api.post<ConnectionTestResult>("/woocommerce/test-connection", {});
      const refreshedSettings = await api.get<WooCommerceSetting>("/woocommerce/settings");
      setSettings(refreshedSettings);
      setSuccess(result.message);
      await refreshLogs();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to test WooCommerce connection");
    } finally {
      setIsTestingConnection(false);
    }
  }

  async function handleProductPreviewLoad() {
    setError("");
    setSuccess("");
    setIsLoadingProducts(true);
    try {
      await loadProductPreview();
      await refreshLogs();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load WooCommerce products preview");
    } finally {
      setIsLoadingProducts(false);
    }
  }

  async function handleOrderPreviewLoad() {
    setError("");
    setSuccess("");
    setIsLoadingOrders(true);
    try {
      await loadOrderPreview();
      await refreshLogs();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load WooCommerce orders preview");
    } finally {
      setIsLoadingOrders(false);
    }
  }

  async function handleProductImport() {
    if (selectedProductIds.length === 0) return;
    setError("");
    setSuccess("");
    setIsImportingProducts(true);
    try {
      const result = await api.post<ImportResult>("/woocommerce/products-import", {
        external_ids: selectedProductIds,
      });
      setLastProductImportResult(result);
      setSuccess(`Product import complete: ${result.imported_count} imported, ${result.skipped_count} skipped, ${result.failed_count} failed.`);
      await refreshLogs();
      await loadProductPreview();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to import WooCommerce products");
    } finally {
      setIsImportingProducts(false);
    }
  }

  async function handleOrderImport() {
    if (selectedOrderIds.length === 0) return;
    setError("");
    setSuccess("");
    setIsImportingOrders(true);
    try {
      const result = await api.post<ImportResult>("/woocommerce/orders-import", {
        external_ids: selectedOrderIds,
      });
      setLastOrderImportResult(result);
      setSuccess(`Order import complete: ${result.imported_count} imported, ${result.skipped_count} skipped, ${result.failed_count} failed.`);
      await refreshLogs();
      await loadOrderPreview();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to import WooCommerce orders");
    } finally {
      setIsImportingOrders(false);
    }
  }

  async function handleLogsRefresh() {
    setError("");
    setIsRefreshingLogs(true);
    try {
      await refreshLogs(logFilters);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to refresh WooCommerce sync logs");
    } finally {
      setIsRefreshingLogs(false);
    }
  }

  async function handleViewLogDetails(logId: string) {
    setError("");
    setIsLoadingLogDetail(true);
    try {
      const detail = await api.get<SyncLog>(`/woocommerce/sync-logs/${logId}`);
      setSelectedLog(detail);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load WooCommerce sync log details");
    } finally {
      setIsLoadingLogDetail(false);
    }
  }

  const selectableProductIds = useMemo(() => {
    return (productPreview?.items || [])
      .filter((item) => includeExistingProductMatches || !isExistingProductMatch(item))
      .map((item) => item.external_id);
  }, [includeExistingProductMatches, productPreview]);

  const selectableOrderIds = useMemo(() => {
    return (orderPreview?.items || [])
      .filter((item) => includeExistingOrderMatches || !isExistingOrderMatch(item))
      .map((item) => item.external_id);
  }, [includeExistingOrderMatches, orderPreview]);

  const allSelectableProductsSelected = selectableProductIds.length > 0 && selectableProductIds.every((id) => selectedProductIds.includes(id));
  const allSelectableOrdersSelected = selectableOrderIds.length > 0 && selectableOrderIds.every((id) => selectedOrderIds.includes(id));

  if (isLoading) {
    return <LoadingState label="Loading WooCommerce workspace..." />;
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)] sm:p-8">
        <PageHeader
          eyebrow="Manual Import Hardening"
          title="WooCommerce workspace"
          description="Configure a safer read-only WooCommerce connection, preview duplicate risk before import, review row-level outcomes, and inspect sync-log details."
          meta="Read-only"
        />
      </section>

      <div className="rounded-[28px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-800 shadow-[var(--shadow-soft)]">
        This phase stays read-only against WooCommerce. There is no automatic background sync, no destructive WooCommerce update, and no push-back of local products or orders.
      </div>
      <div className="rounded-[28px] border border-sky-200 bg-sky-50 px-5 py-4 text-sm leading-6 text-sky-800 shadow-[var(--shadow-soft)]">
        Manual import only. This will not modify your WooCommerce store.
      </div>

      {error ? <ErrorAlert message={error} /> : null}
      {success ? (
        <div className="rounded-[28px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-700 shadow-[var(--shadow-soft)]">
          {success}
        </div>
      ) : null}

      <div className="rounded-[28px] border border-slate-200 bg-white p-3 shadow-[var(--shadow-soft)]">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  isActive ? "bg-slate-950 text-white" : "border border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === "connection" ? (
        <FormCard
          title="Connection settings"
          description="Save WooCommerce credentials server-side, keep them hidden after save, and confirm the connection before any preview or import."
          action={
            <button
              type="button"
              onClick={() => void handleConnectionTest()}
              disabled={isTestingConnection}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              {isTestingConnection ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
              Test connection
            </button>
          }
        >
          <form onSubmit={handleSettingsSave} className="space-y-4">
            <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
              Keys are never displayed after saving.
            </div>
            {settings?.encryption_warning ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {settings.encryption_warning}
              </div>
            ) : null}
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Store URL</span>
                <input
                  value={settingsForm.store_url}
                  onChange={(event) => setSettingsForm((current) => ({ ...current, store_url: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
                  placeholder="https://example.com"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">API version</span>
                <input
                  value={settingsForm.api_version}
                  onChange={(event) => setSettingsForm((current) => ({ ...current, api_version: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Consumer key</span>
                <input
                  value={settingsForm.consumer_key}
                  onChange={(event) => setSettingsForm((current) => ({ ...current, consumer_key: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
                  placeholder={settings?.has_consumer_key ? "Saved server-side" : "ck_..."}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Consumer secret</span>
                <input
                  type="password"
                  value={settingsForm.consumer_secret}
                  onChange={(event) => setSettingsForm((current) => ({ ...current, consumer_secret: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
                  placeholder={settings?.has_consumer_secret ? "Saved server-side" : "cs_..."}
                />
              </label>
            </div>
            <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <span className="text-sm font-medium text-slate-700">WooCommerce integration active</span>
              <input
                type="checkbox"
                checked={settingsForm.is_active}
                onChange={(event) => setSettingsForm((current) => ({ ...current, is_active: event.target.checked }))}
                className="h-4 w-4 rounded border-slate-300"
              />
            </label>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Key saved: <span className="font-semibold text-slate-950">{settings?.has_consumer_key ? "Yes" : "No"}</span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Secret saved: <span className="font-semibold text-slate-950">{settings?.has_consumer_secret ? "Yes" : "No"}</span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Masked key: <span className="font-semibold text-slate-950">{settings?.consumer_key_masked || "Not saved"}</span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Encrypted: <span className="font-semibold text-slate-950">{settings?.credentials_encrypted ? "Yes" : "No"}</span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Last tested: <span className="font-semibold text-slate-950">{settings?.last_tested_at ? formatDateTime(settings.last_tested_at) : "Never"}</span>
              </div>
            </div>
            {settings?.last_test_message ? (
              <div className={`rounded-2xl border px-4 py-3 text-sm ${settings.last_test_success ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
                {settings.last_test_message}
              </div>
            ) : null}
            <button
              type="submit"
              disabled={isSavingSettings}
              className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              {isSavingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Save settings
            </button>
          </form>
        </FormCard>
      ) : null}

      {activeTab === "products" ? (
        <div className="space-y-4">
          <FormCard title="Product preview and import" description="Preview WooCommerce products, inspect duplicate status, and import only the rows you intentionally allow.">
            <div className="grid gap-4 md:grid-cols-[1.2fr_160px_160px_auto]">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Search</span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={productSearch}
                    onChange={(event) => setProductSearch(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-11 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
                    placeholder="Name or SKU"
                  />
                </div>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Page</span>
                <input type="number" min={1} value={productPage} onChange={(event) => setProductPage(Number(event.target.value) || 1)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Per page</span>
                <select value={productPerPage} onChange={(event) => setProductPerPage(Number(event.target.value))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white">
                  {[10, 20, 50].map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
              <div className="flex items-end">
                <button type="button" onClick={() => void handleProductPreviewLoad()} disabled={isLoadingProducts} className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60">
                  {isLoadingProducts ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Load preview
                </button>
              </div>
            </div>
            {productPreview ? (
              <div className="mt-5 space-y-4">
                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={includeExistingProductMatches}
                    onChange={(event) => {
                      setIncludeExistingProductMatches(event.target.checked);
                      setSelectedProductIds([]);
                    }}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Include existing matches
                </label>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-slate-500">
                    Showing page {productPreview.page} with {productPreview.items.length} rows
                    {productPreview.total ? ` out of ${productPreview.total}` : ""}.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setSelectedProductIds(allSelectableProductsSelected ? [] : selectableProductIds)} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                      {allSelectableProductsSelected ? "Clear selection" : "Select eligible"}
                    </button>
                    <button type="button" onClick={() => void handleProductImport()} disabled={selectedProductIds.length === 0 || isImportingProducts} className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60">
                      {isImportingProducts ? <Loader2 className="h-4 w-4 animate-spin" /> : <DownloadCloud className="h-4 w-4" />}
                      Import selected
                    </button>
                  </div>
                </div>
                {productPreview.items.length === 0 ? (
                  <EmptyState
                    title="No products found"
                    description="Try a different search term or page setting, then load the preview again."
                  />
                ) : (
                <div className="overflow-x-auto rounded-3xl border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-left text-slate-600">
                      <tr>
                        <th className="px-4 py-3">
                          <input type="checkbox" checked={allSelectableProductsSelected} onChange={() => setSelectedProductIds(allSelectableProductsSelected ? [] : selectableProductIds)} />
                        </th>
                        <th className="px-4 py-3">External ID</th>
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3">SKU</th>
                        <th className="px-4 py-3">Duplicate status</th>
                        <th className="px-4 py-3">Local product</th>
                        <th className="px-4 py-3">Price</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {productPreview.items.map((item) => {
                        const disabled = isExistingProductMatch(item) && !includeExistingProductMatches;
                        return (
                          <tr key={item.external_id} className={disabled ? "bg-slate-50/70" : ""}>
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={selectedProductIds.includes(item.external_id)}
                                disabled={disabled}
                                onChange={() =>
                                  setSelectedProductIds((current) =>
                                    current.includes(item.external_id)
                                      ? current.filter((id) => id !== item.external_id)
                                      : [...current, item.external_id]
                                  )
                                }
                              />
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-950">{item.external_id}</td>
                            <td className="px-4 py-3 text-slate-700">{item.name}</td>
                            <td className="px-4 py-3 text-slate-500">{item.sku || "No SKU"}</td>
                            <td className="px-4 py-3"><StatusBadge status={item.duplicate_status} label={duplicateStatusLabel(item.duplicate_status)} /></td>
                            <td className="px-4 py-3"><LocalEntityLink type="product" id={item.local_product_id} /></td>
                            <td className="px-4 py-3 text-slate-700">{formatCurrency(item.price)}</td>
                            <td className="px-4 py-3 text-slate-500">{formatLabel(item.status || "unknown")}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                )}
              </div>
            ) : (
              <div className="mt-5">
                <EmptyState
                  title="No product preview loaded"
                  description="Use the filters above, then click Load preview to inspect WooCommerce products before importing."
                />
              </div>
            )}
          </FormCard>

          {lastProductImportResult ? (
            <FormCard title="Latest product import result" description="Review imported, skipped, and failed rows from the last manual product import run.">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4"><p className="text-sm text-emerald-700">Imported</p><p className="mt-2 text-2xl font-semibold text-emerald-900">{lastProductImportResult.imported_count}</p></div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4"><p className="text-sm text-amber-700">Skipped</p><p className="mt-2 text-2xl font-semibold text-amber-900">{lastProductImportResult.skipped_count}</p></div>
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4"><p className="text-sm text-rose-700">Failed</p><p className="mt-2 text-2xl font-semibold text-rose-900">{lastProductImportResult.failed_count}</p></div>
              </div>
              <div className="mt-4 overflow-x-auto rounded-3xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-slate-600">
                    <tr>
                      <th className="px-4 py-3">External ID</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Local entity</th>
                      <th className="px-4 py-3">Message</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {lastProductImportResult.rows.map((row) => (
                      <tr key={`${row.external_id}-${row.status}-${row.local_entity_id || "none"}`}>
                        <td className="px-4 py-3 font-medium text-slate-950">{row.external_id}</td>
                        <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                        <td className="px-4 py-3"><LocalEntityLink type="product" id={row.local_entity_id} /></td>
                        <td className="px-4 py-3 text-slate-500">{row.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </FormCard>
          ) : null}
        </div>
      ) : null}

      {activeTab === "orders" ? (
        <div className="space-y-4">
          <FormCard title="Order preview and import" description="Preview WooCommerce orders, inspect duplicate status, and import only the selected rows without automatic stock deduction.">
            <div className="grid gap-4 md:grid-cols-[1fr_160px_160px_auto]">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Status filter</span>
                <select value={orderStatusFilter} onChange={(event) => setOrderStatusFilter(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white">
                  <option value="">All statuses</option>
                  {["pending", "processing", "completed", "cancelled", "refunded", "failed", "on-hold"].map((value) => <option key={value} value={value}>{formatLabel(value)}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Page</span>
                <input type="number" min={1} value={orderPage} onChange={(event) => setOrderPage(Number(event.target.value) || 1)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Per page</span>
                <select value={orderPerPage} onChange={(event) => setOrderPerPage(Number(event.target.value))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white">
                  {[10, 20, 50].map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
              <div className="flex items-end">
                <button type="button" onClick={() => void handleOrderPreviewLoad()} disabled={isLoadingOrders} className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60">
                  {isLoadingOrders ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Load preview
                </button>
              </div>
            </div>
            {orderPreview ? (
              <div className="mt-5 space-y-4">
                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={includeExistingOrderMatches}
                    onChange={(event) => {
                      setIncludeExistingOrderMatches(event.target.checked);
                      setSelectedOrderIds([]);
                    }}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Include existing matches
                </label>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-slate-500">
                    Showing page {orderPreview.page} with {orderPreview.items.length} rows
                    {orderPreview.total ? ` out of ${orderPreview.total}` : ""}.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setSelectedOrderIds(allSelectableOrdersSelected ? [] : selectableOrderIds)} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                      {allSelectableOrdersSelected ? "Clear selection" : "Select eligible"}
                    </button>
                    <button type="button" onClick={() => void handleOrderImport()} disabled={selectedOrderIds.length === 0 || isImportingOrders} className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60">
                      {isImportingOrders ? <Loader2 className="h-4 w-4 animate-spin" /> : <DownloadCloud className="h-4 w-4" />}
                      Import selected
                    </button>
                  </div>
                </div>
                {orderPreview.items.length === 0 ? (
                  <EmptyState
                    title="No orders found"
                    description="Try a different status or page setting, then load the preview again."
                  />
                ) : (
                <div className="overflow-x-auto rounded-3xl border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-left text-slate-600">
                      <tr>
                        <th className="px-4 py-3">
                          <input type="checkbox" checked={allSelectableOrdersSelected} onChange={() => setSelectedOrderIds(allSelectableOrdersSelected ? [] : selectableOrderIds)} />
                        </th>
                        <th className="px-4 py-3">External ID</th>
                        <th className="px-4 py-3">Number</th>
                        <th className="px-4 py-3">Customer</th>
                        <th className="px-4 py-3">Duplicate status</th>
                        <th className="px-4 py-3">Local order</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Total</th>
                        <th className="px-4 py-3">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {orderPreview.items.map((item) => {
                        const disabled = isExistingOrderMatch(item) && !includeExistingOrderMatches;
                        return (
                          <tr key={item.external_id} className={disabled ? "bg-slate-50/70" : ""}>
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={selectedOrderIds.includes(item.external_id)}
                                disabled={disabled}
                                onChange={() =>
                                  setSelectedOrderIds((current) =>
                                    current.includes(item.external_id)
                                      ? current.filter((id) => id !== item.external_id)
                                      : [...current, item.external_id]
                                  )
                                }
                              />
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-950">{item.external_id}</td>
                            <td className="px-4 py-3 text-slate-700">{item.number}</td>
                            <td className="px-4 py-3 text-slate-500">{item.customer || "Walk-in customer"}</td>
                            <td className="px-4 py-3"><StatusBadge status={item.duplicate_status} label={duplicateStatusLabel(item.duplicate_status)} /></td>
                            <td className="px-4 py-3"><LocalEntityLink type="order" id={item.local_order_id} /></td>
                            <td className="px-4 py-3 text-slate-500">{formatLabel(item.status || "unknown")}</td>
                            <td className="px-4 py-3 text-slate-700">{formatCurrency(item.total)}</td>
                            <td className="px-4 py-3 text-slate-500">{item.created_at ? formatDateTime(item.created_at) : "Unknown"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                )}
              </div>
            ) : (
              <div className="mt-5">
                <EmptyState
                  title="No order preview loaded"
                  description="Use the filters above, then click Load preview to inspect WooCommerce orders before importing."
                />
              </div>
            )}
          </FormCard>

          {lastOrderImportResult ? (
            <FormCard title="Latest order import result" description="Review imported, skipped, and failed rows from the last manual order import run.">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4"><p className="text-sm text-emerald-700">Imported</p><p className="mt-2 text-2xl font-semibold text-emerald-900">{lastOrderImportResult.imported_count}</p></div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4"><p className="text-sm text-amber-700">Skipped</p><p className="mt-2 text-2xl font-semibold text-amber-900">{lastOrderImportResult.skipped_count}</p></div>
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4"><p className="text-sm text-rose-700">Failed</p><p className="mt-2 text-2xl font-semibold text-rose-900">{lastOrderImportResult.failed_count}</p></div>
              </div>
              <div className="mt-4 overflow-x-auto rounded-3xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-slate-600">
                    <tr>
                      <th className="px-4 py-3">External ID</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Local entity</th>
                      <th className="px-4 py-3">Message</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {lastOrderImportResult.rows.map((row) => (
                      <tr key={`${row.external_id}-${row.status}-${row.local_entity_id || "none"}`}>
                        <td className="px-4 py-3 font-medium text-slate-950">{row.external_id}</td>
                        <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                        <td className="px-4 py-3"><LocalEntityLink type="order" id={row.local_entity_id} /></td>
                        <td className="px-4 py-3 text-slate-500">{row.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </FormCard>
          ) : null}
        </div>
      ) : null}

      {activeTab === "logs" ? (
        <div className="space-y-4">
          <FormCard
            title="Sync logs"
            description="Filter connection tests, previews, and manual import runs, then inspect safe payload snapshots for a single log row."
            action={
              <button type="button" onClick={() => void handleLogsRefresh()} disabled={isRefreshingLogs} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60">
                {isRefreshingLogs ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Refresh
              </button>
            }
          >
            <div className="grid gap-4 md:grid-cols-[180px_180px_1fr_auto]">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Sync type</span>
                <select value={logFilters.sync_type} onChange={(event) => setLogFilters((current) => ({ ...current, sync_type: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white">
                  <option value="">All types</option>
                  {["connection_test", "product_preview", "product_import", "order_preview", "order_import"].map((value) => <option key={value} value={value}>{formatLabel(value)}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Status</span>
                <select value={logFilters.status} onChange={(event) => setLogFilters((current) => ({ ...current, status: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white">
                  <option value="">All statuses</option>
                  {["success", "failed", "skipped", "pending"].map((value) => <option key={value} value={value}>{formatLabel(value)}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">External ID</span>
                <input
                  value={logFilters.external_id}
                  onChange={(event) => setLogFilters((current) => ({ ...current, external_id: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
                  placeholder="Search external ID"
                />
              </label>
              <div className="flex items-end">
                <button type="button" onClick={() => void handleLogsRefresh()} disabled={isRefreshingLogs} className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60">
                  {isRefreshingLogs ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Apply filters
                </button>
              </div>
            </div>
            {syncLogs.length === 0 ? (
              <div className="mt-5">
                <EmptyState
                  title="No sync logs found"
                  description="Run a connection test, preview, or import, or relax the filters to see more WooCommerce log entries."
                />
              </div>
            ) : (
            <div className="mt-5 overflow-x-auto rounded-3xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Sync Type</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">External ID</th>
                    <th className="px-4 py-3">Local Entity</th>
                    <th className="px-4 py-3">Message</th>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {syncLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="px-4 py-3 text-slate-500">{formatDateTime(log.created_at)}</td>
                      <td className="px-4 py-3 text-slate-700">{formatLabel(log.sync_type)}</td>
                      <td className="px-4 py-3"><StatusBadge status={log.status} /></td>
                      <td className="px-4 py-3 text-slate-500">{log.external_id || "-"}</td>
                      <td className="px-4 py-3 text-slate-500">{log.local_entity_type ? `${log.local_entity_type}:${log.local_entity_id || "-"}` : "-"}</td>
                      <td className="px-4 py-3 text-slate-500">{log.message || "-"}</td>
                      <td className="px-4 py-3 text-slate-500">{log.created_by?.full_name || "-"}</td>
                      <td className="px-4 py-3">
                        <button type="button" onClick={() => void handleViewLogDetails(log.id)} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">
                          <Eye className="h-3.5 w-3.5" />
                          View details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
          </FormCard>

          {isLoadingLogDetail ? (
            <div className="rounded-[28px] border border-slate-200 bg-white px-5 py-6 text-sm text-slate-600 shadow-[var(--shadow-soft)]">
              <div className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading log detail...
              </div>
            </div>
          ) : null}

          {selectedLog ? (
            <FormCard
              title="Sync log detail"
              description="Inspect the selected WooCommerce sync log entry, including any safe payload snapshot saved for that run."
              action={
                <button type="button" onClick={() => setSelectedLog(null)} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                  Close
                </button>
              }
            >
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Sync type: <span className="font-semibold text-slate-950">{formatLabel(selectedLog.sync_type)}</span>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Status: <span className="font-semibold text-slate-950">{formatLabel(selectedLog.status)}</span>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  External ID: <span className="font-semibold text-slate-950">{selectedLog.external_id || "-"}</span>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Local entity: <span className="font-semibold text-slate-950">{selectedLog.local_entity_type ? `${selectedLog.local_entity_type}:${selectedLog.local_entity_id || "-"}` : "-"}</span>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Started: <span className="font-semibold text-slate-950">{selectedLog.started_at ? formatDateTime(selectedLog.started_at) : "-"}</span>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Finished: <span className="font-semibold text-slate-950">{selectedLog.finished_at ? formatDateTime(selectedLog.finished_at) : "-"}</span>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Created: <span className="font-semibold text-slate-950">{formatDateTime(selectedLog.created_at)}</span>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  User: <span className="font-semibold text-slate-950">{selectedLog.created_by?.full_name || "-"}</span>
                </div>
              </div>
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <span className="font-semibold text-slate-950">Message:</span> {selectedLog.message || "No message"}
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <span className="font-semibold text-slate-950">Product link:</span>{" "}
                  {selectedLog.local_entity_type === "product" ? <LocalEntityLink type="product" id={selectedLog.local_entity_id} /> : "-"}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <span className="font-semibold text-slate-950">Order link:</span>{" "}
                  {selectedLog.local_entity_type === "order" ? <LocalEntityLink type="order" id={selectedLog.local_entity_id} /> : "-"}
                </div>
              </div>
              <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-950 p-4 text-xs text-slate-100">
                <pre className="overflow-x-auto whitespace-pre-wrap">{renderPayloadSnapshot(selectedLog.payload_snapshot)}</pre>
              </div>
            </FormCard>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
