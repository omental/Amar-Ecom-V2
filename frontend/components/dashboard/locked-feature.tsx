"use client";

import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import type { ReactNode } from "react";

import { useEntitlements } from "@/components/dashboard/entitlement-provider";

export function LockedFeature({ feature, children, label }: { feature: string; children: ReactNode; label: string }) {
  const { can, loading } = useEntitlements();
  if (loading || can(feature)) return <>{children}</>;
  return (
    <div className="rounded-2xl border border-dashed border-[var(--color-brd)] bg-[var(--color-surf)] p-6 text-center">
      <LockKeyhole className="mx-auto mb-3 text-[var(--color-txt-mut)]" size={24} />
      <p className="font-bold">{label} is not included in your current access.</p>
      <p className="mt-1 text-sm text-[var(--color-txt-sec)]">Your existing storefront content remains published and safe.</p>
      <Link className="mt-4 inline-flex rounded-xl bg-[var(--color-accent)] px-4 py-2 text-sm font-bold text-white" href="/dashboard/plan">Compare plans</Link>
    </div>
  );
}
