"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useCart } from "@/components/storefront/CartProvider";
import type { StorefrontRenderContext } from "@/lib/storefront-render-context";
import { buildStoreProductsPath, fetchStorefrontJson, fetchStoreProductBySlug, type StoreCategory, type StoreProduct, type StoreProductVariant } from "@/lib/storefront";
import type { DynamicResolutionContext } from "@/lib/storefront-dynamic";

type ProductInteraction = { product: StoreProduct | null; variant: StoreProductVariant | null; quantity: number; setVariant: (value: StoreProductVariant | null) => void; setQuantity: (value: number) => void; addToCart: () => void };
type DynamicProviderValue = { renderContext: StorefrontRenderContext; dynamic: DynamicResolutionContext; loading: boolean; product: ProductInteraction };
const Context = createContext<DynamicProviderValue | null>(null);

export function StorefrontDynamicProvider({ context, currentItem, children }: { context: StorefrontRenderContext; currentItem?: StoreProduct | StoreCategory | null; children: React.ReactNode }) {
  const { addItem } = useCart();
  const [resource, setResource] = useState<StoreProduct | StoreCategory | null>(context.resourceType === "product" || context.resourceType === "collection" ? context.resource : null);
  const [loading, setLoading] = useState((context.resourceType === "product" || context.resourceType === "collection") && !context.resource);
  const [variant, setVariant] = useState<StoreProductVariant | null>(null);
  const [quantity, setQuantityState] = useState(1);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (context.resourceType === "product" && !context.resource && context.resourceSlug) {
        setLoading(true); try { const value = await fetchStoreProductBySlug(context.resourceSlug); if (!cancelled) { setResource(value); setVariant(value.variants?.[0] || null); } } finally { if (!cancelled) setLoading(false); }
      } else if (context.resourceType === "collection" && !context.resource && context.resourceSlug) {
        setLoading(true); try { const values = await fetchStorefrontJson<StoreCategory[]>("/public/categories"); if (!cancelled) setResource(values.find((item) => item.slug === context.resourceSlug) || null); } finally { if (!cancelled) setLoading(false); }
      } else { const next = context.resourceType === "product" || context.resourceType === "collection" ? context.resource : null; setResource(next); setVariant(context.resourceType === "product" ? context.resource?.variants?.[0] || null : null); setQuantityState(1); setLoading(false); }
    }
    void load(); return () => { cancelled = true; };
  }, [context]);
  const product = context.resourceType === "product" ? resource as StoreProduct | null : currentItem && "sale_price" in currentItem ? currentItem as StoreProduct : null;
  const dynamic = useMemo<DynamicResolutionContext>(() => ({
    store: { name: context.theme.name, currency: "BDT", url: "/" },
    product: context.resourceType === "product" ? product : null,
    variant,
    collection: context.resourceType === "collection" ? resource as StoreCategory | null : null,
    page: context.resourceType === "page" ? context.resource : null,
    currentItem: currentItem || null,
  }), [context, currentItem, product, resource, variant]);
  const setQuantity = (value: number) => setQuantityState(Math.max(1, Math.min(99, Math.floor(value) || 1)));
  const interaction: ProductInteraction = { product, variant, quantity, setVariant, setQuantity, addToCart: () => { if (!product || product.stock_status === "out_of_stock" || (variant && variant.stock_quantity <= 0)) return; addItem(product, { quantity, selectedSize: variant?.name || "", selectedColor: "", selectedVariantId: variant?.id, selectedVariantSku: variant?.sku, price: variant ? Number(variant.price) : undefined }); toast.success(`${product.name} added to cart`); } };
  return <Context.Provider value={{ renderContext: context, dynamic, loading, product: interaction }}>{children}</Context.Provider>;
}

export function DynamicItemScope({ item, children }: { item: StoreProduct | StoreCategory; children: React.ReactNode }) {
  const parent = useStorefrontDynamic();
  const { addItem } = useCart();
  const isProduct = "sale_price" in item;
  const variant = isProduct ? item.variants?.[0] || null : null;
  const scopedProduct = isProduct ? { ...parent.product, product: item, variant, addToCart: () => { if (item.stock_status === "out_of_stock") return; addItem(item, { quantity: parent.product.quantity, selectedSize: variant?.name || "", selectedColor: "", selectedVariantId: variant?.id, selectedVariantSku: variant?.sku, price: variant ? Number(variant.price) : undefined }); toast.success(`${item.name} added to cart`); } } : parent.product;
  const scoped = { ...parent, dynamic: { ...parent.dynamic, currentItem: item }, product: scopedProduct };
  return <Context.Provider value={scoped}>{children}</Context.Provider>;
}

export function useStorefrontDynamic() {
  const value = useContext(Context);
  if (!value) throw new Error("Dynamic storefront blocks require StorefrontDynamicProvider");
  return value;
}
export function useOptionalStorefrontDynamic() { return useContext(Context); }

export function useProductQuery(limit: number, categorySlug?: string) {
  const [items, setItems] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { let cancelled = false; const timer = window.setTimeout(() => { setLoading(true); fetchStorefrontJson<{ items: StoreProduct[] }>(buildStoreProductsPath({ limit: Math.min(24, Math.max(1, limit)), category_slug: categorySlug })).then((result) => { if (!cancelled) setItems(result.items); }).finally(() => { if (!cancelled) setLoading(false); }); }, 0); return () => { cancelled = true; window.clearTimeout(timer); }; }, [limit, categorySlug]);
  return { items, loading };
}
