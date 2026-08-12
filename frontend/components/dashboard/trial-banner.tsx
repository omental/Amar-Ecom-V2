"use client";

import Link from "next/link";
import { AlertTriangle, Sparkles } from "lucide-react";

import { trialLabel } from "@/lib/commercial";
import { useEntitlements } from "@/components/dashboard/entitlement-provider";

export function TrialBanner() {
  const { summary, loading } = useEntitlements();
  const label = trialLabel(summary);
  if (loading || !summary || !label) return null;
  const expired = summary.status === "expired";
  if (!expired && (summary.trial.days_remaining ?? 99) > 7) return null;
  const Icon = expired ? AlertTriangle : Sparkles;
  return (
    <div className={`mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm ${expired ? "border-amber-300 bg-amber-50 text-amber-950" : "border-violet-200 bg-violet-50 text-violet-950"}`}>
      <div className="flex items-center gap-2 font-semibold"><Icon size={17} aria-hidden="true" />{label}. Your storefront and existing data remain safe.</div>
      <Link href="/dashboard/plan" className="rounded-lg bg-white px-3 py-1.5 font-bold shadow-sm ring-1 ring-black/5">View plan</Link>
    </div>
  );
}
