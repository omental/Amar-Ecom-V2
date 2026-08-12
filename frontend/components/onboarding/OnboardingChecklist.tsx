"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, ChevronRight, X } from "lucide-react";

import { api } from "@/lib/api";
import type { OnboardingProgress } from "@/lib/onboarding";

export function OnboardingChecklist() {
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);

  useEffect(() => {
    let active = true;
    api.get<OnboardingProgress>("/onboarding/progress").then((value) => {
      if (active) setProgress(value);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  async function dismiss() {
    const updated = await api.patch<OnboardingProgress>("/onboarding/progress", { dismissed: true });
    setProgress(updated);
  }

  if (!progress || progress.dismissed_at || progress.status === "completed") return null;

  return (
    <section className="rounded-[28px] border border-[var(--color-brd)] bg-[var(--color-surf)] p-5 shadow-[var(--shadow-subtle)] sm:p-7" aria-labelledby="store-setup-title">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="ops-micro-label">Getting started</p>
          <h2 id="store-setup-title" className="mt-2 text-xl font-bold text-[var(--color-txt-pri)]">Set up your Amar store</h2>
          <p className="mt-2 text-sm text-[var(--color-txt-sec)]">{progress.completion_percent}% complete · each step opens the real workspace.</p>
        </div>
        <button type="button" onClick={() => void dismiss()} aria-label="Dismiss store setup checklist" className="rounded-xl p-2 text-[var(--color-txt-mut)] hover:bg-[var(--color-surf-hover)]"><X className="h-4 w-4" /></button>
      </div>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-[var(--color-surf-hover)]"><div className="h-full rounded-full bg-[var(--color-accent)] transition-[width]" style={{ width: `${progress.completion_percent}%` }} /></div>
      <div className="mt-5 grid gap-2 lg:grid-cols-2">
        {progress.steps.map((step) => (
          <Link key={step.key} href={step.href} className="group flex items-center gap-3 rounded-2xl border border-[var(--color-brd)] px-4 py-3 hover:border-[color-mix(in_srgb,var(--color-accent)_30%,transparent)] hover:bg-[var(--color-surf-hover)]">
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${step.completed ? "bg-emerald-500 text-white" : "border border-[var(--color-brd)] text-transparent"}`}><Check className="h-4 w-4" /></span>
            <span className={`flex-1 text-sm font-semibold ${step.completed ? "text-[var(--color-txt-sec)] line-through" : "text-[var(--color-txt-pri)]"}`}>{step.label}</span>
            <ChevronRight className="h-4 w-4 text-[var(--color-txt-mut)] transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>
    </section>
  );
}
