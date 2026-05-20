"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Boxes,
  Building2,
  Calculator,
  ChevronDown,
  ClipboardList,
  History,
  LogOut,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
  Settings,
  ShoppingCart,
  Store,
  Tags,
  Truck,
  UserPlus,
  Users,
  Wallet,
  Warehouse,
  Waypoints,
  Workflow,
  X,
  type LucideIcon,
} from "lucide-react";

import { canAccessModule, type AuthUser } from "@/lib/auth";

type SidebarProps = {
  user: AuthUser | null;
  isCollapsed: boolean;
  isMobileOpen: boolean;
  expandedItems: string[];
  onToggleCollapse: () => void;
  onToggleExpand: (name: string) => void;
  onCloseMobile: () => void;
  onLogout: () => void;
};

type NavSubItem = {
  label: string;
  href: string;
  moduleKey: string;
  matchers?: string[];
};

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  moduleKey: string;
  subItems?: NavSubItem[];
  matchers?: string[];
};

type NavGroup = {
  label: string;
  items: NavItem[];
  secondary?: boolean;
};

const primaryNavGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: Boxes, moduleKey: "dashboard" },
      { label: "Reports", href: "/dashboard/reports", icon: BarChart3, moduleKey: "dashboard" },
      { label: "POS", href: "/dashboard/pos", icon: Calculator, moduleKey: "pos" },
    ],
  },
  {
    label: "Operations",
    items: [
      {
        label: "Orders",
        href: "/dashboard/orders",
        icon: ShoppingCart,
        moduleKey: "orders",
        matchers: ["/dashboard/orders", "/dashboard/returns"],
        subItems: [
          { label: "Order List", href: "/dashboard/orders", moduleKey: "orders", matchers: ["/dashboard/orders"] },
          { label: "New Order", href: "/dashboard/orders", moduleKey: "orders", matchers: ["/dashboard/orders"] },
          { label: "Returns", href: "/dashboard/returns", moduleKey: "orders", matchers: ["/dashboard/returns"] },
        ],
      },
      {
        label: "Inventory",
        href: "/dashboard/inventory",
        icon: Package,
        moduleKey: "inventory",
        matchers: [
          "/dashboard/inventory",
          "/dashboard/products",
          "/dashboard/categories",
          "/dashboard/brands",
          "/dashboard/warehouses",
          "/dashboard/stock-movements",
          "/dashboard/suppliers",
          "/dashboard/purchase-orders",
        ],
        subItems: [
          {
            label: "Product List",
            href: "/dashboard/inventory",
            moduleKey: "inventory",
            matchers: ["/dashboard/inventory", "/dashboard/products"],
          },
          {
            label: "Add Product",
            href: "/dashboard/products",
            moduleKey: "inventory",
            matchers: ["/dashboard/products"],
          },
        ],
      },
      { label: "CRM", href: "/dashboard/customers", icon: Users, moduleKey: "customers" },
      { label: "Suppliers", href: "/dashboard/suppliers", icon: UserPlus, moduleKey: "suppliers" },
      { label: "Logistics", href: "/dashboard/logistics", icon: Truck, moduleKey: "logistics", matchers: ["/dashboard/logistics", "/dashboard/shipments", "/dashboard/couriers"] },
      { label: "Tasks", href: "/dashboard/tasks", icon: ClipboardList, moduleKey: "tasks" },
      { label: "Finance", href: "/dashboard/finance", icon: Wallet, moduleKey: "finance" },
      { label: "HR", href: "/dashboard/hr", icon: Users, moduleKey: "hr" },
      { label: "Team", href: "/dashboard/users", icon: UserPlus, moduleKey: "users", matchers: ["/dashboard/users", "/dashboard/activity-logs"] },
      { label: "Settings", href: "/dashboard/settings", icon: Settings, moduleKey: "settings", matchers: ["/dashboard/settings", "/dashboard/admin-tools"] },
    ],
  },
];

const secondaryNavGroup: NavGroup = {
  label: "Additional Tools",
  secondary: true,
  items: [
    { label: "Products", href: "/dashboard/products", icon: Package, moduleKey: "products" },
    { label: "Categories", href: "/dashboard/categories", icon: ClipboardList, moduleKey: "categories" },
    { label: "Brands", href: "/dashboard/brands", icon: Tags, moduleKey: "brands" },
    { label: "Warehouses", href: "/dashboard/warehouses", icon: Warehouse, moduleKey: "warehouses" },
    { label: "Stock Movements", href: "/dashboard/stock-movements", icon: Boxes, moduleKey: "stock_movements" },
    { label: "Shipments", href: "/dashboard/shipments", icon: Truck, moduleKey: "shipments" },
    { label: "Couriers", href: "/dashboard/couriers", icon: Truck, moduleKey: "couriers" },
    { label: "Purchase Orders", href: "/dashboard/purchase-orders", icon: Building2, moduleKey: "purchase_orders" },
    { label: "Activity Logs", href: "/dashboard/activity-logs", icon: History, moduleKey: "activity_logs" },
    { label: "Admin Tools", href: "/dashboard/admin-tools", icon: Settings, moduleKey: "admin_tools" },
    { label: "WooCommerce", href: "/dashboard/woocommerce", icon: Waypoints, moduleKey: "woocommerce" },
    { label: "Courier Integrations", href: "/dashboard/courier-integrations", icon: Workflow, moduleKey: "courier_integrations" },
  ],
};

function matchesPath(pathname: string, href: string, matchers?: string[]) {
  const candidates = matchers ?? [href];
  return candidates.some((candidate) => pathname === candidate || pathname.startsWith(`${candidate}/`));
}

function getVisibleGroups(user: AuthUser | null) {
  const groups: NavGroup[] = primaryNavGroups
    .map<NavGroup>((group) => ({
      ...group,
      items: group.items
        .filter((item) => canAccessModule(item.moduleKey, user))
        .map<NavItem>((item) => ({
          ...item,
          subItems: item.subItems?.filter((subItem) => canAccessModule(subItem.moduleKey, user)),
        })),
    }))
    .filter((group) => group.items.length > 0);

  const visibleSecondaryItems = secondaryNavGroup.items.filter((item) => canAccessModule(item.moduleKey, user));
  if (visibleSecondaryItems.length > 0) {
    groups.push({
      ...secondaryNavGroup,
      items: visibleSecondaryItems,
    });
  }

  return groups;
}

function SidebarContent({
  pathname,
  user,
  isCollapsed,
  expandedItems,
  onToggleCollapse,
  onToggleExpand,
  onNavigate,
  onLogout,
}: {
  pathname: string;
  user: AuthUser | null;
  isCollapsed: boolean;
  expandedItems: string[];
  onToggleCollapse: () => void;
  onToggleExpand: (name: string) => void;
  onNavigate?: () => void;
  onLogout: () => void;
}) {
  const visibleGroups = getVisibleGroups(user);
  const profileName = user?.display_name ?? user?.name ?? user?.full_name ?? "Admin";
  const profileRole = user?.role ?? "admin";
  const profileInitial = (profileName[0] ?? "A").toUpperCase();

  return (
    <>
      <div className={`p-4 flex transition-all duration-300 ${isCollapsed ? "flex-col items-center gap-4" : "items-center justify-between gap-3"}`}>
        <div className={`flex items-center gap-2.5 ${isCollapsed ? "flex-col" : ""}`}>
          <div className="w-9 h-9 bg-[var(--color-accent)] rounded-lg flex items-center justify-center text-white shadow-[0_12px_24px_rgba(37,99,235,0.22)] shrink-0">
            <ShoppingCart size={18} strokeWidth={2.5} />
          </div>
          {!isCollapsed ? (
            <div className="flex-1">
              <h1 className="flex items-center gap-1 text-[1.125rem] font-bold leading-[1.1] tracking-tight text-[var(--color-txt-pri)]">
                <span className="font-extrabold text-[var(--color-txt-pri)]">Amar</span>
                <span className="font-bold text-[var(--color-accent)]">e-Com</span>
              </h1>
              <div className="mt-0.5 flex items-center gap-1">
                <span className="h-1 w-1 rounded-full bg-[var(--color-success)]" />
                <p className="text-[8px] font-bold uppercase tracking-[0.28em] text-[var(--color-txt-sec)]">Business OS</p>
              </div>
            </div>
          ) : null}
        </div>

        <button
          type="button"
          onClick={onToggleCollapse}
          className={`rounded-md border border-[var(--color-brd)] bg-[var(--color-surf)] p-1 text-[var(--color-txt-mut)] transition-all hover:bg-[var(--color-surf-hover)] hover:text-[var(--color-txt-sec)] ${isCollapsed ? "order-2" : "order-1"}`}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-1 dashboard-scrollbar">
        {visibleGroups.map((group, groupIndex) => (
          <div
            key={group.label}
            className={`mb-4 ${groupIndex === 0 && !isCollapsed ? "border-b border-[var(--color-brd)] pb-3" : ""}`}
          >
            {!isCollapsed ? (
              <p className={`px-3 text-[9px] font-black uppercase tracking-[0.12em] ${group.secondary ? "text-[var(--color-txt-mut)]/80" : "text-[var(--color-txt-mut)]"} mb-2`}>
                {group.label}
              </p>
            ) : null}

            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const hasSubItems = Boolean(item.subItems?.length);
                const isChildActive = item.subItems?.some((subItem) => matchesPath(pathname, subItem.href, subItem.matchers)) ?? false;
                const isActive = matchesPath(pathname, item.href, item.matchers) || isChildActive;
                const isExpanded = expandedItems.includes(item.label);

                if (hasSubItems && !isCollapsed) {
                  return (
                    <div key={item.label} className={`mb-1.5 ${isExpanded ? "rounded-xl bg-[var(--color-bg)] pb-2" : ""}`}>
                      <button
                        type="button"
                        onClick={() => onToggleExpand(item.label)}
                        className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-[13px] transition-all ${
                          isExpanded
                            ? "font-bold text-[var(--color-accent)]"
                            : isActive
                              ? "bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)] font-bold text-[var(--color-accent)]"
                              : "font-medium text-[var(--color-txt-sec)] hover:bg-[var(--color-surf-hover)] hover:text-[var(--color-txt-pri)]"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon size={18} className={isExpanded || isActive ? "text-[var(--color-accent)]" : "text-[var(--color-txt-mut)]"} />
                          <span>{item.label}</span>
                        </div>
                        <ChevronDown size={14} strokeWidth={2.5} className={`transition-transform duration-300 ${isExpanded ? "rotate-180 text-[var(--color-accent)]" : "text-[var(--color-txt-mut)]"}`} />
                      </button>

                      {isExpanded ? (
                        <div className="relative ml-6 mt-0.5">
                          <div className="absolute bottom-4 left-[1px] top-2 w-px bg-[var(--color-brd)]" />
                          <div className="relative z-10 flex flex-col gap-1 pl-6">
                            {item.subItems?.map((subItem) => {
                              const isSubActive = matchesPath(pathname, subItem.href, subItem.matchers);
                              const SubIcon =
                                subItem.label.includes("New")
                                  ? Store
                                  : subItem.label.includes("Return")
                                    ? RotateCcw
                                    : ClipboardList;

                              return (
                                <Link
                                  key={subItem.label}
                                  href={subItem.href}
                                  onClick={onNavigate}
                                  className={`group relative flex items-center gap-3 rounded-lg px-1 py-1 text-[12px] transition-all ${
                                    isSubActive
                                      ? "font-bold text-[var(--color-accent)]"
                                      : "font-medium text-[var(--color-txt-sec)] hover:text-[var(--color-txt-pri)]"
                                  }`}
                                >
                                  <div className={`absolute -left-[1.58rem] top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full ring-[3px] ring-[var(--color-bg)] ${isSubActive ? "bg-[var(--color-accent)]" : "bg-slate-300 group-hover:bg-slate-400"}`} />
                                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${isSubActive ? "border border-[color-mix(in_srgb,var(--color-accent)_20%,transparent)] bg-[color-mix(in_srgb,var(--color-accent)_10%,white)] text-[var(--color-accent)] shadow-[var(--shadow-subtle)]" : "text-[var(--color-txt-mut)] group-hover:text-[var(--color-txt-sec)]"}`}>
                                    <SubIcon size={14} strokeWidth={isSubActive ? 2.5 : 2} />
                                  </div>
                                  <span>{subItem.label}</span>
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                }

                return (
                  <div key={item.href} className="relative mb-0.5">
                    {isActive && !isCollapsed ? (
                      <div className="absolute -left-3 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-sm bg-[var(--color-accent)]" />
                    ) : null}
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      className={`group flex items-center rounded-xl px-3 py-2.5 transition-all duration-300 ${
                        isCollapsed ? "justify-center" : "gap-3"
                      } ${
                        isActive
                          ? "bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)] font-bold text-[var(--color-accent)]"
                          : "font-medium text-[var(--color-txt-sec)] hover:bg-[var(--color-surf-hover)] hover:text-[var(--color-txt-pri)]"
                      }`}
                      title={item.label}
                    >
                      <Icon size={18} className={isActive ? "text-[var(--color-accent)]" : "text-[var(--color-txt-mut)] group-hover:text-[var(--color-txt-sec)]"} />
                      {!isCollapsed ? <span className="text-[13px]">{item.label}</span> : null}
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-[var(--color-brd)] p-3">
        {!isCollapsed ? (
          <div className="mb-3 rounded-[16px] border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-3 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent-soft)] font-bold text-[var(--color-accent)]">
                {profileInitial}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-bold text-[var(--color-txt-pri)]">{profileName}</p>
                <p className="truncate text-[10px] font-extrabold uppercase tracking-[0.18em] text-[var(--color-txt-mut)]">
                  {profileRole}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        <button
          type="button"
          onClick={onLogout}
          className={`flex w-full items-center rounded-lg px-3 py-2.5 text-[13px] font-medium text-[var(--color-txt-sec)] transition-all hover:bg-red-50 hover:text-red-500 ${
            isCollapsed ? "justify-center" : "gap-3"
          }`}
        >
          <LogOut size={18} />
          {!isCollapsed ? <span>Log out</span> : null}
        </button>
      </div>
    </>
  );
}

export function DashboardSidebar({
  user,
  isCollapsed,
  isMobileOpen,
  expandedItems,
  onToggleCollapse,
  onToggleExpand,
  onCloseMobile,
  onLogout,
}: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      <aside className={`dashboard-sidebar hidden shrink-0 flex-col border-r border-[var(--color-brd)] bg-[var(--color-surf)] shadow-[var(--shadow-subtle)] transition-all duration-300 md:flex ${isCollapsed ? "w-16" : "w-[240px]"}`}>
        <SidebarContent
          pathname={pathname}
          user={user}
          isCollapsed={isCollapsed}
          expandedItems={expandedItems}
          onToggleCollapse={onToggleCollapse}
          onToggleExpand={onToggleExpand}
          onNavigate={undefined}
          onLogout={onLogout}
        />
      </aside>

      {isMobileOpen ? (
        <div className="dashboard-mobile-overlay fixed inset-0 z-[100] flex justify-end md:hidden">
          <button
            type="button"
            onClick={onCloseMobile}
            className="absolute inset-0 h-full w-full bg-black/60 backdrop-blur-md"
            aria-label="Close mobile menu"
          />
          <div className="relative h-full w-80 overflow-y-auto bg-[var(--color-surf)] px-6 py-8 shadow-2xl">
            <div className="mb-10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[linear-gradient(135deg,var(--color-accent),#0186b8)] text-white shadow-[0_20px_40px_rgba(37,99,235,0.2)]">
                  <ShoppingCart size={20} strokeWidth={2.5} />
                </div>
                <h1 className="flex items-center gap-1 text-xl font-black text-[var(--color-txt-pri)]">
                  Amar <span className="text-[var(--color-accent)]">e-Com</span>
                </h1>
              </div>
              <button
                type="button"
                onClick={onCloseMobile}
                className="rounded-xl bg-[var(--color-surf-hover)] p-2.5 text-[var(--color-txt-sec)] transition-all hover:text-[var(--color-txt-pri)]"
              >
                <X size={20} strokeWidth={2.5} />
              </button>
            </div>

            <SidebarContent
              pathname={pathname}
              user={user}
              isCollapsed={false}
              expandedItems={expandedItems}
              onToggleCollapse={onToggleCollapse}
              onToggleExpand={onToggleExpand}
              onNavigate={onCloseMobile}
              onLogout={onLogout}
            />
        </div>
        </div>
      ) : null}
    </>
  );
}
