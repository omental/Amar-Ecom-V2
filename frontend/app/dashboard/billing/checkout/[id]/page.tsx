"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import type { CheckoutSession } from "@/lib/billing";

export default function TestCheckoutPage() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<CheckoutSession | null>(null);
  const [message, setMessage] = useState("Confirming your payment…");
  useEffect(() => {
    let active = true;
    let attempts = 0;
    const poll = async () => {
      try { const value = await api.get<CheckoutSession>(`/billing/checkouts/${id}`); if (!active) return; setSession(value); if (value.status === "completed") { setMessage("Payment confirmed by Amar billing."); window.dispatchEvent(new Event("amar:commercial-changed")); return; } }
      catch { if (active) setMessage("Payment is still processing."); }
      if (active && attempts++ < 10) window.setTimeout(poll, 1500); else if (active) setMessage("Payment is still processing. You may return to Billing and refresh.");
    }; void poll(); return () => { active = false; };
  }, [id]);
  async function simulate(outcome: "success" | "failed") { setMessage("Confirming your payment…"); await api.post(`/billing/checkouts/${id}/simulate`, { outcome }); const value = await api.get<CheckoutSession>(`/billing/checkouts/${id}`); setSession(value); setMessage(outcome === "success" ? "Payment confirmed by Amar billing." : "Payment failed. No paid access was activated."); if (outcome === "success") window.dispatchEvent(new Event("amar:commercial-changed")); }
  return <div className="mx-auto max-w-xl space-y-5"><div className="card-base p-8 text-center"><h1 className="text-2xl font-black">Test billing provider</h1><p className="mt-3 text-sm text-[var(--color-txt-sec)]">{message}</p><p className="mt-2 text-xs text-[var(--color-txt-mut)]">Session: {session?.status ?? "loading"}</p>{session?.status === "pending" ? <div className="mt-6 flex justify-center gap-3"><button onClick={() => void simulate("success")} className="rounded-xl bg-[var(--color-accent)] px-4 py-2.5 font-bold text-white">Simulate success</button><button onClick={() => void simulate("failed")} className="rounded-xl border border-[var(--color-brd)] px-4 py-2.5 font-bold">Simulate failure</button></div> : null}<Link href="/dashboard/billing" className="mt-6 inline-block text-sm font-bold text-[var(--color-accent)]">Return to Billing</Link></div></div>;
}
