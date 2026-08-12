"use client";

import Link from "next/link";
import { Check, Clock3, Gauge, InfinityIcon, ShieldCheck } from "lucide-react";

import { useEntitlements } from "@/components/dashboard/entitlement-provider";
import { LoadingState } from "@/components/ui/loading-state";
import { OpsPageHeader } from "@/components/ui/ops-page-header";
import { formatLimit, trialLabel, usagePercent } from "@/lib/commercial";

const usageLabels: Record<string, string> = {
  product_limit: "Products",
  staff_limit: "Staff members",
  warehouse_limit: "Warehouses",
  store_limit: "Stores",
  theme_count_limit: "Themes",
};

export default function PlanUsagePage() {
  const { summary, loading } = useEntitlements();
  if (loading || !summary) return <LoadingState label="Loading commercial access…" variant="page" />;
  const trial = trialLabel(summary);
  const enabledFeatures = Object.entries(summary.entitlements).filter(([, value]) => value === true);

  return (
    <div className="space-y-6">
      <OpsPageHeader eyebrow="Commercial access" title="Plan & Usage" description="Your Store's centrally enforced feature access, trial state, and current capacity." />
      <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="card-base p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--color-accent)]">Current plan</p><h2 className="mt-2 text-3xl font-black">{summary.plan.name}</h2><p className="mt-2 max-w-xl text-sm text-[var(--color-txt-sec)]">{summary.plan.description}</p></div>
            <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${summary.status === "expired" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>{summary.status}</span>
          </div>
          {trial ? <div className="mt-5 flex items-center gap-2 rounded-xl bg-[var(--color-surf-hover)] px-4 py-3 text-sm font-semibold"><Clock3 size={17} />{trial}</div> : null}
          <div className="mt-6 flex flex-wrap gap-3"><Link href="/pricing" className="rounded-xl bg-[var(--color-accent)] px-4 py-2.5 text-sm font-bold text-white">Compare plans</Link><Link href="/dashboard/billing" className="self-center text-sm font-bold text-[var(--color-accent)]">Manage billing</Link></div>
        </div>
        <div className="card-base p-6"><div className="mb-4 flex items-center gap-2"><ShieldCheck size={20} className="text-[var(--color-accent)]" /><h2 className="font-black">Included capabilities</h2></div><div className="space-y-2">{enabledFeatures.slice(0, 8).map(([key]) => <div key={key} className="flex items-center gap-2 text-sm"><Check size={15} className="text-emerald-600" />{key.replaceAll("_", " ")}</div>)}</div></div>
      </section>

      <section className="card-base p-6">
        <div className="mb-5 flex items-center gap-2"><Gauge size={20} className="text-[var(--color-accent)]" /><h2 className="text-lg font-black">Current usage</h2></div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Object.entries(summary.usage).map(([key, item]) => (
            <div key={key} className="rounded-2xl border border-[var(--color-brd)] p-4">
              <div className="flex items-center justify-between gap-3"><p className="font-bold">{usageLabels[key] ?? key}</p><p className={`text-sm font-black ${item.over_limit ? "text-red-600" : "text-[var(--color-txt-sec)]"}`}>{item.usage.toLocaleString()} / {item.limit === null ? <InfinityIcon className="inline" size={16} /> : formatLimit(item.limit)}</p></div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--color-surf-hover)]"><div className={`h-full rounded-full ${item.over_limit ? "bg-red-500" : "bg-[var(--color-accent)]"}`} style={{ width: `${usagePercent(item)}%` }} /></div>
              <p className="mt-2 text-xs text-[var(--color-txt-mut)]">{item.limit === null ? "Unlimited on this assignment" : item.over_limit ? "Over limit—existing data is preserved; new creation is blocked." : `${item.remaining?.toLocaleString()} remaining`}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
