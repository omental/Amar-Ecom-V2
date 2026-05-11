"use client";

import { useEffect, useState } from "react";
import { History, Search } from "lucide-react";

import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading-state";
import { PageHeader } from "@/components/ui/page-header";
import { api, ApiError } from "@/lib/api";
import { formatDateTime, formatLabel } from "@/lib/format";

type ActivityLog = {
  id: string;
  user_id: string | null;
  action: string;
  module: string | null;
  entity_type: string | null;
  entity_id: string | null;
  message: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  user?: {
    id: string;
    full_name: string;
    email: string;
  } | null;
};

type UserItem = {
  id: string;
  full_name: string;
};

function buildActivityLogQuery(moduleFilter: string, userFilter: string) {
  const params = new URLSearchParams({
    skip: "0",
    limit: "100",
  });

  if (moduleFilter) {
    params.set("module", moduleFilter);
  }

  if (userFilter) {
    params.set("user_id", userFilter);
  }

  return `/activity-logs?${params.toString()}`;
}

export default function ActivityLogsPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [moduleFilter, setModuleFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const [logsData, usersData] = await Promise.all([
          api.get<ActivityLog[]>(buildActivityLogQuery(moduleFilter, userFilter)),
          api.get<UserItem[]>("/users?skip=0&limit=100"),
        ]);
        if (!isMounted) {
          return;
        }
        setLogs(logsData);
        setUsers(usersData);
      } catch (err) {
        if (!isMounted) {
          return;
        }
        setError(err instanceof ApiError ? err.message : "Failed to load activity logs");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadData();
    return () => {
      isMounted = false;
    };
  }, [moduleFilter, userFilter]);

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)] sm:p-8">
        <PageHeader
          eyebrow="Admin Visibility"
          title="Activity Logs"
          description="Review a lightweight operational trail for team changes, order actions, customer activity, and shipment status updates."
          meta={`${logs.length} entries`}
        />
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
        <div className="grid gap-4 md:grid-cols-[220px_260px_1fr]">
          <select
            value={moduleFilter}
            onChange={(event) => setModuleFilter(event.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
          >
            <option value="">All modules</option>
            {["team", "orders", "customers", "shipments"].map((module) => (
              <option key={module} value={module}>
                {formatLabel(module)}
              </option>
            ))}
          </select>

          <select
            value={userFilter}
            onChange={(event) => setUserFilter(event.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
          >
            <option value="">All users</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.full_name}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
            <Search className="h-4 w-4" />
            Filter logs by module or user to narrow the operational trail.
          </div>
        </div>

        <div className="mt-6">
          {error ? <ErrorAlert message={error} /> : null}
          {isLoading ? (
            <LoadingState label="Loading activity logs..." />
          ) : logs.length === 0 ? (
            <EmptyState
              title="No activity logs found"
              description="Try a broader filter, or perform a team, order, customer, or shipment action to generate logs."
            />
          ) : (
            <DataTable
              columns={["Date", "User", "Module", "Action", "Entity", "Entity ID", "Message"]}
            >
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="grid grid-cols-1 gap-3 px-5 py-4 text-sm text-slate-600 xl:grid-cols-7 xl:gap-4"
                >
                  <span>{formatDateTime(log.created_at)}</span>
                  <span>{log.user?.full_name || "System"}</span>
                  <span>{log.module ? formatLabel(log.module) : "General"}</span>
                  <span className="font-medium text-slate-950">{formatLabel(log.action)}</span>
                  <span>{log.entity_type ? formatLabel(log.entity_type) : "General"}</span>
                  <span className="truncate font-mono text-xs text-slate-500">
                    {log.entity_id || "N/A"}
                  </span>
                  <div className="flex items-start gap-2">
                    <History className="mt-0.5 h-4 w-4 text-slate-400" />
                    <span>{log.message}</span>
                  </div>
                </div>
              ))}
            </DataTable>
          )}
        </div>
      </section>
    </div>
  );
}
