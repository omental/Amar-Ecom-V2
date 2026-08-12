"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, Store } from "lucide-react";

import { ApiError, publicApi } from "@/lib/api";
import { saveToken, saveUser, type AuthUser } from "@/lib/auth";
import { type MerchantSignupResponse, normalizeStoreSlug, type SlugAvailability } from "@/lib/onboarding";
import { setSelectedStoreSlug } from "@/lib/tenant";

type VerifyResponse = { access_token: string; user: AuthUser; permissions: string[] };

const initialForm = {
  full_name: "",
  email: "",
  password: "",
  confirm_password: "",
  business_name: "",
  store_name: "",
  store_slug: "",
  timezone: "Asia/Dhaka",
  locale: "en-BD",
  currency: "BDT",
};

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(initialForm);
  const [availability, setAvailability] = useState<SlugAvailability | null>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [pendingVerification, setPendingVerification] = useState<MerchantSignupResponse | null>(null);
  const normalizedStoreSlug = normalizeStoreSlug(form.store_slug);
  const currentAvailability = availability?.slug === normalizedStoreSlug ? availability : null;

  useEffect(() => {
    const slug = normalizeStoreSlug(form.store_slug);
    if (slug.length < 2) {
      return;
    }
    const timeout = window.setTimeout(async () => {
      setCheckingSlug(true);
      try {
        setAvailability(await publicApi.get<SlugAvailability>(`/onboarding/slug-availability?slug=${encodeURIComponent(slug)}`));
      } catch {
        setAvailability(null);
      } finally {
        setCheckingSlug(false);
      }
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [form.store_slug]);

  function update(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function continueStep() {
    setError("");
    if (step === 1) {
      if (form.full_name.trim().length < 2 || !form.email.includes("@") || form.password.length < 8) {
        setError("Enter your name, a valid email address, and a password of at least 8 characters.");
        return;
      }
      if (form.password !== form.confirm_password) {
        setError("Passwords do not match.");
        return;
      }
    }
    if (step === 2) {
      if (form.business_name.trim().length < 2 || form.store_name.trim().length < 2) {
        setError("Enter both your business name and store name.");
        return;
      }
      if (!currentAvailability?.available) {
        setError("Choose an available store URL before continuing.");
        return;
      }
    }
    setStep((current) => Math.min(3, current + 1));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const signup = await publicApi.post<MerchantSignupResponse>("/onboarding/signup", {
        ...form,
        email: form.email.trim().toLowerCase(),
        store_slug: normalizeStoreSlug(form.store_slug),
      });
      if (!signup.verification_token) {
        setPendingVerification(signup);
        return;
      }
      const verified = await publicApi.post<VerifyResponse>("/onboarding/verify-email", { token: signup.verification_token });
      saveToken(verified.access_token);
      saveUser({ ...verified.user, permissions: verified.permissions });
      setSelectedStoreSlug(signup.store_slug);
      router.replace("/dashboard");
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Your Amar store could not be created. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (pendingVerification) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-12 text-white">
        <div className="w-full max-w-lg rounded-[32px] border border-white/10 bg-white/5 p-10 text-center shadow-2xl backdrop-blur">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
          <h1 className="mt-6 text-3xl font-semibold">Your store is provisioned</h1>
          <p className="mt-4 text-sm leading-6 text-slate-300">{pendingVerification.message}</p>
          <p className="mt-3 text-xs text-slate-400">Storefront URL: {pendingVerification.storefront_url}</p>
          <Link href="/login" className="mt-8 inline-flex rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950">Return to sign in</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white sm:px-6">
      <div className="mx-auto grid max-w-6xl overflow-hidden rounded-[36px] border border-white/10 bg-slate-900 shadow-2xl lg:grid-cols-[0.8fr_1.2fr]">
        <aside className="bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-8 sm:p-10">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-950"><Store className="h-6 w-6" /></div>
          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.3em] text-blue-300">Amar Cloud</p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight">Build your commerce operation in minutes.</h1>
          <p className="mt-5 text-sm leading-7 text-slate-300">Your organization, isolated store, storefront theme, templates, settings, and owner access are prepared together.</p>
          <div className="mt-10 space-y-3">
            {["Account", "Business and store", "Region and launch"].map((label, index) => (
              <div key={label} className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm ${step === index + 1 ? "border-blue-400/50 bg-blue-400/10 text-white" : "border-white/10 text-slate-400"}`}>
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-xs">{index + 1}</span>{label}
              </div>
            ))}
          </div>
        </aside>

        <section className="bg-white p-6 text-slate-950 sm:p-10 lg:p-14">
          <form onSubmit={submit} className="mx-auto max-w-xl space-y-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Step {step} of 3</p>
              <h2 className="mt-3 text-3xl font-semibold">{step === 1 ? "Create your account" : step === 2 ? "Name your business" : "Choose your region"}</h2>
            </div>

            {step === 1 ? <div className="grid gap-5">
              <Field label="Your name"><input required minLength={2} value={form.full_name} onChange={(e) => update("full_name", e.target.value)} /></Field>
              <Field label="Email address"><input required type="email" value={form.email} onChange={(e) => update("email", e.target.value)} /></Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Password"><input required minLength={8} maxLength={72} type="password" value={form.password} onChange={(e) => update("password", e.target.value)} /></Field>
                <Field label="Confirm password"><input required minLength={8} maxLength={72} type="password" value={form.confirm_password} onChange={(e) => update("confirm_password", e.target.value)} /></Field>
              </div>
            </div> : null}

            {step === 2 ? <div className="grid gap-5">
              <Field label="Business name"><input required minLength={2} value={form.business_name} onChange={(e) => update("business_name", e.target.value)} /></Field>
              <Field label="Store name"><input required minLength={2} value={form.store_name} onChange={(e) => update("store_name", e.target.value)} /></Field>
              <Field label="Desired store URL">
                <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 pr-3 focus-within:border-slate-400">
                  <input required value={form.store_slug} onChange={(e) => update("store_slug", e.target.value)} className="border-0 bg-transparent" />
                  <span className="whitespace-nowrap text-xs text-slate-400">.amar-ecom.com</span>
                </div>
                <p className={`mt-2 text-xs ${availability?.available ? "text-emerald-600" : "text-slate-500"}`}>
                  {checkingSlug ? "Checking availability…" : currentAvailability ? currentAvailability.available ? `${currentAvailability.slug} is available` : "This URL is unavailable or reserved" : "This is your future Amar store URL; hosted DNS arrives in a later phase."}
                </p>
              </Field>
            </div> : null}

            {step === 3 ? <div className="grid gap-5">
              <Field label="Timezone"><select value={form.timezone} onChange={(e) => update("timezone", e.target.value)}><option value="Asia/Dhaka">Asia/Dhaka</option><option value="Asia/Kolkata">Asia/Kolkata</option><option value="UTC">UTC</option><option value="America/New_York">America/New_York</option></select></Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Locale"><select value={form.locale} onChange={(e) => update("locale", e.target.value)}><option value="en-BD">English (Bangladesh)</option><option value="bn-BD">Bangla (Bangladesh)</option><option value="en-US">English (US)</option></select></Field>
                <Field label="Currency"><select value={form.currency} onChange={(e) => update("currency", e.target.value)}><option value="BDT">BDT</option><option value="USD">USD</option><option value="INR">INR</option><option value="EUR">EUR</option></select></Field>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600"><strong className="text-slate-900">{form.store_name}</strong><br />{normalizeStoreSlug(form.store_slug)}.amar-ecom.com<br />{form.timezone} · {form.currency}</div>
            </div> : null}

            {error ? <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div> : null}
            <div className="flex items-center justify-between border-t border-slate-100 pt-6">
              {step > 1 ? <button type="button" onClick={() => setStep((current) => current - 1)} className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-slate-600"><ArrowLeft className="h-4 w-4" />Back</button> : <Link href="/login" className="text-sm font-semibold text-slate-500">Sign in instead</Link>}
              {step < 3 ? <button type="button" onClick={continueStep} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">Continue<ArrowRight className="h-4 w-4" /></button> : <button disabled={submitting || !currentAvailability?.available} type="submit" className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{submitting ? "Creating your store…" : "Create Store"}</button>}
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">{label}</span><div className="[&_input]:w-full [&_input]:rounded-xl [&_input]:border [&_input]:border-slate-200 [&_input]:px-4 [&_input]:py-3 [&_input]:text-sm [&_input]:outline-none [&_select]:w-full [&_select]:rounded-xl [&_select]:border [&_select]:border-slate-200 [&_select]:bg-white [&_select]:px-4 [&_select]:py-3 [&_select]:text-sm">{children}</div></label>;
}
