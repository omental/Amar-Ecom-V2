"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Activity, Copy, DatabaseBackup, Download, Loader2, RefreshCcw, ShieldCheck, Wrench } from "lucide-react";

import { ErrorAlert } from "@/components/ui/error-alert";
import { FormCard } from "@/components/ui/form-card";
import { LoadingState } from "@/components/ui/loading-state";
import { PageHeader } from "@/components/ui/page-header";
import { api, ApiError } from "@/lib/api";
import { getToken } from "@/lib/auth";

type SystemHealth = {
  service_status: {
    api: string;
    database: string;
  };
  environment: string;
  database_connectivity: boolean;
  migrations: {
    current_revision: string | null;
    head_revision: string | null;
    up_to_date: boolean | null;
  };
  counts: {
    users: number;
    products: number;
    orders: number;
    inventory_items: number;
    customers: number;
    finance_accounts: number;
    tasks: number;
    employees: number;
  };
  timestamp: string;
};

type BackupGuidance = {
  database_name: string | null;
  pg_dump_command_template: string;
  folders_to_back_up: string[];
  restore_checklist: string[];
  environment_warning: string;
  env_commit_warning: string;
};

type MaintenanceChecklist = {
  items: Array<{
    key: string;
    label: string;
    status: string;
    value: string;
    recommended_action: string;
    route: string | null;
  }>;
  timestamp: string;
};

const tabs = [
  { id: "health", label: "System Health", icon: Activity },
  { id: "exports", label: "Data Export", icon: Download },
  { id: "backup", label: "Backup Guidance", icon: DatabaseBackup },
  { id: "maintenance", label: "Maintenance Checklist", icon: Wrench },
] as const;

type TabId = (typeof tabs)[number]["id"];

const exportActions = [
  { key: "products", label: "Products CSV", path: "/admin/exports/products" },
  { key: "customers", label: "Customers CSV", path: "/admin/exports/customers" },
  { key: "orders", label: "Orders CSV", path: "/admin/exports/orders" },
  { key: "inventory", label: "Inventory CSV", path: "/admin/exports/inventory" },
  { key: "stock-movements", label: "Stock Movements CSV", path: "/admin/exports/stock-movements" },
  { key: "transactions", label: "Transactions CSV", path: "/admin/exports/transactions" },
  { key: "suppliers", label: "Suppliers CSV", path: "/admin/exports/suppliers" },
  { key: "purchase-orders", label: "Purchase Orders CSV", path: "/admin/exports/purchase-orders" },
] as const;

async function downloadProtectedCsv(path: string, filename: string) {
  const token = getToken();
  const response = await fetch(`${api.baseUrl()}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(text || `Failed to download ${filename}`, response.status);
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.URL.revokeObjectURL(url);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not available";
  return new Date(value).toLocaleString();
}

function ChecklistBadge({ status }: { status: string }) {
  const className =
    status === "pass"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "fail"
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : "border-amber-200 bg-amber-50 text-amber-700";

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${className}`}>
      {status}
    </span>
  );
}

export default function AdminToolsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("health");
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [backupGuidance, setBackupGuidance] = useState<BackupGuidance | null>(null);
  const [maintenanceChecklist, setMaintenanceChecklist] = useState<MaintenanceChecklist | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshingHealth, setIsRefreshingHealth] = useState(false);
  const [busyExportKey, setBusyExportKey] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState("");
  const [error, setError] = useState("");

  async function loadAdminData() {
    const [healthData, backupData, checklistData] = await Promise.all([
      api.get<SystemHealth>("/admin/system-health"),
      api.get<BackupGuidance>("/admin/backup-guidance"),
      api.get<MaintenanceChecklist>("/admin/maintenance-checklist"),
    ]);

    setHealth(healthData);
    setBackupGuidance(backupData);
    setMaintenanceChecklist(checklistData);
  }

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        await loadAdminData();
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof ApiError ? err.message : "Failed to load admin tools");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void load();
    return () => {
      isMounted = false;
    };
  }, []);

  async function refreshHealth() {
    setError("");
    setIsRefreshingHealth(true);
    try {
      const nextHealth = await api.get<SystemHealth>("/admin/system-health");
      setHealth(nextHealth);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to refresh system health");
    } finally {
      setIsRefreshingHealth(false);
    }
  }

  async function handleExportClick(path: string, key: string) {
    setError("");
    setBusyExportKey(key);
    try {
      await downloadProtectedCsv(path, `${key}.csv`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to export CSV");
    } finally {
      setBusyExportKey(null);
    }
  }

  async function copyText(value: string) {
    await navigator.clipboard.writeText(value);
    setCopyMessage("Copied to clipboard.");
    window.setTimeout(() => setCopyMessage(""), 1600);
  }

  const countCards = useMemo(
    () =>
      health
        ? [
            { label: "Users", value: health.counts.users },
            { label: "Products", value: health.counts.products },
            { label: "Orders", value: health.counts.orders },
            { label: "Inventory Items", value: health.counts.inventory_items },
            { label: "Customers", value: health.counts.customers },
            { label: "Finance Accounts", value: health.counts.finance_accounts },
            { label: "Tasks", value: health.counts.tasks },
            { label: "Employees", value: health.counts.employees },
          ]
        : [],
    [health],
  );

  if (isLoading) {
    return <LoadingState label="Loading admin tools..." />;
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)] sm:p-8">
        <PageHeader
          eyebrow="Production Readiness"
          title="Admin tools"
          description="Use this workspace for release checks, CSV exports, backup guidance, and a quick operational maintenance pass before deployment."
          meta="Admin only"
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <div className="rounded-[28px] border border-slate-200 bg-white p-3 shadow-[var(--shadow-soft)]">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm transition ${
                    isActive ? "bg-slate-950 text-white" : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white px-5 py-5 text-sm text-slate-600 shadow-[var(--shadow-soft)]">
            <p className="font-semibold text-slate-950">Admin scope</p>
            <p className="mt-2 leading-6">
              These tools are intended for admin and super admin release-readiness checks, not day-to-day operator workflows.
            </p>
          </div>
        </aside>

        <div className="space-y-4">
          {error ? <ErrorAlert message={error} /> : null}
          {copyMessage ? (
            <div className="rounded-[28px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-700 shadow-[var(--shadow-soft)]">
              {copyMessage}
            </div>
          ) : null}

          {activeTab === "health" ? (
            <div className="space-y-4">
              <FormCard
                title="System health"
                description="Check API reachability, database connectivity, migration state, and core record counts before release."
                action={
                  <button
                    type="button"
                    onClick={() => void refreshHealth()}
                    disabled={isRefreshingHealth}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isRefreshingHealth ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                    Refresh
                  </button>
                }
              >
                {health ? (
                  <div className="space-y-5">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      {[
                        { label: "API Status", value: health.service_status.api, accent: "emerald" },
                        { label: "Database Status", value: health.service_status.database, accent: "emerald" },
                        { label: "Environment", value: health.environment, accent: "sky" },
                        {
                          label: "Migration Status",
                          value: health.migrations.up_to_date ? "Up to date" : "Review needed",
                          accent: health.migrations.up_to_date ? "emerald" : "amber",
                        },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className={`rounded-3xl border px-4 py-4 ${
                            item.accent === "emerald"
                              ? "border-emerald-200 bg-emerald-50"
                              : item.accent === "amber"
                                ? "border-amber-200 bg-amber-50"
                                : "border-sky-200 bg-sky-50"
                          }`}
                        >
                          <p className="text-sm text-slate-600">{item.label}</p>
                          <p className="mt-2 text-xl font-semibold text-slate-950">{item.value}</p>
                        </div>
                      ))}
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-5">
                      <div className="flex flex-wrap items-center gap-4">
                        <div>
                          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Migration Revisions</p>
                          <p className="mt-2 text-sm text-slate-700">
                            Current: <span className="font-semibold text-slate-950">{health.migrations.current_revision || "Unknown"}</span>
                          </p>
                          <p className="mt-1 text-sm text-slate-700">
                            Head: <span className="font-semibold text-slate-950">{health.migrations.head_revision || "Unknown"}</span>
                          </p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                          Last checked: <span className="font-semibold text-slate-950">{formatDateTime(health.timestamp)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      {countCards.map((card) => (
                        <div key={card.label} className="rounded-3xl border border-slate-200 bg-white px-5 py-5">
                          <p className="text-sm text-slate-500">{card.label}</p>
                          <p className="mt-3 text-2xl font-semibold text-slate-950">{card.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </FormCard>
            </div>
          ) : null}

          {activeTab === "exports" ? (
            <FormCard
              title="Data export"
              description="Download compact CSV exports for the main operational modules without leaving the admin workspace."
              action={
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  <Download className="h-5 w-5" />
                </div>
              }
            >
              <div className="grid gap-3 md:grid-cols-2">
                {exportActions.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => void handleExportClick(item.path, item.key)}
                    disabled={busyExportKey === item.key}
                    className="inline-flex items-center justify-between rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-left text-sm font-semibold text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span>{item.label}</span>
                    {busyExportKey === item.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  </button>
                ))}
              </div>
            </FormCard>
          ) : null}

          {activeTab === "backup" ? (
            <div className="space-y-4">
              <FormCard
                title="Backup guidance"
                description="Review the recommended PostgreSQL dump command, the folders worth preserving, and the restore checklist before a release or maintenance window."
                action={
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                    <DatabaseBackup className="h-5 w-5" />
                  </div>
                }
              >
                {backupGuidance ? (
                  <div className="space-y-5">
                    <div className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">pg_dump Template</p>
                          <code className="mt-3 block whitespace-pre-wrap break-all rounded-2xl bg-white px-4 py-4 text-sm text-slate-800">
                            {backupGuidance.pg_dump_command_template}
                          </code>
                        </div>
                        <button
                          type="button"
                          onClick={() => void copyText(backupGuidance.pg_dump_command_template)}
                          className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white"
                        >
                          <Copy className="h-4 w-4" />
                          Copy
                        </button>
                      </div>
                      <p className="mt-4 text-sm text-slate-600">
                        Database name: <span className="font-semibold text-slate-950">{backupGuidance.database_name || "Not detected"}</span>
                      </p>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="rounded-3xl border border-slate-200 bg-white px-5 py-5">
                        <p className="text-sm font-semibold text-slate-950">Folders to back up</p>
                        <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                          {backupGuidance.folders_to_back_up.map((folder) => (
                            <li key={folder} className="rounded-2xl bg-slate-50 px-4 py-3">
                              {folder}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="rounded-3xl border border-slate-200 bg-white px-5 py-5">
                        <p className="text-sm font-semibold text-slate-950">Restore checklist</p>
                        <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                          {backupGuidance.restore_checklist.map((item) => (
                            <li key={item} className="rounded-2xl bg-slate-50 px-4 py-3">
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-5 text-sm leading-6 text-amber-800">
                        <p className="font-semibold">Environment warning</p>
                        <p className="mt-2">{backupGuidance.environment_warning}</p>
                      </div>
                      <div className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-5 text-sm leading-6 text-rose-800">
                        <p className="font-semibold">Commit warning</p>
                        <p className="mt-2">{backupGuidance.env_commit_warning}</p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </FormCard>
            </div>
          ) : null}

          {activeTab === "maintenance" ? (
            <FormCard
              title="Maintenance checklist"
              description="Use this as a quick pass/fail review for production readiness, operational configuration, and unresolved workload."
              action={
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  <ShieldCheck className="h-5 w-5" />
                </div>
              }
            >
              <div className="space-y-3">
                {maintenanceChecklist?.items.map((item) => (
                  <div key={item.key} className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="text-base font-semibold text-slate-950">{item.label}</h3>
                          <ChecklistBadge status={item.status} />
                        </div>
                        <p className="text-sm text-slate-600">
                          Current value: <span className="font-semibold text-slate-950">{item.value}</span>
                        </p>
                        <p className="text-sm leading-6 text-slate-500">{item.recommended_action}</p>
                      </div>
                      {item.route ? (
                        <Link
                          href={item.route}
                          className="inline-flex items-center rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white"
                        >
                          Open module
                        </Link>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </FormCard>
          ) : null}
        </div>
      </div>
    </div>
  );
}
