import "server-only";

import { buildApiUrl } from "@/lib/api-config";
import type {
  OnlineStoreMenuItem,
  OnlineStoreSettings,
  PublicStorefrontResponse,
  ResolvedStorefrontTemplate,
  StorefrontResourceType,
} from "@/lib/online-store";
import type { StoreCategory } from "@/lib/storefront";
import { getServerStorefrontHostname } from "@/lib/storefront-domain-server";

export type PublicStoreDomainContext = {
  store_name: string;
  store_slug: string;
  hostname: string;
  canonical_url: string;
  redirect_to_primary: boolean;
};

export async function serverPublicGet<T>(path: string): Promise<T> {
  // Calling headers() makes hostname-dependent routes request-time rendered.
  const hostname = await getServerStorefrontHostname();
  const secret = process.env.STOREFRONT_INTERNAL_SECRET || (process.env.NODE_ENV !== "production" ? "amar-development-storefront-proxy" : "");
  const response = await fetch(buildApiUrl(path), {
    headers: {
      Accept: "application/json",
      "X-Amar-Storefront-Host": hostname,
      ...(secret ? { "X-Amar-Internal-Secret": secret } : {}),
    },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(response.status === 404 ? "Storefront not found" : "Storefront request failed");
  return response.json() as Promise<T>;
}

export function fetchPublicStorefrontHomeServer() {
  return serverPublicGet<PublicStorefrontResponse>("/public/storefront/pages/home");
}

export function fetchPublicStoreDomainContextServer() {
  return serverPublicGet<PublicStoreDomainContext>("/public/storefront/context");
}

export async function getServerCanonicalStorefrontUrl(path = "") {
  const context = await fetchPublicStoreDomainContextServer();
  return path ? `${context.canonical_url}/${path.replace(/^\/+/, "")}` : context.canonical_url;
}

export function fetchPublicStorefrontPageServer(slug: string) {
  return serverPublicGet<PublicStorefrontResponse>(`/public/storefront/pages/${slug}`);
}

export function fetchPublicStorefrontSettingsServer() {
  return serverPublicGet<OnlineStoreSettings>("/public/storefront/settings");
}

export function fetchPublicStorefrontMenusServer() {
  return serverPublicGet<Record<string, OnlineStoreMenuItem[]>>("/public/storefront/menus");
}

export function fetchPublicResolvedTemplateServer(resourceType: StorefrontResourceType, resourceSlug?: string) {
  const search = new URLSearchParams();
  if (resourceSlug) search.set("resource_slug", resourceSlug);
  return serverPublicGet<ResolvedStorefrontTemplate>(`/public/storefront/theme/resolve/${resourceType}${search.size ? `?${search}` : ""}`);
}

export function fetchPublicCategoriesServer() {
  return serverPublicGet<StoreCategory[]>("/public/categories");
}
