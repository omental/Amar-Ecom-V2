"use client";

import { useState } from "react";
import { Copy, GripVertical, Plus, Trash2, Zap } from "lucide-react";
import { useDraggable, useDroppable } from "@dnd-kit/core";

import { getBlockDefinition, getResponsiveRenderProps, resolveBuilderBlockProps } from "@/lib/storefront-block-registry";
import { normalizeBuilderBlock, type BuilderBlock, type BuilderDevice } from "@/lib/storefront-builder";
import type { getStorefrontTheme } from "@/lib/storefront-theme";
import type { OnlineStoreTheme } from "@/lib/online-store";
import { cssUnitToString, resolveNodeStyleRules, resolveNodeStyles, styleObjectToCss, type BuilderBoxValues, type BuilderStyleState } from "@/lib/storefront-builder-style";
import { BUILDER_BREAKPOINTS } from "@/lib/storefront-builder-breakpoints";
import type { StorefrontRenderContext } from "@/lib/storefront-render-context";
import { evaluateCondition, isDynamicValue, resolveDynamicValue, type DynamicResolutionContext, type StorefrontCondition } from "@/lib/storefront-dynamic";
import { useOptionalStorefrontDynamic } from "@/components/storefront/StorefrontDynamicProvider";

function normalizeInlineText(value: string, singleLine: boolean) {
  const safe = value.replace(/\u0000/g, "").slice(0, 20_000);
  return singleLine ? safe.replace(/[\r\n]+/g, " ") : safe.replace(/\r\n/g, "\n");
}
function resolveDynamicObject(value: unknown, context: DynamicResolutionContext): unknown { if (isDynamicValue(value)) return resolveDynamicValue(value, context); if (Array.isArray(value)) return value.map((item) => resolveDynamicObject(item, context)); if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveDynamicObject(item, context)])); return value; }

function CanvasDropZone({ id, inside = false }: { id: string; inside?: boolean }) { const { isOver, setNodeRef } = useDroppable({ id }); return <div ref={setNodeRef} aria-hidden="true" className={`${inside ? "absolute inset-2 rounded-lg border-2 border-dashed" : "absolute left-0 right-0 z-20 h-2"} ${id.includes("before") ? "-top-1" : id.includes("after") ? "-bottom-1" : ""} ${isOver ? "border-sky-500 bg-sky-400/20 shadow-[0_0_0_2px_rgba(14,165,233,.25)]" : "border-transparent"}`} />; }

export function BuilderBlockRenderer({ block: rawBlock, theme, themeDefinition, renderContext, builderMode = false, selectedNodeId, onSelectNode, onUpdateText, onDuplicateNode, onDeleteNode, onRequestInsert, onMoveNode, device = "desktop", forcedState = "base" }: {
  block: BuilderBlock | Record<string, unknown>;
  theme: ReturnType<typeof getStorefrontTheme>;
  themeDefinition?: OnlineStoreTheme | null;
  renderContext?: StorefrontRenderContext;
  builderMode?: boolean;
  selectedNodeId?: string | null;
  onSelectNode?: (id: string) => void;
  onUpdateText?: (id: string, text: string) => void;
  onDuplicateNode?: (id: string) => void;
  onDeleteNode?: (id: string) => void;
  onRequestInsert?: (id: string) => void;
  onMoveNode?: (nodeId: string, target: import("@/lib/storefront-builder-tree").BuilderDropTarget) => void;
  device?: BuilderDevice;
  forcedState?: BuilderStyleState;
}) {
  const block = normalizeBuilderBlock(rawBlock);
  const definition = getBlockDefinition(block.type);
  const rawProps = resolveBuilderBlockProps(block, device);
  const dynamicState = useOptionalStorefrontDynamic();
  const styledBlock = dynamicState ? { ...block, style: resolveDynamicObject(block.style, dynamicState.dynamic) as BuilderBlock["style"], responsive: resolveDynamicObject(block.responsive, dynamicState.dynamic) as BuilderBlock["responsive"] } : block;
  const props = Object.fromEntries(Object.entries(rawProps).map(([key, value]) => [key, dynamicState ? resolveDynamicValue(value, dynamicState.dynamic) : isDynamicValue(value) ? value.fallback ?? "" : value]));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const selected = selectedNodeId === block.id;
  const textBlock = (block.type === "heading" || block.type === "paragraph") && !isDynamicValue(rawProps.text);
  const dynamicBindings = Object.entries(rawProps).filter(([, value]) => isDynamicValue(value));
  const normalStyle = resolveNodeStyles(themeDefinition, styledBlock, device, forcedState);
  const hoverStyle = resolveNodeStyles(themeDefinition, styledBlock, device, "hover");
  const tabletStyle = resolveNodeStyles(themeDefinition, styledBlock, "tablet", "base");
  const tabletHoverStyle = resolveNodeStyles(themeDefinition, styledBlock, "tablet", "hover");
  const mobileStyle = resolveNodeStyles(themeDefinition, styledBlock, "mobile", "base");
  const mobileHoverStyle = resolveNodeStyles(themeDefinition, styledBlock, "mobile", "hover");
  const selectedRules = resolveNodeStyleRules(themeDefinition, styledBlock, device, "base");
  const spacingLabel = (["margin", "padding"] as const).flatMap((name) => { const box = selectedRules[name] as BuilderBoxValues | undefined; if (!box) return []; const values = [box.top, box.right, box.bottom, box.left].map((value) => cssUnitToString(value) || "–"); return [`${name[0].toUpperCase()}: ${values.join(" ")}`]; }).join(" · ");
  const styleOwnButton = block.type === "button" && Object.keys(normalStyle).length > 0;
  const scopedClass = `amar-node-${block.id.replace(/[^a-z0-9-]/gi, "")}`;
  const { setNodeRef, attributes, listeners } = useDraggable({ id: `canvas-node|${block.id}`, data: { nodeId: block.id }, disabled: !builderMode || block.meta.locked });

  function beginInlineEdit(event: React.MouseEvent) {
    if (!builderMode || !textBlock) return;
    event.preventDefault(); event.stopPropagation();
    setDraft(String(props.text || ""));
    setEditing(true);
    onSelectNode?.(block.id);
  }

  function commitInlineEdit() {
    if (!editing) return;
    const normalized = normalizeInlineText(draft, block.type === "heading");
    setEditing(false);
    if (normalized !== String(props.text || "")) onUpdateText?.(block.id, normalized);
  }

  const renderChildren = (scopeKey = "base") => block.children.map((child) => <BuilderBlockRenderer key={`${scopeKey}-${child.id}`} block={child} theme={theme} themeDefinition={themeDefinition} renderContext={renderContext} builderMode={builderMode} selectedNodeId={selectedNodeId} onSelectNode={onSelectNode} onUpdateText={onUpdateText} onDuplicateNode={onDuplicateNode} onDeleteNode={onDeleteNode} onRequestInsert={onRequestInsert} onMoveNode={onMoveNode} device={device} forcedState={forcedState} />);
  const children = renderChildren();
  let presentation: React.ReactNode;
  if (dynamicState && !evaluateCondition(rawProps.condition as StorefrontCondition | undefined, dynamicState.dynamic)) return null;
  if (!definition) {
    presentation = builderMode ? <div className="rounded-lg border border-dashed border-amber-400 bg-amber-50 p-3 text-xs text-amber-900">Unknown block <code>{block.type}</code></div> : null;
  } else if (editing && block.type === "heading") {
    presentation = <input autoFocus aria-label="Edit heading text" value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commitInlineEdit} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => { if (event.nativeEvent.isComposing) return; if (event.key === "Enter") { event.preventDefault(); commitInlineEdit(); } if (event.key === "Escape") setEditing(false); }} className="w-full rounded-md border-2 border-[#db011c] bg-white px-2 py-1 text-2xl font-black text-black outline-none" />;
  } else if (editing && block.type === "paragraph") {
    presentation = <textarea autoFocus aria-label="Edit paragraph text" value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commitInlineEdit} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => { if (event.nativeEvent.isComposing) return; if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); commitInlineEdit(); } if (event.key === "Escape") setEditing(false); }} className="min-h-24 w-full resize-y rounded-md border-2 border-[#db011c] bg-white px-2 py-2 text-sm leading-7 text-black outline-none" />;
  } else {
    presentation = definition.render({ node: block, props, responsiveProps: getResponsiveRenderProps(block), theme, children, renderChildren });
  }

  if (!presentation && !builderMode) return null;
  return <div
    ref={setNodeRef}
    {...(builderMode ? { "data-builder-node-id": block.id, "data-builder-node-type": "block" } : {})}
    onClick={builderMode ? (event) => { event.preventDefault(); event.stopPropagation(); onSelectNode?.(block.id); } : undefined}
    onDoubleClick={builderMode && textBlock ? beginInlineEdit : undefined}
    className={`${scopedClass} ${builderMode ? `group/builder-node relative min-h-3 cursor-pointer rounded-md outline outline-2 outline-offset-2 transition ${selected ? "z-10 outline-[#db011c]" : "outline-transparent hover:outline-[#db011c]/40"}` : ""}`}
    style={{ ...normalStyle, ...(block.meta.hidden ? { display: "none" } : {}) }}
  >
    <style>{`.${scopedClass}:hover{${styleObjectToCss(hoverStyle)}}${styleOwnButton ? `.${scopedClass} a{background:transparent!important;color:inherit!important;border-color:inherit!important;border-radius:inherit!important;padding:0!important;font:inherit}` : ""}@media(max-width:${BUILDER_BREAKPOINTS.tablet.maxWidth}px){.${scopedClass}{${styleObjectToCss(tabletStyle)}}.${scopedClass}:hover{${styleObjectToCss(tabletHoverStyle)}}}@media(max-width:${BUILDER_BREAKPOINTS.mobile.maxWidth}px){.${scopedClass}{${styleObjectToCss(mobileStyle)}}.${scopedClass}:hover{${styleObjectToCss(mobileHoverStyle)}}}`}</style>
    {builderMode ? <><CanvasDropZone id={`canvas-drop|before|${block.id}`} /><CanvasDropZone id={`canvas-drop|after|${block.id}`} />{definition?.capabilities.canHaveChildren ? <CanvasDropZone id={`canvas-drop|inside|${block.id}`} inside /> : null}</> : null}
    {presentation}
    {builderMode && dynamicBindings.length ? <span className="pointer-events-none absolute left-1 top-1 z-20 inline-flex items-center gap-1 rounded-full bg-violet-700 px-2 py-1 text-[9px] font-bold text-white shadow"><Zap size={9}/>{dynamicBindings.map(([key]) => key).join(", ")}</span> : null}
    {builderMode && selected ? <><div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] border border-sky-400/70 shadow-[0_0_0_5px_rgba(245,158,11,.12),inset_0_0_0_5px_rgba(34,197,94,.08)]" />{spacingLabel ? <span className="pointer-events-none absolute bottom-1 left-1 z-30 rounded bg-slate-950/85 px-1.5 py-0.5 text-[9px] font-semibold text-white">{spacingLabel}</span> : null}</> : null}
    {builderMode && definition?.capabilities.canHaveChildren && block.children.length === 0 ? <button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); onRequestInsert?.(block.id); }} className="mt-2 flex min-h-16 w-full items-center justify-center rounded-lg border border-dashed border-[#db011c]/40 bg-red-50/30 text-xs font-semibold text-[#a30b1e]"><Plus size={14} className="mr-1" /> Drop or add block here</button> : null}
    {builderMode && selected && !editing ? <div className="absolute -top-9 right-0 z-30 flex items-center gap-0.5 rounded-lg bg-[#111827] p-1 text-white shadow-lg">
      <button type="button" aria-label={`Drag ${definition?.label || block.type}`} className="cursor-grab rounded p-1.5 hover:bg-white/15" {...attributes} {...listeners}><GripVertical size={13} /></button>
      {definition?.capabilities.canHaveChildren ? <button type="button" aria-label={`Add child to ${definition.label}`} onClick={(event) => { event.preventDefault(); event.stopPropagation(); onRequestInsert?.(block.id); }} className="rounded p-1.5 hover:bg-white/15"><Plus size={13} /></button> : null}
      {definition?.capabilities.canDuplicate ? <button type="button" aria-label={`Duplicate ${definition.label}`} onClick={(event) => { event.preventDefault(); event.stopPropagation(); onDuplicateNode?.(block.id); }} className="rounded p-1.5 hover:bg-white/15"><Copy size={13} /></button> : null}
      {definition?.capabilities.canDelete ? <button type="button" aria-label={`Delete ${definition.label}`} onClick={(event) => { event.preventDefault(); event.stopPropagation(); onDeleteNode?.(block.id); }} className="rounded p-1.5 text-rose-300 hover:bg-white/15"><Trash2 size={13} /></button> : null}
    </div> : null}
  </div>;
}
