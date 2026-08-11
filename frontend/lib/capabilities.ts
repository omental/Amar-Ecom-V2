import type { AuthUser, LegacyPermissions } from "@/lib/auth";

export type CapabilityAction = "view" | "create" | "update" | "delete" | "import" | "checkout" | "refund";
export type Capability = `${string}.${CapabilityAction}`;

const ADMIN_ROLES = new Set(["admin", "super_admin"]);

const legacyCapabilities: Record<keyof LegacyPermissions, Capability[]> = {
  dashboard: ["dashboard.view"],
  orders: ["orders.view", "orders.create", "orders.update", "orders.delete", "returns.view", "returns.create", "returns.update", "returns.delete"],
  inventory: ["inventory.view", "inventory.create", "inventory.update", "inventory.delete", "products.view", "products.create", "products.update", "products.delete", "media.view", "media.create", "media.update", "media.delete", "categories.view", "categories.create", "categories.update", "categories.delete", "brands.view", "brands.create", "brands.update", "brands.delete", "warehouses.view", "warehouses.create", "warehouses.update", "warehouses.delete", "stock_movements.view", "suppliers.view", "suppliers.create", "suppliers.update", "purchase_orders.view", "purchase_orders.create", "purchase_orders.update"],
  crm: ["customers.view", "customers.create", "customers.update", "customers.delete"],
  logistics: ["logistics.view", "shipments.view", "shipments.create", "shipments.update", "shipments.delete", "couriers.view", "couriers.create", "couriers.update", "courier_integrations.view"],
  reports: ["reports.view"],
  finance: ["finance.view"],
  hr: ["hr.view"],
  settings: ["settings.view", "settings.update", "online_store.view", "online_store.update"],
  team: ["team.view", "team.create", "team.update", "users.view", "permissions.view", "activity_logs.view"],
  pos: ["pos.view", "pos.checkout", "pos.refund"],
};

export const moduleViewCapabilities: Record<string, Capability> = {
  dashboard: "dashboard.view",
  reports: "reports.view",
  orders: "orders.view",
  pos: "pos.view",
  products: "products.view",
  media: "media.view",
  inventory: "inventory.view",
  categories: "categories.view",
  brands: "brands.view",
  warehouses: "warehouses.view",
  stock_movements: "stock_movements.view",
  suppliers: "suppliers.view",
  purchase_orders: "purchase_orders.view",
  customers: "customers.view",
  logistics: "logistics.view",
  shipments: "shipments.view",
  returns: "returns.view",
  couriers: "couriers.view",
  courier_integrations: "courier_integrations.view",
  finance: "finance.view",
  hr: "hr.view",
  tasks: "tasks.view",
  woocommerce: "woocommerce.view",
  online_store: "online_store.view",
  users: "users.view",
  activity_logs: "activity_logs.view",
  settings: "settings.view",
  admin_tools: "settings.view",
};

export function hasFullAccess(user?: AuthUser | null) {
  return Boolean(user && (user.has_full_access || ADMIN_ROLES.has(user.role?.toLowerCase())));
}

export function resolveCapabilities(user?: AuthUser | null): Set<string> {
  if (!user) return new Set();
  if (hasFullAccess(user)) return new Set(["*"]);

  const explicitPermissions = user.permissions ?? [];
  const resolved = new Set(explicitPermissions);
  // Modern granular grants are authoritative. Legacy bundles are only a
  // compatibility fallback for older sessions that have no granular grants.
  if (explicitPermissions.length > 0) return resolved;
  for (const [legacyKey, enabled] of Object.entries(user.legacy_permissions ?? {})) {
    if (!enabled) continue;
    for (const capability of legacyCapabilities[legacyKey as keyof LegacyPermissions] ?? []) {
      resolved.add(capability);
    }
  }
  return resolved;
}

export function can(user: AuthUser | null | undefined, capability: Capability | string) {
  const capabilities = resolveCapabilities(user);
  return capabilities.has("*") || capabilities.has(capability);
}

export function canAccessModule(moduleKey: string, user?: AuthUser | null) {
  const capability = moduleViewCapabilities[moduleKey];
  return capability ? can(user, capability) : false;
}
