"use client";

import { useEffect, useState } from "react";
import { Copy, Plus, Save, Trash2, X, Zap } from "lucide-react";

import { MediaPicker } from "@/components/dashboard/online-store/MediaPicker";
import { api, ApiError } from "@/lib/api";
import { getBlockDefinition, resolveBuilderBlockProps, type BlockField } from "@/lib/storefront-block-registry";
import type { BuilderBlock, BuilderDevice } from "@/lib/storefront-builder";
import { normalizeStyleSet, resolveNodeStyleRules, type BuilderStyleRules, type BuilderStyleState } from "@/lib/storefront-builder-style";
import type { OnlineStoreStyleClass, OnlineStoreTheme } from "@/lib/online-store";
import { availableDynamicSources, isDynamicValue, type DynamicValueType } from "@/lib/storefront-dynamic";
import type { CustomFieldDefinition } from "@/components/dashboard/online-store/CustomFieldsEditor";
type ContentModelSummary = { key: string; name: string; fields: Array<{ key: string; name: string; value_type: string }> };

import { AdvancedStyleInspector } from "./AdvancedStyleInspector";
import { InspectorField, InspectorGroup, inspectorInputClass } from "./InspectorFields";

function customValueType(value: string): DynamicValueType { if (value === "image") return "image"; if (value === "url") return "url"; if (value === "money") return "money"; if (["integer", "decimal"].includes(value)) return "number"; if (value === "boolean") return "boolean"; if (value === "date") return "date"; return value === "multiline_text" ? "text" : "string"; }

function customSources(resourceType: string, customFields: CustomFieldDefinition[], contentModels: ContentModelSummary[]) { const root = resourceType === "collection" ? "collection" : resourceType === "page" ? "page" : "product"; return customFields.flatMap((item) => { const prefix = ["custom_fields", `${item.namespace}.${item.key}`]; if (item.value_type !== "reference") return [{ key: `${root}.custom.${item.namespace}.${item.key}`, label: `${root[0].toUpperCase() + root.slice(1)} · ${item.name}`, root: root as "product" | "collection" | "page", path: prefix, valueType: customValueType(item.value_type), resourceTypes: [resourceType] }]; const model = contentModels.find((candidate) => candidate.key === item.validation.reference_model_key); return (model?.fields || []).map((field) => ({ key: `${root}.custom.${item.namespace}.${item.key}.${field.key}`, label: `${root[0].toUpperCase() + root.slice(1)} · ${item.name} · ${field.name}`, root: root as "product" | "collection" | "page", path: [...prefix, field.key], valueType: customValueType(field.value_type), resourceTypes: [resourceType] })); }); }

function FieldControl({ field, value, onChange, resourceType = "home", customFields = [], contentModels = [] }: { field: BlockField; value: unknown; onChange: (value: unknown) => void; resourceType?: string; customFields?: CustomFieldDefinition[]; contentModels?: ContentModelSummary[] }) {
  const accepted: DynamicValueType[] = field.type === "media" ? ["image"] : /url|href|link/i.test(field.key) ? ["url"] : field.type === "text" || field.type === "textarea" ? ["string", "text", "money", "number", "date"] : [];
  const sources = [...availableDynamicSources(resourceType, accepted), ...customSources(resourceType, customFields, contentModels).filter((item) => accepted.includes(item.valueType) || (accepted.includes("text") && item.valueType === "string"))];
  if (accepted.length && isDynamicValue(value)) return <InspectorField label={field.label}><div className="space-y-2 rounded-xl border border-violet-200 bg-violet-50 p-3"><div className="flex items-center justify-between text-xs font-bold text-violet-800"><span className="flex items-center gap-1"><Zap size={12}/> Dynamic</span><button type="button" onClick={() => onChange(value.fallback ?? "")} className="rounded bg-white px-2 py-1">Use static</button></div><select aria-label={`${field.label} dynamic source`} className={inspectorInputClass} value={`${value.source.root}:${value.source.path.join(".")}`} onChange={(event) => { const selected = sources.find((item) => `${item.root}:${item.path.join(".")}` === event.target.value); if (selected) onChange({ ...value, source: { root: selected.root, path: selected.path, valueType: selected.valueType } }); }}>{sources.map((item) => <option key={item.key} value={`${item.root}:${item.path.join(".")}`}>{item.label}</option>)}</select><input className={inspectorInputClass} value={String(value.fallback ?? "")} placeholder="Fallback value" onChange={(event) => onChange({ ...value, fallback: event.target.value })}/></div></InspectorField>;
  const dynamicAction = sources.length ? <button type="button" aria-label={`Bind ${field.label} dynamically`} title="Bind dynamic data" onClick={() => { const source = sources[0]; onChange({ kind: "dynamic", source: { root: source.root, path: source.path, valueType: source.valueType }, fallback: value }); }} className="rounded-lg border border-violet-200 bg-violet-50 p-2 text-violet-700"><Zap size={14}/></button> : null;
  if (field.type === "media") return <div className="space-y-2"><MediaPicker label={field.label} mediaType="section" value={String(value || "")} onChange={onChange} />{dynamicAction ? <div className="flex justify-end">{dynamicAction}</div> : null}</div>;
  if (field.type === "textarea") return <InspectorField label={field.label}><textarea className={`${inspectorInputClass} min-h-28`} value={String(value || "")} onChange={(event) => onChange(event.target.value)} /></InspectorField>;
  if (field.type === "select") return <InspectorField label={field.label}><select className={inspectorInputClass} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)}>{field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></InspectorField>;
  if (field.type === "number") return <InspectorField label={field.label}><input type="number" min={field.min} max={field.max} className={inspectorInputClass} value={Number(value) || field.min || 0} onChange={(event) => onChange(Math.max(field.min || 0, Math.min(field.max || Number.MAX_SAFE_INTEGER, Number(event.target.value) || field.min || 0)))} /></InspectorField>;
  if (field.type === "color") return <InspectorField label={field.label}><div className="flex gap-2"><input type="color" value={String(value || "#ffffff")} onChange={(event) => onChange(event.target.value)} className="h-10 w-12 rounded border border-[var(--color-brd)]" /><input className={inspectorInputClass} value={String(value || "")} onChange={(event) => onChange(event.target.value)} placeholder="#ffffff" /></div></InspectorField>;
  return <InspectorField label={field.label}><div className="flex gap-2"><input className={inspectorInputClass} value={String(value || "")} onChange={(event) => onChange(event.target.value)} />{dynamicAction}</div></InspectorField>;
}

type Props = {
  block: BuilderBlock; sectionId: string; theme?: OnlineStoreTheme | null; device: BuilderDevice; resourceType?: string;
  onThemeChange?: (theme: OnlineStoreTheme) => void;
  onChange: (sectionId: string, blockId: string, updater: (block: BuilderBlock) => BuilderBlock) => void;
  onRequestInsert: (sectionId: string, parentId: string | null) => void;
};

export function BlockInspectorPanel({ block, sectionId, theme, device, resourceType, onThemeChange, onChange, onRequestInsert }: Props) {
  const [styleState, setStyleState] = useState<BuilderStyleState>("base");
  const [editingClassId, setEditingClassId] = useState<string | null>(null);
  const [classDraft, setClassDraft] = useState<OnlineStoreStyleClass | null>(null);
  const [classError, setClassError] = useState("");
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([]);
  const [contentModels, setContentModels] = useState<ContentModelSummary[]>([]);
  useEffect(() => { const owner = resourceType === "collection" ? "collection" : resourceType === "page" ? "page" : resourceType === "product" ? "product" : ""; if (!owner) return; let active = true; Promise.all([api.get<CustomFieldDefinition[]>(`/admin/storefront/custom-fields?owner_type=${owner}`), api.get<ContentModelSummary[]>("/admin/storefront/content-models")]).then(([fields, models]) => { if (active) { setCustomFields(fields); setContentModels(models); } }).catch(() => undefined); return () => { active = false; }; }, [resourceType]);
  const definition = getBlockDefinition(block.type);
  if (!definition) return <InspectorGroup title="Unknown block"><p className="text-sm text-amber-800">No inspector schema exists for <code>{block.type}</code>. Its data remains preserved.</p></InspectorGroup>;

  const resolved = resolveBuilderBlockProps(block, device);
  const selectedClass = theme?.style_classes?.find((item) => item.id === editingClassId) || null;
  const activeClass = classDraft?.id === editingClassId ? classDraft : selectedClass;
  const styleSet = normalizeStyleSet(block.style);
  const classBreakpoint = activeClass?.responsive?.[device] as Record<string, BuilderStyleRules> | undefined;
  const currentStyles = activeClass
    ? device === "desktop" ? (styleState === "base" ? activeClass.styles : activeClass.states[styleState] || {}) : classBreakpoint?.[styleState] || {}
    : device === "desktop" ? styleSet[styleState] : ((block.responsive[device].styles as Record<string, BuilderStyleRules> | undefined)?.[styleState] || {});
  const inheritedNode = device === "desktop" ? { ...block, style: { ...styleSet, [styleState]: {} } } : { ...block, responsive: { ...block.responsive, [device]: { ...block.responsive[device], styles: { ...(block.responsive[device].styles as object || {}), [styleState]: {} } } } };
  const inheritedStyles = activeClass ? {} : resolveNodeStyleRules(theme, inheritedNode, device, styleState);
  const imageSources = [...availableDynamicSources(resourceType || "home", ["image"]), ...customSources(resourceType || "home", customFields, contentModels).filter((item) => item.valueType === "image")];
  const backgroundValue = (currentStyles.backgroundImageValue as { url?: unknown } | undefined)?.url;
  const conditionSources = [...availableDynamicSources(resourceType || "home", ["string", "text", "number", "money", "boolean", "date", "url", "image", "color"]), ...customSources(resourceType || "home", customFields, contentModels)];
  const condition = block.props.condition as import("@/lib/storefront-dynamic").StorefrontCondition | undefined;
  const predicate = condition?.conditions[0];

  function updateField(field: BlockField, value: unknown) {
    onChange(sectionId, block.id, (current) => field.responsive && device !== "desktop" ? { ...current, responsive: { ...current.responsive, [device]: { ...current.responsive[device], [field.key]: value } } } : { ...current, props: { ...current.props, [field.key]: value } });
  }
  function updateStyles(rules: BuilderStyleRules) {
    if (activeClass) {
      setClassDraft(device === "desktop" ? styleState === "base" ? { ...activeClass, styles: rules } : { ...activeClass, states: { ...activeClass.states, [styleState]: rules } } : { ...activeClass, responsive: { ...activeClass.responsive, [device]: { ...(activeClass.responsive[device] || {}), [styleState]: rules } } });
      return;
    }
    onChange(sectionId, block.id, (current) => device === "desktop" ? { ...current, style: { ...normalizeStyleSet(current.style), [styleState]: rules } } : { ...current, responsive: { ...current.responsive, [device]: { ...current.responsive[device], styles: { ...(current.responsive[device].styles as object || {}), [styleState]: rules } } } });
  }
  function editClass(item: OnlineStoreStyleClass | null) { setEditingClassId(item?.id || null); setClassDraft(item ? structuredClone(item) : null); setClassError(""); }
  async function createClass() {
    if (!theme || theme.status !== "draft") return;
    const name = window.prompt("Class name", "custom-card"); if (!name?.trim()) return;
    try {
      const created = await api.post<OnlineStoreStyleClass>(`/admin/storefront/themes/${theme.id}/style-classes`, { name: name.trim().replace(/^\./, ""), styles: {}, responsive: {}, states: {} });
      onThemeChange?.({ ...theme, style_classes: [...(theme.style_classes || []), created] });
      onChange(sectionId, block.id, (current) => ({ ...current, class_ids: [...current.class_ids, created.id] })); editClass(created);
    } catch (error) { setClassError(error instanceof ApiError ? error.message : "Could not create style class."); }
  }
  async function saveClass() {
    if (!theme || !classDraft) return;
    try {
      const saved = await api.patch<OnlineStoreStyleClass>(`/admin/storefront/style-classes/${classDraft.id}`, { name: classDraft.name, styles: classDraft.styles, responsive: classDraft.responsive, states: classDraft.states });
      onThemeChange?.({ ...theme, style_classes: (theme.style_classes || []).map((item) => item.id === saved.id ? saved : item) }); setClassDraft(saved);
    } catch (error) { setClassError(error instanceof ApiError ? error.message : "Could not save style class."); }
  }
  async function duplicateClass() {
    if (!theme || !activeClass) return;
    const name = window.prompt("Duplicate class as", `${activeClass.name}-copy`); if (!name?.trim()) return;
    try {
      const duplicate = await api.post<OnlineStoreStyleClass>(`/admin/storefront/style-classes/${activeClass.id}/duplicate`, { name: name.trim().replace(/^\./, ""), styles: {}, responsive: {}, states: {} });
      onThemeChange?.({ ...theme, style_classes: [...(theme.style_classes || []), duplicate] });
      editClass(duplicate);
    } catch (error) { setClassError(error instanceof ApiError ? error.message : "Could not duplicate style class."); }
  }
  async function deleteClass() {
    if (!theme || !activeClass || !window.confirm(`Delete .${activeClass.name}? Classes currently in use must be detached first.`)) return;
    try {
      await api.delete(`/admin/storefront/style-classes/${activeClass.id}`);
      onThemeChange?.({ ...theme, style_classes: (theme.style_classes || []).filter((item) => item.id !== activeClass.id) });
      editClass(null);
    } catch (error) { setClassError(error instanceof ApiError ? error.message : "Could not delete style class."); }
  }

  const contentFields = definition.fields.filter((field) => !field.responsive);
  const responsiveFields = definition.fields.filter((field) => field.responsive);
  return <>
    {theme ? <InspectorGroup title="Global classes"><div className="flex flex-wrap gap-1.5">{block.class_ids.map((id) => { const item = theme.style_classes?.find((value) => value.id === id); return item ? <span key={id} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${editingClassId === id ? "bg-violet-700 text-white" : "bg-violet-100 text-violet-800"}`}><button type="button" onClick={() => editClass(item)}>.{item.name}</button><button type="button" aria-label={`Remove ${item.name}`} onClick={() => { if (editingClassId === id) editClass(null); onChange(sectionId, block.id, (current) => ({ ...current, class_ids: current.class_ids.filter((value) => value !== id) })); }}><X size={11} /></button></span> : null; })}</div><div className="mt-3 flex gap-2"><select aria-label="Add global class" defaultValue="" onChange={(event) => { const id = event.target.value; if (id && !block.class_ids.includes(id)) onChange(sectionId, block.id, (current) => ({ ...current, class_ids: [...current.class_ids, id] })); event.currentTarget.value = ""; }} className={inspectorInputClass}><option value="">Add class…</option>{(theme.style_classes || []).filter((item) => !block.class_ids.includes(item.id)).map((item) => <option key={item.id} value={item.id}>.{item.name} · {item.usage_count || 0} uses</option>)}</select>{theme.status === "draft" ? <button type="button" aria-label="Create global class" onClick={() => void createClass()} className="rounded-xl border border-[var(--color-brd)] px-3"><Plus size={14} /></button> : null}</div>{classError ? <p className="mt-2 text-xs text-rose-700">{classError}</p> : null}</InspectorGroup> : null}
    {contentFields.length ? <InspectorGroup title={definition.category === "layout" ? "Layout preset" : "Content"}>{contentFields.map((field) => <FieldControl key={field.key} field={field} value={block.props[field.key] ?? resolved[field.key]} resourceType={resourceType} customFields={customFields} contentModels={contentModels} onChange={(value) => updateField(field, value)} />)}</InspectorGroup> : null}
    {responsiveFields.length ? <InspectorGroup title={`Block settings · ${device}`}>{responsiveFields.map((field) => <div key={field.key}><FieldControl field={field} value={resolved[field.key]} onChange={(value) => updateField(field, value)} />{device !== "desktop" && block.responsive[device][field.key] === undefined ? <p className="mt-1 text-[10px] text-[var(--color-txt-sec)]">Inherited from {device === "mobile" && block.responsive.tablet[field.key] !== undefined ? "tablet" : "desktop"}</p> : null}</div>)}</InspectorGroup> : null}
    {imageSources.length ? <InspectorGroup title="Dynamic background"><select aria-label="Dynamic background image" className={inspectorInputClass} value={isDynamicValue(backgroundValue) ? `${backgroundValue.source.root}:${backgroundValue.source.path.join(".")}` : ""} onChange={(event) => { const selected = imageSources.find((item) => `${item.root}:${item.path.join(".")}` === event.target.value); const existing = currentStyles.backgroundImageValue as Record<string, unknown> | undefined; updateStyles({ ...currentStyles, backgroundImageValue: { ...(existing || {}), url: selected ? { kind: "dynamic", source: { root: selected.root, path: selected.path, valueType: selected.valueType }, fallback: "" } : "" } }); }}><option value="">Static background image</option>{imageSources.map((item) => <option key={item.key} value={`${item.root}:${item.path.join(".")}`}>{item.label}</option>)}</select></InspectorGroup> : null}
    {conditionSources.length ? <InspectorGroup title="Conditional visibility"><select aria-label="Visibility source" className={inspectorInputClass} value={predicate ? `${predicate.source.root}:${predicate.source.path.join(".")}` : ""} onChange={(event) => { const selected = conditionSources.find((item) => `${item.root}:${item.path.join(".")}` === event.target.value); onChange(sectionId, block.id, (current) => ({ ...current, props: { ...current.props, condition: selected ? { operator: "and", conditions: [{ source: { root: selected.root, path: selected.path, valueType: selected.valueType }, comparison: "exists" }] } : undefined } })); }}><option value="">Always visible</option>{conditionSources.map((item) => <option key={item.key} value={`${item.root}:${item.path.join(".")}`}>{item.label}</option>)}</select>{predicate ? <div className="mt-2 grid gap-2"><select aria-label="Visibility comparison" className={inspectorInputClass} value={predicate.comparison} onChange={(event) => onChange(sectionId, block.id, (current) => ({ ...current, props: { ...current.props, condition: { operator: condition?.operator || "and", conditions: [{ ...predicate, comparison: event.target.value as typeof predicate.comparison }] } } }))}>{["equals", "not_equals", "exists", "not_exists", "greater_than", "less_than", "contains"].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select>{!["exists", "not_exists"].includes(predicate.comparison) ? <input aria-label="Visibility comparison value" className={inspectorInputClass} value={String(predicate.value ?? "")} onChange={(event) => onChange(sectionId, block.id, (current) => ({ ...current, props: { ...current.props, condition: { operator: condition?.operator || "and", conditions: [{ ...predicate, value: event.target.value }] } } }))}/> : null}</div> : null}</InspectorGroup> : null}
    {definition.capabilities.canHaveChildren ? <InspectorGroup title="Children"><button type="button" onClick={() => onRequestInsert(sectionId, block.id)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--color-brd)] px-3 py-3 text-sm font-semibold hover:border-[var(--color-accent)]"><Plus size={14} /> Add child block</button></InspectorGroup> : null}
    <div className="sticky top-0 z-10 space-y-2 border-y border-[var(--color-brd)] bg-white p-3"><div className="flex gap-1"><button type="button" onClick={() => editClass(null)} className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold ${!editingClassId ? "bg-slate-950 text-white" : "bg-slate-100"}`}>Element</button>{selectedClass ? <button type="button" onClick={() => editClass(selectedClass)} className="flex-1 rounded-lg bg-violet-700 px-3 py-2 text-xs font-semibold text-white">Class: .{selectedClass.name}</button> : null}</div>{activeClass ? <div className="flex gap-1"><input aria-label="Global class name" value={classDraft?.name || activeClass.name} onChange={(event) => setClassDraft({ ...activeClass, name: event.target.value.replace(/^\./, "") })} className={`${inspectorInputClass} min-w-0 flex-1`} /><button type="button" aria-label="Duplicate global class" onClick={() => void duplicateClass()} className="rounded-lg border border-[var(--color-brd)] px-2"><Copy size={13} /></button><button type="button" aria-label="Delete global class" onClick={() => void deleteClass()} className="rounded-lg border border-rose-200 px-2 text-rose-700"><Trash2 size={13} /></button></div> : null}<div className="flex gap-1"><button type="button" onClick={() => setStyleState("base")} className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold ${styleState === "base" ? "bg-slate-950 text-white" : "bg-slate-100"}`}>Normal</button><button type="button" onClick={() => setStyleState("hover")} className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold ${styleState === "hover" ? "bg-slate-950 text-white" : "bg-slate-100"}`}>Hover</button>{activeClass ? <button type="button" aria-label="Save global class" onClick={() => void saveClass()} className="rounded-lg bg-violet-700 px-3 text-white"><Save size={14} /></button> : null}</div></div>
    <AdvancedStyleInspector rules={currentStyles} inherited={inheritedStyles} state={styleState} onChange={updateStyles} onClear={() => updateStyles({})} />
    <InspectorGroup title="Legacy placement"><InspectorField label="Flexible Grid column"><input type="number" min={1} max={3} className={inspectorInputClass} value={block.column} onChange={(event) => onChange(sectionId, block.id, (current) => ({ ...current, column: Number(event.target.value) || 1 }))} /></InspectorField></InspectorGroup>
  </>;
}
