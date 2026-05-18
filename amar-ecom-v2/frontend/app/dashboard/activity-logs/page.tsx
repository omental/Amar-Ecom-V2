"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarRange, History, Search } from "lucide-react";

import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading-state";
import { OpsPageHeader } from "@/components/ui/ops-page-header";
import { OpsStatusBadge } from "@/components/ui/ops-status-badge";
import { OpsSummaryCard } from "@/components/ui/ops-summary-card";
import { api, ApiError } from "@/lib/api";
import { formatDateTime, formatLabel } from "@/lib/format";

type ActivityLog = {
  id: string;
  user_id: string | null;
  action: string;
  actionLabel?: string | null;
  module?: string | null;
  moduleLabel?: string | null;
  entity_type?: string | null;
  entityType?: string | null;
  entity_id?: string | null;
  entityId?: string | null;
  message: string;
  created_at: string;
  createdAt?: string | null;
  userName?: string | null;
  userEmail?: string | null;
};

type UserItem = {
  id: string;
  full_name: string;
  displayName?: string | null;
};

type Filters = {
  search: string;
  module: string;
  action: string;
  userId: string;
  dateFrom: string;
  dateTo: string;
};

const modules = [
  "settings",
  "team",
  "orders",
  "inventory",
  "customers",
  "shipments",
  "returns",
  "finance",
  "hr",
];

const actions = [
  "user_created",
  "user_updated",
  "user_activated",
  "user_deactivated",
  "permissions_updated",
  "legacy_permissions_updated",
  "order_created",
  "inventory_adjusted",
  "shipment_created",
];

export default function ActivityLogsPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [filters, setFilters] = useState<Filters>({
    search: "",
    module: "",
    action: "",
    userId: "",
    dateFrom: "",
    dateTo: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadUsers() {
      try {
        const usersData = await api.get<UserItem[]>("/users?skip=0&limit=100");
        if (isMounted) {
          setUsers(usersData);
        }
      } catch {
        // Keep activity logs usable even if the user directory fetch fails.
      }
    }

    void loadUsers();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadLogs() {
      setError("");
      try {
        const logData = await api.get<ActivityLog[]>(buildQuery(filters));
        if (isMounted) {
          setLogs(logData);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof ApiError ? err.message : "Failed to load activity logs");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadLogs();
    return () => {
      isMounted = false;
    };
  }, [filters]);

  const summaryCards = useMemo(() => {
    const uniqueUsers = new Set(logs.map((log) => log.user_id).filter(Boolean)).size;
    const moduleCount = new Set(logs.map((log) => log.module || "general")).size;
    const newest = logs[0];

    return [
      {
        label: "Log Entries",
        value: logs.length,
        helper: "Current filtered result",
        tone: "default" as const,
      },
      {
        label: "Users Involved",
        value: uniqueUsers,
        helper: "Unique operators in view",
        tone: "info" as const,
      },
      {
        label: "Modules Touched",
        value: moduleCount,
        helper: "Settings, team, orders, inventory, and more",
        tone: "warning" as const,
      },
      {
        label: "Latest Event",
        value: newest ? formatDateTime(newest.createdAt || newest.created_at) : "No logs",
        helper: "Most recent record in the table",
        tone: "success" as const,
      },
    ];
  }, [logs]);

  return (
    <div className="space-y-5">
      <section className="card-base p-6 sm:p-8">
        <OpsPageHeader
          eyebrow="Admin Visibility"
          title="Activity Logs"
          description="Review the same dense audit stream the v1 settings and team workspace depended on, with quick filters for module, action, user, dates, and free-text search."
          meta={`${logs.length} entries`}
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
            icon={History}
          />
        ))}
      </section>

      <section className="card-base p-6">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_180px_180px_200px]">
          <label className="flex items-center gap-3 rounded-[20px] border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3">
            <Search className="h-4 w-4 text-[var(--color-txt-mut)]" />
            <input
              value={filters.search}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
              placeholder="Search user, message, action, or module"
              className="w-full bg-transparent text-sm text-[var(--color-txt-pri)] outline-none placeholder:text-[var(--color-txt-mut)]"
            />
          </label>

          <select
            value={filters.module}
            onChange={(event) => setFilters((current) => ({ ...current, module: event.target.value }))}
            className={selectClassName}
          >
            <option value="">All modules</option>
            {modules.map((module) => (
              <option key={module} value={module}>
                {formatLabel(module)}
              </option>
            ))}
          </select>

          <select
            value={filters.action}
            onChange={(event) => setFilters((current) => ({ ...current, action: event.target.value }))}
            className={selectClassName}
          >
            <option value="">All actions</option>
            {actions.map((action) => (
              <option key={action} value={action}>
                {formatLabel(action)}
              </option>
            ))}
          </select>

          <select
            value={filters.userId}
            onChange={(event) => setFilters((current) => ({ ...current, userId: event.target.value }))}
            className={selectClassName}
          >
            <option value="">All users</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.displayName || user.full_name}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="rounded-[20px] border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3">
            <span className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-txt-mut)]">
              <CalendarRange className="h-4 w-4" />
              Date From
            </span>
            <input
              type="datetime-local"
              value={filters.dateFrom}
              onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))}
              className="w-full bg-transparent text-sm text-[var(--color-txt-pri)] outline-none"
            />
          </label>

          <label className="rounded-[20px] border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3">
            <span className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-txt-mut)]">
              <CalendarRange className="h-4 w-4" />
              Date To
            </span>
            <input
              type="datetime-local"
              value={filters.dateTo}
              onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))}
              className="w-full bg-transparent text-sm text-[var(--color-txt-pri)] outline-none"
            />
          </label>
        </div>
      </section>

      {error ? <ErrorAlert message={error} /> : null}

      <section className="card-base overflow-hidden">
        <div className="border-b border-[var(--color-brd)] px-6 py-5">
          <h2 className="text-lg font-bold text-[var(--color-txt-pri)]">Audit Trail</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--color-txt-sec)]">
            Keep recent admin, settings, team, order, inventory, and shipment actions in one searchable table just like the v1 control-center model.
          </p>
        </div>

        {isLoading ? (
          <div className="px-6 py-10">
            <LoadingState label="Loading activity logs..." />
          </div>
        ) : logs.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-[var(--color-txt-mut)]">
            No activity logs matched the current filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left">
              <thead>
                <tr className="border-b border-[var(--color-brd)] text-[11px] uppercase tracking-[0.18em] text-[var(--color-txt-mut)]">
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Module</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Entity</th>
                  <th className="px-4 py-3">Message</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-[var(--color-brd)]/70 align-top">
                    <td className="px-4 py-4 text-sm text-[var(--color-txt-sec)]">
                      {formatDateTime(log.createdAt || log.created_at)}
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-sm font-bold text-[var(--color-txt-pri)]">
                        {log.userName || "System"}
                      </p>
                      {log.userEmail ? (
                        <p className="mt-1 text-xs text-[var(--color-txt-mut)]">{log.userEmail}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-4">
                      <OpsStatusBadge
                        label={log.moduleLabel || formatLabel(log.module || "general")}
                        tone="default"
                      />
                    </td>
                    <td className="px-4 py-4">
                      <OpsStatusBadge
                        label={log.actionLabel || formatLabel(log.action)}
                        tone="info"
                      />
                    </td>
                    <td className="px-4 py-4 text-sm text-[var(--color-txt-sec)]">
                      <p>{formatLabel(log.entityType || log.entity_type || "general")}</p>
                      <p className="mt-1 font-mono text-xs text-[var(--color-txt-mut)]">
                        {log.entityId || log.entity_id || "N/A"}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-sm leading-6 text-[var(--color-txt-sec)]">
                      {log.message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function buildQuery(filters: Filters) {
  const params = new URLSearchParams({
    skip: "0",
    limit: "100",
  });

  if (filters.search.trim()) params.set("search", filters.search.trim());
  if (filters.module) params.set("module", filters.module);
  if (filters.action) params.set("action", filters.action);
  if (filters.userId) params.set("user_id", filters.userId);
  if (filters.dateFrom) params.set("date_from", new Date(filters.dateFrom).toISOString());
  if (filters.dateTo) params.set("date_to", new Date(filters.dateTo).toISOString());

  return `/activity-logs?${params.toString()}`;
}

const selectClassName =
  "w-full rounded-[20px] border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm text-[var(--color-txt-pri)] outline-none transition focus:border-[var(--color-accent)] focus:bg-white";
