export type AuthUser = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  permissions?: string[];
  created_at?: string;
  updated_at?: string;
};

const TOKEN_KEY = "amar_token";
const USER_KEY = "amar_user";

function canUseStorage() {
  return typeof window !== "undefined";
}

export function saveToken(token: string) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function getToken() {
  if (!canUseStorage()) return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function clearToken() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(TOKEN_KEY);
}

export function saveUser(user: AuthUser) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getUser(): AuthUser | null {
  if (!canUseStorage()) return null;

  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function clearUser() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(USER_KEY);
}

export function logout() {
  clearToken();
  clearUser();
}

export function isAuthenticated() {
  return Boolean(getToken());
}

export function isAdminUser(user?: AuthUser | null) {
  const role = user?.role?.toLowerCase();
  return role === "admin" || role === "super_admin";
}

export function hasPermission(permissionKey: string, user?: AuthUser | null) {
  if (!user || isAdminUser(user)) {
    return true;
  }

  const permissions = user.permissions;
  if (!permissions || permissions.length === 0) {
    return true;
  }

  return permissions.includes(permissionKey);
}

const modulePermissionMap: Record<string, string> = {
  dashboard: "dashboard.view",
  orders: "orders.view",
  pos: "pos.view",
  logistics: "logistics.view",
  shipments: "shipments.view",
  returns: "returns.view",
  couriers: "couriers.view",
  suppliers: "suppliers.view",
  purchase_orders: "purchase_orders.view",
  products: "products.view",
  customers: "customers.view",
  woocommerce: "woocommerce.view",
  finance: "finance.view",
  hr: "hr.view",
  tasks: "tasks.view",
  reports: "reports.view",
  inventory: "inventory.view",
  stock_movements: "stock_movements.view",
  warehouses: "warehouses.view",
  categories: "categories.view",
  brands: "brands.view",
  users: "users.view",
  activity_logs: "activity_logs.view",
  settings: "settings.view",
};

export function canAccessModule(moduleKey: string, user?: AuthUser | null) {
  const permissionKey = modulePermissionMap[moduleKey];
  if (!permissionKey) {
    return true;
  }
  return hasPermission(permissionKey, user);
}
