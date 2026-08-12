"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Bot, Gauge, LoaderCircle, Save, ShieldCheck } from "lucide-react";

import { useDashboardStore } from "@/components/dashboard/store-provider";
import { useEntitlements } from "@/components/dashboard/entitlement-provider";
import { api, getErrorMessage } from "@/lib/api";
import { aiModeLabel, formatAIUsage, type AISettings, type AIUsage } from "@/lib/ai-commerce";

export default function AIAssistantPage() {
  const { store } = useDashboardStore();
  const { can } = useEntitlements();
  const [form, setForm] = useState<AISettings | null>(null);
  const [usage, setUsage] = useState<AIUsage | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [settings, currentUsage] = await Promise.all([
      api.get<AISettings>("/admin/inbox/ai/settings"),
      api.get<AIUsage>("/admin/inbox/ai/usage"),
    ]);
    setForm(settings); setUsage(currentUsage);
  }, []);
  useEffect(() => { queueMicrotask(() => load().catch((error) => setMessage(getErrorMessage(error, "Could not load Amar AI.")))); }, [load, store.id]);

  async function save() {
    if (!form) return;
    setBusy(true); setMessage(null);
    try {
      const updated = await api.patch<AISettings>("/admin/inbox/ai/settings", {
        enabled: form.mode !== "off", mode: form.mode, tone: form.tone,
        language_preferences: form.language_preferences, merchant_instructions: form.merchant_instructions,
        handoff_rules: form.handoff_rules, disclose_ai: form.disclose_ai,
      });
      setForm(updated); setMessage("Amar AI settings saved.");
    } catch (error) { setMessage(getErrorMessage(error, "Could not save AI settings.")); }
    finally { setBusy(false); }
  }

  if (!form) return <div className="flex min-h-64 items-center justify-center"><LoaderCircle className="animate-spin" /></div>;
  const entitled = can("ai_commerce");
  return <div className="mx-auto max-w-5xl space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><Link href="/dashboard/inbox" className="mb-3 inline-flex items-center gap-1 text-xs font-bold text-[var(--color-accent)]"><ArrowLeft size={14} />Back to Inbox</Link><h1 className="flex items-center gap-2 text-2xl font-black"><Bot />Amar AI Assistant</h1><p className="mt-2 text-sm text-[var(--color-txt-sec)]">Grounded commerce answers through Amar products, inventory, orders, and Store settings.</p></div><span className={`rounded-full px-3 py-1 text-xs font-black ${entitled ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800"}`}>{entitled ? "Included in plan" : "Plan upgrade required"}</span></div>
    {message ? <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">{message}</div> : null}
    {!form.provider_available ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong>AI unavailable.</strong> A production model provider is not configured for this environment. Human Inbox remains fully available.</div> : null}
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <section className="card-base space-y-5 p-5"><div><h2 className="font-black">Operating mode</h2><p className="mt-1 text-xs text-[var(--color-txt-mut)]">Explicit activation is required. Transactional actions are not available.</p></div><div className="grid gap-3 md:grid-cols-3">{(["off", "copilot", "assist"] as const).map((mode) => <button key={mode} type="button" onClick={() => setForm({ ...form, mode, enabled: mode !== "off" })} disabled={!entitled && mode !== "off"} className={`rounded-xl border p-4 text-left ${form.mode === mode ? "border-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-accent)_7%,transparent)]" : "border-[var(--color-brd)]"}`}><span className="font-black">{aiModeLabel(mode)}</span><span className="mt-1 block text-xs leading-5 text-[var(--color-txt-mut)]">{mode === "off" ? "No AI execution." : mode === "copilot" ? "Drafts only; a human sends." : "Safe grounded replies; risky work hands off."}</span></button>)}</div>
        <label className="block text-sm font-bold">Tone<input value={form.tone} maxLength={80} onChange={(event) => setForm({ ...form, tone: event.target.value })} className="mt-2 w-full rounded-xl border border-[var(--color-brd)] bg-transparent px-3 py-2 font-normal" /></label>
        <label className="block text-sm font-bold">Languages<input value={form.language_preferences.join(", ")} onChange={(event) => setForm({ ...form, language_preferences: event.target.value.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 5) })} placeholder="Bangla, English" className="mt-2 w-full rounded-xl border border-[var(--color-brd)] bg-transparent px-3 py-2 font-normal" /></label>
        <label className="block text-sm font-bold">Merchant preferences<textarea value={form.merchant_instructions ?? ""} maxLength={1000} onChange={(event) => setForm({ ...form, merchant_instructions: event.target.value })} rows={5} placeholder="Brand tone and non-security preferences. Amar safety policy always wins." className="mt-2 w-full rounded-xl border border-[var(--color-brd)] bg-transparent px-3 py-2 font-normal" /></label>
        <label className="flex items-center gap-3 text-sm font-bold"><input type="checkbox" checked={form.disclose_ai} onChange={(event) => setForm({ ...form, disclose_ai: event.target.checked })} />Identify autonomous replies as an automated Store assistant</label>
        <button onClick={() => void save()} disabled={busy || !form.provider_available || (!entitled && form.mode !== "off")} className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 py-2 text-sm font-black text-white disabled:opacity-40">{busy ? <LoaderCircle className="animate-spin" size={16} /> : <Save size={16} />}Save settings</button>
      </section>
      <aside className="space-y-4"><section className="card-base p-5"><div className="flex items-center gap-2"><Gauge className="text-[var(--color-accent)]" size={19} /><h2 className="font-black">Usage this month</h2></div><p className="mt-4 text-3xl font-black">{usage ? formatAIUsage(usage) : "—"}</p><p className="mt-1 text-xs text-[var(--color-txt-mut)]">AI message units. Quota exhaustion never blocks human replies.</p><Link href="/dashboard/plan" className="mt-4 inline-block text-xs font-black text-[var(--color-accent)]">Plan & Usage →</Link></section><section className="rounded-2xl border border-blue-200 bg-blue-50 p-5 text-blue-950"><ShieldCheck size={20} /><h2 className="mt-2 font-black">Grounded by Amar</h2><p className="mt-1 text-xs leading-5">The model has no database, SQL, filesystem, shell, arbitrary network, HR, finance, DNS, billing-secret, or provider-credential access.</p></section></aside>
    </div>
  </div>;
}
