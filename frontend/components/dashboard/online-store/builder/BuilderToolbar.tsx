"use client";

import { Monitor, Redo2, Smartphone, Tablet, Undo2 } from "lucide-react";

import type { OnlineStorePage } from "@/lib/online-store";
import type { BuilderDevice } from "@/lib/storefront-builder";

import type { BuilderSaveState } from "./types";

const devices = [{ value: "desktop", label: "Desktop", icon: Monitor }, { value: "tablet", label: "Tablet", icon: Tablet }, { value: "mobile", label: "Mobile", icon: Smartphone }] as const;

export function BuilderToolbar({ pages, page, previewResources = [], previewResourceSlug = "", device, saveState, canUndo, canRedo, publishing, onPageChange, onPreviewResourceChange, onDeviceChange, onUndo, onRedo, onSave, onPublish }: {
  pages: OnlineStorePage[];
  page: OnlineStorePage;
  device: BuilderDevice;
  saveState: BuilderSaveState;
  canUndo: boolean;
  canRedo: boolean;
  publishing: boolean;
  onPageChange: (id: string) => void;
  previewResources?: Array<{ slug: string; label: string }>;
  previewResourceSlug?: string;
  onPreviewResourceChange?: (slug: string) => void;
  onDeviceChange: (device: BuilderDevice) => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onPublish: () => void;
}) {
  const stateLabel = saveState === "unsaved" ? "Unsaved changes" : saveState === "saving" ? "Saving…" : saveState === "published" ? "Published" : "Saved";
  return <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-[var(--color-brd)] bg-[var(--color-surf)] px-4 py-3">
    <div className="flex items-center gap-3">
      <select aria-label="Storefront page" value={page.id} onChange={(event) => onPageChange(event.target.value)} className="rounded-xl border border-[var(--color-brd)] bg-white px-3 py-2 text-sm font-semibold outline-none">{pages.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select>
      {previewResources.length ? <select aria-label="Preview resource" value={previewResourceSlug} onChange={(event) => onPreviewResourceChange?.(event.target.value)} className="max-w-56 rounded-xl border border-[var(--color-brd)] bg-white px-3 py-2 text-sm font-semibold outline-none">{previewResources.map((item) => <option key={item.slug} value={item.slug}>{item.label}</option>)}</select> : null}
      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${saveState === "unsaved" ? "bg-amber-100 text-amber-800" : saveState === "saving" ? "bg-sky-100 text-sky-800" : "bg-emerald-100 text-emerald-800"}`}>{stateLabel}</span>
    </div>
    <div className="flex items-center gap-1 rounded-xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] p-1">{devices.map(({ value, label, icon: Icon }) => <button key={value} type="button" aria-label={`${label} preview`} aria-pressed={device === value} onClick={() => onDeviceChange(value)} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${device === value ? "bg-white text-[var(--color-txt-pri)] shadow-sm" : "text-[var(--color-txt-sec)]"}`}><Icon size={15} /><span className="hidden 2xl:inline">{label}</span></button>)}</div>
    <div className="flex items-center gap-2">
      <button type="button" aria-label="Undo" title="Undo (Ctrl/Cmd+Z)" disabled={!canUndo} onClick={onUndo} className="rounded-xl border border-[var(--color-brd)] p-2.5 disabled:opacity-40"><Undo2 size={16} /></button>
      <button type="button" aria-label="Redo" title="Redo (Ctrl/Cmd+Shift+Z)" disabled={!canRedo} onClick={onRedo} className="rounded-xl border border-[var(--color-brd)] p-2.5 disabled:opacity-40"><Redo2 size={16} /></button>
      <button type="button" disabled={saveState !== "unsaved"} onClick={onSave} className="rounded-xl border border-[var(--color-brd)] px-4 py-2 text-sm font-semibold disabled:opacity-50">Save</button>
      <button type="button" disabled={publishing} onClick={onPublish} className="rounded-xl bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{publishing ? "Publishing…" : "Publish"}</button>
    </div>
  </header>;
}
