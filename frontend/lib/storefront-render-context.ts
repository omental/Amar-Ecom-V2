import type { OnlineStorePage, OnlineStoreTemplate, OnlineStoreTheme, StorefrontResourceType } from "@/lib/online-store";
import type { StoreCategory, StoreProduct } from "@/lib/storefront";
import { isDynamicValue, type DynamicStorefrontValue } from "@/lib/storefront-dynamic";
export type { DynamicStorefrontValue, StaticStorefrontValue, StorefrontValue } from "@/lib/storefront-dynamic";

type RenderContextBase<T extends StorefrontResourceType> = {
  resourceType: T;
  theme: OnlineStoreTheme;
  template: OnlineStoreTemplate;
  builderMode: boolean;
};

export type StorefrontRenderContext =
  | (RenderContextBase<"home"> & { resource: null })
  | (RenderContextBase<"product"> & { resource: StoreProduct | null; resourceSlug: string })
  | (RenderContextBase<"collection"> & { resource: StoreCategory | null; resourceSlug: string })
  | (RenderContextBase<"page"> & { resource: OnlineStorePage | null; resourceSlug: string })
  | (RenderContextBase<"search"> & { resource: null; searchQuery: string })
  | (RenderContextBase<"cart"> & { resource: null })
  | (RenderContextBase<"not_found"> & { resource: null });

export function isDynamicStorefrontValue(value: unknown): value is DynamicStorefrontValue {
  return isDynamicValue(value);
}

export function createBuilderRenderContext(theme: OnlineStoreTheme, template: OnlineStoreTemplate, page: OnlineStorePage, resourceSlug = ""): StorefrontRenderContext {
  const base = { theme, template, builderMode: true as const };
  switch (template.resource_type) {
    case "product": return { ...base, resourceType: "product", resource: null, resourceSlug };
    case "collection": return { ...base, resourceType: "collection", resource: null, resourceSlug };
    case "page": return { ...base, resourceType: "page", resource: page, resourceSlug };
    case "search": return { ...base, resourceType: "search", resource: null, searchQuery: resourceSlug };
    case "cart": return { ...base, resourceType: "cart", resource: null };
    case "not_found": return { ...base, resourceType: "not_found", resource: null };
    default: return { ...base, resourceType: "home", resource: null };
  }
}
