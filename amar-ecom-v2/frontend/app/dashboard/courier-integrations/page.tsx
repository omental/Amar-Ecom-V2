"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Eye, Loader2, PlugZap, RefreshCw, Search, Send, ShieldCheck } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { ErrorAlert } from "@/components/ui/error-alert";
import { FormCard } from "@/components/ui/form-card";
import { LoadingState } from "@/components/ui/loading-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { api, ApiError } from "@/lib/api";
import { formatDateTime, formatLabel } from "@/lib/format";

type CourierProviderSetting = {
  id: string;
  provider: string;
  display_name: string;
  base_url: string | null;
  has_api_key: boolean;
  has_api_secret: boolean;
  has_merchant_id: boolean;
  has_username: boolean;
  has_password: boolean;
  api_key_masked: string | null;
  api_secret_masked: string | null;
  merchant_id_masked: string | null;
  username_masked: string | null;
  password_masked: string | null;
  credentials_encrypted: boolean;
  encryption_key_configured: boolean;
  encryption_warning: string | null;
  is_active: boolean;
  is_sandbox: boolean;
  last_tested_at: string | null;
  last_test_success: boolean;
  last_test_message: string | null;
  created_at: string;
  updated_at: string;
};

type ProviderForm = {
  display_name: string;
  base_url: string;
  api_key: string;
  api_secret: string;
  merchant_id: string;
  username: string;
  password: string;
  is_active: boolean;
  is_sandbox: boolean;
};

type CourierConnectionTestResult = {
  provider: string;
  success: boolean;
  message: string;
  tested_at: string;
};

type ShipmentRow = {
  id: string;
  shipment_number: string;
  status: string;
  recipient_name: string | null;
  recipient_phone: string | null;
  tracking_number: string | null;
  external_provider: string | null;
  external_consignment_id: string | null;
  external_tracking_number: string | null;
  external_status: string | null;
  external_synced_at: string | null;
  sent_to_courier_at: string | null;
  order?: {
    order_number: string;
  } | null;
  courier?: {
    name: string;
  } | null;
};

type CourierLog = {
  id: string;
  provider: string;
  action: string;
  status: string;
  shipment_id: string | null;
  external_id: string | null;
  request_snapshot: unknown;
  response_snapshot: unknown;
  message: string | null;
  created_at: string;
  created_by: { full_name: string } | null;
};

type SendShipmentResult = {
  status: string;
  provider: string;
  shipment_id: string;
  external_id: string | null;
  external_tracking_number: string | null;
  external_status: string | null;
  sent_at: string | null;
  message: string;
};

type StatusSyncResult = {
  status: string;
  provider: string;
  shipment_id: string;
  external_id: string | null;
  external_tracking_number: string | null;
  external_status: string | null;
  internal_status: string | null;
  synced_at: string | null;
  message: string;
};

type LogFilters = {
  provider: string;
  action: string;
  status: string;
  external_id: string;
};

const providerOptions = ["manual", "steadfast", "pathao", "redx", "paperfly"] as const;

const tabs = [
  { id: "settings", label: "Provider Settings", icon: PlugZap },
  { id: "shipments", label: "Send Shipments", icon: Send },
  { id: "logs", label: "API Logs", icon: ShieldCheck },
] as const;

type TabId = (typeof tabs)[number]["id"];

const initialProviderForm: ProviderForm = {
  display_name: "",
  base_url: "",
  api_key: "",
  api_secret: "",
  merchant_id: "",
  username: "",
  password: "",
  is_active: true,
  is_sandbox: true,
};

const initialLogFilters: LogFilters = {
  provider: "",
  action: "",
  status: "",
  external_id: "",
};

function renderSnapshot(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "No snapshot available";
  }
  if (typeof value === "string") {
    return value;
  }
  return JSON.stringify(value, null, 2);
}

export default function CourierIntegrationsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("settings");
  const [providers, setProviders] = useState<CourierProviderSetting[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>("manual");
  const [providerSettings, setProviderSettings] = useState<CourierProviderSetting | null>(null);
  const [providerForm, setProviderForm] = useState<ProviderForm>(initialProviderForm);
  const [shipments, setShipments] = useState<ShipmentRow[]>([]);
  const [logs, setLogs] = useState<CourierLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<CourierLog | null>(null);
  const [logFilters, setLogFilters] = useState<LogFilters>(initialLogFilters);
  const [lastConnectionTest, setLastConnectionTest] = useState<CourierConnectionTestResult | null>(null);
  const [lastSendResult, setLastSendResult] = useState<SendShipmentResult | null>(null);
  const [lastSyncResult, setLastSyncResult] = useState<StatusSyncResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isRefreshingLogs, setIsRefreshingLogs] = useState(false);
  const [busySendShipmentId, setBusySendShipmentId] = useState<string | null>(null);
  const [busySyncShipmentId, setBusySyncShipmentId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedProviderInfo = useMemo(
    () => providers.find((provider) => provider.provider === selectedProvider) || providerSettings,
    [providerSettings, providers, selectedProvider],
  );

  async function loadProviders(nextProvider = selectedProvider) {
    const providerRows = await api.get<CourierProviderSetting[]>("/courier-integrations/providers");
    setProviders(providerRows);
    const matched = providerRows.find((provider) => provider.provider === nextProvider) || providerRows[0] || null;
    if (!matched) {
      return;
    }
    setSelectedProvider(matched.provider);
    setProviderSettings(matched);
    setProviderForm({
      display_name: matched.display_name,
      base_url: matched.base_url || "",
      api_key: "",
      api_secret: "",
      merchant_id: "",
      username: "",
      password: "",
      is_active: matched.is_active,
      is_sandbox: matched.is_sandbox,
    });
  }

  async function loadShipments() {
    const rows = await api.get<ShipmentRow[]>("/shipments?skip=0&limit=50");
    setShipments(rows);
  }

  async function loadLogs(filters: LogFilters = logFilters) {
    const query = new URLSearchParams();
    if (filters.provider) query.set("provider", filters.provider);
    if (filters.action) query.set("action", filters.action);
    if (filters.status) query.set("status", filters.status);
    if (filters.external_id.trim()) query.set("external_id", filters.external_id.trim());
    query.set("limit", "100");
    const rows = await api.get<CourierLog[]>(`/courier-integrations/logs?${query.toString()}`);
    setLogs(rows);
    if (selectedLog) {
      setSelectedLog(rows.find((row) => row.id === selectedLog.id) || null);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      try {
        const [providerRows, shipmentRows, logRows] = await Promise.all([
          api.get<CourierProviderSetting[]>("/courier-integrations/providers"),
          api.get<ShipmentRow[]>("/shipments?skip=0&limit=50"),
          api.get<CourierLog[]>("/courier-integrations/logs?limit=100"),
        ]);
        if (!isMounted) {
          return;
        }
        setProviders(providerRows);
        setShipments(shipmentRows);
        setLogs(logRows);
        const matched = providerRows.find((provider) => provider.provider === selectedProvider) || providerRows[0] || null;
        if (matched) {
          setSelectedProvider(matched.provider);
          setProviderSettings(matched);
          setProviderForm({
            display_name: matched.display_name,
            base_url: matched.base_url || "",
            api_key: "",
            api_secret: "",
            merchant_id: "",
            username: "",
            password: "",
            is_active: matched.is_active,
            is_sandbox: matched.is_sandbox,
          });
        }
      } catch (err) {
        if (!isMounted) {
          return;
        }
        setError(err instanceof ApiError ? err.message : "Failed to load courier integrations workspace");
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
  }, [selectedProvider]);

  async function handleProviderSelection(nextProvider: string) {
    setError("");
    try {
      const settings = await api.get<CourierProviderSetting>(`/courier-integrations/providers/${nextProvider}/settings`);
      setSelectedProvider(nextProvider);
      setProviderSettings(settings);
      setProviderForm({
        display_name: settings.display_name,
        base_url: settings.base_url || "",
        api_key: "",
        api_secret: "",
        merchant_id: "",
        username: "",
        password: "",
        is_active: settings.is_active,
        is_sandbox: settings.is_sandbox,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load provider settings");
    }
  }

  async function handleSaveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSaving(true);
    try {
      await api.patch<CourierProviderSetting>(`/courier-integrations/providers/${selectedProvider}/settings`, {
        display_name: providerForm.display_name,
        base_url: providerForm.base_url || null,
        api_key: providerForm.api_key || undefined,
        api_secret: providerForm.api_secret || undefined,
        merchant_id: providerForm.merchant_id || undefined,
        username: providerForm.username || undefined,
        password: providerForm.password || undefined,
        is_active: providerForm.is_active,
        is_sandbox: providerForm.is_sandbox,
      });
      await loadProviders(selectedProvider);
      setSuccess("Courier provider settings saved. Credentials are stored server-side and never displayed after saving.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save provider settings");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleTestConnection() {
    setError("");
    setSuccess("");
    setIsTesting(true);
    try {
      const result = await api.post<CourierConnectionTestResult>(`/courier-integrations/providers/${selectedProvider}/test-connection`, {});
      setLastConnectionTest(result);
      await loadProviders(selectedProvider);
      await loadLogs();
      setSuccess(result.message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to test provider connection");
    } finally {
      setIsTesting(false);
    }
  }

  async function handleSendShipment(shipmentId: string) {
    setError("");
    setSuccess("");
    setBusySendShipmentId(shipmentId);
    try {
      const result = await api.post<SendShipmentResult>(`/courier-integrations/shipments/${shipmentId}/send`, {
        provider: selectedProvider,
      });
      setLastSendResult(result);
      await loadShipments();
      await loadLogs();
      setSuccess(result.message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to send shipment to courier provider");
    } finally {
      setBusySendShipmentId(null);
    }
  }

  async function handleSyncStatus(shipmentId: string, provider: string | null) {
    setError("");
    setSuccess("");
    setBusySyncShipmentId(shipmentId);
    try {
      const result = await api.post<StatusSyncResult>(`/courier-integrations/shipments/${shipmentId}/sync-status`, {
        provider: provider || undefined,
      });
      setLastSyncResult(result);
      await loadShipments();
      await loadLogs();
      setSuccess(result.message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to sync external courier status");
    } finally {
      setBusySyncShipmentId(null);
    }
  }

  async function handleRefreshLogs() {
    setError("");
    setIsRefreshingLogs(true);
    try {
      await loadLogs(logFilters);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load courier API logs");
    } finally {
      setIsRefreshingLogs(false);
    }
  }

  if (isLoading) {
    return <LoadingState label="Loading courier integrations workspace..." />;
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)] sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <PageHeader
            eyebrow="Courier API Foundation"
            title="Courier Integrations"
            description="Save provider credentials, send shipments manually to external couriers, and sync external shipment status without background workers or destructive local changes."
            meta="Foundation only"
          />
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800 lg:max-w-md">
            This sends shipment data to the selected courier provider. It does not change WooCommerce or local inventory.
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-[var(--shadow-soft)] sm:p-6">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  isActive
                    ? "border-slate-950 bg-slate-950 text-white"
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </section>

      {error ? <ErrorAlert message={error} /> : null}
      {success ? (
        <div className="rounded-[28px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-700 shadow-[var(--shadow-soft)]">
          {success}
        </div>
      ) : null}

      {activeTab === "settings" ? (
        <FormCard title="Provider settings" description="Credentials are masked on read and stored server-side with encryption helpers already used by the backend.">
          <form onSubmit={handleSaveSettings} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-[220px_1fr]">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Provider</span>
                <select
                  value={selectedProvider}
                  onChange={(event) => void handleProviderSelection(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                >
                  {providerOptions.map((provider) => (
                    <option key={provider} value={provider}>
                      {formatLabel(provider)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                Credentials are stored server-side and never displayed after saving.
                {selectedProviderInfo?.encryption_warning ? (
                  <p className="mt-2 text-amber-700">{selectedProviderInfo.encryption_warning}</p>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Display name</span>
                <input
                  value={providerForm.display_name}
                  onChange={(event) => setProviderForm((current) => ({ ...current, display_name: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Base URL</span>
                <input
                  value={providerForm.base_url}
                  onChange={(event) => setProviderForm((current) => ({ ...current, base_url: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                  placeholder="https://api.example.com"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">API key</span>
                <input
                  value={providerForm.api_key}
                  onChange={(event) => setProviderForm((current) => ({ ...current, api_key: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                  placeholder={selectedProviderInfo?.api_key_masked || "Saved server-side after submit"}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">API secret</span>
                <input
                  value={providerForm.api_secret}
                  onChange={(event) => setProviderForm((current) => ({ ...current, api_secret: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                  placeholder={selectedProviderInfo?.api_secret_masked || "Saved server-side after submit"}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Merchant ID</span>
                <input
                  value={providerForm.merchant_id}
                  onChange={(event) => setProviderForm((current) => ({ ...current, merchant_id: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                  placeholder={selectedProviderInfo?.merchant_id_masked || "Optional"}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Username</span>
                <input
                  value={providerForm.username}
                  onChange={(event) => setProviderForm((current) => ({ ...current, username: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                  placeholder={selectedProviderInfo?.username_masked || "Optional"}
                />
              </label>
              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-medium text-slate-700">Password</span>
                <input
                  value={providerForm.password}
                  onChange={(event) => setProviderForm((current) => ({ ...current, password: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                  placeholder={selectedProviderInfo?.password_masked || "Optional"}
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={providerForm.is_sandbox}
                  onChange={(event) => setProviderForm((current) => ({ ...current, is_sandbox: event.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Sandbox mode
              </label>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={providerForm.is_active}
                  onChange={(event) => setProviderForm((current) => ({ ...current, is_active: event.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Provider active
              </label>
            </div>

            {selectedProviderInfo ? (
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                  <p className="font-semibold text-slate-950">Saved secrets</p>
                  <p className="mt-2">API key: {selectedProviderInfo.has_api_key ? selectedProviderInfo.api_key_masked || "Saved" : "Not saved"}</p>
                  <p className="mt-1">API secret: {selectedProviderInfo.has_api_secret ? selectedProviderInfo.api_secret_masked || "Saved" : "Not saved"}</p>
                  <p className="mt-1">Merchant: {selectedProviderInfo.has_merchant_id ? selectedProviderInfo.merchant_id_masked || "Saved" : "Not saved"}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                  <p className="font-semibold text-slate-950">Last test</p>
                  <p className="mt-2">{selectedProviderInfo.last_tested_at ? formatDateTime(selectedProviderInfo.last_tested_at) : "Never"}</p>
                  <p className="mt-1 text-xs text-slate-500">{selectedProviderInfo.last_test_message || "No connection test recorded."}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                  <p className="font-semibold text-slate-950">Security state</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <StatusBadge status={selectedProviderInfo.credentials_encrypted ? "success" : "warning"} label={selectedProviderInfo.credentials_encrypted ? "Encrypted" : "Legacy / Mixed"} />
                    <StatusBadge status={selectedProviderInfo.encryption_key_configured ? "active" : "warning"} label={selectedProviderInfo.encryption_key_configured ? "Key configured" : "Fallback key"} />
                  </div>
                </div>
              </div>
            ) : null}

            {lastConnectionTest ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-700">
                {lastConnectionTest.message} Tested at {formatDateTime(lastConnectionTest.tested_at)}.
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Save settings
              </button>
              <button
                type="button"
                onClick={() => void handleTestConnection()}
                disabled={isTesting}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
              >
                {isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
                Test connection
              </button>
            </div>
          </form>
        </FormCard>
      ) : null}

      {activeTab === "shipments" ? (
        <div className="space-y-4">
          <FormCard title="Send shipments" description="Manual only. Send recent shipment records to the selected provider and sync external delivery status when needed.">
            <div className="grid gap-4 md:grid-cols-[220px_1fr]">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Provider for send</span>
                <select
                  value={selectedProvider}
                  onChange={(event) => void handleProviderSelection(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                >
                  {providerOptions.map((provider) => (
                    <option key={provider} value={provider}>
                      {formatLabel(provider)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
                This sends shipment data to the selected courier provider. It does not change WooCommerce or local inventory.
              </div>
            </div>

            {shipments.length === 0 ? (
              <div className="mt-5">
                <EmptyState title="No shipments available" description="Create shipments first, then send them to a configured external courier provider from this page." />
              </div>
            ) : (
              <div className="mt-5 overflow-x-auto rounded-3xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-slate-600">
                    <tr>
                      <th className="px-4 py-3">Shipment</th>
                      <th className="px-4 py-3">Order</th>
                      <th className="px-4 py-3">Courier</th>
                      <th className="px-4 py-3">Recipient</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">External</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {shipments.map((shipment) => (
                      <tr key={shipment.id}>
                        <td className="px-4 py-3">
                          <Link href={`/dashboard/shipments/${shipment.id}`} className="font-medium text-slate-950 hover:underline">
                            {shipment.shipment_number}
                          </Link>
                          <p className="mt-1 text-xs text-slate-500">
                            {shipment.sent_to_courier_at ? `Sent ${formatDateTime(shipment.sent_to_courier_at)}` : "Not sent externally"}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{shipment.order?.order_number || "-"}</td>
                        <td className="px-4 py-3 text-slate-700">{shipment.courier?.name || "-"}</td>
                        <td className="px-4 py-3 text-slate-700">
                          {shipment.recipient_name || "No recipient"}
                          <p className="mt-1 text-xs text-slate-500">{shipment.recipient_phone || "No phone"}</p>
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={shipment.status} /></td>
                        <td className="px-4 py-3">
                          {shipment.external_provider ? (
                            <>
                              <StatusBadge status={shipment.external_provider} />
                              <p className="mt-1 text-xs text-slate-500">
                                {shipment.external_status || shipment.external_tracking_number || shipment.external_consignment_id || "Linked"}
                              </p>
                            </>
                          ) : (
                            <span className="text-slate-400">No external link</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => void handleSendShipment(shipment.id)}
                              disabled={busySendShipmentId === shipment.id}
                              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
                            >
                              {busySendShipmentId === shipment.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                              Send to provider
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleSyncStatus(shipment.id, shipment.external_provider)}
                              disabled={busySyncShipmentId === shipment.id}
                              className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-100 disabled:opacity-60"
                            >
                              {busySyncShipmentId === shipment.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                              Sync external status
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </FormCard>

          {lastSendResult ? (
            <div className="rounded-[28px] border border-slate-200 bg-white px-5 py-5 text-sm text-slate-700 shadow-[var(--shadow-soft)]">
              Latest send result: {lastSendResult.message}
            </div>
          ) : null}

          {lastSyncResult ? (
            <div className="rounded-[28px] border border-slate-200 bg-white px-5 py-5 text-sm text-slate-700 shadow-[var(--shadow-soft)]">
              Latest sync result: {lastSyncResult.message}
            </div>
          ) : null}
        </div>
      ) : null}

      {activeTab === "logs" ? (
        <div className="space-y-4">
          <FormCard title="API logs" description="Review connection tests, shipment send attempts, and status sync calls with sanitized snapshots.">
            <div className="grid gap-4 md:grid-cols-[180px_180px_180px_1fr_auto]">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Provider</span>
                <select
                  value={logFilters.provider}
                  onChange={(event) => setLogFilters((current) => ({ ...current, provider: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
                >
                  <option value="">All providers</option>
                  {providerOptions.map((provider) => (
                    <option key={provider} value={provider}>
                      {formatLabel(provider)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Action</span>
                <select
                  value={logFilters.action}
                  onChange={(event) => setLogFilters((current) => ({ ...current, action: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
                >
                  <option value="">All actions</option>
                  {["connection_test", "send_shipment", "status_sync"].map((action) => (
                    <option key={action} value={action}>
                      {formatLabel(action)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Status</span>
                <select
                  value={logFilters.status}
                  onChange={(event) => setLogFilters((current) => ({ ...current, status: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
                >
                  <option value="">All statuses</option>
                  {["success", "failed", "skipped"].map((statusValue) => (
                    <option key={statusValue} value={statusValue}>
                      {formatLabel(statusValue)}
                    </option>
                  ))}
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
                <button
                  type="button"
                  onClick={() => void handleRefreshLogs()}
                  disabled={isRefreshingLogs}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                >
                  {isRefreshingLogs ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Apply
                </button>
              </div>
            </div>

            {logs.length === 0 ? (
              <div className="mt-5">
                <EmptyState title="No API logs found" description="Run a connection test, send a shipment, or sync external status to generate courier API logs." />
              </div>
            ) : (
              <div className="mt-5 overflow-x-auto rounded-3xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-slate-600">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Provider</th>
                      <th className="px-4 py-3">Action</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Shipment</th>
                      <th className="px-4 py-3">External ID</th>
                      <th className="px-4 py-3">Message</th>
                      <th className="px-4 py-3">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {logs.map((log) => (
                      <tr key={log.id}>
                        <td className="px-4 py-3 text-slate-500">{formatDateTime(log.created_at)}</td>
                        <td className="px-4 py-3"><StatusBadge status={log.provider} /></td>
                        <td className="px-4 py-3 text-slate-700">{formatLabel(log.action)}</td>
                        <td className="px-4 py-3"><StatusBadge status={log.status} /></td>
                        <td className="px-4 py-3 text-slate-500">
                          {log.shipment_id ? (
                            <Link href={`/dashboard/shipments/${log.shipment_id}`} className="hover:underline">
                              Open shipment
                            </Link>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-500">{log.external_id || "-"}</td>
                        <td className="px-4 py-3 text-slate-500">{log.message || "-"}</td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => setSelectedLog(log)}
                            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </FormCard>

          {selectedLog ? (
            <FormCard title="Log detail" description="Snapshots are sanitized before storage and display.">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Provider: <span className="font-semibold text-slate-950">{formatLabel(selectedLog.provider)}</span>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Action: <span className="font-semibold text-slate-950">{formatLabel(selectedLog.action)}</span>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Status: <span className="font-semibold text-slate-950">{formatLabel(selectedLog.status)}</span>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  User: <span className="font-semibold text-slate-950">{selectedLog.created_by?.full_name || "-"}</span>
                </div>
              </div>
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <span className="font-semibold text-slate-950">Message:</span> {selectedLog.message || "No message"}
              </div>
              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                <div className="rounded-3xl border border-slate-200 bg-slate-950 p-4 text-xs text-slate-100">
                  <p className="mb-3 text-sm font-semibold text-white">Request snapshot</p>
                  <pre className="overflow-x-auto whitespace-pre-wrap">{renderSnapshot(selectedLog.request_snapshot)}</pre>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-slate-950 p-4 text-xs text-slate-100">
                  <p className="mb-3 text-sm font-semibold text-white">Response snapshot</p>
                  <pre className="overflow-x-auto whitespace-pre-wrap">{renderSnapshot(selectedLog.response_snapshot)}</pre>
                </div>
              </div>
            </FormCard>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-[28px] border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600 shadow-[var(--shadow-soft)]">
        No background worker is running yet. Provider adapters in this phase are foundational only, and the Steadfast endpoint mapping should be confirmed before production use.
      </div>
    </div>
  );
}
