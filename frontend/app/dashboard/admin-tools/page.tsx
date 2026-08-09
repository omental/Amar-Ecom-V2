"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Copy,
  DatabaseBackup,
  Download,
  Loader2,
  RefreshCcw,
  ShieldCheck,
  Wrench,
} from "lucide-react";

import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading-state";
import { OpsPageHeader } from "@/components/ui/ops-page-header";
import { OpsStatusBadge } from "@/components/ui/ops-status-badge";
import { OpsSummaryCard } from "@/components/ui/ops-summary-card";
import { api, ApiError } from "@/lib/api";

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

type TabId = "overview" | "exports" | "backup" | "maintenance";

const tabs: Array<{ id: TabId; label: string; icon: typeof Activity }> = [
  { id: "overview", label: "System Health", icon: Activity },
  { id: "exports", label: "Data Export", icon: Download },
  { id: "backup", label: "Backup Guidance", icon: DatabaseBackup },
  { id: "maintenance", label: "Maintenance Checklist", icon: Wrench },
];

const exportActions = [
  { key: "products", label: "Products CSV", path: "/admin/exports/products" },
  { key: "customers", label: "Customers CSV", path: "/admin/exports/customers" },
  { key: "orders", label: "Orders CSV", path: "/admin/exports/orders" },
  { key: "inventory", label: "Inventory CSV", path: "/admin/exports/inventory" },
  { key: "stock-movements", label: "Stock Movements CSV", path: "/admin/exports/stock-movements" },
  { key: "transactions", label: "Transactions CSV", path: "/admin/exports/transactions" },
  { key: "suppliers", label: "Suppliers CSV", path: "/admin/exports/suppliers" },
  { key: "purchase-orders", label: "Purchase Orders CSV", path: "/admin/exports/purchase-orders" },
];

export default function AdminToolsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [backupGuidance, setBackupGuidance] = useState<BackupGuidance | null>(null);
  const [maintenanceChecklist, setMaintenanceChecklist] = useState<MaintenanceChecklist | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [busyExportKey, setBusyExportKey] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const [healthData, backupData, checklistData] = await Promise.all([
          api.get<SystemHealth>("/admin/system-health"),
          api.get<BackupGuidance>("/admin/backup-guidance"),
          api.get<MaintenanceChecklist>("/admin/maintenance-checklist"),
        ]);

        if (!isMounted) return;
        setHealth(healthData);
        setBackupGuidance(backupData);
        setMaintenanceChecklist(checklistData);
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof ApiError ? err.message : "Failed to load admin tools");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  const summaryCards = useMemo(() => {
    if (!health || !maintenanceChecklist) return [];
    const failingItems = maintenanceChecklist.items.filter((item) => item.status === "fail").length;
    return [
      {
        label: "API",
        value: health.service_status.api,
        helper: `Database: ${health.service_status.database}`,
        icon: Activity,
        tone: "success" as const,
      },
      {
        label: "Environment",
        value: health.environment,
        helper: health.migrations.up_to_date ? "Migrations up to date" : "Migration review needed",
        icon: ShieldCheck,
        tone: health.migrations.up_to_date ? ("info" as const) : ("warning" as const),
      },
      {
        label: "Checklist Flags",
        value: failingItems,
        helper: `${maintenanceChecklist.items.length} release checks`,
        icon: AlertTriangle,
        tone: failingItems === 0 ? ("success" as const) : ("warning" as const),
      },
      {
        label: "Last Health Check",
        value: formatDateTime(health.timestamp),
        helper: "Manual admin refresh only",
        icon: RefreshCcw,
        tone: "default" as const,
      },
    ];
  }, [health, maintenanceChecklist]);

  async function refreshHealth() {
    setError("");
    setIsRefreshing(true);
    try {
      const nextHealth = await api.get<SystemHealth>("/admin/system-health");
      setHealth(nextHealth);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to refresh system health");
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleExport(path: string, key: string) {
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
    window.setTimeout(() => setCopyMessage(""), 1500);
  }

  if (isLoading) {
    return <LoadingState label="Loading admin tools..." />;
  }

  return (
    <div className="space-y-5">
      <section className="card-base p-6 sm:p-8">
        <OpsPageHeader
          eyebrow="Admin"
          title="Admin Tools"
          description="Keep health checks, exports, backup guidance, and maintenance review inside the same broad control-center model the v1 settings workflow relied on."
          meta="Safe admin only"
          actions={
            <button
              type="button"
              onClick={() => void refreshHealth()}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--color-brd)] px-4 py-2 text-sm font-semibold text-[var(--color-txt-sec)] transition hover:bg-[var(--color-surf-hover)] disabled:opacity-60"
            >
              {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
              Refresh
            </button>
          }
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <OpsSummaryCard
            key={card.label}
            label={card.label}
            value={card.value}
            helper={card.helper}
            tone={card.tone}
            icon={card.icon}
          />
        ))}
      </section>

      {error ? <ErrorAlert message={error} /> : null}
      {copyMessage ? (
        <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-700">
          {copyMessage}
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <div className="card-base p-4">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`mb-2 flex w-full items-center gap-3 rounded-full px-4 py-3 text-left text-[13px] font-bold transition ${
                    isActive
                      ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                      : "text-[var(--color-txt-sec)] hover:bg-[var(--color-surf-hover)]"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-5 py-5 text-sm leading-6 text-rose-900">
            Restore, purge, and destructive backup operations stay intentionally disabled. This screen only exposes the current safe guidance and export surfaces.
          </div>

          <Link
            href="/dashboard/settings"
            className="block rounded-[24px] border border-[var(--color-brd)] bg-[var(--color-surf)] px-5 py-5 shadow-[var(--shadow-sub)] transition hover:bg-[var(--color-surf-hover)]"
          >
            <p className="text-sm font-bold text-[var(--color-txt-pri)]">Return to Settings Center</p>
            <p className="mt-2 text-sm leading-6 text-[var(--color-txt-sec)]">
              Jump back to the broader company, invoice, and account control panels.
            </p>
          </Link>
        </aside>

        <div className="space-y-5">
          {activeTab === "overview" && health ? (
            <section className="card-base p-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <DataStat label="Users" value={health.counts.users} />
                <DataStat label="Products" value={health.counts.products} />
                <DataStat label="Orders" value={health.counts.orders} />
                <DataStat label="Inventory" value={health.counts.inventory_items} />
                <DataStat label="Customers" value={health.counts.customers} />
                <DataStat label="Accounts" value={health.counts.finance_accounts} />
                <DataStat label="Tasks" value={health.counts.tasks} />
                <DataStat label="Employees" value={health.counts.employees} />
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <article className="rounded-[24px] border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-5 py-5">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-[var(--color-txt-pri)]">Service Status</h2>
                    <OpsStatusBadge label={health.database_connectivity ? "Online" : "Review"} tone={health.database_connectivity ? "success" : "warning"} />
                  </div>
                  <div className="mt-4 space-y-3 text-sm text-[var(--color-txt-sec)]">
                    <p>API: <span className="font-semibold text-[var(--color-txt-pri)]">{health.service_status.api}</span></p>
                    <p>Database: <span className="font-semibold text-[var(--color-txt-pri)]">{health.service_status.database}</span></p>
                    <p>Environment: <span className="font-semibold text-[var(--color-txt-pri)]">{health.environment}</span></p>
                    <p>Checked: <span className="font-semibold text-[var(--color-txt-pri)]">{formatDateTime(health.timestamp)}</span></p>
                  </div>
                </article>

                <article className="rounded-[24px] border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-5 py-5">
                  <h2 className="text-base font-bold text-[var(--color-txt-pri)]">Migration Status</h2>
                  <div className="mt-4 space-y-3 text-sm text-[var(--color-txt-sec)]">
                    <p>
                      Current revision:{" "}
                      <span className="font-semibold text-[var(--color-txt-pri)]">
                        {health.migrations.current_revision || "Unknown"}
                      </span>
                    </p>
                    <p>
                      Head revision:{" "}
                      <span className="font-semibold text-[var(--color-txt-pri)]">
                        {health.migrations.head_revision || "Unknown"}
                      </span>
                    </p>
                    <p>
                      Status:{" "}
                      <span className="font-semibold text-[var(--color-txt-pri)]">
                        {health.migrations.up_to_date ? "Up to date" : "Needs review"}
                      </span>
                    </p>
                  </div>
                </article>
              </div>
            </section>
          ) : null}

          {activeTab === "exports" ? (
            <section className="card-base p-6">
              <h2 className="text-lg font-bold text-[var(--color-txt-pri)]">Safe Data Export</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--color-txt-sec)]">
                Export the same core operations data from existing backend-approved CSV endpoints. No new all-in-one destructive export flow is introduced here.
              </p>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {exportActions.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => void handleExport(item.path, item.key)}
                    disabled={busyExportKey === item.key}
                    className="flex items-center justify-between rounded-[22px] border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-4 text-left text-sm font-semibold text-[var(--color-txt-pri)] transition hover:bg-white disabled:opacity-60"
                  >
                    <span>{item.label}</span>
                    {busyExportKey === item.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {activeTab === "backup" && backupGuidance ? (
            <section className="space-y-5">
              <section className="card-base p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-[var(--color-txt-pri)]">Backup Guidance</h2>
                    <p className="mt-2 text-sm leading-6 text-[var(--color-txt-sec)]">
                      Review the recommended database command and folder checklist before a release or maintenance window.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void copyText(backupGuidance.pg_dump_command_template)}
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--color-brd)] px-4 py-2 text-sm font-semibold text-[var(--color-txt-sec)] transition hover:bg-[var(--color-surf-hover)]"
                  >
                    <Copy className="h-4 w-4" />
                    Copy Command
                  </button>
                </div>

                <code className="mt-5 block whitespace-pre-wrap break-all rounded-[20px] border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-4 text-sm text-[var(--color-txt-pri)]">
                  {backupGuidance.pg_dump_command_template}
                </code>

                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <ListPanel
                    title="Folders to Back Up"
                    items={backupGuidance.folders_to_back_up}
                  />
                  <ListPanel
                    title="Restore Checklist"
                    items={backupGuidance.restore_checklist}
                  />
                </div>
              </section>

              <div className="grid gap-4 lg:grid-cols-2">
                <WarningPanel title="Environment Warning" body={backupGuidance.environment_warning} tone="amber" />
                <WarningPanel title="Commit Warning" body={backupGuidance.env_commit_warning} tone="rose" />
              </div>
            </section>
          ) : null}

          {activeTab === "maintenance" ? (
            <section className="card-base p-6">
              <h2 className="text-lg font-bold text-[var(--color-txt-pri)]">Maintenance Checklist</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--color-txt-sec)]">
                Use the release-readiness checklist as a pass/fail control pass before shipping operational changes.
              </p>
              <div className="mt-5 space-y-3">
                {maintenanceChecklist?.items.map((item) => (
                  <article
                    key={item.key}
                    className="rounded-[22px] border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-5 py-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="text-base font-bold text-[var(--color-txt-pri)]">{item.label}</h3>
                          <OpsStatusBadge
                            label={item.status}
                            tone={item.status === "pass" ? "success" : item.status === "warn" ? "warning" : "danger"}
                          />
                        </div>
                        <p className="text-sm text-[var(--color-txt-sec)]">
                          Current value: <span className="font-semibold text-[var(--color-txt-pri)]">{item.value}</span>
                        </p>
                        <p className="text-sm leading-6 text-[var(--color-txt-sec)]">{item.recommended_action}</p>
                      </div>
                      {item.route ? (
                        <Link
                          href={item.route}
                          className="inline-flex rounded-full border border-[var(--color-brd)] px-4 py-2 text-sm font-semibold text-[var(--color-txt-sec)] transition hover:bg-white"
                        >
                          Open Module
                        </Link>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DataStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[22px] border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-4">
      <p className="text-sm text-[var(--color-txt-sec)]">{label}</p>
      <p className="mt-2 text-2xl font-bold text-[var(--color-txt-pri)]">{value}</p>
    </div>
  );
}

function ListPanel({ title, items }: { title: string; items: string[] }) {
  return (
    <article className="rounded-[24px] border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-5 py-5">
      <h3 className="text-base font-bold text-[var(--color-txt-pri)]">{title}</h3>
      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <li key={item} className="rounded-[18px] bg-white px-4 py-3 text-sm leading-6 text-[var(--color-txt-sec)]">
            {item}
          </li>
        ))}
      </ul>
    </article>
  );
}

function WarningPanel({
  title,
  body,
  tone,
}: {
  title: string;
  body: string;
  tone: "amber" | "rose";
}) {
  const className =
    tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-rose-200 bg-rose-50 text-rose-900";

  return (
    <div className={`rounded-[24px] border px-5 py-5 text-sm leading-6 ${className}`}>
      <p className="font-bold">{title}</p>
      <p className="mt-2">{body}</p>
    </div>
  );
}

async function downloadProtectedCsv(path: string, filename: string) {
  const blob = await api.download(path);
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
