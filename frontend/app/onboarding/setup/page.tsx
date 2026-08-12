"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Store } from "lucide-react";

import { api, getErrorMessage } from "@/lib/api";
import { normalizeStoreSlug, type ProvisionedStoreResponse } from "@/lib/onboarding";
import { setSelectedStoreSlug } from "@/lib/tenant";
import { getHostedStorefrontUrl } from "@/lib/storefront-domain";

export default function ProvisionStorePage() {
  const router = useRouter();
  const [form, setForm] = useState({ business_name: "", store_name: "", store_slug: "", timezone: "Asia/Dhaka", locale: "en-BD", currency: "BDT" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function update(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await api.post<ProvisionedStoreResponse>("/onboarding/provision", {
        ...form,
        store_slug: normalizeStoreSlug(form.store_slug),
      });
      setSelectedStoreSlug(response.store.slug);
      router.replace("/dashboard");
      router.refresh();
    } catch (cause) {
      setError(getErrorMessage(cause, "Your store could not be provisioned."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-white">
      <div className="w-full max-w-2xl rounded-[32px] border border-white/10 bg-white p-8 text-slate-950 shadow-2xl sm:p-12">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white"><Store className="h-6 w-6" /></div>
        <h1 className="mt-6 text-3xl font-semibold">Create your first store</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">Your account is ready, but it does not have a store workspace yet.</p>
        <form onSubmit={submit} className="mt-8 grid gap-5">
          <Input label="Business name" value={form.business_name} onChange={(value) => update("business_name", value)} />
          <Input label="Store name" value={form.store_name} onChange={(value) => update("store_name", value)} />
          <Input label="Desired store URL" value={form.store_slug} onChange={(value) => update("store_slug", value)} hint={getHostedStorefrontUrl(normalizeStoreSlug(form.store_slug) || "your-store")} />
          <div className="grid gap-5 sm:grid-cols-3">
            <Select label="Timezone" value={form.timezone} onChange={(value) => update("timezone", value)} values={["Asia/Dhaka", "Asia/Kolkata", "UTC", "America/New_York"]} />
            <Select label="Locale" value={form.locale} onChange={(value) => update("locale", value)} values={["en-BD", "bn-BD", "en-US"]} />
            <Select label="Currency" value={form.currency} onChange={(value) => update("currency", value)} values={["BDT", "USD", "INR", "EUR"]} />
          </div>
          {error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div> : null}
          <button disabled={submitting} className="mt-2 rounded-xl bg-slate-950 px-5 py-3.5 text-sm font-semibold text-white disabled:opacity-50">{submitting ? "Preparing your workspace…" : "Create Store"}</button>
        </form>
      </div>
    </main>
  );
}

function Input({ label, value, onChange, hint }: { label: string; value: string; onChange: (value: string) => void; hint?: string }) {
  return <label><span className="mb-2 block text-sm font-medium">{label}</span><input required minLength={2} value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-500" />{hint ? <span className="mt-2 block text-xs text-slate-400">{hint}</span> : null}</label>;
}

function Select({ label, value, onChange, values }: { label: string; value: string; onChange: (value: string) => void; values: string[] }) {
  return <label><span className="mb-2 block text-sm font-medium">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm">{values.map((item) => <option key={item}>{item}</option>)}</select></label>;
}
