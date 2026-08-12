"use client";

import { Minus, Plus, ShoppingBag } from "lucide-react";
import { DynamicItemScope, useProductQuery, useStorefrontDynamic } from "@/components/storefront/StorefrontDynamicProvider";
import { formatStoreCurrency, getProductPrimaryImage } from "@/lib/storefront";

export function QueryLoopBlock({ limit, category, renderItem }: { limit: number; category?: string; renderItem: (key: string) => React.ReactNode }) {
  const { dynamic } = useStorefrontDynamic();
  const currentCategory = category === "current" ? dynamic.collection?.slug : category;
  const { items, loading } = useProductQuery(limit, currentCategory);
  if (loading) return <div className="py-8 text-center text-sm text-slate-500">Loading products…</div>;
  return <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">{items.map((item) => <DynamicItemScope key={item.id} item={item}>{renderItem(item.id)}</DynamicItemScope>)}</div>;
}

export function ProductTitleBlock() { const { product, loading } = useStorefrontDynamic(); return <h1 className="text-3xl font-black tracking-tight text-current">{loading ? "Loading product…" : product.product?.name || "No preview product"}</h1>; }
export function ProductDescriptionBlock() { const { product } = useStorefrontDynamic(); return <p className="whitespace-pre-line text-sm leading-7 text-current/70">{product.product?.description || product.product?.short_description || "No product description"}</p>; }
export function ProductPriceBlock({ compare = false }: { compare?: boolean }) { const { product } = useStorefrontDynamic(); const value = compare ? product.product?.price : product.variant?.price || product.product?.sale_price; return value ? <span className={compare ? "text-sm text-slate-500 line-through" : "text-2xl font-black text-[#db011c]"}>{formatStoreCurrency(value)}</span> : null; }
export function ProductMediaBlock() { const { product } = useStorefrontDynamic(); const src = product.product ? getProductPrimaryImage(product.product) : ""; return src ? <img /* eslint-disable-line @next/next/no-img-element */ src={src} alt={product.product?.name || "Product"} className="h-auto w-full rounded-2xl object-cover" /> : <div className="aspect-square rounded-2xl bg-slate-100" />; }
export function ProductSkuBlock() { const { product } = useStorefrontDynamic(); return <span className="text-sm text-slate-600">SKU: {product.variant?.sku || product.product?.sku || "—"}</span>; }
export function ProductBrandBlock() { const { product } = useStorefrontDynamic(); return <span className="text-sm font-semibold text-slate-700">{product.product?.brand?.name || ""}</span>; }
export function ProductAvailabilityBlock() { const { product } = useStorefrontDynamic(); const available = product.product?.stock_status !== "out_of_stock" && (!product.variant || product.variant.stock_quantity > 0); return <span className={`text-sm font-semibold ${available ? "text-emerald-700" : "text-red-700"}`}>{available ? "In stock" : "Out of stock"}</span>; }
export function VariantSelectorBlock() { const { product } = useStorefrontDynamic(); if (!product.product?.variants?.length) return null; return <div className="flex flex-wrap gap-2">{product.product.variants.map((variant) => <button type="button" key={variant.id} disabled={variant.stock_quantity <= 0} onClick={() => product.setVariant(variant)} className={`rounded-lg border px-3 py-2 text-sm ${product.variant?.id === variant.id ? "border-[#db011c] bg-red-50 text-[#db011c]" : "border-slate-300"}`}>{variant.name}</button>)}</div>; }
export function QuantitySelectorBlock() { const { product } = useStorefrontDynamic(); return <div className="inline-flex items-center rounded-lg border border-slate-300"><button type="button" aria-label="Decrease quantity" className="p-2" onClick={() => product.setQuantity(product.quantity - 1)}><Minus size={16} /></button><input aria-label="Quantity" type="number" min={1} value={product.quantity} onChange={(event) => product.setQuantity(Number(event.target.value))} className="w-12 border-x border-slate-300 py-2 text-center text-sm"/><button type="button" aria-label="Increase quantity" className="p-2" onClick={() => product.setQuantity(product.quantity + 1)}><Plus size={16} /></button></div>; }
export function AddToCartBlock({ label }: { label: string }) { const { product } = useStorefrontDynamic(); const disabled = !product.product || product.product.stock_status === "out_of_stock"; return <button type="button" disabled={disabled} onClick={product.addToCart} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#db011c] px-5 py-3 text-sm font-bold text-white disabled:opacity-50"><ShoppingBag size={18}/>{label}</button>; }
export function CollectionTitleBlock() { const { dynamic } = useStorefrontDynamic(); return <h1 className="text-3xl font-black">{dynamic.collection?.name || "No preview collection"}</h1>; }
export function CollectionDescriptionBlock() { const { dynamic } = useStorefrontDynamic(); return <p className="text-sm leading-7 text-slate-600">{dynamic.collection?.description || ""}</p>; }
export function CollectionImageBlock() { const { dynamic } = useStorefrontDynamic(); return dynamic.collection?.image ? <img /* eslint-disable-line @next/next/no-img-element */ src={dynamic.collection.image} alt={dynamic.collection.name} className="h-auto w-full rounded-2xl"/> : null; }
