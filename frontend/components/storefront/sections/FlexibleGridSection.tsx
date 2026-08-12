"use client";

import type { OnlineStoreSection, OnlineStoreSettings, OnlineStoreTheme } from "@/lib/online-store";
import { getRenderableBuilderBlocks, type BuilderDevice } from "@/lib/storefront-builder";
import { getStorefrontTheme } from "@/lib/storefront-theme";
import { DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import type { BuilderDropTarget } from "@/lib/storefront-builder-tree";
import type { StorefrontRenderContext } from "@/lib/storefront-render-context";

import { BuilderBlockRenderer } from "../blocks/BuilderBlockRenderer";
import { SectionWrap } from "./shared";

function columnsClass(layout: string) {
  if (layout === "one_column") return "grid-cols-1";
  if (layout === "three_column") return "grid-cols-1 md:grid-cols-3";
  if (layout === "left_wide") return "grid-cols-1 md:grid-cols-[1.35fr_0.65fr]";
  if (layout === "right_wide") return "grid-cols-1 md:grid-cols-[0.65fr_1.35fr]";
  return "grid-cols-1 md:grid-cols-2";
}

function columnCount(layout: string) {
  return layout === "one_column" ? 1 : layout === "three_column" ? 3 : 2;
}

export function FlexibleGridSection({ section, settings, themeDefinition, renderContext, builderMode = false, selectedNodeId, onSelectNode, onUpdateText, onDuplicateNode, onDeleteNode, onRequestInsert, onMoveNode, device = "desktop" }: {
  section: OnlineStoreSection;
  settings: OnlineStoreSettings;
  themeDefinition?: OnlineStoreTheme | null;
  renderContext?: StorefrontRenderContext;
  builderMode?: boolean;
  selectedNodeId?: string | null;
  onSelectNode?: (id: string) => void;
  onUpdateText?: (id: string, text: string) => void;
  onDuplicateNode?: (id: string) => void;
  onDeleteNode?: (id: string) => void;
  onRequestInsert?: (id: string) => void;
  onMoveNode?: (nodeId: string, target: BuilderDropTarget) => void;
  device?: BuilderDevice;
}) {
  const sectionSettings = (section.settings || {}) as Record<string, unknown>;
  const style = (sectionSettings.style || {}) as Record<string, unknown>;
  const blocks = getRenderableBuilderBlocks(section);
  const layout = String(sectionSettings.layout || "two_column");
  const theme = getStorefrontTheme(settings);
  const columns = Array.from({ length: columnCount(layout) }, (_, index) => index + 1);
  const backgroundClass = style.background_preset === "soft" ? "bg-[var(--store-accent-soft)]" : style.background_preset === "dark" ? "bg-[#111111] text-white" : "bg-white";
  const paddingClass = style.padding_y === "lg" ? "py-10 sm:py-14" : style.padding_y === "sm" ? "py-4 sm:py-5" : "py-6 sm:py-8";
  const wrapperClass = style.max_width === "wide" ? "max-w-[1200px]" : style.max_width === "narrow" ? "max-w-[860px]" : "max-w-[1040px]";
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor));
  function canvasDragEnd(event: DragEndEvent) { const nodeId = String(event.active.data.current?.nodeId || ""); const parts = String(event.over?.id || "").split("|"); if (nodeId && parts[0] === "canvas-drop" && ["before", "inside", "after"].includes(parts[1])) onMoveNode?.(nodeId, { position: parts[1] as BuilderDropTarget["position"], targetId: parts.slice(2).join("|") }); }

  return <DndContext sensors={sensors} onDragEnd={canvasDragEnd}><SectionWrap settings={settings} className={`${theme.radiusClass} border border-[#e5e7eb] ${backgroundClass} ${paddingClass} px-5 sm:px-6`}>
    <div className={`mx-auto ${wrapperClass}`}>
      {section.title || section.subtitle ? <div className={`mb-6 ${String(style.alignment || "left") === "center" ? "text-center" : ""}`}>{section.title ? <h2 className="text-2xl font-black tracking-tight text-current sm:text-3xl">{section.title}</h2> : null}{section.subtitle ? <p className="mt-3 text-sm leading-7 text-inherit/80">{section.subtitle}</p> : null}</div> : null}
      <div className={`grid gap-5 ${columnsClass(layout)}`}>
        {columns.map((column) => <div key={column} className="min-h-12 space-y-4">{blocks.filter((block) => block.column === column).map((block) => <BuilderBlockRenderer key={block.id} block={block} theme={theme} themeDefinition={themeDefinition} renderContext={renderContext} builderMode={builderMode} selectedNodeId={selectedNodeId} onSelectNode={onSelectNode} onUpdateText={onUpdateText} onDuplicateNode={onDuplicateNode} onDeleteNode={onDeleteNode} onRequestInsert={onRequestInsert} onMoveNode={onMoveNode} device={device} />)}</div>)}
      </div>
    </div>
  </SectionWrap></DndContext>;
}
