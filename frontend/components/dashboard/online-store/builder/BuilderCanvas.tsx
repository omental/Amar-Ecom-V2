"use client";

import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { RefreshCw } from "lucide-react";

import { CartProvider } from "@/components/storefront/CartProvider";
import { StoreCategoryNav } from "@/components/storefront/StoreCategoryNav";
import { StoreFooter } from "@/components/storefront/StoreFooter";
import { StoreHeader } from "@/components/storefront/StoreHeader";
import { StoreTopBar } from "@/components/storefront/StoreTopBar";
import { SectionRenderer, StorefrontSectionStyle } from "@/components/storefront/sections/SectionRenderer";
import { StorefrontTemplateRenderer } from "@/components/storefront/StorefrontTemplateRenderer";
import { FALLBACK_STOREFRONT_MENUS, type OnlineStoreMenuItem, type OnlineStorePage, type OnlineStoreSettings, type OnlineStoreTemplate, type OnlineStoreTheme } from "@/lib/online-store";
import { createBuilderRenderContext } from "@/lib/storefront-render-context";
import type { BuilderDevice } from "@/lib/storefront-builder";
import { getStorefrontTheme } from "@/lib/storefront-theme";
import { BUILDER_BREAKPOINTS } from "@/lib/storefront-builder-breakpoints";

import type { BuilderSelection } from "./types";

export function BuilderCanvas({ page, settings, menus, themeDefinition, template, previewResourceSlug = "", device, selection, onSelect, onUpdateText, onDuplicateNode, onDeleteNode, onRequestInsert, onMoveBlock, refreshKey, onRefresh }: {
  page: OnlineStorePage;
  settings: OnlineStoreSettings;
  menus: Record<string, OnlineStoreMenuItem[]>;
  themeDefinition?: OnlineStoreTheme | null;
  template?: OnlineStoreTemplate | null;
  previewResourceSlug?: string;
  device: BuilderDevice;
  selection: BuilderSelection;
  onSelect: (selection: BuilderSelection) => void;
  onUpdateText: (id: string, text: string) => void;
  onDuplicateNode: (id: string) => void;
  onDeleteNode: (id: string) => void;
  onRequestInsert: (id: string) => void;
  onMoveBlock: (sectionId: string, nodeId: string, target: import("@/lib/storefront-builder-tree").BuilderDropTarget) => void;
  refreshKey: number;
  onRefresh: () => void;
}) {
  const theme = getStorefrontTheme(settings);
  const headerSections = page.sections.filter((section) => section.section_group_id && ["announcement_bar", "header"].includes(section.type));
  const footerSections = page.sections.filter((section) => section.section_group_id && section.type === "footer");
  const contentSections = page.sections.filter((section) => !section.section_group_id);
  const [frameBody, setFrameBody] = useState<HTMLElement | null>(null);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const prepareFrame = useCallback((frame: HTMLIFrameElement | null) => {
    const document = frame?.contentDocument;
    if (!document) return;
    document.head.querySelectorAll("[data-builder-copied-style]").forEach((node) => node.remove());
    window.document.head.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => {
      const clone = node.cloneNode(true) as HTMLElement;
      clone.dataset.builderCopiedStyle = "true";
      document.head.appendChild(clone);
    });
    document.body.style.margin = "0";
    document.body.style.background = "white";
    setFrameBody(document.body);
  }, []);
  return <main className="min-w-0 bg-[#e9ebef] p-4 lg:p-6">
    <div className="mb-3 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#687083]">Live storefront</p><p className="mt-1 text-xs text-[#7a8292]">Real renderer · {device} viewport</p></div><button type="button" aria-label="Refresh preview" onClick={onRefresh} className="rounded-lg border border-[#d7dae0] bg-white p-2 text-[#687083]"><RefreshCw size={15} /></button></div>
    <iframe ref={frameRef} onLoad={() => prepareFrame(frameRef.current)} title={`${page.title} live preview`} srcDoc="<!doctype html><html><head></head><body></body></html>" className="mx-auto block min-h-[720px] rounded-2xl border border-[#d7dae0] bg-white shadow-[0_16px_50px_rgba(17,24,39,0.12)] transition-[width] duration-300" style={{ width: device === "desktop" ? "100%" : `${BUILDER_BREAKPOINTS[device].previewWidth}px`, maxWidth: "100%" }} />
    {frameBody ? createPortal(<CartProvider><div key={refreshKey} className="storefront-shell min-h-screen bg-white" data-builder-preview="true" onClickCapture={(event) => { if ((event.target as HTMLElement).closest("a")) event.preventDefault(); }} onSubmitCapture={(event) => event.preventDefault()}>
      <div data-builder-area="header" className="relative">{headerSections.map((section) => <div key={section.id} className={`outline outline-2 outline-offset-[-2px] ${selection?.type === "section" && section.id === selection.id ? "outline-[#db011c]" : "outline-transparent hover:outline-[#db011c]/30"}`} onClick={(event) => { if (section.id) { event.preventDefault(); event.stopPropagation(); onSelect({ type: "section", id: section.id }); } }}><StorefrontSectionStyle section={section} device={device}>{section.type === "announcement_bar" ? <StoreTopBar settings={{ ...settings, show_topbar: true }} /> : <><StoreHeader settings={settings} navigation={menus.main_nav || FALLBACK_STOREFRONT_MENUS.main_nav} /><StoreCategoryNav settings={settings} items={menus.category_nav || FALLBACK_STOREFRONT_MENUS.category_nav} /></>}</StorefrontSectionStyle></div>)}</div>
      <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-6 px-4 py-4 sm:px-5 sm:py-5" style={theme.cssVars}>
        {page.content ? <section className="rounded-2xl border border-[#e5e7eb] bg-white px-5 py-8"><h1 className="text-3xl font-bold text-black">{page.title}</h1><div className="mt-4 text-sm leading-7 text-[#4b5563]" dangerouslySetInnerHTML={{ __html: page.content }} /></section> : null}
        <div className={theme.spacingClass}>{contentSections.filter((section) => section.is_enabled !== false).map((section) => <div key={section.id} data-builder-node-id={section.id} data-builder-node-type="section" onClick={(event) => { event.preventDefault(); event.stopPropagation(); if (section.id) onSelect({ type: "section", id: section.id }); }} className={`relative cursor-pointer outline outline-2 outline-offset-[-2px] transition ${selection?.type === "section" && selection.id === section.id ? "outline-[#db011c]" : "outline-transparent hover:outline-[#db011c]/30"}`}>
          {themeDefinition && template ? <StorefrontTemplateRenderer sections={[section]} settings={settings} context={createBuilderRenderContext(themeDefinition, template, page, previewResourceSlug)} builderMode selectedNodeId={selection?.type === "block" ? selection.id : null} onSelectNode={(id) => onSelect({ type: "block", id })} onUpdateText={onUpdateText} onDuplicateNode={onDuplicateNode} onDeleteNode={onDeleteNode} onRequestInsert={onRequestInsert} onMoveNode={(nodeId, target) => { if (section.id) onMoveBlock(section.id, nodeId, target); }} device={device} /> : <SectionRenderer section={section} settings={settings} builderMode selectedNodeId={selection?.type === "block" ? selection.id : null} onSelectNode={(id) => onSelect({ type: "block", id })} onUpdateText={onUpdateText} onDuplicateNode={onDuplicateNode} onDeleteNode={onDeleteNode} onRequestInsert={onRequestInsert} onMoveNode={(nodeId, target) => { if (section.id) onMoveBlock(section.id, nodeId, target); }} device={device} />}
        </div>)}</div>
      </main>
      <div data-builder-area="footer" className="relative">{footerSections.map((section) => <div key={section.id} className={`outline outline-2 outline-offset-[-2px] ${selection?.type === "section" && section.id === selection.id ? "outline-[#db011c]" : "outline-transparent hover:outline-[#db011c]/30"}`} onClick={(event) => { if (section.id) { event.preventDefault(); event.stopPropagation(); onSelect({ type: "section", id: section.id }); } }}><StorefrontSectionStyle section={section} device={device}><StoreFooter settings={settings} footerServices={menus.footer_services || FALLBACK_STOREFRONT_MENUS.footer_services} footerJoinUs={menus.footer_join_us || FALLBACK_STOREFRONT_MENUS.footer_join_us} footerSocial={menus.footer_social || FALLBACK_STOREFRONT_MENUS.footer_social} /></StorefrontSectionStyle></div>)}</div>
    </div></CartProvider>, frameBody) : null}
  </main>;
}
