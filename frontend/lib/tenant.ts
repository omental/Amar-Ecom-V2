export type OrganizationSummary = {
  id: string;
  name: string;
  slug: string;
  status: string;
};

export type StoreSummary = {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  status: string;
  timezone: string;
  locale: string;
  default_currency: string;
  is_primary: boolean;
};

export type StoreContextResponse = {
  organization: OrganizationSummary;
  store: StoreSummary;
  stores: StoreSummary[];
  organization_role: string;
  store_role: string | null;
};

export const SELECTED_STORE_KEY = "amar_current_store";

export function getSelectedStoreSlug() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(SELECTED_STORE_KEY);
}

export function setSelectedStoreSlug(slug: string) {
  window.localStorage.setItem(SELECTED_STORE_KEY, slug);
}

export function clearSelectedStore() {
  if (typeof window !== "undefined") window.localStorage.removeItem(SELECTED_STORE_KEY);
}

export function getPublicStoreSlug() {
  const configured = process.env.NEXT_PUBLIC_STOREFRONT_STORE_SLUG;
  if (configured) return configured;
  if (typeof window === "undefined") return null;
  const hostname = window.location.hostname.toLowerCase();
  if (hostname === "localhost" || hostname === "127.0.0.1" || !hostname.includes(".")) return null;
  return hostname.split(".", 1)[0] || null;
}
