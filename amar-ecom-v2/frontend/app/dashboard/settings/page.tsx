"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Building2, FileText, LayoutTemplate, Loader2, Settings2 } from "lucide-react";

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
  invoice_title: string;
  invoice_footer_note: string | null;
  invoice_terms: string | null;
  payment_instructions: string | null;
  show_logo_on_invoice: boolean;
  show_business_address_on_invoice: boolean;
  show_customer_phone_on_invoice: boolean;
  show_payment_status_on_invoice: boolean;
  show_warehouse_on_invoice: boolean;
  invoice_template: string;
  invoice_accent_color: string | null;
  invoice_signature_label: string | null;
  low_stock_default_threshold: number;
  tax_rate: string | number;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
};

type InvoiceTemplate = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  template_type: string;
  is_default: boolean;
  is_active: boolean;
  accent_color: string | null;
  header_text: string | null;
  footer_text: string | null;
  terms_text: string | null;
  payment_instructions: string | null;
  created_at: string;
  updated_at: string;
};

type OrderSummary = {
  id: string;
  order_number: string;
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
  invoice_title: string;
  invoice_footer_note: string;
  invoice_terms: string;
  payment_instructions: string;
  invoice_template: string;
  invoice_accent_color: string;
  invoice_signature_label: string;
  show_logo_on_invoice: boolean;
  show_business_address_on_invoice: boolean;
  show_customer_phone_on_invoice: boolean;
  show_payment_status_on_invoice: boolean;
  show_warehouse_on_invoice: boolean;
  low_stock_default_threshold: string;
  tax_rate: string;
  logo_url: string;
};

type TemplateForm = {
  name: string;
  slug: string;
  description: string;
  accent_color: string;
  header_text: string;
  footer_text: string;
  terms_text: string;
  payment_instructions: string;
  is_active: boolean;
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
  invoice_title: "Invoice",
  invoice_footer_note: "",
  invoice_terms: "",
  payment_instructions: "",
  invoice_template: "standard",
  invoice_accent_color: "",
  invoice_signature_label: "",
  show_logo_on_invoice: true,
  show_business_address_on_invoice: true,
  show_customer_phone_on_invoice: true,
  show_payment_status_on_invoice: true,
  show_warehouse_on_invoice: false,
  low_stock_default_threshold: "5",
  tax_rate: "0",
  logo_url: "",
};

const initialTemplateForm: TemplateForm = {
  name: "",
  slug: "",
  description: "",
  accent_color: "",
  header_text: "",
  footer_text: "",
  terms_text: "",
  payment_instructions: "",
  is_active: true,
};

const tabs = [
  { id: "profile", label: "Business Profile", icon: Building2 },
  { id: "invoice", label: "Invoice Settings", icon: FileText },
  { id: "templates", label: "Invoice Templates", icon: LayoutTemplate },
] as const;

type TabId = (typeof tabs)[number]["id"];

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
    invoice_title: settings.invoice_title,
    invoice_footer_note: settings.invoice_footer_note || "",
    invoice_terms: settings.invoice_terms || "",
    payment_instructions: settings.payment_instructions || "",
    invoice_template: settings.invoice_template,
    invoice_accent_color: settings.invoice_accent_color || "",
    invoice_signature_label: settings.invoice_signature_label || "",
    show_logo_on_invoice: settings.show_logo_on_invoice,
    show_business_address_on_invoice: settings.show_business_address_on_invoice,
    show_customer_phone_on_invoice: settings.show_customer_phone_on_invoice,
    show_payment_status_on_invoice: settings.show_payment_status_on_invoice,
    show_warehouse_on_invoice: settings.show_warehouse_on_invoice,
    low_stock_default_threshold: String(settings.low_stock_default_threshold),
    tax_rate: String(settings.tax_rate),
    logo_url: settings.logo_url || "",
  };
}

function templateToForm(template: InvoiceTemplate): TemplateForm {
  return {
    name: template.name,
    slug: template.slug,
    description: template.description || "",
    accent_color: template.accent_color || "",
    header_text: template.header_text || "",
    footer_text: template.footer_text || "",
    terms_text: template.terms_text || "",
    payment_instructions: template.payment_instructions || "",
    is_active: template.is_active,
  };
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-slate-300 text-slate-950 focus:ring-slate-400"
      />
    </label>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("profile");
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [templates, setTemplates] = useState<InvoiceTemplate[]>([]);
  const [latestOrder, setLatestOrder] = useState<OrderSummary | null>(null);
  const [form, setForm] = useState<SettingsForm>(initialForm);
  const [templateForm, setTemplateForm] = useState<TemplateForm>(initialTemplateForm);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [busyTemplateId, setBusyTemplateId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const [settingsData, templatesData, ordersData] = await Promise.all([
          api.get<BusinessSettings>("/settings/business"),
          api.get<InvoiceTemplate[]>("/invoice-templates"),
          api.get<OrderSummary[]>("/orders?skip=0&limit=1").catch(() => []),
        ]);

        if (!isMounted) return;
        setSettings(settingsData);
        setForm(settingsToForm(settingsData));
        setTemplates(templatesData);
        setLatestOrder(ordersData[0] || null);
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof ApiError ? err.message : "Failed to load settings");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  async function refreshTemplates() {
    const data = await api.get<InvoiceTemplate[]>("/invoice-templates");
    setTemplates(data);
  }

  async function handleSettingsSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSavingSettings(true);

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
        invoice_title: form.invoice_title,
        invoice_footer_note: form.invoice_footer_note || null,
        invoice_terms: form.invoice_terms || null,
        payment_instructions: form.payment_instructions || null,
        invoice_template: form.invoice_template,
        invoice_accent_color: form.invoice_accent_color || null,
        invoice_signature_label: form.invoice_signature_label || null,
        show_logo_on_invoice: form.show_logo_on_invoice,
        show_business_address_on_invoice: form.show_business_address_on_invoice,
        show_customer_phone_on_invoice: form.show_customer_phone_on_invoice,
        show_payment_status_on_invoice: form.show_payment_status_on_invoice,
        show_warehouse_on_invoice: form.show_warehouse_on_invoice,
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
      setIsSavingSettings(false);
    }
  }

  async function handleTemplateSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSavingTemplate(true);

    const payload = {
      name: templateForm.name,
      slug: templateForm.slug,
      description: templateForm.description || null,
      accent_color: templateForm.accent_color || null,
      header_text: templateForm.header_text || null,
      footer_text: templateForm.footer_text || null,
      terms_text: templateForm.terms_text || null,
      payment_instructions: templateForm.payment_instructions || null,
      is_active: templateForm.is_active,
    };

    try {
      if (editingTemplateId) {
        await api.patch<InvoiceTemplate>(`/invoice-templates/${editingTemplateId}`, payload);
        setSuccess("Invoice template updated.");
      } else {
        await api.post<InvoiceTemplate>("/invoice-templates", payload);
        setSuccess("Invoice template created.");
      }

      setTemplateForm(initialTemplateForm);
      setEditingTemplateId(null);
      await refreshTemplates();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save invoice template");
    } finally {
      setIsSavingTemplate(false);
    }
  }

  async function handleSetDefault(templateId: string) {
    setBusyTemplateId(templateId);
    setError("");
    setSuccess("");

    try {
      const updated = await api.post<InvoiceTemplate>(`/invoice-templates/${templateId}/set-default`);
      await refreshTemplates();
      setForm((current) => ({ ...current, invoice_template: updated.slug }));
      setSuccess(`Default invoice template set to ${updated.name}.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update default template");
    } finally {
      setBusyTemplateId(null);
    }
  }

  async function handleDeactivate(templateId: string) {
    setBusyTemplateId(templateId);
    setError("");
    setSuccess("");

    try {
      const deactivatedTemplate = templates.find((template) => template.id === templateId) || null;
      await api.delete(`/invoice-templates/${templateId}`);
      await refreshTemplates();
      if (deactivatedTemplate && form.invoice_template === deactivatedTemplate.slug) {
        setForm((current) => ({ ...current, invoice_template: "standard" }));
      }
      setSuccess("Invoice template deactivated.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to deactivate invoice template");
    } finally {
      setBusyTemplateId(null);
    }
  }

  function startEditingTemplate(template: InvoiceTemplate) {
    setEditingTemplateId(template.id);
    setTemplateForm(templateToForm(template));
    setActiveTab("templates");
    setError("");
    setSuccess("");
  }

  function resetTemplateEditor() {
    setEditingTemplateId(null);
    setTemplateForm(initialTemplateForm);
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
          description="Keep the business profile, invoice presentation, and template defaults aligned as the v2 commercial workflow gets closer to parity."
          meta={settings?.company_name || "Settings"}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <div className="rounded-[28px] border border-slate-200 bg-white p-3 shadow-[var(--shadow-soft)]">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm transition ${
                    isActive
                      ? "bg-slate-950 text-white"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="grid gap-4">
            <Link
              href="/dashboard/activity-logs"
              className="rounded-[28px] border border-slate-200 bg-white px-5 py-5 text-sm font-semibold text-slate-700 shadow-[var(--shadow-soft)] transition hover:border-slate-300 hover:bg-slate-50"
            >
              Activity Logs
              <p className="mt-2 text-sm font-normal leading-6 text-slate-500">
                Review recent admin and workflow actions.
              </p>
            </Link>
            <Link
              href="/dashboard/users"
              className="rounded-[28px] border border-slate-200 bg-white px-5 py-5 text-sm font-semibold text-slate-700 shadow-[var(--shadow-soft)] transition hover:border-slate-300 hover:bg-slate-50"
            >
              Team Permissions
              <p className="mt-2 text-sm font-normal leading-6 text-slate-500">
                Open the team workspace to assign module permissions.
              </p>
            </Link>
            {latestOrder ? (
              <Link
                href={`/dashboard/orders/${latestOrder.id}/invoice`}
                className="rounded-[28px] border border-slate-200 bg-white px-5 py-5 text-sm font-semibold text-slate-700 shadow-[var(--shadow-soft)] transition hover:border-slate-300 hover:bg-slate-50"
              >
                Preview Invoice
                <p className="mt-2 text-sm font-normal leading-6 text-slate-500">
                  Open the latest order invoice preview using current settings.
                </p>
              </Link>
            ) : null}
          </div>
        </aside>

        <div className="space-y-4">
          {error ? <ErrorAlert message={error} /> : null}
          {success ? (
            <div className="rounded-[28px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-700 shadow-[var(--shadow-soft)]">
              {success}
            </div>
          ) : null}

          {activeTab === "profile" ? (
            <form onSubmit={handleSettingsSubmit} className="space-y-4">
              <FormCard
                title="Company profile"
                description="These details anchor the operating identity used across the dashboard, invoices, and document previews."
                action={
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                    <Building2 className="h-5 w-5" />
                  </div>
                }
              >
                <div className="space-y-4">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Company name</span>
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
                      <span className="mb-2 block text-sm font-medium text-slate-700">Business email</span>
                      <input
                        type="email"
                        value={form.business_email}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, business_email: event.target.value }))
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">Business phone</span>
                      <input
                        value={form.business_phone}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, business_phone: event.target.value }))
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                      />
                    </label>
                  </div>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Business address</span>
                    <textarea
                      rows={4}
                      value={form.business_address}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, business_address: event.target.value }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                    />
                  </label>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">Website</span>
                      <input
                        value={form.website}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, website: event.target.value }))
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">Logo URL</span>
                      <input
                        value={form.logo_url}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, logo_url: event.target.value }))
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                      />
                    </label>
                  </div>
                </div>
              </FormCard>

              <FormCard
                title="Operational defaults"
                description="These baseline settings still live here because they affect broader dashboard behavior, not just invoice output."
                action={
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                    <Settings2 className="h-5 w-5" />
                  </div>
                }
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Currency</span>
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
                    <span className="mb-2 block text-sm font-medium text-slate-700">Timezone</span>
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
                    <span className="mb-2 block text-sm font-medium text-slate-700">Order prefix</span>
                    <input
                      value={form.order_prefix}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, order_prefix: event.target.value }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm uppercase text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                      required
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Invoice prefix</span>
                    <input
                      value={form.invoice_prefix}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, invoice_prefix: event.target.value }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm uppercase text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                      required
                    />
                  </label>

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
                    <span className="mb-2 block text-sm font-medium text-slate-700">Tax rate</span>
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
                </div>
              </FormCard>

              <button
                type="submit"
                disabled={isSavingSettings}
                className="flex w-full items-center justify-center gap-2 rounded-[28px] bg-slate-950 px-4 py-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingSettings ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving settings...
                  </>
                ) : (
                  "Save business profile"
                )}
              </button>
            </form>
          ) : null}

          {activeTab === "invoice" ? (
            <form onSubmit={handleSettingsSubmit} className="space-y-4">
              <FormCard
                title="Invoice settings"
                description="Tune what the invoice shows and which template should supply display copy when available."
                action={
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                    <FileText className="h-5 w-5" />
                  </div>
                }
              >
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">Invoice title</span>
                      <input
                        value={form.invoice_title}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, invoice_title: event.target.value }))
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                        required
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">Selected template</span>
                      <select
                        value={form.invoice_template}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, invoice_template: event.target.value }))
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                      >
                        <option value="standard">Standard</option>
                        {templates.map((template) => (
                          <option key={template.id} value={template.slug}>
                            {template.name}
                            {template.is_default ? " (Default)" : ""}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">Accent color</span>
                      <input
                        value={form.invoice_accent_color}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            invoice_accent_color: event.target.value,
                          }))
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                        placeholder="#0f172a"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">Signature label</span>
                      <input
                        value={form.invoice_signature_label}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            invoice_signature_label: event.target.value,
                          }))
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                        placeholder="Authorized Signature"
                      />
                    </label>
                  </div>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Footer note</span>
                    <textarea
                      rows={3}
                      value={form.invoice_footer_note}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, invoice_footer_note: event.target.value }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Terms</span>
                    <textarea
                      rows={4}
                      value={form.invoice_terms}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, invoice_terms: event.target.value }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Payment instructions</span>
                    <textarea
                      rows={4}
                      value={form.payment_instructions}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          payment_instructions: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                    />
                  </label>

                  <div className="grid gap-3 md:grid-cols-2">
                    <ToggleField
                      label="Show logo on invoice"
                      checked={form.show_logo_on_invoice}
                      onChange={(value) =>
                        setForm((current) => ({ ...current, show_logo_on_invoice: value }))
                      }
                    />
                    <ToggleField
                      label="Show business address"
                      checked={form.show_business_address_on_invoice}
                      onChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          show_business_address_on_invoice: value,
                        }))
                      }
                    />
                    <ToggleField
                      label="Show customer phone"
                      checked={form.show_customer_phone_on_invoice}
                      onChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          show_customer_phone_on_invoice: value,
                        }))
                      }
                    />
                    <ToggleField
                      label="Show payment status"
                      checked={form.show_payment_status_on_invoice}
                      onChange={(value) =>
                        setForm((current) => ({
                          ...current,
                          show_payment_status_on_invoice: value,
                        }))
                      }
                    />
                    <ToggleField
                      label="Show warehouse"
                      checked={form.show_warehouse_on_invoice}
                      onChange={(value) =>
                        setForm((current) => ({ ...current, show_warehouse_on_invoice: value }))
                      }
                    />
                  </div>
                </div>
              </FormCard>

              <button
                type="submit"
                disabled={isSavingSettings}
                className="flex w-full items-center justify-center gap-2 rounded-[28px] bg-slate-950 px-4 py-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingSettings ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving invoice settings...
                  </>
                ) : (
                  "Save invoice settings"
                )}
              </button>
            </form>
          ) : null}

          {activeTab === "templates" ? (
            <div className="space-y-4">
              <FormCard
                title={editingTemplateId ? "Edit invoice template" : "Create invoice template"}
                description="Keep template management simple for now: store reusable invoice copy, color accents, and the default selection."
                action={
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                    <LayoutTemplate className="h-5 w-5" />
                  </div>
                }
              >
                <form onSubmit={handleTemplateSubmit} className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">Name</span>
                      <input
                        value={templateForm.name}
                        onChange={(event) =>
                          setTemplateForm((current) => ({ ...current, name: event.target.value }))
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                        required
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">Slug</span>
                      <input
                        value={templateForm.slug}
                        onChange={(event) =>
                          setTemplateForm((current) => ({ ...current, slug: event.target.value }))
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                        required
                      />
                    </label>
                  </div>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Description</span>
                    <textarea
                      rows={2}
                      value={templateForm.description}
                      onChange={(event) =>
                        setTemplateForm((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Accent color</span>
                    <input
                      value={templateForm.accent_color}
                      onChange={(event) =>
                        setTemplateForm((current) => ({
                          ...current,
                          accent_color: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                      placeholder="#0f172a"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Header text</span>
                    <textarea
                      rows={2}
                      value={templateForm.header_text}
                      onChange={(event) =>
                        setTemplateForm((current) => ({
                          ...current,
                          header_text: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Footer text</span>
                    <textarea
                      rows={3}
                      value={templateForm.footer_text}
                      onChange={(event) =>
                        setTemplateForm((current) => ({
                          ...current,
                          footer_text: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Terms text</span>
                    <textarea
                      rows={3}
                      value={templateForm.terms_text}
                      onChange={(event) =>
                        setTemplateForm((current) => ({
                          ...current,
                          terms_text: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Payment instructions</span>
                    <textarea
                      rows={3}
                      value={templateForm.payment_instructions}
                      onChange={(event) =>
                        setTemplateForm((current) => ({
                          ...current,
                          payment_instructions: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                    />
                  </label>

                  <ToggleField
                    label="Template is active"
                    checked={templateForm.is_active}
                    onChange={(value) =>
                      setTemplateForm((current) => ({ ...current, is_active: value }))
                    }
                  />

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="submit"
                      disabled={isSavingTemplate}
                      className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSavingTemplate ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : editingTemplateId ? (
                        "Update template"
                      ) : (
                        "Create template"
                      )}
                    </button>

                    {editingTemplateId ? (
                      <button
                        type="button"
                        onClick={resetTemplateEditor}
                        className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Cancel edit
                      </button>
                    ) : null}
                  </div>
                </form>
              </FormCard>

              <FormCard
                title="Active invoice templates"
                description="Set the default template, edit reusable display text, or deactivate templates you no longer need."
              >
                <div className="space-y-3">
                  {templates.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-5 py-6 text-sm text-slate-500">
                      No invoice templates yet. The invoice page will use the standard business settings until one is added.
                    </div>
                  ) : (
                    templates.map((template) => (
                      <div
                        key={template.id}
                        className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-5"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-base font-semibold text-slate-950">{template.name}</h3>
                              {template.is_default ? (
                                <span className="rounded-full bg-slate-950 px-2.5 py-1 text-xs font-semibold text-white">
                                  Default
                                </span>
                              ) : null}
                            </div>
                            <p className="text-sm text-slate-500">{template.slug}</p>
                            {template.description ? (
                              <p className="text-sm leading-6 text-slate-600">{template.description}</p>
                            ) : null}
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {!template.is_default ? (
                              <button
                                type="button"
                                onClick={() => void handleSetDefault(template.id)}
                                disabled={busyTemplateId === template.id}
                                className="rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Set default
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => startEditingTemplate(template)}
                              className="rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeactivate(template.id)}
                              disabled={busyTemplateId === template.id}
                              className="rounded-full border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Deactivate
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </FormCard>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
