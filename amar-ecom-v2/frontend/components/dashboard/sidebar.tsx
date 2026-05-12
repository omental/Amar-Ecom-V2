"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import {
  ArrowRightLeft,
  Boxes,
  Building2,
  ClipboardList,
  History,
  IdCard,
  LayoutDashboard,
  LogOut,
  Package,
  PackageCheck,
  PieChart,
  RotateCcw,
  Settings,
  ShoppingCart,
  Store,
  Tags,
  TicketCheck,
  Truck,
  Users,
  Wallet,
  Warehouse,
} from "lucide-react";

import { canAccessModule, getUser } from "@/lib/auth";

type SidebarProps = {
  onLogout: () => void;
};

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, moduleKey: "dashboard" },
  { href: "/dashboard/orders", label: "Orders", icon: ShoppingCart, moduleKey: "orders" },
  { href: "/dashboard/pos", label: "POS", icon: Store, moduleKey: "pos" },
  { href: "/dashboard/logistics", label: "Logistics", icon: Truck, moduleKey: "logistics" },
  { href: "/dashboard/shipments", label: "Shipments", icon: PackageCheck, moduleKey: "shipments" },
  { href: "/dashboard/returns", label: "Returns", icon: RotateCcw, moduleKey: "returns" },
  { href: "/dashboard/couriers", label: "Couriers", icon: Truck, moduleKey: "couriers" },
  { href: "/dashboard/suppliers", label: "Suppliers", icon: Building2, moduleKey: "suppliers" },
  { href: "/dashboard/purchase-orders", label: "Purchase Orders", icon: ClipboardList, moduleKey: "purchase_orders" },
  { href: "/dashboard/products", label: "Products", icon: Package, moduleKey: "products" },
  { href: "/dashboard/customers", label: "Customers", icon: Users, moduleKey: "customers" },
  { href: "/dashboard/finance", label: "Finance", icon: Wallet, moduleKey: "finance" },
  { href: "/dashboard/hr", label: "HR", icon: IdCard, moduleKey: "hr" },
  { href: "/dashboard/tasks", label: "Tasks", icon: TicketCheck, moduleKey: "tasks" },
  { href: "/dashboard/reports", label: "Reports", icon: PieChart, moduleKey: "reports" },
  { href: "/dashboard/inventory", label: "Inventory", icon: Boxes, moduleKey: "inventory" },
  { href: "/dashboard/stock-movements", label: "Stock Movements", icon: ArrowRightLeft, moduleKey: "stock_movements" },
  { href: "/dashboard/warehouses", label: "Warehouses", icon: Warehouse, moduleKey: "warehouses" },
  { href: "/dashboard/categories", label: "Categories", icon: ClipboardList, moduleKey: "categories" },
  { href: "/dashboard/brands", label: "Brands", icon: Tags, moduleKey: "brands" },
  { href: "/dashboard/users", label: "Team", icon: Building2, moduleKey: "users" },
  { href: "/dashboard/activity-logs", label: "Activity Logs", icon: History, moduleKey: "activity_logs" },
  { href: "/dashboard/settings", label: "Settings", icon: Settings, moduleKey: "settings" },
];

export function DashboardSidebar({ onLogout }: SidebarProps) {
  const pathname = usePathname();
  const user = getUser();
  const visibleLinks = useMemo(
    () => links.filter((link) => canAccessModule(link.moduleKey, user)),
    [user],
  );

  return (
    <aside className="flex w-full flex-col justify-between rounded-[28px] border border-[var(--color-border)] bg-white p-4 shadow-[var(--shadow-soft)] lg:w-[272px]">
      <div>
        <div className="mb-8 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-950 px-4 py-4 text-white">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-300">
              Admin Suite
            </p>
            <h1 className="text-lg font-semibold">Amar eCom v2</h1>
          </div>
        </div>

        <nav className="space-y-1.5">
          {visibleLinks.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href;

            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                  isActive
                    ? "bg-slate-950 text-white shadow-lg"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <button
        onClick={onLogout}
        className="mt-6 flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
      >
        <LogOut className="h-4 w-4" />
        <span>Logout</span>
      </button>
    </aside>
  );
}
