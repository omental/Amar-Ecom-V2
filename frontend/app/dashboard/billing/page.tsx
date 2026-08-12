"use client";

import Link from "next/link";
import { CreditCard, FileText, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { useEntitlements } from "@/components/dashboard/entitlement-provider";
import { LoadingState } from "@/components/ui/loading-state";
import { OpsPageHeader } from "@/components/ui/ops-page-header";
import { api, getErrorMessage } from "@/lib/api";
import { billingStatusMessage, formatMoney, type BillingInvoice, type BillingSummary } from "@/lib/billing";

export default function BillingPage() {
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [invoices, setInvoices] = useState<BillingInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const { refresh: refreshEntitlements } = useEntitlements();
  const load = useCallback(async () => {
    try {
      const [nextSummary, nextInvoices] = await Promise.all([api.get<BillingSummary>("/billing/summary"), api.get<BillingInvoice[]>("/billing/invoices")]);
      setSummary(nextSummary); setInvoices(nextInvoices);
    } catch (error) { toast.error(getErrorMessage(error, "Billing information could not be loaded.")); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    let active = true;
    Promise.all([api.get<BillingSummary>("/billing/summary"), api.get<BillingInvoice[]>("/billing/invoices")]).then(
      ([nextSummary, nextInvoices]) => { if (active) { setSummary(nextSummary); setInvoices(nextInvoices); setLoading(false); } },
      (error) => { if (active) { toast.error(getErrorMessage(error, "Billing information could not be loaded.")); setLoading(false); } },
    );
    return () => { active = false; };
  }, []);
  async function action(path: string) {
    try { await api.post(path, {}); await load(); await refreshEntitlements(); window.dispatchEvent(new Event("amar:commercial-changed")); toast.success("Billing state updated."); }
    catch (error) { toast.error(getErrorMessage(error)); }
  }
  if (loading) return <LoadingState label="Loading billing…" variant="page" />;
  const subscription = summary?.subscription;
  return <div className="space-y-6">
    <OpsPageHeader eyebrow="Amar Cloud" title="Billing" description="Your Store subscription, renewal state, and immutable Amar billing history." />
    <section className="card-base p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--color-accent)]">Current subscription</p><h2 className="mt-2 text-3xl font-black capitalize">{subscription?.plan_key ?? "Trial / legacy access"}</h2><p className="mt-2 text-sm text-[var(--color-txt-sec)]">{billingStatusMessage(summary)}</p></div>
        <span className="rounded-full bg-[var(--color-surf-hover)] px-3 py-1 text-xs font-black uppercase">{subscription?.status ?? summary?.commercial_status ?? "unavailable"}</span>
      </div>
      {subscription ? <div className="mt-6 grid gap-4 sm:grid-cols-3"><div><p className="text-xs text-[var(--color-txt-mut)]">Price</p><p className="font-black">{formatMoney(subscription.unit_amount, subscription.currency)} / {subscription.billing_cycle}</p></div><div><p className="text-xs text-[var(--color-txt-mut)]">Current period ends</p><p className="font-black">{subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString() : "Pending"}</p></div><div><p className="text-xs text-[var(--color-txt-mut)]">Billing cycle</p><p className="font-black capitalize">{subscription.billing_cycle}</p></div></div> : null}
      <div className="mt-6 flex flex-wrap gap-3"><Link href="/pricing" className="rounded-xl bg-[var(--color-accent)] px-4 py-2.5 text-sm font-bold text-white">Change plan</Link>{subscription && !subscription.cancel_at_period_end ? <button onClick={() => void action("/billing/subscription/cancel")} className="rounded-xl border border-[var(--color-brd)] px-4 py-2.5 text-sm font-bold">Cancel at period end</button> : null}{subscription?.cancel_at_period_end ? <button onClick={() => void action("/billing/subscription/resume")} className="rounded-xl border border-[var(--color-brd)] px-4 py-2.5 text-sm font-bold">Resume subscription</button> : null}<button onClick={() => void load()} aria-label="Refresh billing state" className="rounded-xl border border-[var(--color-brd)] p-2.5"><RefreshCw size={17} /></button></div>
    </section>
    <section className="card-base overflow-hidden"><div className="flex items-center gap-2 border-b border-[var(--color-brd)] p-5"><FileText size={19} /><h2 className="font-black">Invoices</h2></div>{invoices.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-[var(--color-surf-hover)] text-xs uppercase"><tr><th className="p-4">Invoice</th><th className="p-4">Date</th><th className="p-4">Amount</th><th className="p-4">Status</th></tr></thead><tbody>{invoices.map((invoice) => <tr key={invoice.id} className="border-t border-[var(--color-brd)]"><td className="p-4 font-bold"><Link href={`/dashboard/billing/invoices/${invoice.id}`} className="text-[var(--color-accent)] hover:underline">{invoice.invoice_number}</Link></td><td className="p-4">{new Date(invoice.created_at).toLocaleDateString()}</td><td className="p-4">{formatMoney(invoice.total, invoice.currency)}</td><td className="p-4 capitalize">{invoice.status}</td></tr>)}</tbody></table></div> : <div className="p-8 text-center text-sm text-[var(--color-txt-mut)]"><CreditCard className="mx-auto mb-2" />No billing invoices yet. Trial and legacy access do not create fake financial history.</div>}</section>
  </div>;
}
