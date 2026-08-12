"use client";

import { useCallback, useEffect, useState } from "react";

import { BuilderShell } from "@/components/dashboard/online-store/builder/BuilderShell";
import type { BuilderSaveState, BuilderSelection } from "@/components/dashboard/online-store/builder/types";
import { OnlineStoreTabs } from "@/components/dashboard/online-store/OnlineStoreTabs";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading-state";
import { OpsPageHeader } from "@/components/ui/ops-page-header";
import { useBuilderHistory } from "@/hooks/use-builder-history";
import { api, ApiError } from "@/lib/api";
import type { OnlineStoreMenu, OnlineStoreMenuItem, OnlineStorePage, OnlineStoreSavedSection, OnlineStoreSection, OnlineStoreSettings, OnlineStoreTemplate, OnlineStoreTheme } from "@/lib/online-store";
import { indexBuilderMenus, selectBuilderTheme } from "@/lib/storefront-builder-bootstrap";
import { canAcceptBuilderChild, createBlockFromRegistry } from "@/lib/storefront-block-registry";
import { cloneBlockWithNewIds, cloneSectionWithNewBlockIds, findBuilderBlock, getBuilderBlocks, normalizeBuilderPage, updateBuilderBlock, type BuilderBlock, type BuilderBlockType, type BuilderDevice } from "@/lib/storefront-builder";
import { findBuilderLocation, findBuilderParent, insertTreeNode, moveTreeNode, removeTreeNode, sanitizeTreeRelationships, wrapTreeNode, type BuilderDropTarget } from "@/lib/storefront-builder-tree";
import { copyBuilderStyles, pasteBuilderStyles } from "@/lib/storefront-builder-style";
import { buildSectionFromPreset } from "@/lib/storefront-section-presets";
import type { StoreCategory, StoreProductListResponse } from "@/lib/storefront";

function normalizePageTree(page: OnlineStorePage) {
  const normalized = normalizeBuilderPage(page);
  return { ...normalized, sections: normalized.sections.map((section) => section.type === "flexible_grid" ? { ...section, content: { ...(section.content || {}), blocks: sanitizeTreeRelationships(getBuilderBlocks(section), canAcceptBuilderChild) } } : section) };
}

export default function OnlineStoreCustomizePage() {
  const history = useBuilderHistory<OnlineStorePage>(null);
  const page = history.present;
  const resetHistory = history.reset;
  const undoHistory = history.undo;
  const redoHistory = history.redo;
  const commitHistory = history.commit;
  const [pages, setPages] = useState<OnlineStorePage[]>([]);
  const [theme, setTheme] = useState<OnlineStoreTheme | null>(null);
  const [activeTemplate, setActiveTemplate] = useState<OnlineStoreTemplate | null>(null);
  const [previewResources, setPreviewResources] = useState<Array<{ slug: string; label: string }>>([]);
  const [previewResourceSlug, setPreviewResourceSlug] = useState("");
  const [settings, setSettings] = useState<OnlineStoreSettings | null>(null);
  const [menus, setMenus] = useState<Record<string, OnlineStoreMenuItem[]>>({});
  const [savedSections, setSavedSections] = useState<OnlineStoreSavedSection[]>([]);
  const [selection, setSelection] = useState<BuilderSelection>(null);
  const [clipboard, setClipboard] = useState<BuilderBlock | null>(null);
  const [styleClipboard, setStyleClipboard] = useState<ReturnType<typeof copyBuilderStyles> | null>(null);
  const [device, setDevice] = useState<BuilderDevice>("desktop");
  const [saveState, setSaveState] = useState<BuilderSaveState>("saved");
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const loadSavedSections = useCallback(async () => setSavedSections(await api.get<OnlineStoreSavedSection[]>("/admin/storefront/saved-sections")), []);
  const loadThemeTemplate = useCallback(async (themeId: string, templateId?: string) => {
    const [loadedTheme, styleClasses] = await Promise.all([
      api.get<OnlineStoreTheme>(`/admin/storefront/themes/${themeId}`),
      api.get<NonNullable<OnlineStoreTheme["style_classes"]>>(`/admin/storefront/themes/${themeId}/style-classes`),
    ]);
    loadedTheme.style_classes = styleClasses;
    const target = loadedTheme.templates.find((item) => item.id === templateId)
      || loadedTheme.templates.find((item) => item.resource_type === "home" && item.is_default)
      || loadedTheme.templates[0];
    if (!target) throw new Error("The theme has no storefront templates.");
    const header = loadedTheme.section_groups.find((group) => group.group_type === "header");
    const footer = loadedTheme.section_groups.find((group) => group.group_type === "footer");
    const virtualPages = loadedTheme.templates.map((item) => ({ id: item.id, title: `${item.resource_type.replace("_", " ")} / ${item.name}`, slug: item.key, page_type: item.resource_type, status: loadedTheme.status, sections: item.sections }));
    const virtualPage: OnlineStorePage = { id: target.id, title: `${target.resource_type.replace("_", " ")} / ${target.name}`, slug: target.key, page_type: target.resource_type, status: loadedTheme.status, sections: [...(header?.sections || []), ...target.sections, ...(footer?.sections || [])] };
    let resources: Array<{ slug: string; label: string }> = [];
    if (target.resource_type === "product") {
      const result = await api.get<Array<Pick<StoreProductListResponse["items"][number], "slug" | "name">>>("/products?skip=0&limit=50");
      resources = result.map((item) => ({ slug: item.slug, label: item.name }));
    } else if (target.resource_type === "collection") {
      resources = (await api.get<StoreCategory[]>("/categories?skip=0&limit=100")).map((item) => ({ slug: item.slug, label: item.name }));
    } else if (target.resource_type === "page") {
      resources = (await api.get<OnlineStorePage[]>("/admin/storefront/pages")).filter((item) => item.page_type !== "home").map((item) => ({ slug: item.slug, label: item.title }));
    }
    const normalized = normalizePageTree(virtualPage);
    setTheme(loadedTheme); setActiveTemplate(target); setPages(virtualPages); setPreviewResources(resources); setPreviewResourceSlug(resources[0]?.slug || ""); resetHistory(normalized);
    setSelection(normalized.sections[0]?.id ? { type: "section", id: normalized.sections[0].id } : null);
    setSaveState(JSON.stringify(virtualPage) === JSON.stringify(normalized) ? "saved" : "unsaved");
    return loadedTheme;
  }, [resetHistory]);

  useEffect(() => {
    let active = true;
    async function bootstrap() {
      try {
        const [storeSettings, adminMenus, reusable, themes] = await Promise.all([
          api.get<OnlineStoreSettings>("/admin/storefront/settings"),
          api.get<OnlineStoreMenu[]>("/admin/storefront/menus"),
          api.get<OnlineStoreSavedSection[]>("/admin/storefront/saved-sections"),
          api.get<OnlineStoreTheme[]>("/admin/storefront/themes"),
        ]);
        const requestedThemeId = new URLSearchParams(window.location.search).get("theme");
        const selectedTheme = selectBuilderTheme(themes, requestedThemeId);
        if (!selectedTheme) throw new Error(requestedThemeId ? "The requested storefront theme is unavailable." : "Storefront theme configuration is missing.");
        const loadedTheme = await loadThemeTemplate(selectedTheme.id);
        if (active) { setSettings({ ...storeSettings, ...loadedTheme.settings }); setMenus(indexBuilderMenus(adminMenus)); setSavedSections(reusable); }
      } catch (caught) { if (active) setError(caught instanceof ApiError ? caught.message : caught instanceof Error ? caught.message : "Failed to load Builder V2."); }
      finally { if (active) setLoading(false); }
    }
    void bootstrap();
    return () => { active = false; };
  }, [loadThemeTemplate]);

  useEffect(() => { const protect = (event: BeforeUnloadEvent) => { if (saveState === "unsaved") event.preventDefault(); }; window.addEventListener("beforeunload", protect); return () => window.removeEventListener("beforeunload", protect); }, [saveState]);

  useEffect(() => {
    const shortcuts = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable=true]")) return;
      const key = event.key.toLowerCase();
      if (key === "z") { event.preventDefault(); if (event.shiftKey) redoHistory(); else undoHistory(); setSaveState("unsaved"); return; }
      if (key === "c" && selection?.type === "block" && page) {
        const owner = page.sections.find((section) => findBuilderBlock(getBuilderBlocks(section), selection.id));
        const node = owner && findBuilderBlock(getBuilderBlocks(owner), selection.id);
        if (node) { event.preventDefault(); setClipboard(structuredClone(node)); setSuccess("Block copied."); }
      }
      if (key === "v" && clipboard && page) {
        event.preventDefault();
        const owner = selection?.type === "section" ? page.sections.find((section) => section.id === selection.id) : selection?.type === "block" ? page.sections.find((section) => findBuilderBlock(getBuilderBlocks(section), selection.id)) : null;
        if (!owner?.id || owner.type !== "flexible_grid") return;
        const blocks = getBuilderBlocks(owner);
        const selectedNode = selection?.type === "block" ? findBuilderBlock(blocks, selection.id) : null;
        const parent = selectedNode && canAcceptBuilderChild(selectedNode, clipboard) ? selectedNode : selectedNode ? findBuilderParent(blocks, selectedNode.id) : null;
        if (!canAcceptBuilderChild(parent, clipboard)) { setError("Copied block is not compatible with the selected parent."); return; }
        const clone = cloneBlockWithNewIds(clipboard);
        const next = insertTreeNode(blocks, parent?.id || null, parent?.children.length || blocks.length, clone);
        commitHistory((current) => ({ ...current, sections: current.sections.map((section) => section.id === owner!.id ? { ...section, content: { ...(section.content || {}), blocks: next } } : section) }));
        setSelection({ type: "block", id: clone.id }); setSaveState("unsaved"); setSuccess("Block pasted with new IDs.");
      }
      if (key === "d" && selection?.type === "block") { const owner = ownerForNode(selection.id); if (owner?.id) { event.preventDefault(); duplicateBlock(owner.id, selection.id); } }
    };
    window.addEventListener("keydown", shortcuts);
    return () => window.removeEventListener("keydown", shortcuts);
  });

  useEffect(() => {
    const destructiveShortcuts = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable=true]")) return;
      if ((event.key === "Delete" || event.key === "Backspace") && selection?.type === "block") { const owner = ownerForNode(selection.id); const node = owner && findBuilderBlock(getBuilderBlocks(owner), selection.id); if (owner?.id && node && !node.meta.locked) { event.preventDefault(); deleteBlock(owner.id, node.id); } }
      if (event.key === "Escape") setSelection(null);
    };
    window.addEventListener("keydown", destructiveShortcuts); return () => window.removeEventListener("keydown", destructiveShortcuts);
  });

  function mutate(updater: (current: OnlineStorePage) => OnlineStorePage) { commitHistory(updater); setSaveState("unsaved"); setSuccess(""); }
  function updateBlocks(sectionId: string, blocks: BuilderBlock[]) { mutate((current) => ({ ...current, sections: current.sections.map((section) => section.id === sectionId ? { ...section, content: { ...(section.content || {}), blocks } } : section) })); }
  function ownerForNode(id: string) { return page?.sections.find((section) => findBuilderBlock(getBuilderBlocks(section), id)); }

  async function persistPage(target: OnlineStorePage) {
    if (!target.id) return;
    await Promise.all(target.sections.filter((section) => section.id).map((section) => api.put(`/admin/storefront/sections/${section.id}`, { title: section.title, subtitle: section.subtitle, is_enabled: section.is_enabled, settings: section.settings || {}, content: section.content || {} })));
    if (theme && activeTemplate) {
      await api.post(`/admin/storefront/templates/${activeTemplate.id}/sections/reorder`, { ordered_ids: target.sections.filter((section) => section.template_id === activeTemplate.id).flatMap((section) => section.id ? [section.id] : []) });
      for (const group of theme.section_groups) await api.post(`/admin/storefront/section-groups/${group.id}/sections/reorder`, { ordered_ids: target.sections.filter((section) => section.section_group_id === group.id).flatMap((section) => section.id ? [section.id] : []) });
    } else await api.post(`/admin/storefront/pages/${target.id}/sections/reorder`, { ordered_ids: target.sections.flatMap((section) => section.id ? [section.id] : []) });
  }

  async function reloadCurrent(targetId?: string) { if (!theme) throw new Error("Storefront theme configuration is missing."); await loadThemeTemplate(theme.id, targetId || activeTemplate?.id); }
  async function save() { if (!page) return false; setError(""); setSaveState("saving"); try { await persistPage(page); await reloadCurrent(page.id); setSaveState("saved"); setSuccess(theme ? "Theme draft saved." : "Storefront configuration saved."); return true; } catch (caught) { setSaveState("unsaved"); setError(caught instanceof ApiError ? caught.message : "Failed to save storefront changes."); return false; } }
  async function publish() { if (!page?.id) return; setPublishing(true); setError(""); try { if (saveState === "unsaved" && !(await save())) return; const response = theme ? await api.post<{ message?: string }>(`/admin/storefront/themes/${theme.id}/publish`) : await api.post<{ message?: string }>(`/admin/storefront/pages/${page.id}/publish`); await reloadCurrent(page.id); setSaveState("published"); setSuccess(response.message || (theme ? "Theme published." : "Storefront page published.")); } catch (caught) { setError(caught instanceof ApiError ? caught.message : "Failed to publish storefront changes."); } finally { setPublishing(false); } }
  async function withPersistedStructure(action: () => Promise<void>) { if (!page) return; try { setError(""); if (saveState === "unsaved") await persistPage(page); await action(); await reloadCurrent(page.id); } catch (caught) { setError(caught instanceof ApiError ? caught.message : "Could not update storefront structure."); } }

  function updateSection(section: OnlineStoreSection) { mutate((current) => ({ ...current, sections: current.sections.map((item) => item.id === section.id ? section : item) })); }
  function updateBlock(sectionId: string, blockId: string, updater: (block: BuilderBlock) => BuilderBlock) { const section = page?.sections.find((item) => item.id === sectionId); if (section) updateBlocks(sectionId, updateBuilderBlock(getBuilderBlocks(section), blockId, updater)); }
  function moveBlock(sectionId: string, nodeId: string, target: BuilderDropTarget) { const section = page?.sections.find((item) => item.id === sectionId); if (!section) return; const source = findBuilderBlock(getBuilderBlocks(section), nodeId); if (source?.meta.locked) { setError("Unlock this node before moving it."); return; } const result = moveTreeNode(getBuilderBlocks(section), nodeId, target, canAcceptBuilderChild); if (!result.moved) { setError(result.reason || "Invalid block drop."); return; } updateBlocks(sectionId, result.tree); }
  function duplicateBlock(sectionId: string, blockId: string) { const section = page?.sections.find((item) => item.id === sectionId); if (!section) return; const blocks = getBuilderBlocks(section); const block = findBuilderBlock(blocks, blockId); const location = findBuilderLocation(blocks, blockId); if (!block || !location) return; const clone = cloneBlockWithNewIds(block); updateBlocks(sectionId, insertTreeNode(blocks, location.parentId, location.index + 1, clone)); setSelection({ type: "block", id: clone.id }); }
  function deleteBlock(sectionId: string, blockId: string) { const section = page?.sections.find((item) => item.id === sectionId); if (!section) return; const blocks = getBuilderBlocks(section); const node = findBuilderBlock(blocks, blockId); if (node?.meta.locked) { setError("Unlock this node before deleting it."); return; } const parent = findBuilderParent(blocks, blockId); const removed = removeTreeNode(blocks, blockId); if (!removed.node) return; updateBlocks(sectionId, removed.tree); setSelection(parent ? { type: "block", id: parent.id } : { type: "section", id: sectionId }); }
  function updateBlockMeta(sectionId: string, blockId: string, meta: BuilderBlock["meta"]) { updateBlock(sectionId, blockId, (block) => ({ ...block, meta })); }
  function wrapBlock(sectionId: string, blockId: string) { const section = page?.sections.find((item) => item.id === sectionId); if (!section) return; const wrapper = createBlockFromRegistry("div"); wrapper.meta.label = "Wrapper"; const result = wrapTreeNode(getBuilderBlocks(section), blockId, wrapper); if (result.moved) { updateBlocks(sectionId, result.tree); setSelection({ type: "block", id: wrapper.id }); } }
  function copyBlock(sectionId: string, blockId: string) { const section = page?.sections.find((item) => item.id === sectionId); const block = section && findBuilderBlock(getBuilderBlocks(section), blockId); if (block) { setClipboard(structuredClone(block)); setSuccess("Block copied."); } }
  function pasteBlock(sectionId: string, targetId: string) { const section = page?.sections.find((item) => item.id === sectionId); if (!section || !clipboard) { setError("Copy a block first."); return; } const blocks = getBuilderBlocks(section); const target = findBuilderBlock(blocks, targetId); if (!target) return; const parent = canAcceptBuilderChild(target, clipboard) ? target : findBuilderParent(blocks, target.id); if (!canAcceptBuilderChild(parent, clipboard)) { setError("Copied block is not compatible with this location."); return; } const clone = cloneBlockWithNewIds(clipboard); const location = findBuilderLocation(blocks, target.id); const index = parent?.id === target.id ? target.children.length : (location?.index ?? blocks.length - 1) + 1; updateBlocks(sectionId, insertTreeNode(blocks, parent?.id || null, index, clone)); setSelection({ type: "block", id: clone.id }); }
  function copyStyles(sectionId: string, blockId: string) { const section = page?.sections.find((item) => item.id === sectionId); const block = section && findBuilderBlock(getBuilderBlocks(section), blockId); if (block) { setStyleClipboard(copyBuilderStyles(block)); setSuccess("Styles copied."); } }
  function pasteStyles(sectionId: string, blockId: string) { if (!styleClipboard) { setError("Copy styles from another node first."); return; } updateBlock(sectionId, blockId, (block) => pasteBuilderStyles(block, styleClipboard)); setSuccess("Styles pasted."); }
  function insertBlock(sectionId: string, parentId: string | null, type: BuilderBlockType) { const section = page?.sections.find((item) => item.id === sectionId); if (!section) return; const blocks = getBuilderBlocks(section); const parent = parentId ? findBuilderBlock(blocks, parentId) : null; const block = createBlockFromRegistry(type); if (!canAcceptBuilderChild(parent, block)) { setError("That block cannot be inserted into the selected parent."); return; } updateBlocks(sectionId, insertTreeNode(blocks, parentId, parent?.children.length || blocks.length, block)); setSelection({ type: "block", id: block.id }); }
  function updateInlineText(id: string, text: string) { const owner = ownerForNode(id); if (owner?.id) updateBlock(owner.id, id, (block) => ({ ...block, props: { ...block.props, text } })); }

  async function saveReusable(section: OnlineStoreSection) { const name = window.prompt("Name this reusable section", section.title || "Reusable section"); if (!name?.trim()) return; try { await api.post("/admin/storefront/saved-sections", { name: name.trim(), description: section.subtitle || null, category: section.type, snapshot: section }); await loadSavedSections(); setSuccess("Reusable section saved."); } catch (caught) { setError(caught instanceof ApiError ? caught.message : "Could not save reusable section."); } }
  function insertSaved(item: OnlineStoreSavedSection) { if (!page?.id) return; void withPersistedStructure(async () => { const clone = cloneSectionWithNewBlockIds({ ...item.snapshot, id: undefined }); const owner = theme && activeTemplate ? `/admin/storefront/templates/${activeTemplate.id}/sections` : `/admin/storefront/pages/${page.id}/sections`; await api.post(owner, { type: clone.type, title: clone.title, subtitle: clone.subtitle, is_enabled: clone.is_enabled ?? true, settings: clone.settings || {}, content: clone.content || {} }); }); }
  async function deleteSaved(item: OnlineStoreSavedSection) { if (!window.confirm(`Delete saved section “${item.name}”?`)) return; try { await api.delete(`/admin/storefront/saved-sections/${item.id}`); await loadSavedSections(); } catch (caught) { setError(caught instanceof ApiError ? caught.message : "Could not delete reusable section."); } }

  const effectiveSelection = selection?.type === "section" ? (page?.sections.some((section) => section.id === selection.id) ? selection : null) : selection?.type === "block" ? (ownerForNode(selection.id) ? selection : null) : null;
  if (loading) return <div className="space-y-6"><OpsPageHeader eyebrow="Online Store" title="Builder V2" description="Loading the recursive visual storefront builder." /><OnlineStoreTabs /><LoadingState label="Loading Builder V2…" /></div>;
  return <div className="space-y-5"><OpsPageHeader eyebrow="Online Store" title="Builder V2" description="Author the real storefront with safe recursive responsive layouts." /><OnlineStoreTabs />{error ? <ErrorAlert message={error} /> : null}{success ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{success}</div> : null}
    {page && settings ? <BuilderShell pages={pages} page={page} settings={settings} menus={menus} theme={theme} template={activeTemplate} previewResources={previewResources} previewResourceSlug={previewResourceSlug} savedSections={savedSections} device={device} selection={effectiveSelection} saveState={saveState} canUndo={history.canUndo} canRedo={history.canRedo} publishing={publishing} refreshKey={refreshKey}
      onPreviewResourceChange={setPreviewResourceSlug}
      onThemeChange={setTheme}
      onPageChange={(id) => { if (saveState === "unsaved" && !window.confirm("Discard unsaved changes and open another template?")) return; if (theme) void loadThemeTemplate(theme.id, id); }} onDeviceChange={setDevice} onSelection={setSelection} onUndo={() => { undoHistory(); setSaveState("unsaved"); }} onRedo={() => { redoHistory(); setSaveState("unsaved"); }} onSave={() => void save()} onPublish={() => void publish()} onRefresh={() => setRefreshKey((value) => value + 1)}
      onReorderSections={(sections) => mutate((current) => ({ ...current, sections }))} onMoveBlock={moveBlock} onUpdateSection={updateSection} onUpdateBlock={updateBlock} onToggleSection={(section) => updateSection({ ...section, is_enabled: section.is_enabled === false })}
      onDuplicateSection={(section) => void withPersistedStructure(async () => { if (page.id) { const clone = cloneSectionWithNewBlockIds(section); const owner = section.template_id ? `/admin/storefront/templates/${section.template_id}/sections` : section.section_group_id ? `/admin/storefront/section-groups/${section.section_group_id}/sections` : `/admin/storefront/pages/${page.id}/sections`; await api.post(owner, { type: clone.type, title: `${clone.title || "Section"} copy`, subtitle: clone.subtitle, is_enabled: clone.is_enabled, settings: clone.settings || {}, content: clone.content || {} }); } })}
      onDeleteSection={(section) => { if (section.id && window.confirm(`Delete ${section.title || "this section"}?`)) void withPersistedStructure(() => api.delete(`/admin/storefront/sections/${section.id}`)); }} onSaveReusable={(section) => void saveReusable(section)} onDuplicateBlock={duplicateBlock} onDeleteBlock={deleteBlock} onInsertBlock={insertBlock}
      onUpdateBlockMeta={updateBlockMeta} onWrapBlock={wrapBlock} onCopyBlock={copyBlock} onPasteBlock={pasteBlock} onCopyStyles={copyStyles} onPasteStyles={pasteStyles}
      onCreateSection={(type) => void withPersistedStructure(async () => { if (page.id) await api.post(theme && activeTemplate ? `/admin/storefront/templates/${activeTemplate.id}/sections` : `/admin/storefront/pages/${page.id}/sections`, buildSectionFromPreset(type)); })} onInsertSaved={insertSaved} onDeleteSaved={(item) => void deleteSaved(item)} onUpdateInlineText={updateInlineText} /> : null}
  </div>;
}
