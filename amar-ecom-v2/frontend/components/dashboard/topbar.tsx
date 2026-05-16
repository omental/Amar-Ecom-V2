"use client";

import Link from "next/link";
import { Bell, MoonStar, Plus, Search, Zap } from "lucide-react";

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
    <header className="glass-morphism sticky top-4 z-20 w-full max-w-full overflow-hidden rounded-[28px] border border-[var(--color-brd)] px-4 py-4 shadow-[var(--shadow-premium)] sm:px-5 lg:px-6">
      <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <p className="ops-micro-label">Operations Console</p>
          <h2 className="mt-2 truncate text-2xl font-semibold tracking-tight text-[var(--color-txt-pri)]">
            {title}
          </h2>
        </div>

        <div className="flex min-w-0 w-full flex-1 flex-col gap-3 xl:ml-8 xl:max-w-[900px] xl:flex-row xl:items-center xl:justify-end">
          <div className="flex min-w-0 w-full flex-1 items-center gap-3 rounded-[20px] border border-[var(--color-brd)] bg-white px-4 py-3 text-sm text-[var(--color-txt-mut)] shadow-[var(--shadow-subtle)]">
            <Search className="h-4 w-4 shrink-0" />
            <span className="truncate">Search modules, orders, shipments, or customers</span>
          </div>

          <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
            <Link
              href="/dashboard/orders"
              className="inline-flex max-w-full items-center gap-2 rounded-full border border-[var(--color-brd)] bg-white px-4 py-3 text-sm font-semibold text-[var(--color-txt-sec)] shadow-[var(--shadow-subtle)] transition hover:bg-[var(--color-surf-hover)]"
            >
              <Plus className="h-4 w-4" />
              <span className="truncate">Quick order</span>
            </Link>

            <button className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--color-brd)] bg-white text-[var(--color-txt-sec)] shadow-[var(--shadow-subtle)] transition hover:bg-[var(--color-surf-hover)]">
              <Bell className="h-4 w-4" />
            </button>

            <button className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--color-brd)] bg-white text-[var(--color-txt-sec)] shadow-[var(--shadow-subtle)] transition hover:bg-[var(--color-surf-hover)]">
              <MoonStar className="h-4 w-4" />
            </button>

            <div className="flex min-w-0 max-w-full items-center gap-3 rounded-[20px] border border-[var(--color-brd)] bg-white px-3 py-2 shadow-[var(--shadow-subtle)]">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-txt-pri)] text-sm font-semibold text-white">
                {initials}
              </div>
              <div className="hidden min-w-0 sm:block">
                <p className="truncate text-sm font-semibold text-[var(--color-txt-pri)]">
                  {user?.full_name || "Authenticated User"}
                </p>
                <div className="mt-1 flex items-center gap-2 text-xs text-[var(--color-txt-mut)]">
                  <Zap className="h-3.5 w-3.5" />
                  <span>{user?.role || "admin"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
