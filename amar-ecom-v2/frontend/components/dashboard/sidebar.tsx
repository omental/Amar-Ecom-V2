"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ArrowRightLeft,
  Boxes,
  Building2,
  ChevronLeft,
  ChevronRight,
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
  ShieldCheck,
  Store,
  Tags,
  TicketCheck,
  Truck,
  Users,
  Wallet,
  Warehouse,
  Waypoints,
  Workflow,
} from "lucide-react";

import { canAccessModule, getUser } from "@/lib/auth";

type SidebarProps = {
  onLogout: () => void;
};

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  moduleKey: string;
  requiresAdmin?: boolean;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, moduleKey: "dashboard" }],
  },
  {
    label: "Commerce",
    items: [
      { href: "/dashboard/orders", label: "Orders", icon: ShoppingCart, moduleKey: "orders" },
      { href: "/dashboard/customers", label: "Customers", icon: Users, moduleKey: "customers" },
      { href: "/dashboard/returns", label: "Returns", icon: RotateCcw, moduleKey: "returns" },
      { href: "/dashboard/pos", label: "POS", icon: Store, moduleKey: "pos" },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/dashboard/logistics", label: "Logistics", icon: Truck, moduleKey: "logistics" },
      { href: "/dashboard/shipments", label: "Shipments", icon: PackageCheck, moduleKey: "shipments" },
      { href: "/dashboard/couriers", label: "Couriers", icon: Truck, moduleKey: "couriers" },
      { href: "/dashboard/tasks", label: "Tasks", icon: TicketCheck, moduleKey: "tasks" },
      { href: "/dashboard/reports", label: "Reports", icon: PieChart, moduleKey: "reports" },
    ],
  },
  {
    label: "Inventory",
    items: [
      { href: "/dashboard/inventory", label: "Inventory", icon: Boxes, moduleKey: "inventory" },
      { href: "/dashboard/products", label: "Products", icon: Package, moduleKey: "products" },
      { href: "/dashboard/stock-movements", label: "Stock Movements", icon: ArrowRightLeft, moduleKey: "stock_movements" },
      { href: "/dashboard/warehouses", label: "Warehouses", icon: Warehouse, moduleKey: "warehouses" },
      { href: "/dashboard/categories", label: "Categories", icon: ClipboardList, moduleKey: "categories" },
      { href: "/dashboard/brands", label: "Brands", icon: Tags, moduleKey: "brands" },
      { href: "/dashboard/suppliers", label: "Suppliers", icon: Building2, moduleKey: "suppliers" },
      { href: "/dashboard/purchase-orders", label: "Purchase Orders", icon: ClipboardList, moduleKey: "purchase_orders" },
    ],
  },
  {
    label: "Finance & Admin",
    items: [
      { href: "/dashboard/finance", label: "Finance", icon: Wallet, moduleKey: "finance" },
      { href: "/dashboard/hr", label: "HR", icon: IdCard, moduleKey: "hr" },
      { href: "/dashboard/users", label: "Team", icon: Building2, moduleKey: "users" },
      { href: "/dashboard/activity-logs", label: "Activity Logs", icon: History, moduleKey: "activity_logs" },
      { href: "/dashboard/admin-tools", label: "Admin Tools", icon: ShieldCheck, moduleKey: "admin_tools", requiresAdmin: true },
      { href: "/dashboard/settings", label: "Settings", icon: Settings, moduleKey: "settings" },
    ],
  },
  {
    label: "Integrations",
    items: [
      { href: "/dashboard/woocommerce", label: "WooCommerce", icon: Waypoints, moduleKey: "woocommerce", requiresAdmin: true },
      { href: "/dashboard/courier-integrations", label: "Courier Integrations", icon: Workflow, moduleKey: "couriers", requiresAdmin: true },
    ],
  },
] as const;

export function DashboardSidebar({ onLogout }: SidebarProps) {
  const pathname = usePathname();
  const user = getUser();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const visibleGroups = useMemo(
    () =>
      navGroups
        .map((group) => ({
          ...group,
          items: group.items.filter((link) => {
            if (link.requiresAdmin) {
              return user?.role === "admin" || user?.role === "super_admin";
            }
            return canAccessModule(link.moduleKey, user);
          }),
        }))
        .filter((group) => group.items.length > 0),
    [user],
  );

  return (
    <aside
      className={`card-base flex w-full shrink-0 flex-col justify-between p-4 lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] ${
        isCollapsed ? "lg:w-24" : "lg:w-[240px]"
      }`}
    >
      <div>
        <div className={`mb-6 flex items-center ${isCollapsed ? "justify-center" : "justify-between"} gap-3`}>
          <div
            className={`flex items-center gap-3 rounded-[24px] border border-[var(--color-brd)] bg-[var(--color-txt-pri)] px-4 py-4 text-white ${
              isCollapsed ? "w-full justify-center px-2" : "flex-1"
            }`}
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
              <Package className="h-5 w-5" />
            </div>
            {!isCollapsed ? (
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">
                  Operations
                </p>
                <h1 className="text-lg font-semibold">Amar eCom v2</h1>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setIsCollapsed((current) => !current)}
            className="hidden h-11 w-11 items-center justify-center rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] text-[var(--color-txt-sec)] transition hover:bg-white lg:flex"
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto pr-1">
          {visibleGroups.map((group) => (
            <section key={group.label}>
              {!isCollapsed ? <p className="ops-micro-label px-3 pb-2">{group.label}</p> : null}
              <nav className="space-y-1.5">
                {group.items.map(({ href, label, icon: Icon }) => {
                  const isActive = pathname === href;

                  return (
                    <Link
                      key={href}
                      href={href}
                      title={label}
                      className={`group relative flex items-center gap-3 rounded-[20px] px-3 py-3 text-sm font-semibold transition ${
                        isActive
                          ? "bg-[var(--color-accent)] text-white shadow-[var(--shadow-subtle)]"
                          : "text-[var(--color-txt-sec)] hover:bg-[var(--color-surf-hover)] hover:text-[var(--color-txt-pri)]"
                      } ${isCollapsed ? "justify-center" : ""}`}
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border transition ${
                          isActive
                            ? "border-white/20 bg-white/10 text-white"
                            : "border-[var(--color-brd)] bg-white text-[var(--color-txt-sec)] group-hover:border-[color-mix(in_srgb,var(--color-accent)_18%,var(--color-brd))]"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      {!isCollapsed ? <span className="truncate">{label}</span> : null}
                      {isActive && !isCollapsed ? <span className="ml-auto h-2 w-2 rounded-full bg-white/80" /> : null}
                    </Link>
                  );
                })}
              </nav>
            </section>
          ))}
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {!isCollapsed ? (
          <div className="rounded-[20px] border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-xs leading-6 text-[var(--color-txt-sec)]">
            <p className="ops-micro-label">Logged In</p>
            <p className="mt-2 font-semibold text-[var(--color-txt-pri)]">{user?.full_name || "Authenticated User"}</p>
            <p className="text-[var(--color-txt-mut)]">{user?.role || "admin"}</p>
          </div>
        ) : null}

        <button
          onClick={onLogout}
          className={`flex items-center gap-3 rounded-[20px] border border-[var(--color-brd)] px-4 py-3 text-sm font-semibold text-[var(--color-txt-sec)] transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 ${
            isCollapsed ? "justify-center px-0" : ""
          }`}
          title="Logout"
        >
          <LogOut className="h-4 w-4" />
          {!isCollapsed ? <span>Logout</span> : null}
        </button>
      </div>
    </aside>
  );
}
