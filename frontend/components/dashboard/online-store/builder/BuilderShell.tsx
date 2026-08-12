"use client";

import { useState } from "react";

import type { OnlineStoreMenuItem, OnlineStorePage, OnlineStoreSavedSection, OnlineStoreSection, OnlineStoreSettings, OnlineStoreTemplate, OnlineStoreTheme } from "@/lib/online-store";
import { findBuilderBlock, getBuilderBlocks, type BuilderBlock, type BuilderBlockType, type BuilderDevice } from "@/lib/storefront-builder";
import type { BuilderDropTarget } from "@/lib/storefront-builder-tree";

import { BuilderCanvas } from "./BuilderCanvas";
import { BuilderInspector } from "./BuilderInspector";
import { BuilderStructurePanel } from "./BuilderStructurePanel";
import { BuilderToolbar } from "./BuilderToolbar";
import { BlockPicker } from "./library/BlockPicker";
import { SectionLibrary } from "./library/SectionLibrary";
import type { BuilderSaveState, BuilderSelection } from "./types";

type InsertTarget = { sectionId: string; parentId: string | null } | null;

export function BuilderShell({ pages, page, settings, menus, theme, template, previewResources = [], previewResourceSlug = "", savedSections, device, selection, saveState, canUndo, canRedo, publishing, refreshKey, onPageChange, onPreviewResourceChange, onThemeChange, onDeviceChange, onSelection, onUndo, onRedo, onSave, onPublish, onRefresh, onReorderSections, onMoveBlock, onUpdateSection, onUpdateBlock, onToggleSection, onDuplicateSection, onDeleteSection, onSaveReusable, onDuplicateBlock, onDeleteBlock, onUpdateBlockMeta, onWrapBlock, onCopyBlock, onPasteBlock, onCopyStyles, onPasteStyles, onInsertBlock, onCreateSection, onInsertSaved, onDeleteSaved, onUpdateInlineText }: {
  pages: OnlineStorePage[]; page: OnlineStorePage; settings: OnlineStoreSettings; menus: Record<string, OnlineStoreMenuItem[]>; savedSections: OnlineStoreSavedSection[]; device: BuilderDevice; selection: BuilderSelection; saveState: BuilderSaveState; canUndo: boolean; canRedo: boolean; publishing: boolean; refreshKey: number;
  theme?: OnlineStoreTheme | null; template?: OnlineStoreTemplate | null; previewResources?: Array<{ slug: string; label: string }>; previewResourceSlug?: string;
  onPreviewResourceChange?: (slug: string) => void;
  onThemeChange?: (theme: OnlineStoreTheme) => void;
  onPageChange: (id: string) => void; onDeviceChange: (device: BuilderDevice) => void; onSelection: (selection: BuilderSelection) => void; onUndo: () => void; onRedo: () => void; onSave: () => void; onPublish: () => void; onRefresh: () => void;
  onReorderSections: (sections: OnlineStoreSection[]) => void; onMoveBlock: (sectionId: string, nodeId: string, target: BuilderDropTarget) => void; onUpdateSection: (section: OnlineStoreSection) => void; onUpdateBlock: (sectionId: string, blockId: string, updater: (block: BuilderBlock) => BuilderBlock) => void;
  onToggleSection: (section: OnlineStoreSection) => void; onDuplicateSection: (section: OnlineStoreSection) => void; onDeleteSection: (section: OnlineStoreSection) => void; onSaveReusable: (section: OnlineStoreSection) => void; onDuplicateBlock: (sectionId: string, blockId: string) => void; onDeleteBlock: (sectionId: string, blockId: string) => void;
  onInsertBlock: (sectionId: string, parentId: string | null, type: BuilderBlockType) => void; onCreateSection: (type: string) => void; onInsertSaved: (item: OnlineStoreSavedSection) => void; onDeleteSaved: (item: OnlineStoreSavedSection) => void; onUpdateInlineText: (id: string, text: string) => void;
  onUpdateBlockMeta: (sectionId: string, blockId: string, meta: BuilderBlock["meta"]) => void; onWrapBlock: (sectionId: string, blockId: string) => void; onCopyBlock: (sectionId: string, blockId: string) => void; onPasteBlock: (sectionId: string, blockId: string) => void; onCopyStyles: (sectionId: string, blockId: string) => void; onPasteStyles: (sectionId: string, blockId: string) => void;
}) {
  const [insertTarget, setInsertTarget] = useState<InsertTarget>(null);
  const [sectionLibraryOpen, setSectionLibraryOpen] = useState(false);
  function ownerForNode(id: string) { return page.sections.find((section) => findBuilderBlock(getBuilderBlocks(section), id)); }
  function requestInsertForNode(id: string) { const owner = ownerForNode(id); if (owner?.id) setInsertTarget({ sectionId: owner.id, parentId: id }); }
  function duplicateById(id: string) { const owner = ownerForNode(id); if (owner?.id) onDuplicateBlock(owner.id, id); }
  function deleteById(id: string) { const owner = ownerForNode(id); if (owner?.id) onDeleteBlock(owner.id, id); }
  return <div className="overflow-hidden rounded-[24px] border border-[var(--color-brd)] bg-[var(--color-surf)] shadow-sm">
    <BuilderToolbar pages={pages} page={page} previewResources={previewResources} previewResourceSlug={previewResourceSlug} device={device} saveState={saveState} canUndo={canUndo} canRedo={canRedo} publishing={publishing} onPageChange={onPageChange} onPreviewResourceChange={onPreviewResourceChange} onDeviceChange={onDeviceChange} onUndo={onUndo} onRedo={onRedo} onSave={onSave} onPublish={onPublish} />
    <div className="grid min-h-[760px] xl:grid-cols-[280px_minmax(480px,1fr)_330px]">
      <BuilderStructurePanel page={page} selection={selection} savedSections={savedSections} onSelect={onSelection} onReorderSections={onReorderSections} onMoveBlock={onMoveBlock} onToggleSection={onToggleSection} onDuplicateSection={onDuplicateSection} onDeleteSection={onDeleteSection} onSaveReusable={onSaveReusable} onDuplicateBlock={onDuplicateBlock} onDeleteBlock={onDeleteBlock} onUpdateBlockMeta={onUpdateBlockMeta} onWrapBlock={onWrapBlock} onCopyBlock={onCopyBlock} onPasteBlock={onPasteBlock} onCopyStyles={onCopyStyles} onPasteStyles={onPasteStyles} onRequestInsert={(sectionId, parentId) => setInsertTarget({ sectionId, parentId })} onOpenSectionLibrary={() => setSectionLibraryOpen(true)} />
      <BuilderCanvas page={page} settings={settings} menus={menus} themeDefinition={theme} template={template} previewResourceSlug={previewResourceSlug} device={device} selection={selection} onSelect={onSelection} onUpdateText={onUpdateInlineText} onDuplicateNode={duplicateById} onDeleteNode={deleteById} onRequestInsert={requestInsertForNode} onMoveBlock={onMoveBlock} refreshKey={refreshKey} onRefresh={onRefresh} />
      <BuilderInspector page={page} theme={theme} selection={selection} device={device} onThemeChange={onThemeChange} onUpdateSection={onUpdateSection} onUpdateBlock={onUpdateBlock} onRequestInsert={(sectionId, parentId) => setInsertTarget({ sectionId, parentId })} />
    </div>
    <BlockPicker open={Boolean(insertTarget)} resourceType={page.page_type === "custom" ? "page" : page.page_type} parentType={insertTarget?.parentId ? findBuilderBlock(getBuilderBlocks(page.sections.find((item) => item.id === insertTarget.sectionId) || page.sections[0]), insertTarget.parentId)?.type : undefined} onClose={() => setInsertTarget(null)} onInsert={(type) => { if (insertTarget) onInsertBlock(insertTarget.sectionId, insertTarget.parentId, type); }} />
    <SectionLibrary open={sectionLibraryOpen} saved={savedSections} onClose={() => setSectionLibraryOpen(false)} onCreatePreset={onCreateSection} onInsertSaved={onInsertSaved} onDeleteSaved={onDeleteSaved} />
  </div>;
}
