"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { api, getErrorMessage, publicApi } from "@/lib/api";
import { annualSavings, formatMoney, type BillingCycle, type CheckoutSession, type PlanPrice } from "@/lib/billing";
import { formatLimit, type PlanSummary } from "@/lib/commercial";

const visibleFeatures = ["advanced_builder", "custom_fields", "content_models", "product_limit", "staff_limit", "warehouse_limit", "store_limit", "theme_count_limit"];

export default function PricingPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [prices, setPrices] = useState<PlanPrice[]>([]);
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { Promise.all([publicApi.get<PlanSummary[]>("/commercial/plans"), publicApi.get<PlanPrice[]>("/billing/prices")]).then(([nextPlans, nextPrices]) => { setPlans(nextPlans); setPrices(nextPrices); }).catch(() => setError("Plan catalog is temporarily unavailable.")); }, []);
  const priceIndex = useMemo(() => new Map(prices.map((price) => [`${price.plan_id}:${price.billing_cycle}`, price])), [prices]);
  async function choose(plan: PlanSummary) {
    if (!window.localStorage.getItem("amar_token")) { router.push("/signup"); return; }
    const price = priceIndex.get(`${plan.id}:${cycle}`);
    if (!price) { setError("This billing option is not available."); return; }
    setBusy(plan.id); setError(null);
    try {
      const checkout = await api.post<CheckoutSession>("/billing/checkouts", { plan_price_id: price.id, idempotency_key: crypto.randomUUID() });
      if (checkout.checkout_url) window.location.assign(checkout.checkout_url);
      else router.push("/dashboard/billing");
    } catch (cause) { setError(getErrorMessage(cause, "Checkout could not be started.")); setBusy(null); }
  }
  return <main className="min-h-screen bg-slate-950 px-5 py-16 text-white">
    <div className="mx-auto max-w-6xl"><div className="text-center"><div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500"><Sparkles /></div><h1 className="text-4xl font-black sm:text-5xl">Plans built for the Store you are growing</h1><p className="mx-auto mt-4 max-w-2xl text-slate-300">Choose a concrete monthly or annual price. Paid access activates only after Amar receives authoritative provider confirmation.</p><div className="mx-auto mt-6 inline-flex rounded-xl bg-white/10 p-1">{(["monthly", "annual"] as const).map((value) => <button key={value} onClick={() => setCycle(value)} className={`rounded-lg px-4 py-2 text-sm font-bold capitalize ${cycle === value ? "bg-white text-slate-950" : "text-slate-300"}`}>{value}</button>)}</div></div>
      {error ? <p className="mt-8 text-center text-amber-300">{error}</p> : null}
      <div className="mt-12 grid gap-5 md:grid-cols-3">{plans.map((plan) => { const price = priceIndex.get(`${plan.id}:${cycle}`); const monthly = priceIndex.get(`${plan.id}:monthly`); const annual = priceIndex.get(`${plan.id}:annual`); const saving = annualSavings(monthly, annual); return <article key={`${plan.key}-${plan.version}`} className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur"><p className="text-sm font-black uppercase tracking-[0.18em] text-violet-300">{plan.name}</p><h2 className="mt-3 text-2xl font-black">{price ? formatMoney(price.amount, price.currency) : "Contact us"}</h2><p className="text-xs text-slate-400">per {cycle === "annual" ? "year" : "month"}</p>{cycle === "annual" && saving > 0 && annual ? <p className="mt-2 text-xs font-bold text-emerald-300">Save {formatMoney(saving, annual.currency)} versus monthly</p> : null}<p className="mt-3 min-h-12 text-sm text-slate-300">{plan.description}</p>{plan.trial_days > 0 ? <p className="mt-4 text-sm font-bold text-emerald-300">{plan.trial_days}-day trial</p> : null}<ul className="mt-6 space-y-3 text-sm">{visibleFeatures.map((feature) => { const value = plan.entitlements[feature]; if (value === false || value === 0 || value === undefined) return null; return <li key={feature} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-emerald-400" /><span className="capitalize">{feature.replaceAll("_", " ")}{typeof value === "number" || value === null ? `: ${formatLimit(value)}` : ""}</span></li>; })}</ul>{price ? <button disabled={busy === plan.id} onClick={() => void choose(plan)} className="mt-8 flex w-full justify-center rounded-xl bg-white px-4 py-3 font-black text-slate-950 disabled:opacity-60">{busy === plan.id ? "Starting checkout…" : Number(price.amount) === 0 ? "Choose free" : `Choose ${plan.name}`}</button> : <Link href="/signup" className="mt-8 flex w-full justify-center rounded-xl border border-white/20 px-4 py-3 font-black">Contact us</Link>}</article>; })}</div>
    </div>
  </main>;
}
