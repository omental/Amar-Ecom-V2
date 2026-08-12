"use client";

import { useState } from "react";

import { MediaPicker } from "@/components/dashboard/online-store/MediaPicker";
import { ProductPicker } from "@/components/dashboard/online-store/ProductPicker";
import type { OnlineStorePage, OnlineStoreSection, OnlineStoreTheme } from "@/lib/online-store";
import { getBlockDefinition } from "@/lib/storefront-block-registry";
import { findBuilderBlock, getBuilderBlocks, type BuilderBlock, type BuilderDevice } from "@/lib/storefront-builder";

import { BlockInspectorPanel } from "./inspector/BlockInspectorPanel";
import { AdvancedStyleInspector } from "./inspector/AdvancedStyleInspector";
import { InspectorField, InspectorGroup, inspectorInputClass } from "./inspector/InspectorFields";
import { normalizeStyleSet, type BuilderStyleRules, type BuilderStyleState } from "@/lib/storefront-builder-style";
import type { BuilderSelection } from "./types";

export function BuilderInspector({ page, theme, selection, device, onThemeChange, onUpdateSection, onUpdateBlock, onRequestInsert }: {
  page: OnlineStorePage; selection: BuilderSelection; device: BuilderDevice; onUpdateSection: (section: OnlineStoreSection) => void;
  theme?: OnlineStoreTheme | null;
  onThemeChange?: (theme: OnlineStoreTheme) => void;
  onUpdateBlock: (sectionId: string, blockId: string, updater: (block: BuilderBlock) => BuilderBlock) => void; onRequestInsert: (sectionId: string, parentId: string | null) => void;
}) {
  const selectedSection = selection?.type === "section" ? page.sections.find((section) => section.id === selection.id) : null;
  const blockOwner = selection?.type === "block" ? page.sections.find((section) => findBuilderBlock(getBuilderBlocks(section), selection.id)) : null;
  const selectedBlock = blockOwner && selection?.type === "block" ? findBuilderBlock(getBuilderBlocks(blockOwner), selection.id) : null;
  return <aside className="min-w-0 border-l border-[var(--color-brd)] bg-[var(--color-surf)]">
    <div className="border-b border-[var(--color-brd)] p-4"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--color-txt-sec)]">Inspector</p><p className="mt-1 truncate text-sm font-semibold">{selectedBlock ? getBlockDefinition(selectedBlock.type)?.label || selectedBlock.type : selectedSection?.title || "Select a node"}</p></div>
    <div className="max-h-[calc(100vh-210px)] overflow-y-auto">{selectedSection ? <SectionInspector section={selectedSection} device={device} onChange={onUpdateSection} onRequestInsert={onRequestInsert} /> : selectedBlock && blockOwner?.id ? <BlockInspectorPanel block={selectedBlock} sectionId={blockOwner.id} theme={theme} device={device} resourceType={page.page_type === "custom" ? "page" : page.page_type} onThemeChange={onThemeChange} onChange={onUpdateBlock} onRequestInsert={onRequestInsert} /> : <p className="p-5 text-sm leading-6 text-[var(--color-txt-sec)]">Select a section or nested block in the tree or storefront preview.</p>}</div>
  </aside>;
}

function SectionInspector({ section, device, onChange, onRequestInsert }: { section: OnlineStoreSection; device: BuilderDevice; onChange: (section: OnlineStoreSection) => void; onRequestInsert: (sectionId: string, parentId: string | null) => void }) {
  const [styleState, setStyleState] = useState<BuilderStyleState>("base");
  const settings = (section.settings || {}) as Record<string, unknown>;
  const content = (section.content || {}) as Record<string, unknown>;
  const updateSettings = (partial: Record<string, unknown>) => onChange({ ...section, settings: { ...settings, ...partial } });
  const updateContent = (partial: Record<string, unknown>) => onChange({ ...section, content: { ...content, ...partial } });
  const slides = Array.isArray(content.slides) ? content.slides as Array<Record<string, unknown>> : [];
  const slide = slides[0] || {};
  const productSection = ["product_grid", "new_arrivals", "featured_collection", "best_selling", "flash_sale"].includes(section.type);
  const baseStyles = normalizeStyleSet(settings.builder_style);
  const responsiveStyles = (settings.builder_responsive && typeof settings.builder_responsive === "object" ? settings.builder_responsive : {}) as Partial<Record<BuilderDevice, Partial<Record<BuilderStyleState, BuilderStyleRules>>>>;
  const currentStyles = device === "desktop" ? baseStyles[styleState] : responsiveStyles[device]?.[styleState] || {};
  const updateSectionStyles = (rules: BuilderStyleRules) => device === "desktop" ? updateSettings({ builder_style: { ...baseStyles, [styleState]: rules } }) : updateSettings({ builder_responsive: { ...responsiveStyles, [device]: { ...(responsiveStyles[device] || {}), [styleState]: rules } } });
  return <>
    <InspectorGroup title="Content">
      <InspectorField label="Title"><input className={inspectorInputClass} value={section.title || ""} onChange={(event) => onChange({ ...section, title: event.target.value })} /></InspectorField>
      <InspectorField label="Subtitle"><textarea className={`${inspectorInputClass} min-h-20`} value={section.subtitle || ""} onChange={(event) => onChange({ ...section, subtitle: event.target.value })} /></InspectorField>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={section.is_enabled !== false} onChange={(event) => onChange({ ...section, is_enabled: event.target.checked })} />Visible on storefront</label>
      {section.type === "hero_slider" ? <><InspectorField label="Hero headline"><input className={inspectorInputClass} value={String(slide.title || "")} onChange={(event) => updateContent({ slides: [{ ...slide, title: event.target.value }, ...slides.slice(1)] })} /></InspectorField><MediaPicker label="Hero image" mediaType="banner" value={String(slide.image_url || "")} onChange={(value) => updateContent({ slides: [{ ...slide, image_url: value }, ...slides.slice(1)] })} /></> : null}
      {section.type === "text_block" ? <InspectorField label="Body"><textarea className={`${inspectorInputClass} min-h-28`} value={String(content.text || "")} onChange={(event) => updateContent({ text: event.target.value })} /></InspectorField> : null}
      {section.type === "image_text" ? <><InspectorField label="Body"><textarea className={`${inspectorInputClass} min-h-24`} value={String(content.body || "")} onChange={(event) => updateContent({ body: event.target.value })} /></InspectorField><MediaPicker label="Image" mediaType="section" value={String(content.image_url || "")} onChange={(value) => updateContent({ image_url: value })} /></> : null}
      {productSection ? <ProductPicker value={(Array.isArray(settings.product_ids) ? settings.product_ids : []).map(String)} onChange={(ids) => updateSettings({ source: "manual", product_ids: ids })} maxSelection={Number(settings.limit || 8)} /> : null}
    </InspectorGroup>
    {section.type === "flexible_grid" && section.id ? <InspectorGroup title="Blocks"><button type="button" onClick={() => onRequestInsert(section.id!, null)} className="w-full rounded-xl border border-dashed border-[var(--color-brd)] px-3 py-3 text-sm font-semibold hover:border-[var(--color-accent)]">Add root block</button></InspectorGroup> : null}
    <div className="sticky top-0 z-10 flex gap-1 border-y border-[var(--color-brd)] bg-white p-3"><button type="button" onClick={() => setStyleState("base")} className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold ${styleState === "base" ? "bg-slate-950 text-white" : "bg-slate-100"}`}>Normal</button><button type="button" onClick={() => setStyleState("hover")} className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold ${styleState === "hover" ? "bg-slate-950 text-white" : "bg-slate-100"}`}>Hover</button></div>
    <AdvancedStyleInspector rules={currentStyles} inherited={{}} state={styleState} onChange={updateSectionStyles} onClear={() => updateSectionStyles({})} />
    <InspectorGroup title="Advanced"><details><summary className="cursor-pointer text-xs font-semibold">JSON data</summary><div className="mt-3 space-y-3"><InspectorField label="Settings JSON"><textarea className={`${inspectorInputClass} min-h-32 font-mono text-[11px]`} value={JSON.stringify(settings, null, 2)} onChange={(event) => { try { onChange({ ...section, settings: JSON.parse(event.target.value || "{}") as Record<string, unknown> }); } catch {} }} /></InspectorField><InspectorField label="Content JSON"><textarea className={`${inspectorInputClass} min-h-40 font-mono text-[11px]`} value={JSON.stringify(content, null, 2)} onChange={(event) => { try { onChange({ ...section, content: JSON.parse(event.target.value || "{}") as Record<string, unknown> }); } catch {} }} /></InspectorField></div></details></InspectorGroup>
  </>;
}
