"use client";

import { useEffect, useState } from "react";
import { Building2, Loader2, Settings2 } from "lucide-react";

import { ErrorAlert } from "@/components/ui/error-alert";
import { FormCard } from "@/components/ui/form-card";
import { LoadingState } from "@/components/ui/loading-state";
import { PageHeader } from "@/components/ui/page-header";
import { api, ApiError } from "@/lib/api";

type BusinessSettings = {
  id: string;
  company_name: string;
  business_email: string | null;
  business_phone: string | null;
  business_address: string | null;
  website: string | null;
  currency: string;
  timezone: string;
  invoice_prefix: string;
  order_prefix: string;
  low_stock_default_threshold: number;
  tax_rate: string | number;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
};

type SettingsForm = {
  company_name: string;
  business_email: string;
  business_phone: string;
  business_address: string;
  website: string;
  currency: string;
  timezone: string;
  invoice_prefix: string;
  order_prefix: string;
  low_stock_default_threshold: string;
  tax_rate: string;
  logo_url: string;
};

const initialForm: SettingsForm = {
  company_name: "",
  business_email: "",
  business_phone: "",
  business_address: "",
  website: "",
  currency: "BDT",
  timezone: "Asia/Dhaka",
  invoice_prefix: "INV",
  order_prefix: "ORD",
  low_stock_default_threshold: "5",
  tax_rate: "0",
  logo_url: "",
};

function settingsToForm(settings: BusinessSettings): SettingsForm {
  return {
    company_name: settings.company_name,
    business_email: settings.business_email || "",
    business_phone: settings.business_phone || "",
    business_address: settings.business_address || "",
    website: settings.website || "",
    currency: settings.currency,
    timezone: settings.timezone,
    invoice_prefix: settings.invoice_prefix,
    order_prefix: settings.order_prefix,
    low_stock_default_threshold: String(settings.low_stock_default_threshold),
    tax_rate: String(settings.tax_rate),
    logo_url: settings.logo_url || "",
  };
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [form, setForm] = useState<SettingsForm>(initialForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadSettings() {
      try {
        const data = await api.get<BusinessSettings>("/settings/business");
        if (!isMounted) return;
        setSettings(data);
        setForm(settingsToForm(data));
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof ApiError ? err.message : "Failed to load business settings");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadSettings();
    return () => {
      isMounted = false;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
      const updated = await api.patch<BusinessSettings>("/settings/business", {
        company_name: form.company_name,
        business_email: form.business_email || null,
        business_phone: form.business_phone || null,
        business_address: form.business_address || null,
        website: form.website || null,
        currency: form.currency,
        timezone: form.timezone,
        invoice_prefix: form.invoice_prefix,
        order_prefix: form.order_prefix,
        low_stock_default_threshold: Number(form.low_stock_default_threshold),
        tax_rate: Number(form.tax_rate),
        logo_url: form.logo_url || null,
      });
      setSettings(updated);
      setForm(settingsToForm(updated));
      setSuccess("Business settings saved successfully.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save business settings");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <LoadingState label="Loading business settings..." />;
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)] sm:p-8">
        <PageHeader
          eyebrow="Operations Settings"
          title="Business settings"
          description="Keep the company profile, numbering preferences, and stock defaults aligned before expanding into more advanced configuration."
          meta={settings?.company_name || "Settings"}
        />
      </section>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
            <FormCard
              title="Company profile"
              description="These details anchor the operating identity used across the dashboard and future commercial documents."
              action={
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  <Building2 className="h-5 w-5" />
                </div>
              }
            >
              <div className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    Company name
                  </span>
                  <input
                    value={form.company_name}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, company_name: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                    required
                  />
                </label>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">
                      Business email
                    </span>
                    <input
                      type="email"
                      value={form.business_email}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          business_email: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                      placeholder="hello@amarecom.com"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">
                      Business phone
                    </span>
                    <input
                      value={form.business_phone}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          business_phone: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                      placeholder="+8801XXXXXXXXX"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    Business address
                  </span>
                  <textarea
                    rows={4}
                    value={form.business_address}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        business_address: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                    placeholder="House, street, city"
                  />
                </label>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">
                      Website
                    </span>
                    <input
                      value={form.website}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, website: event.target.value }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                      placeholder="https://example.com"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">
                      Logo URL
                    </span>
                    <input
                      value={form.logo_url}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, logo_url: event.target.value }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                      placeholder="https://example.com/logo.png"
                    />
                  </label>
                </div>
              </div>
            </FormCard>

            <FormCard
              title="Invoice and order preferences"
              description="Set the numbering prefixes and commercial defaults that will matter once document flows expand."
              action={
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  <Settings2 className="h-5 w-5" />
                </div>
              }
            >
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    Currency
                  </span>
                  <input
                    value={form.currency}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, currency: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm uppercase text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                    required
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    Timezone
                  </span>
                  <input
                    value={form.timezone}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, timezone: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                    required
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    Invoice prefix
                  </span>
                  <input
                    value={form.invoice_prefix}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        invoice_prefix: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm uppercase text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                    required
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    Order prefix
                  </span>
                  <input
                    value={form.order_prefix}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        order_prefix: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm uppercase text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                    required
                  />
                </label>
              </div>
            </FormCard>
          </div>

          <div className="space-y-4">
            <FormCard
              title="Inventory defaults"
              description="These settings keep operations aligned even before more advanced automation and rule layers are introduced."
              action={
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  <Settings2 className="h-5 w-5" />
                </div>
              }
            >
              <div className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    Default low stock threshold
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={form.low_stock_default_threshold}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        low_stock_default_threshold: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                    required
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    Tax rate
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.tax_rate}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, tax_rate: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                    required
                  />
                </label>

                <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-600">
                  These essentials cover the operational baseline for now. More advanced permissions, workflow rules, and external integrations stay intentionally out of scope for this phase.
                </div>
              </div>
            </FormCard>

            {error ? <ErrorAlert message={error} /> : null}
            {success ? (
              <div className="rounded-[28px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-700 shadow-[var(--shadow-soft)]">
                {success}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isSaving}
              className="flex w-full items-center justify-center gap-2 rounded-[28px] bg-slate-950 px-4 py-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving settings...
                </>
              ) : (
                "Save business settings"
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
