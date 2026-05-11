"use client";

import { Bell, Search } from "lucide-react";

import type { AuthUser } from "@/lib/auth";

type TopbarProps = {
  user: AuthUser | null;
  title: string;
};

export function DashboardTopbar({ user, title }: TopbarProps) {
  const initials =
    user?.full_name
      ?.split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "AE";

  return (
    <header className="flex flex-col gap-4 rounded-[28px] border border-[var(--color-border)] bg-white px-5 py-5 shadow-[var(--shadow-soft)] sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-muted)]">
          Operations Console
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
          {title}
        </h2>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-500 md:flex">
          <Search className="h-4 w-4" />
          <span>Search coming next</span>
        </div>

        <button className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800">
          <Bell className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-sm font-semibold text-white">
            {initials}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold text-slate-950">
              {user?.full_name || "Authenticated User"}
            </p>
            <p className="text-xs text-slate-500">
              {user?.role || "admin"}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}
