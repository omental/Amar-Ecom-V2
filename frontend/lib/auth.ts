import { api } from "@/lib/api";

export type LegacyPermissions = {
  dashboard: boolean;
  orders: boolean;
  inventory: boolean;
  crm: boolean;
  logistics: boolean;
  reports: boolean;
  finance: boolean;
  hr: boolean;
  settings: boolean;
  team: boolean;
  pos: boolean;
};

export type AuthUser = {
  id: string;
  uid?: string;
  name?: string;
  full_name: string;
  display_name?: string | null;
  email: string;
  role: string;
  active?: boolean;
  is_active: boolean;
  permissions?: string[];
  legacy_permissions?: LegacyPermissions;
  has_full_access?: boolean;
  last_login?: string | null;
  lastLogin?: string | null;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  photo_url?: string | null;
  photoURL?: string | null;
};

const TOKEN_KEY = "amar_token";
const USER_KEY = "amar_user";

function canUseStorage() {
  return typeof window !== "undefined";
}

function getDefaultLegacyPermissions(): LegacyPermissions {
  return {
    dashboard: false,
    orders: false,
    inventory: false,
    crm: false,
    logistics: false,
    reports: false,
    finance: false,
    hr: false,
    settings: false,
    team: false,
    pos: false,
  };
}

export function normalizeUser(user: AuthUser): AuthUser {
  const legacy_permissions = {
    ...getDefaultLegacyPermissions(),
    ...(user.legacy_permissions ?? {}),
  };

  const display_name = user.display_name ?? user.name ?? user.full_name;
  const name = user.name ?? user.full_name;
  const uid = user.uid ?? user.id;
  const active = user.active ?? user.is_active;
  const is_active = user.is_active ?? Boolean(user.active);
  const last_login = user.last_login ?? user.lastLogin ?? null;
  const created_at = user.created_at ?? user.createdAt;
  const photo_url = user.photo_url ?? user.photoURL ?? null;

  return {
    ...user,
    uid,
    name,
    full_name: user.full_name ?? display_name ?? name,
    display_name,
    active,
    is_active,
    permissions: user.permissions ?? [],
    legacy_permissions,
    has_full_access: user.has_full_access ?? isAdminUser(user),
    last_login,
    lastLogin: last_login,
    created_at,
    createdAt: created_at,
    photo_url,
    photoURL: photo_url,
  };
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
  window.localStorage.setItem(USER_KEY, JSON.stringify(normalizeUser(user)));
}

export function getUser(): AuthUser | null {
  if (!canUseStorage()) return null;

  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;

  try {
    return normalizeUser(JSON.parse(raw) as AuthUser);
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
    return false;
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
  admin_tools: "settings.view",
  courier_integrations: "couriers.view",
  online_store: "online_store.view",
};

const legacyModuleMap: Record<string, keyof LegacyPermissions> = {
  dashboard: "dashboard",
  orders: "orders",
  inventory: "inventory",
  customers: "crm",
  crm: "crm",
  logistics: "logistics",
  reports: "reports",
  finance: "finance",
  hr: "hr",
  settings: "settings",
  users: "team",
  team: "team",
  pos: "pos",
};

export function canAccessModule(moduleKey: string, user?: AuthUser | null) {
  if (!user || isAdminUser(user)) {
    return true;
  }

  const legacyKey = legacyModuleMap[moduleKey];
  if (legacyKey && user.legacy_permissions) {
    return user.legacy_permissions[legacyKey] === true;
  }

  const permissionKey = modulePermissionMap[moduleKey];
  if (!permissionKey) {
    return true;
  }
  return hasPermission(permissionKey, user);
}

export async function fetchCurrentUser() {
  const user = await api.get<AuthUser>("/auth/me");
  const normalized = normalizeUser(user);
  saveUser(normalized);
  return normalized;
}
