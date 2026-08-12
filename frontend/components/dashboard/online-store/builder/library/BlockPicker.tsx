"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";

import { blockDefinitions, type BlockCategory } from "@/lib/storefront-block-registry";
import type { BuilderBlockType } from "@/lib/storefront-builder";

export function BlockPicker({ open, onClose, onInsert, resourceType = "home", parentType }: { open: boolean; onClose: () => void; onInsert: (type: BuilderBlockType) => void; resourceType?: string; parentType?: string }) {
  const [query, setQuery] = useState("");
  const groups = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filtered = blockDefinitions.filter((item) => (item.category !== "product" || resourceType === "product" || parentType === "query_loop") && (item.category !== "collection" || resourceType === "collection") && (item.category !== "cart" || resourceType === "cart") && (!normalized || `${item.label} ${item.description}`.toLowerCase().includes(normalized)));
    return (["layout", "content", "dynamic", "product", "collection", "cart", "commerce", "apps"] as BlockCategory[]).map((category) => ({ category, items: filtered.filter((item) => item.category === category) })).filter((group) => group.items.length);
  }, [parentType, query, resourceType]);
  if (!open) return null;
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/35 p-4" role="dialog" aria-modal="true" aria-label="Add block">
    <div className="w-full max-w-lg rounded-2xl border border-[var(--color-brd)] bg-white p-4 shadow-2xl">
      <div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-txt-sec)]">Insert</p><h2 className="mt-1 text-lg font-bold">Add block</h2></div><button type="button" aria-label="Close block picker" onClick={onClose} className="rounded-lg border border-[var(--color-brd)] p-2"><X size={15} /></button></div>
      <label className="mt-4 flex items-center gap-2 rounded-xl border border-[var(--color-brd)] px-3"><Search size={15} className="text-[var(--color-txt-sec)]" /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search blocks" className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
      <div className="mt-4 max-h-[55vh] space-y-5 overflow-y-auto">{groups.map((group) => <section key={group.category}><h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-txt-sec)]">{group.category}</h3><div className="grid grid-cols-2 gap-2">{group.items.map((item) => { const Icon = item.icon; return <button key={item.type} type="button" onClick={() => { onInsert(item.type); onClose(); }} className="flex items-start gap-3 rounded-xl border border-[var(--color-brd)] p-3 text-left hover:border-[var(--color-accent)] hover:bg-red-50/40"><Icon size={17} className="mt-0.5 shrink-0" /><span><span className="block text-sm font-semibold">{item.label}</span><span className="mt-1 block text-[11px] leading-4 text-[var(--color-txt-sec)]">{item.description}</span></span></button>; })}</div></section>)}</div>
    </div>
  </div>;
}
