"use client";

import Link from "next/link";
import { Copy, Eye, Palette, Radio, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { OnlineStoreTabs } from "@/components/dashboard/online-store/OnlineStoreTabs";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading-state";
import { OpsPageHeader } from "@/components/ui/ops-page-header";
import { api, ApiError } from "@/lib/api";
import type { OnlineStoreTheme } from "@/lib/online-store";

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function StorefrontThemesPage() {
  const [themes, setThemes] = useState<OnlineStoreTheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    try { setThemes(await api.get<OnlineStoreTheme[]>("/admin/storefront/themes")); }
    catch (caught) { setError(caught instanceof ApiError ? caught.message : "Could not load themes."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    let active = true;
    api.get<OnlineStoreTheme[]>("/admin/storefront/themes").then((items) => { if (active) setThemes(items); }).catch((caught) => { if (active) setError(caught instanceof ApiError ? caught.message : "Could not load themes."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function duplicate(theme: OnlineStoreTheme) {
    const name = window.prompt("Name the duplicated theme", `${theme.name} copy`);
    if (!name?.trim()) return;
    setBusy(theme.id); setError("");
    try {
      await api.post(`/admin/storefront/themes/${theme.id}/duplicate`, { name: name.trim(), key: `${slugify(name)}-${Date.now().toString(36)}`, version: theme.version, settings: {} });
      setMessage("Independent draft theme created."); await load();
    } catch (caught) { setError(caught instanceof ApiError ? caught.message : "Could not duplicate theme."); }
    finally { setBusy(null); }
  }
  async function publish(theme: OnlineStoreTheme) {
    if (!window.confirm(`Publish “${theme.name}”? The current live theme remains available until publication succeeds.`)) return;
    setBusy(theme.id); setError("");
    try { await api.post(`/admin/storefront/themes/${theme.id}/publish`); setMessage(`${theme.name} is now live.`); await load(); }
    catch (caught) { setError(caught instanceof ApiError ? caught.message : "Could not publish theme."); }
    finally { setBusy(null); }
  }
  async function remove(theme: OnlineStoreTheme) {
    if (!window.confirm(`Delete draft theme “${theme.name}”?`)) return;
    setBusy(theme.id); setError("");
    try { await api.delete(`/admin/storefront/themes/${theme.id}`); await load(); }
    catch (caught) { setError(caught instanceof ApiError ? caught.message : "Could not delete theme."); }
    finally { setBusy(null); }
  }

  if (loading) return <div className="space-y-6"><OpsPageHeader eyebrow="Online Store" title="Themes" description="Loading theme library." /><OnlineStoreTabs /><LoadingState label="Loading themes…" /></div>;
  const current = themes.find((theme) => theme.status === "published");
  const library = themes.filter((theme) => theme.status !== "published");
  return <div className="space-y-6">
    <OpsPageHeader eyebrow="Online Store" title="Themes" description="Manage isolated presentation themes, templates, and global header/footer groups." />
    <OnlineStoreTabs />
    {error ? <ErrorAlert message={error} /> : null}
    {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{message}</div> : null}
    {current ? <section className="rounded-3xl border border-[var(--color-brd)] bg-[var(--color-surf)] p-6 shadow-sm"><p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Current theme</p><ThemeCard theme={current} busy={busy === current.id} onDuplicate={() => void duplicate(current)} /></section> : null}
    <section className="space-y-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--color-txt-sec)]">Theme library</p><h2 className="mt-1 text-xl font-bold">Draft and archived themes</h2></div>{library.length ? <div className="grid gap-4 xl:grid-cols-2">{library.map((theme) => <ThemeCard key={theme.id} theme={theme} busy={busy === theme.id} onDuplicate={() => void duplicate(theme)} onPublish={() => void publish(theme)} onDelete={() => void remove(theme)} />)}</div> : <div className="rounded-2xl border border-dashed border-[var(--color-brd)] p-8 text-center text-sm text-[var(--color-txt-sec)]">Duplicate the current theme to begin an isolated draft.</div>}</section>
  </div>;
}

function ThemeCard({ theme, busy, onDuplicate, onPublish, onDelete }: { theme: OnlineStoreTheme; busy: boolean; onDuplicate: () => void; onPublish?: () => void; onDelete?: () => void }) {
  return <article className="mt-4 rounded-2xl border border-[var(--color-brd)] bg-white p-5"><div className="flex items-start justify-between gap-4"><div className="flex gap-3"><span className="rounded-xl bg-slate-100 p-3"><Palette size={20} /></span><div><h3 className="text-lg font-bold">{theme.name}</h3><p className="mt-1 text-xs text-[var(--color-txt-sec)]">v{theme.version} · {theme.templates.length} templates · {theme.section_groups.length} global groups</p></div></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${theme.status === "published" ? "bg-emerald-100 text-emerald-800" : theme.status === "draft" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}>{theme.status}</span></div>{theme.description ? <p className="mt-4 text-sm leading-6 text-[var(--color-txt-sec)]">{theme.description}</p> : null}<div className="mt-5 flex flex-wrap gap-2">{theme.status === "draft" ? <Link href={`/dashboard/online-store/customize?theme=${theme.id}`} className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white"><Eye size={15} /> Customize</Link> : null}<button type="button" disabled={busy} onClick={onDuplicate} className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-brd)] px-4 py-2 text-sm font-semibold disabled:opacity-50"><Copy size={15} /> Duplicate</button>{onPublish ? <button type="button" disabled={busy} onClick={onPublish} className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-800"><Radio size={15} /> Publish</button> : null}{onDelete ? <button type="button" disabled={busy} onClick={onDelete} className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700"><Trash2 size={15} /> Delete</button> : null}</div></article>;
}
