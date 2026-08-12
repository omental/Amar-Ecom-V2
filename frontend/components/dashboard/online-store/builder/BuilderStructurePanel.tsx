"use client";

import { useMemo, useState } from "react";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { BookmarkPlus, ChevronDown, ChevronRight, Copy, Eye, EyeOff, GripVertical, Plus, Search, Trash2 } from "lucide-react";

import type { OnlineStorePage, OnlineStoreSection, OnlineStoreSavedSection } from "@/lib/online-store";
import { getBuilderBlocks } from "@/lib/storefront-builder";
import type { BuilderDropTarget } from "@/lib/storefront-builder-tree";
import { getSectionPreset } from "@/lib/storefront-section-presets";

import { RecursiveBlockTree } from "./tree/RecursiveBlockTree";
import type { BuilderSelection } from "./types";

function SortableSection({ id, children }: { id: string; children: (handle: Record<string, unknown>) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={isDragging ? "opacity-40" : ""}>{children({ ...attributes, ...listeners })}</div>;
}

export function BuilderStructurePanel({ page, selection, savedSections, onSelect, onReorderSections, onMoveBlock, onToggleSection, onDuplicateSection, onDeleteSection, onSaveReusable, onDuplicateBlock, onDeleteBlock, onUpdateBlockMeta, onWrapBlock, onCopyBlock, onPasteBlock, onCopyStyles, onPasteStyles, onRequestInsert, onOpenSectionLibrary }: {
  page: OnlineStorePage; selection: BuilderSelection; savedSections: OnlineStoreSavedSection[]; onSelect: (selection: BuilderSelection) => void; onReorderSections: (sections: OnlineStoreSection[]) => void;
  onMoveBlock: (sectionId: string, nodeId: string, target: BuilderDropTarget) => void; onToggleSection: (section: OnlineStoreSection) => void; onDuplicateSection: (section: OnlineStoreSection) => void; onDeleteSection: (section: OnlineStoreSection) => void; onSaveReusable: (section: OnlineStoreSection) => void;
  onDuplicateBlock: (sectionId: string, blockId: string) => void; onDeleteBlock: (sectionId: string, blockId: string) => void; onRequestInsert: (sectionId: string, parentId: string | null) => void; onOpenSectionLibrary: () => void;
  onUpdateBlockMeta: (sectionId: string, blockId: string, meta: import("@/lib/storefront-builder").BuilderBlock["meta"]) => void; onWrapBlock: (sectionId: string, blockId: string) => void; onCopyBlock: (sectionId: string, blockId: string) => void; onPasteBlock: (sectionId: string, blockId: string) => void; onCopyStyles: (sectionId: string, blockId: string) => void; onPasteStyles: (sectionId: string, blockId: string) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const sectionIds = useMemo(() => page.sections.flatMap((section) => section.id ? [section.id] : []), [page.sections]);
  function sectionDragEnd(event: DragEndEvent) { if (!event.over || event.active.id === event.over.id) return; const from = page.sections.findIndex((section) => section.id === event.active.id); const to = page.sections.findIndex((section) => section.id === event.over?.id); if (from < 0 || to < 0) return; const source = page.sections[from]; const target = page.sections[to]; const sourceOwner = source.section_group_id || source.template_id || source.page_id; const targetOwner = target.section_group_id || target.template_id || target.page_id; if (sourceOwner !== targetOwner) return; onReorderSections(arrayMove(page.sections, from, to)); }

  return <aside className="min-w-0 border-r border-[var(--color-brd)] bg-[var(--color-surf)]">
    <div className="border-b border-[var(--color-brd)] p-4"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--color-txt-sec)]">Navigator</p><p className="mt-1 text-sm font-semibold">{page.title}</p><label className="relative mt-3 block"><Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-txt-sec)]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search nodes" className="w-full rounded-lg border border-[var(--color-brd)] bg-[var(--color-surf-hover)] py-2 pl-8 pr-2 text-xs outline-none" /></label></div>
    <div className="max-h-[calc(100vh-250px)] overflow-y-auto p-3"><DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={sectionDragEnd}><SortableContext items={sectionIds} strategy={verticalListSortingStrategy}><div className="space-y-2">{page.sections.map((section, index) => section.id ? <div key={section.id}>{index === 0 || (page.sections[index - 1]?.section_group_id || page.sections[index - 1]?.template_id || page.sections[index - 1]?.page_id) !== (section.section_group_id || section.template_id || section.page_id) ? <p className="mb-2 mt-4 px-1 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--color-txt-sec)]">{section.section_group_id ? (["announcement_bar", "header"].includes(section.type) ? "Header · Global" : "Footer · Global") : section.template_id ? page.title : "Page content"}</p> : null}<SortableSection id={section.id}>{(handle) => {
      const blocks = section.type === "flexible_grid" ? getBuilderBlocks(section) : [];
      const open = expanded[section.id!] ?? section.type === "flexible_grid";
      const selected = selection?.type === "section" && selection.id === section.id;
      return <div className={`rounded-xl border ${selected ? "border-[var(--color-accent)] bg-red-50/40" : "border-[var(--color-brd)]"}`}>
        <div className="group flex items-center gap-1 p-2">
          <button type="button" aria-label={`Drag ${section.title || section.type}`} className="cursor-grab rounded p-1" {...handle}><GripVertical size={14} /></button>
          <button type="button" aria-label={open ? "Collapse section" : "Expand section"} onClick={() => setExpanded((value) => ({ ...value, [section.id!]: !open }))} className="rounded p-1">{open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</button>
          <button type="button" onClick={() => onSelect({ type: "section", id: section.id! })} className="min-w-0 flex-1 text-left"><span className="block truncate text-xs font-semibold">{section.title || getSectionPreset(section.type)?.label || section.type}</span><span className="text-[9px] text-[var(--color-txt-sec)]">{section.is_enabled === false ? "Hidden" : "Visible"}</span></button>
          <button type="button" aria-label={section.is_enabled === false ? "Show section" : "Hide section"} onClick={() => onToggleSection(section)} className="rounded p-1">{section.is_enabled === false ? <EyeOff size={12} /> : <Eye size={12} />}</button>
          <button type="button" aria-label="Save section as reusable" onClick={() => onSaveReusable(section)} className="rounded p-1 opacity-0 group-hover:opacity-100 focus:opacity-100"><BookmarkPlus size={12} /></button>
          <button type="button" aria-label="Duplicate section" onClick={() => onDuplicateSection(section)} className="rounded p-1 opacity-0 group-hover:opacity-100 focus:opacity-100"><Copy size={12} /></button>
          <button type="button" aria-label="Delete section" onClick={() => onDeleteSection(section)} className="rounded p-1 text-rose-500 opacity-0 group-hover:opacity-100 focus:opacity-100"><Trash2 size={12} /></button>
        </div>
        {open && section.type === "flexible_grid" ? <div className="border-t border-[var(--color-brd)] p-2"><RecursiveBlockTree blocks={blocks} selection={selection} search={search} onSelect={(id) => onSelect({ type: "block", id })} onMove={(nodeId, target) => onMoveBlock(section.id!, nodeId, target)} onDuplicate={(id) => onDuplicateBlock(section.id!, id)} onDelete={(id) => onDeleteBlock(section.id!, id)} onMeta={(id, meta) => onUpdateBlockMeta(section.id!, id, meta)} onWrap={(id) => onWrapBlock(section.id!, id)} onCopyElement={(id) => onCopyBlock(section.id!, id)} onPasteElement={(id) => onPasteBlock(section.id!, id)} onCopyStyles={(id) => onCopyStyles(section.id!, id)} onPasteStyles={(id) => onPasteStyles(section.id!, id)} onRequestInsert={(parentId) => onRequestInsert(section.id!, parentId)} /></div> : null}
      </div>;
    }}</SortableSection></div> : null)}</div></SortableContext></DndContext></div>
    <div className="border-t border-[var(--color-brd)] p-3"><button type="button" onClick={onOpenSectionLibrary} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-accent)] px-3 py-2 text-xs font-semibold text-white"><Plus size={14} /> Add section{savedSections.length ? ` · ${savedSections.length} saved` : ""}</button></div>
  </aside>;
}
