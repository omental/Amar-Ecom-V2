import type { OnlineStorePage } from "@/lib/online-store";
import type { StoreCategory, StoreProduct } from "@/lib/storefront";

export type DynamicValueType = "string" | "text" | "number" | "money" | "boolean" | "date" | "url" | "image" | "color";
export type DynamicRoot = "store" | "product" | "variant" | "collection" | "page" | "current_item";
export type DynamicSourceReference = { root: DynamicRoot; path: string[]; valueType: DynamicValueType };
export type DynamicTransform = { type: "uppercase" | "lowercase" | "money" | "number" | "date" };
export type DynamicStorefrontValue<T = unknown> = { kind: "dynamic"; source: DynamicSourceReference; fallback?: T; transform?: DynamicTransform };
export type StaticStorefrontValue<T> = { kind: "static"; value: T };
export type StorefrontValue<T> = T | StaticStorefrontValue<T> | DynamicStorefrontValue<T>;
export type DynamicCustomValues = Record<string, unknown>;
export type DynamicContentEntry = { model_key: string; handle: string; values: Record<string, unknown> };

export type DynamicResolutionContext = {
  store?: { name?: string; url?: string; currency?: string; custom_fields?: DynamicCustomValues } | null;
  product?: StoreProduct | null;
  variant?: NonNullable<StoreProduct["variants"]>[number] | null;
  collection?: StoreCategory | null;
  page?: OnlineStorePage | null;
  currentItem?: StoreProduct | StoreCategory | null;
  contentEntries?: Record<string, DynamicContentEntry>;
};

export type DynamicSourceDefinition = { key: string; label: string; root: DynamicRoot; path: string[]; valueType: DynamicValueType; resourceTypes: string[] };

export const dynamicSourceRegistry: DynamicSourceDefinition[] = [
  { key: "store.name", label: "Store name", root: "store", path: ["name"], valueType: "string", resourceTypes: ["home", "product", "collection", "page", "search", "cart", "not_found"] },
  { key: "store.url", label: "Store URL", root: "store", path: ["url"], valueType: "url", resourceTypes: ["home", "product", "collection", "page", "search", "cart", "not_found"] },
  { key: "product.title", label: "Product title", root: "product", path: ["name"], valueType: "string", resourceTypes: ["product"] },
  { key: "product.description", label: "Product description", root: "product", path: ["description"], valueType: "text", resourceTypes: ["product"] },
  { key: "product.price", label: "Product price", root: "product", path: ["sale_price"], valueType: "money", resourceTypes: ["product"] },
  { key: "product.compare_at_price", label: "Compare-at price", root: "product", path: ["price"], valueType: "money", resourceTypes: ["product"] },
  { key: "product.featured_image", label: "Product featured image", root: "product", path: ["image"], valueType: "image", resourceTypes: ["product"] },
  { key: "product.sku", label: "Product SKU", root: "product", path: ["sku"], valueType: "string", resourceTypes: ["product"] },
  { key: "product.brand", label: "Product brand", root: "product", path: ["brand", "name"], valueType: "string", resourceTypes: ["product"] },
  { key: "product.url", label: "Product URL", root: "product", path: ["url"], valueType: "url", resourceTypes: ["product"] },
  { key: "collection.title", label: "Collection title", root: "collection", path: ["name"], valueType: "string", resourceTypes: ["collection"] },
  { key: "collection.description", label: "Collection description", root: "collection", path: ["description"], valueType: "text", resourceTypes: ["collection"] },
  { key: "collection.image", label: "Collection image", root: "collection", path: ["image"], valueType: "image", resourceTypes: ["collection"] },
  { key: "collection.url", label: "Collection URL", root: "collection", path: ["url"], valueType: "url", resourceTypes: ["collection"] },
  { key: "page.title", label: "Page title", root: "page", path: ["title"], valueType: "string", resourceTypes: ["page"] },
  { key: "page.content", label: "Page content", root: "page", path: ["content"], valueType: "text", resourceTypes: ["page"] },
  { key: "page.url", label: "Page URL", root: "page", path: ["url"], valueType: "url", resourceTypes: ["page"] },
  { key: "current_item.title", label: "Current item title", root: "current_item", path: ["name"], valueType: "string", resourceTypes: ["home", "product", "collection", "page", "search"] },
  { key: "current_item.price", label: "Current item price", root: "current_item", path: ["sale_price"], valueType: "money", resourceTypes: ["home", "product", "collection", "page", "search"] },
  { key: "current_item.image", label: "Current item image", root: "current_item", path: ["image"], valueType: "image", resourceTypes: ["home", "product", "collection", "page", "search"] },
  { key: "current_item.url", label: "Current item URL", root: "current_item", path: ["url"], valueType: "url", resourceTypes: ["home", "product", "collection", "page", "search"] },
];

export function isDynamicValue(value: unknown): value is DynamicStorefrontValue {
  if (!value || typeof value !== "object" || (value as { kind?: unknown }).kind !== "dynamic") return false;
  const source = (value as { source?: unknown }).source;
  return Boolean(source && typeof source === "object" && typeof (source as DynamicSourceReference).root === "string" && Array.isArray((source as DynamicSourceReference).path));
}

export function isStaticValue<T>(value: StorefrontValue<T>): value is StaticStorefrontValue<T> { return Boolean(value && typeof value === "object" && (value as { kind?: unknown }).kind === "static"); }
export function sourceSupportsType(source: DynamicSourceReference, accepted: DynamicValueType[]) { return accepted.includes(source.valueType) || (accepted.includes("text") && source.valueType === "string") || (accepted.includes("string") && source.valueType === "text"); }
export function availableDynamicSources(resourceType: string, accepted: DynamicValueType[]) { return dynamicSourceRegistry.filter((item) => item.resourceTypes.includes(resourceType) && sourceSupportsType({ root: item.root, path: item.path, valueType: item.valueType }, accepted)); }

const SAFE_PATHS = new Set(dynamicSourceRegistry.map((item) => `${item.root}:${item.path.join(".")}`));
const safeUrlFor = (root: DynamicRoot, item: unknown) => {
  const value = item as { slug?: unknown } | null;
  if (!value || typeof value.slug !== "string") return undefined;
  return root === "collection" ? `/categories/${value.slug}` : root === "page" ? `/pages/${value.slug}` : `/products/${value.slug}`;
};

function resolvePath(source: DynamicSourceReference, context: DynamicResolutionContext): unknown {
  const key = `${source.root}:${source.path.join(".")}`;
  const custom = source.path[0] === "custom_fields" && source.path.length >= 2;
  if (!SAFE_PATHS.has(key) && !custom) return undefined;
  let current: unknown = source.root === "store" ? context.store : source.root === "product" ? context.product : source.root === "variant" ? context.variant : source.root === "collection" ? context.collection : source.root === "page" ? context.page : context.currentItem;
  if (source.path[0] === "url") return safeUrlFor(source.root, current);
  for (const segment of source.path) {
    if (!current || typeof current !== "object" || Array.isArray(current) || segment === "__proto__" || segment === "constructor" || segment === "prototype") return undefined;
    current = (current as Record<string, unknown>)[segment];
    if (current && typeof current === "object" && "model_key" in current && "entry_handle" in current) {
      const ref = current as { model_key: string; entry_handle: string; values?: Record<string, unknown> };
      current = ref.values || context.contentEntries?.[`${ref.model_key}:${ref.entry_handle}`]?.values;
    }
  }
  return current;
}

function format(value: unknown, transform?: DynamicTransform, currency = "BDT") {
  if (value == null || !transform) return value;
  if (transform.type === "uppercase") return String(value).toUpperCase();
  if (transform.type === "lowercase") return String(value).toLowerCase();
  if (transform.type === "money") return new Intl.NumberFormat("en-BD", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(value) || 0);
  if (transform.type === "number") return new Intl.NumberFormat("en-BD").format(Number(value) || 0);
  if (transform.type === "date") { const date = new Date(String(value)); return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat("en-BD").format(date); }
  return value;
}

export function resolveDynamicValue<T>(value: StorefrontValue<T>, context: DynamicResolutionContext): T | unknown {
  if (isStaticValue(value)) return value.value;
  if (!isDynamicValue(value)) return value;
  const resolved = resolvePath(value.source, context);
  return format(resolved ?? value.fallback, value.transform, context.store?.currency);
}

export type StorefrontCondition = { operator: "and" | "or"; conditions: Array<{ source: DynamicSourceReference; comparison: "equals" | "not_equals" | "exists" | "not_exists" | "greater_than" | "less_than" | "contains"; value?: unknown }> };
export function evaluateCondition(condition: StorefrontCondition | undefined, context: DynamicResolutionContext) {
  if (!condition?.conditions.length) return true;
  const results = condition.conditions.map((item) => { const actual = resolveDynamicValue({ kind: "dynamic", source: item.source }, context); switch (item.comparison) { case "equals": return actual === item.value; case "not_equals": return actual !== item.value; case "exists": return actual !== undefined && actual !== null && actual !== ""; case "not_exists": return actual === undefined || actual === null || actual === ""; case "greater_than": return Number(actual) > Number(item.value); case "less_than": return Number(actual) < Number(item.value); case "contains": return String(actual ?? "").includes(String(item.value ?? "")); } });
  return condition.operator === "or" ? results.some(Boolean) : results.every(Boolean);
}
