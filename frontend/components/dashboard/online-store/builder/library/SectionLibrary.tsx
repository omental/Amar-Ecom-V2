"use client";

import { useState } from "react";
import { Bookmark, LayoutTemplate, Trash2, X } from "lucide-react";

import type { OnlineStoreSavedSection } from "@/lib/online-store";
import { storefrontSectionPresets } from "@/lib/storefront-section-presets";

export function SectionLibrary({ open, saved, onClose, onCreatePreset, onInsertSaved, onDeleteSaved }: { open: boolean; saved: OnlineStoreSavedSection[]; onClose: () => void; onCreatePreset: (type: string) => void; onInsertSaved: (item: OnlineStoreSavedSection) => void; onDeleteSaved: (item: OnlineStoreSavedSection) => void }) {
  const [tab, setTab] = useState<"sections" | "saved">("sections");
  if (!open) return null;
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/35 p-4" role="dialog" aria-modal="true" aria-label="Section library">
    <div className="w-full max-w-3xl rounded-2xl border border-[var(--color-brd)] bg-white p-5 shadow-2xl">
      <div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-txt-sec)]">Library</p><h2 className="mt-1 text-xl font-bold">Add storefront section</h2></div><button type="button" aria-label="Close section library" onClick={onClose} className="rounded-lg border border-[var(--color-brd)] p-2"><X size={16} /></button></div>
      <div className="mt-4 flex gap-1 rounded-xl bg-[var(--color-surf-hover)] p-1"><button type="button" onClick={() => setTab("sections")} className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${tab === "sections" ? "bg-white shadow-sm" : ""}`}>Sections</button><button type="button" onClick={() => setTab("saved")} className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${tab === "saved" ? "bg-white shadow-sm" : ""}`}>Saved ({saved.length})</button></div>
      <div className="mt-4 grid max-h-[60vh] gap-3 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">{tab === "sections" ? storefrontSectionPresets.map((preset) => <button key={preset.type} type="button" onClick={() => { onCreatePreset(preset.type); onClose(); }} className="rounded-xl border border-[var(--color-brd)] p-4 text-left hover:border-[var(--color-accent)]"><LayoutTemplate size={18} /><span className="mt-3 block text-sm font-bold">{preset.label}</span><span className="mt-1 block text-xs leading-5 text-[var(--color-txt-sec)]">{preset.description}</span></button>) : saved.length ? saved.map((item) => <div key={item.id} className="group relative rounded-xl border border-[var(--color-brd)] p-4"><button type="button" onClick={() => { onInsertSaved(item); onClose(); }} className="w-full text-left"><Bookmark size={18} /><span className="mt-3 block text-sm font-bold">{item.name}</span><span className="mt-1 block text-xs leading-5 text-[var(--color-txt-sec)]">{item.description || item.category}</span></button><button type="button" aria-label={`Delete saved section ${item.name}`} onClick={() => onDeleteSaved(item)} className="absolute right-2 top-2 rounded p-1.5 text-rose-500 opacity-0 group-hover:opacity-100 focus:opacity-100"><Trash2 size={13} /></button></div>) : <p className="col-span-full py-12 text-center text-sm text-[var(--color-txt-sec)]">No reusable sections saved yet.</p>}</div>
    </div>
  </div>;
}
