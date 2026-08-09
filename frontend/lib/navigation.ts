import type { Capability } from "@/lib/capabilities";

export const NAVIGATION_GROUPS = ["Overview", "Sales", "Catalog", "Operations", "Customers", "Finance", "People", "Channels", "Administration"] as const;
export type NavigationGroup = (typeof NAVIGATION_GROUPS)[number];

export type NavigationEntry = {
  label: string;
  href: string;
  group: NavigationGroup;
  icon: string;
  capability: Capability;
  matchers?: string[];
  parentHref?: string;
};

export const navigationRegistry: NavigationEntry[] = [
  { label: "Dashboard", href: "/dashboard", group: "Overview", icon: "dashboard", capability: "dashboard.view" },
  { label: "Reports", href: "/dashboard/reports", group: "Overview", icon: "reports", capability: "reports.view" },
  { label: "Orders", href: "/dashboard/orders", group: "Sales", icon: "orders", capability: "orders.view", matchers: ["/dashboard/orders"] },
  { label: "POS", href: "/dashboard/pos", group: "Sales", icon: "pos", capability: "pos.view" },
  { label: "Returns", href: "/dashboard/returns", group: "Sales", icon: "returns", capability: "returns.view", matchers: ["/dashboard/returns"] },
  { label: "Products", href: "/dashboard/products", group: "Catalog", icon: "products", capability: "products.view", matchers: ["/dashboard/products"] },
  { label: "Inventory", href: "/dashboard/inventory", group: "Catalog", icon: "inventory", capability: "inventory.view" },
  { label: "Categories", href: "/dashboard/categories", group: "Catalog", icon: "categories", capability: "categories.view" },
  { label: "Brands", href: "/dashboard/brands", group: "Catalog", icon: "brands", capability: "brands.view" },
  { label: "Warehouses", href: "/dashboard/warehouses", group: "Operations", icon: "warehouses", capability: "warehouses.view" },
  { label: "Stock Movements", href: "/dashboard/stock-movements", group: "Operations", icon: "stock", capability: "stock_movements.view" },
  { label: "Suppliers", href: "/dashboard/suppliers", group: "Operations", icon: "suppliers", capability: "suppliers.view" },
  { label: "Purchase Orders", href: "/dashboard/purchase-orders", group: "Operations", icon: "purchases", capability: "purchase_orders.view", matchers: ["/dashboard/purchase-orders"] },
  { label: "Logistics", href: "/dashboard/logistics", group: "Operations", icon: "logistics", capability: "logistics.view" },
  { label: "Shipments", href: "/dashboard/shipments", group: "Operations", icon: "shipments", capability: "shipments.view", matchers: ["/dashboard/shipments"] },
  { label: "Couriers", href: "/dashboard/couriers", group: "Operations", icon: "couriers", capability: "couriers.view" },
  { label: "Customers", href: "/dashboard/customers", group: "Customers", icon: "customers", capability: "customers.view", matchers: ["/dashboard/customers"] },
  { label: "Finance", href: "/dashboard/finance", group: "Finance", icon: "finance", capability: "finance.view" },
  { label: "HR", href: "/dashboard/hr", group: "People", icon: "hr", capability: "hr.view" },
  { label: "Tasks", href: "/dashboard/tasks", group: "People", icon: "tasks", capability: "tasks.view" },
  { label: "Team", href: "/dashboard/users", group: "People", icon: "team", capability: "users.view" },
  { label: "WooCommerce", href: "/dashboard/woocommerce", group: "Channels", icon: "woocommerce", capability: "woocommerce.view" },
  { label: "Online Store", href: "/dashboard/online-store", group: "Channels", icon: "store", capability: "online_store.view", matchers: ["/dashboard/online-store"] },
  { label: "Courier Integrations", href: "/dashboard/courier-integrations", group: "Channels", icon: "integrations", capability: "courier_integrations.view" },
  { label: "Activity Logs", href: "/dashboard/activity-logs", group: "Administration", icon: "activity", capability: "activity_logs.view" },
  { label: "Settings", href: "/dashboard/settings", group: "Administration", icon: "settings", capability: "settings.view" },
  { label: "Admin Tools", href: "/dashboard/admin-tools", group: "Administration", icon: "admin", capability: "settings.view" },
];

export function matchesNavigationPath(pathname: string, entry: NavigationEntry) {
  const candidates = entry.matchers ?? [entry.href];
  if (entry.href === "/dashboard") return pathname === entry.href;
  return candidates.some((candidate) => pathname === candidate || pathname.startsWith(`${candidate}/`));
}

export function getNavigationEntry(pathname: string) {
  return navigationRegistry
    .filter((entry) => matchesNavigationPath(pathname, entry))
    .sort((a, b) => Math.max(...(b.matchers ?? [b.href]).map((item) => item.length)) - Math.max(...(a.matchers ?? [a.href]).map((item) => item.length)))[0];
}

export function getBreadcrumbs(pathname: string) {
  const entry = getNavigationEntry(pathname);
  if (!entry) return [{ label: "Dashboard", href: "/dashboard", current: pathname === "/dashboard" }];
  const crumbs = [{ label: "Dashboard", href: "/dashboard", current: entry.href === "/dashboard" }];
  if (entry.href !== "/dashboard") crumbs.push({ label: entry.label, href: entry.href, current: pathname === entry.href });
  if (pathname !== entry.href) crumbs.push({ label: "Details", href: pathname, current: true });
  return crumbs;
}
