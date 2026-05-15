"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";

import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { DashboardTopbar } from "@/components/dashboard/topbar";
import { getUser, isAuthenticated, logout, type AuthUser } from "@/lib/auth";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dashboard/orders": "Orders",
  "/dashboard/products": "Products",
  "/dashboard/customers": "Customers",
  "/dashboard/courier-integrations": "Courier Integrations",
  "/dashboard/inventory": "Inventory",
  "/dashboard/warehouses": "Warehouses",
  "/dashboard/categories": "Categories",
  "/dashboard/brands": "Brands",
  "/dashboard/users": "Users",
  "/dashboard/activity-logs": "Activity Logs",
  "/dashboard/settings": "Settings",
};

export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const router = useRouter();
  const pathname = usePathname();
  const hasToken = typeof window !== "undefined" ? isAuthenticated() : false;
  const user: AuthUser | null =
    typeof window !== "undefined" ? getUser() : null;

  useEffect(() => {
    if (!hasToken) {
      router.replace("/login");
    }
  }, [hasToken, router]);

  const title = useMemo(() => {
    return pageTitles[pathname] || "Dashboard";
  }, [pathname]);

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  if (typeof window === "undefined" || !hasToken) {
    return (
      <div className="app-shell flex min-h-screen items-center justify-center">
        <div className="rounded-3xl border border-slate-200 bg-white px-6 py-5 text-sm font-medium text-slate-500 shadow-[var(--shadow-soft)]">
          Preparing your workspace...
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell min-h-screen p-4 sm:p-6">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 lg:flex-row">
        <DashboardSidebar onLogout={handleLogout} />

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <DashboardTopbar user={user} title={title} />
          <main className="min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
