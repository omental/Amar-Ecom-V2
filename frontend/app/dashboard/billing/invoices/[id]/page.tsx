"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { LoadingState } from "@/components/ui/loading-state";
import { api } from "@/lib/api";
import { formatMoney, type BillingInvoice } from "@/lib/billing";

export default function BillingInvoicePage() {
  const { id } = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<BillingInvoice | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    api.get<BillingInvoice>(`/billing/invoices/${id}`).then(
      (value) => { if (active) setInvoice(value); },
      () => { if (active) setFailed(true); },
    );
    return () => { active = false; };
  }, [id]);
  if (!invoice && !failed) return <LoadingState label="Loading invoice…" variant="page" />;
  if (!invoice) return <div className="card-base p-8"><h1 className="text-xl font-black">Invoice unavailable</h1><p className="mt-2 text-sm text-[var(--color-txt-sec)]">It may not exist in this Store.</p><Link href="/dashboard/billing" className="mt-5 inline-block font-bold text-[var(--color-accent)]">Back to Billing</Link></div>;
  return <div className="space-y-5"><div className="flex items-center justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--color-accent)]">Amar Cloud invoice</p><h1 className="mt-1 text-3xl font-black">{invoice.invoice_number}</h1></div><span className="rounded-full bg-[var(--color-surf-hover)] px-3 py-1 text-xs font-black uppercase">{invoice.status}</span></div><section className="card-base p-6"><div className="grid gap-4 sm:grid-cols-3"><div><p className="text-xs text-[var(--color-txt-mut)]">Issued</p><p className="font-bold">{new Date(invoice.created_at).toLocaleDateString()}</p></div><div><p className="text-xs text-[var(--color-txt-mut)]">Period</p><p className="font-bold">{invoice.period_start ? new Date(invoice.period_start).toLocaleDateString() : "—"} – {invoice.period_end ? new Date(invoice.period_end).toLocaleDateString() : "—"}</p></div><div><p className="text-xs text-[var(--color-txt-mut)]">Total</p><p className="font-black">{formatMoney(invoice.total, invoice.currency)}</p></div></div><div className="mt-6 divide-y divide-[var(--color-brd)] border-y border-[var(--color-brd)]">{invoice.lines.map((line, index) => <div key={`${line.description}-${index}`} className="flex justify-between gap-4 py-4"><div><p className="font-bold">{line.description}</p><p className="text-xs text-[var(--color-txt-mut)]">{line.quantity} × {formatMoney(line.unit_amount, invoice.currency)}</p></div><p className="font-black">{formatMoney(line.amount, invoice.currency)}</p></div>)}</div><div className="ml-auto mt-5 max-w-xs space-y-2 text-sm"><div className="flex justify-between"><span>Paid</span><strong>{formatMoney(invoice.amount_paid, invoice.currency)}</strong></div><div className="flex justify-between"><span>Due</span><strong>{formatMoney(invoice.amount_due, invoice.currency)}</strong></div></div></section><Link href="/dashboard/billing" className="inline-block font-bold text-[var(--color-accent)]">← Back to Billing</Link></div>;
}
