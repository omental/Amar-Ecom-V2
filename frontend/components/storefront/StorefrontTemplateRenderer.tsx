"use client";

import Link from "next/link";

import { CartPageView } from "@/components/storefront/CartPageView";
import { StorefrontDynamicProvider, useStorefrontDynamic } from "@/components/storefront/StorefrontDynamicProvider";
import { ProductDetailView } from "@/components/storefront/ProductDetailView";
import { ProductGrid } from "@/components/storefront/ProductGrid";
import { SectionRenderer, StorefrontSectionStyle } from "@/components/storefront/sections/SectionRenderer";
import type { OnlineStoreSection, OnlineStoreSettings } from "@/lib/online-store";
import type { BuilderDevice } from "@/lib/storefront-builder";
import type { StorefrontRenderContext } from "@/lib/storefront-render-context";

type BuilderCallbacks = {
  builderMode?: boolean;
  selectedNodeId?: string | null;
  onSelectNode?: (id: string) => void;
  onUpdateText?: (id: string, text: string) => void;
  onDuplicateNode?: (id: string) => void;
  onDeleteNode?: (id: string) => void;
  onRequestInsert?: (id: string) => void;
  onMoveNode?: (nodeId: string, target: import("@/lib/storefront-builder-tree").BuilderDropTarget) => void;
  device?: BuilderDevice;
};

export function StorefrontTemplateRenderer({ sections, settings, context, ...builder }: { sections: OnlineStoreSection[]; settings: OnlineStoreSettings; context: StorefrontRenderContext } & BuilderCallbacks) {
  const systemTypes = new Set(["product_main", "collection_main", "page_main", "search_results", "cart_main", "not_found_main"]);
  return <StorefrontDynamicProvider context={context}><div className="space-y-6">{sections.filter((section) => section.is_enabled !== false).map((section) => <div key={section.id} data-template-section-type={section.type}>{systemTypes.has(section.type) ? <StorefrontSectionStyle section={section} device={builder.device}>{renderTemplateSection(section, settings, context, builder)}</StorefrontSectionStyle> : renderTemplateSection(section, settings, context, builder)}</div>)}</div></StorefrontDynamicProvider>;
}

function renderTemplateSection(section: OnlineStoreSection, settings: OnlineStoreSettings, context: StorefrontRenderContext, builder: BuilderCallbacks) {
  switch (section.type) {
    case "product_main":
      return context.resourceType === "product" ? <ProductSystemMain productSlug={context.resourceSlug} /> : <ContextMismatch section={section} context={context} />;
    case "collection_main":
      return context.resourceType === "collection" ? <section className="space-y-5"><div className="rounded-2xl border border-[#e5e7eb] bg-white px-5 py-6 sm:px-7"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#db011c]">Collection</p><h1 className="mt-3 text-3xl font-black text-black">{context.resource?.name || readableSlug(context.resourceSlug)}</h1>{context.resource?.description ? <p className="mt-3 text-sm leading-7 text-[#4b5563]">{context.resource.description}</p> : null}</div><ProductGrid eyebrow="Collection" title={`${context.resource?.name || readableSlug(context.resourceSlug)} products`} description="Products resolved from the selected collection." query={{ category_slug: context.resourceSlug }} collection="seasonal" maxItems={Number(section.settings?.limit || 24)} /></section> : <ContextMismatch section={section} context={context} />;
    case "page_main":
      if (context.resourceType !== "page") return <ContextMismatch section={section} context={context} />;
      return <div className="space-y-6"><section className="rounded-2xl border border-[#e5e7eb] bg-white px-5 py-8 sm:px-8"><h1 className="text-3xl font-bold tracking-tight text-black">{context.resource?.title || readableSlug(context.resourceSlug)}</h1>{context.resource?.content ? <div className="prose mt-4 max-w-none text-sm leading-7 text-[#4b5563]" dangerouslySetInnerHTML={{ __html: context.resource.content }} /> : null}</section>{section.settings?.include_legacy_sections !== false ? context.resource?.sections.map((legacy) => <SectionRenderer key={legacy.id} section={legacy} settings={settings} />) : null}</div>;
    case "search_results":
      return context.resourceType === "search" ? <ProductGrid eyebrow="Search" title={context.searchQuery ? `Results for “${context.searchQuery}”` : "Search products"} description="Search across public storefront products." query={{ search: context.searchQuery }} maxItems={Number(section.settings?.limit || 24)} /> : <ContextMismatch section={section} context={context} />;
    case "cart_main":
      return context.resourceType === "cart" ? <CartPageView /> : <ContextMismatch section={section} context={context} />;
    case "not_found_main":
      return context.resourceType === "not_found" ? <section className="rounded-[28px] border border-slate-200 bg-white px-6 py-16 text-center shadow-sm"><p className="text-xs font-bold uppercase tracking-[0.22em] text-[#db011c]">404</p><h1 className="mt-4 text-4xl font-black text-slate-950">{String(section.settings?.heading || "Page not found")}</h1><p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-slate-600">{String(section.settings?.message || "The page you are looking for does not exist.")}</p><Link href={safePath(section.settings?.cta_url)} className="store-primary-button mt-7">{String(section.settings?.cta_label || "Return home")}</Link></section> : <ContextMismatch section={section} context={context} />;
    default:
      return <SectionRenderer section={section} settings={settings} themeDefinition={context.theme} renderContext={context} builderMode={builder.builderMode} selectedNodeId={builder.selectedNodeId} onSelectNode={builder.onSelectNode} onUpdateText={builder.onUpdateText} onDuplicateNode={builder.onDuplicateNode} onDeleteNode={builder.onDeleteNode} onRequestInsert={builder.onRequestInsert} onMoveNode={builder.onMoveNode} device={builder.device} />;
  }
}

function ProductSystemMain({ productSlug }: { productSlug: string }) { const { product, loading } = useStorefrontDynamic(); if (loading) return <div className="py-12 text-center text-sm text-slate-500">Loading product details…</div>; return <ProductDetailView key={product.product?.id || productSlug} productSlug={productSlug} initialProduct={product.product} />; }
function readableSlug(value: string) { return value.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" "); }
function safePath(value: unknown) { const path = String(value || "/"); return path.startsWith("/") ? path : "/"; }
function ContextMismatch({ section, context }: { section: OnlineStoreSection; context: StorefrontRenderContext }) { return context.builderMode ? <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">{section.type} requires a compatible resource context.</div> : null; }
