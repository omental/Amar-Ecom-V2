"use client";

import { useState } from "react";
import { closestCenter, DndContext, DragOverlay, KeyboardSensor, PointerSensor, pointerWithin, useDraggable, useDroppable, useSensor, useSensors, type CollisionDetection, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronRight, Copy, Eye, EyeOff, GripVertical, Lock, LockOpen, Plus, Trash2 } from "lucide-react";

import { canAcceptBuilderChild, getBlockDefinition } from "@/lib/storefront-block-registry";
import type { BuilderBlock } from "@/lib/storefront-builder";
import { findBuilderParent, findTreeNode, validateTreeMove, type BuilderDropPosition, type BuilderDropTarget } from "@/lib/storefront-builder-tree";

import type { BuilderSelection } from "../types";

const collisionDetection: CollisionDetection = (args) => {
  const pointer = pointerWithin(args);
  return pointer.length ? pointer : closestCenter(args);
};

function nodeMatchesSearch(node: BuilderBlock, search: string): boolean {
  if (!search) return true;
  const definition = getBlockDefinition(node.type);
  const own = `${node.meta.label || definition?.label || ""} ${node.type}`.toLowerCase();
  return own.includes(search) || node.children.some((child) => nodeMatchesSearch(child, search));
}

function parseDropTarget(id: string): BuilderDropTarget | null {
  const [prefix, position, ...targetParts] = id.split("|");
  if (prefix !== "drop" || !["before", "inside", "after"].includes(position)) return null;
  const targetId = targetParts.join("|");
  return { position: position as BuilderDropPosition, targetId: targetId === "root" ? null : targetId };
}

function DropIndicator({ id, enabled, inside = false }: { id: string; enabled: boolean; inside?: boolean }) {
  const { isOver, setNodeRef } = useDroppable({ id, disabled: !enabled });
  return <div ref={setNodeRef} aria-hidden="true" className={`${inside ? "my-1 min-h-7 rounded-md border border-dashed px-2 py-1 text-center text-[9px]" : "h-1 rounded-full"} transition ${isOver ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white" : inside ? "border-transparent text-transparent" : "bg-transparent"}`}>{inside ? "Drop inside" : null}</div>;
}

function TreeNode({ node, roots, depth, activeId, expanded, selection, search, onToggle, onSelect, onDuplicate, onDelete, onRequestInsert, onMeta, onContextMenu }: {
  node: BuilderBlock; roots: BuilderBlock[]; depth: number; activeId: string | null; expanded: Record<string, boolean>; selection: BuilderSelection;
  onToggle: (id: string) => void; onSelect: (id: string) => void; onDuplicate: (id: string) => void; onDelete: (id: string) => void; onRequestInsert: (id: string) => void;
  search: string; onMeta: (id: string, meta: BuilderBlock["meta"]) => void; onContextMenu: (event: React.MouseEvent, id: string) => void;
}) {
  const definition = getBlockDefinition(node.type);
  const Icon = definition?.icon;
  const open = expanded[node.id] ?? true;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `node|${node.id}`, data: { nodeId: node.id }, disabled: node.meta.locked });
  const moving = activeId ? findTreeNode(roots, activeId) : null;
  const targetParent = findBuilderParent(roots, node.id);
  const beforeAfterValid = moving ? canAcceptBuilderChild(targetParent, moving) && validateTreeMove(roots, moving.id, { targetId: node.id, position: "before" }, canAcceptBuilderChild).valid : false;
  const insideValid = moving ? canAcceptBuilderChild(node, moving) && validateTreeMove(roots, moving.id, { targetId: node.id, position: "inside" }, canAcceptBuilderChild).valid : false;
  const selected = selection?.type === "block" && selection.id === node.id;
  const label = node.meta.label || definition?.label || `Unknown: ${node.type}`;
  const matches = nodeMatchesSearch(node, search);
  if (!matches) return null;

  return <div className="relative" data-builder-tree-node-id={node.id}>
    <DropIndicator id={`drop|before|${node.id}`} enabled={beforeAfterValid} />
    <div ref={setNodeRef} onContextMenu={(event) => onContextMenu(event, node.id)} style={{ transform: CSS.Translate.toString(transform) }} className={`group flex items-center gap-1 rounded-lg py-1 pr-1 text-xs ${selected ? "bg-[var(--color-accent)] text-white" : "hover:bg-[var(--color-surf-hover)]"} ${isDragging ? "opacity-30" : ""} ${node.meta.hidden ? "opacity-50" : ""}`}>
      <span aria-hidden="true" style={{ width: depth * 13 }} />
      <button type="button" aria-label={node.meta.locked ? `${label} is locked` : `Drag ${label}`} className={`rounded p-1 ${node.meta.locked ? "cursor-not-allowed" : "cursor-grab"}`} {...attributes} {...listeners}><GripVertical size={13} /></button>
      {node.children.length || definition?.capabilities.canHaveChildren ? <button type="button" aria-label={open ? `Collapse ${definition?.label}` : `Expand ${definition?.label}`} onClick={() => onToggle(node.id)} className="rounded p-0.5">{open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</button> : <span className="w-[13px]" />}
      <button type="button" onClick={() => onSelect(node.id)} onDoubleClick={() => { const next = window.prompt("Navigator label", label); if (next !== null) onMeta(node.id, { ...node.meta, label: next.trim() || undefined }); }} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">{Icon ? <Icon size={13} /> : null}<span className="truncate">{label}</span></button>
      <button type="button" aria-label={node.meta.hidden ? `Show ${label}` : `Hide ${label}`} onClick={() => onMeta(node.id, { ...node.meta, hidden: !node.meta.hidden })} className="rounded p-1 opacity-0 group-hover:opacity-100 focus:opacity-100">{node.meta.hidden ? <EyeOff size={12} /> : <Eye size={12} />}</button>
      <button type="button" aria-label={node.meta.locked ? `Unlock ${label}` : `Lock ${label}`} onClick={() => onMeta(node.id, { ...node.meta, locked: !node.meta.locked })} className="rounded p-1 opacity-0 group-hover:opacity-100 focus:opacity-100">{node.meta.locked ? <Lock size={12} /> : <LockOpen size={12} />}</button>
      {definition?.capabilities.canHaveChildren ? <button type="button" aria-label={`Add child to ${definition.label}`} onClick={() => onRequestInsert(node.id)} className="rounded p-1 opacity-0 group-hover:opacity-100 focus:opacity-100"><Plus size={12} /></button> : null}
      {definition?.capabilities.canDuplicate !== false ? <button type="button" aria-label={`Duplicate ${definition?.label || node.type}`} onClick={() => onDuplicate(node.id)} className="rounded p-1 opacity-0 group-hover:opacity-100 focus:opacity-100"><Copy size={12} /></button> : null}
      {definition?.capabilities.canDelete !== false && !node.meta.locked ? <button type="button" aria-label={`Delete ${label}`} onClick={() => onDelete(node.id)} className="rounded p-1 text-rose-500 opacity-0 group-hover:opacity-100 focus:opacity-100"><Trash2 size={12} /></button> : null}
    </div>
    {definition?.capabilities.canHaveChildren && open ? <DropIndicator id={`drop|inside|${node.id}`} enabled={insideValid} inside /> : null}
    {open ? <div>{node.children.map((child) => <TreeNode key={child.id} node={child} roots={roots} depth={depth + 1} activeId={activeId} expanded={expanded} selection={selection} search={search} onToggle={onToggle} onSelect={onSelect} onDuplicate={onDuplicate} onDelete={onDelete} onRequestInsert={onRequestInsert} onMeta={onMeta} onContextMenu={onContextMenu} />)}</div> : null}
    <DropIndicator id={`drop|after|${node.id}`} enabled={beforeAfterValid} />
  </div>;
}

export function RecursiveBlockTree({ blocks, selection, search = "", onSelect, onMove, onDuplicate, onDelete, onRequestInsert, onMeta, onWrap, onCopyElement, onPasteElement, onCopyStyles, onPasteStyles }: {
  blocks: BuilderBlock[]; selection: BuilderSelection; onSelect: (id: string) => void; onMove: (nodeId: string, target: BuilderDropTarget) => void; onDuplicate: (id: string) => void; onDelete: (id: string) => void; onRequestInsert: (parentId: string | null) => void;
  search?: string; onMeta: (id: string, meta: BuilderBlock["meta"]) => void; onWrap: (id: string) => void; onCopyElement: (id: string) => void; onPasteElement: (id: string) => void; onCopyStyles: (id: string) => void; onPasteStyles: (id: string) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [context, setContext] = useState<{ id: string; x: number; y: number } | null>(null);
  const activeNode = activeId ? findTreeNode(blocks, activeId) : null;
  function dragStart(event: DragStartEvent) { setActiveId(String(event.active.data.current?.nodeId || "")); }
  function dragEnd(event: DragEndEvent) {
    const nodeId = String(event.active.data.current?.nodeId || "");
    const target = event.over ? parseDropTarget(String(event.over.id)) : null;
    setActiveId(null);
    if (nodeId && target) onMove(nodeId, target);
  }
  return <DndContext sensors={sensors} collisionDetection={collisionDetection} onDragStart={dragStart} onDragCancel={() => setActiveId(null)} onDragEnd={dragEnd}>
    <div className="pb-1" onClick={() => setContext(null)}>{blocks.map((node) => <TreeNode key={node.id} node={node} roots={blocks} depth={0} activeId={activeId} expanded={expanded} selection={selection} search={search.toLowerCase().trim()} onToggle={(id) => setExpanded((value) => ({ ...value, [id]: !(value[id] ?? true) }))} onSelect={onSelect} onDuplicate={onDuplicate} onDelete={onDelete} onRequestInsert={(id) => onRequestInsert(id)} onMeta={onMeta} onContextMenu={(event, id) => { event.preventDefault(); onSelect(id); setContext({ id, x: event.clientX, y: event.clientY }); }} />)}
      <DropIndicator id="drop|inside|root" enabled={Boolean(activeNode && validateTreeMove(blocks, activeNode.id, { targetId: null, position: "inside" }, canAcceptBuilderChild).valid)} inside />
      <button type="button" onClick={() => onRequestInsert(null)} className="mt-1 flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-[var(--color-brd)] px-2 py-2 text-[10px] font-semibold text-[var(--color-txt-sec)] hover:border-[var(--color-accent)]"><Plus size={12} /> Add root block</button>
    </div>
    {context ? (() => {
      const node = findTreeNode(blocks, context.id); const parent = findBuilderParent(blocks, context.id); const siblings = parent?.children || blocks; const index = siblings.findIndex((item) => item.id === context.id); const definition = node && getBlockDefinition(node.type);
      const actions: Array<[string, () => void]> = [["Edit", () => onSelect(context.id)]];
      if (definition?.capabilities.canHaveChildren) actions.push(["Add child", () => onRequestInsert(context.id)]);
      if (!node?.meta.locked) actions.push(["Duplicate", () => onDuplicate(context.id)], ["Copy", () => onCopyElement(context.id)], ["Paste", () => onPasteElement(context.id)], ["Copy styles", () => onCopyStyles(context.id)], ["Paste styles", () => onPasteStyles(context.id)], ["Wrap in Div", () => onWrap(context.id)]);
      if (!node?.meta.locked && index > 0) actions.push(["Move up", () => onMove(context.id, { targetId: siblings[index - 1].id, position: "before" })]);
      if (!node?.meta.locked && index >= 0 && index < siblings.length - 1) actions.push(["Move down", () => onMove(context.id, { targetId: siblings[index + 1].id, position: "after" })]);
      if (node) actions.push([node.meta.hidden ? "Show" : "Hide", () => onMeta(node.id, { ...node.meta, hidden: !node.meta.hidden })], [node.meta.locked ? "Unlock" : "Lock", () => onMeta(node.id, { ...node.meta, locked: !node.meta.locked })]);
      return <div role="menu" style={{ left: Math.min(context.x, window.innerWidth - 190), top: Math.min(context.y, window.innerHeight - 420) }} className="fixed z-[100] max-h-[min(420px,80vh)] w-48 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 text-xs text-slate-800 shadow-2xl">{actions.map(([label, action]) => <button key={label} type="button" role="menuitem" onClick={() => { action(); setContext(null); }} className="block w-full rounded-lg px-3 py-2 text-left hover:bg-slate-100">{label}</button>)}{!node?.meta.locked ? <button type="button" role="menuitem" onClick={() => { onDelete(context.id); setContext(null); }} className="block w-full rounded-lg px-3 py-2 text-left text-rose-700 hover:bg-rose-50">Delete</button> : null}</div>;
    })() : null}
    <DragOverlay>{activeNode ? <div className="rounded-lg bg-[#111827] px-3 py-2 text-xs font-semibold text-white shadow-xl">{getBlockDefinition(activeNode.type)?.label || activeNode.type}</div> : null}</DragOverlay>
  </DndContext>;
}
