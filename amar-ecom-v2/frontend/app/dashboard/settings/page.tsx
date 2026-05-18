"use client";

import Link from "next/link";
import { FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import {
  Bell,
  Building2,
  ClipboardList,
  Database,
  FileText,
  Globe,
  Loader2,
  Save,
  Settings as SettingsIcon,
  Shield,
  Smartphone,
  User,
} from "lucide-react";

import { ControlModal } from "@/components/ui/control-modal";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading-state";
import { OpsPageHeader } from "@/components/ui/ops-page-header";
import { OpsStatusBadge } from "@/components/ui/ops-status-badge";
import { OpsSummaryCard } from "@/components/ui/ops-summary-card";
import { api, ApiError } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";

type TabId =
  | "General"
  | "Company Info"
  | "Account"
  | "Notifications"
  | "Security"
  | "Integrations"
  | "SMS Settings"
  | "Data Management"
  | "Mobile App"
  | "Activity Logs";

type SettingsSummary = {
  business_profile_completeness: number;
  invoice_settings_configured: boolean;
  default_invoice_template_configured: boolean;
  active_users: number;
  pending_users: number;
  inactive_users: number;
  roles_count: number;
  permissions_count: number;
  recent_activity_count: number;
  has_active_admin: boolean;
  permissions_seeded: boolean;
  backup_guidance_available: boolean;
  maintenance_checklist_available: boolean;
  system_health_status: string;
};

type BusinessSettings = {
  id: string;
  company_name: string;
  companyName?: string;
  businessName?: string;
  business_email: string | null;
  businessEmail?: string | null;
  business_phone: string | null;
  businessPhone?: string | null;
  business_address: string | null;
  businessAddress?: string | null;
  website: string | null;
  currency: string;
  timezone: string;
  invoice_prefix: string;
  invoicePrefix?: string;
  order_prefix: string;
  orderPrefix?: string;
  invoice_title: string;
  invoiceTitle?: string;
  invoice_footer_note: string | null;
  invoiceFooterNote?: string | null;
  invoice_terms: string | null;
  invoiceTerms?: string | null;
  payment_instructions: string | null;
  paymentInstructions?: string | null;
  invoice_template: string;
  invoice_accent_color: string | null;
  invoice_signature_label: string | null;
  low_stock_default_threshold: number;
  lowStockDefaultThreshold?: number;
  tax_rate: string | number;
  taxRate?: string | number;
  logo_url: string | null;
  logoUrl?: string | null;
  created_at: string;
  updated_at: string;
  createdAt?: string;
  updatedAt?: string;
  show_logo_on_invoice: boolean;
  show_business_address_on_invoice: boolean;
  show_customer_phone_on_invoice: boolean;
  show_payment_status_on_invoice: boolean;
  show_warehouse_on_invoice: boolean;
};

type InvoiceTemplate = {
  id: string;
  name: string;
  templateName?: string;
  slug: string;
  description: string | null;
  accent_color: string | null;
  accentColor?: string | null;
  header_text: string | null;
  headerText?: string | null;
  footer_text: string | null;
  footerText?: string | null;
  terms_text: string | null;
  termsText?: string | null;
  payment_instructions: string | null;
  paymentInstructions?: string | null;
  is_default: boolean;
  isDefault?: boolean;
  is_active: boolean;
  isActive?: boolean;
  created_at: string;
  updated_at: string;
  createdAt?: string;
  updatedAt?: string;
};

type ActivityLog = {
  id: string;
  action: string;
  actionLabel?: string | null;
  moduleLabel?: string | null;
  message: string;
  userName?: string | null;
  createdAt?: string | null;
  created_at?: string | null;
};

type TemplateForm = {
  templateName: string;
  slug: string;
  description: string;
  accentColor: string;
  headerText: string;
  footerText: string;
  termsText: string;
  paymentInstructions: string;
  isActive: boolean;
};

const tabs: Array<{ id: TabId; icon: typeof SettingsIcon }> = [
  { id: "General", icon: SettingsIcon },
  { id: "Company Info", icon: Building2 },
  { id: "Account", icon: User },
  { id: "Notifications", icon: Bell },
  { id: "Security", icon: Shield },
  { id: "Integrations", icon: Globe },
  { id: "SMS Settings", icon: Smartphone },
  { id: "Data Management", icon: Database },
  { id: "Mobile App", icon: Smartphone },
  { id: "Activity Logs", icon: ClipboardList },
];

const initialTemplateForm: TemplateForm = {
  templateName: "",
  slug: "",
  description: "",
  accentColor: "",
  headerText: "",
  footerText: "",
  termsText: "",
  paymentInstructions: "",
  isActive: true,
};

export default function SettingsPage() {
  const currentUser = getUser();
  const [activeTab, setActiveTab] = useState<TabId>("General");
  const [summary, setSummary] = useState<SettingsSummary | null>(null);
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [templates, setTemplates] = useState<InvoiceTemplate[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [templateForm, setTemplateForm] = useState<TemplateForm>(initialTemplateForm);
  const [editingTemplate, setEditingTemplate] = useState<InvoiceTemplate | null>(null);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [busyTemplateId, setBusyTemplateId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [accountDraft, setAccountDraft] = useState({
    fullName: currentUser?.display_name || currentUser?.full_name || "",
    email: currentUser?.email || "",
  });
  const [notificationDraft, setNotificationDraft] = useState({
    emailOrders: true,
    emailInventory: true,
    pushOrders: true,
    pushInventory: false,
    smsAlerts: false,
  });
  const [securityDraft, setSecurityDraft] = useState({
    twoFactor: false,
    sessionTimeout: "30",
    ipWhitelist: "",
  });
  const [smsDraft, setSmsDraft] = useState({
    enableOrderConfirmation: false,
    gateway: "Twilio",
    senderId: "",
    template: "Hello {customerName}, your order #{orderNumber} has been received.",
  });

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const [summaryData, settingsData, templateData, logData] = await Promise.all([
          api.get<SettingsSummary>("/settings/center-summary"),
          api.get<BusinessSettings>("/settings/business"),
          api.get<InvoiceTemplate[]>("/invoice-templates"),
          api.get<ActivityLog[]>("/activity-logs?module=settings&limit=25"),
        ]);

        if (!isMounted) return;
        setSummary(summaryData);
        setSettings(settingsData);
        setTemplates(templateData);
        setLogs(logData);
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof ApiError ? err.message : "Failed to load settings center");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  const summaryCards = useMemo(
    () =>
      summary
        ? [
            {
              label: "Profile Complete",
              value: `${summary.business_profile_completeness}%`,
              icon: Building2,
              tone: summary.business_profile_completeness >= 75 ? "success" : "warning",
              helper: "Company details and invoice identity",
            },
            {
              label: "Invoice Ready",
              value: summary.invoice_settings_configured ? "Configured" : "Review",
              icon: FileText,
              tone: summary.invoice_settings_configured ? "success" : "warning",
              helper: "Prefixes, title, tax, footer, and template",
            },
            {
              label: "Active Users",
              value: summary.active_users,
              icon: User,
              tone: "info",
              helper: `${summary.pending_users} pending / inactive`,
            },
            {
              label: "Recent Activity",
              value: summary.recent_activity_count,
              icon: ClipboardList,
              tone: "default",
              helper: `${summary.permissions_count} permission keys seeded`,
            },
          ]
        : [],
    [summary],
  );

  async function refreshCoreData() {
    const [summaryData, settingsData, templateData, logData] = await Promise.all([
      api.get<SettingsSummary>("/settings/center-summary"),
      api.get<BusinessSettings>("/settings/business"),
      api.get<InvoiceTemplate[]>("/invoice-templates"),
      api.get<ActivityLog[]>("/activity-logs?module=settings&limit=25"),
    ]);
    setSummary(summaryData);
    setSettings(settingsData);
    setTemplates(templateData);
    setLogs(logData);
  }

  async function saveSettings(payload: Record<string, unknown>, message: string) {
    setError("");
    setSuccess("");
    setIsSavingSettings(true);
    try {
      const updated = await api.patch<BusinessSettings>("/settings/business", payload);
      setSettings(updated);
      setSuccess(message);
      await refreshCoreData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save settings");
    } finally {
      setIsSavingSettings(false);
    }
  }

  async function handleGeneralSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings) return;
    await saveSettings(
      {
        companyName: settings.companyName || settings.company_name,
        businessEmail: settings.businessEmail ?? settings.business_email,
        businessPhone: settings.businessPhone ?? settings.business_phone,
        businessAddress: settings.businessAddress ?? settings.business_address,
        website: settings.website,
        currency: settings.currency,
        timezone: settings.timezone,
        invoicePrefix: settings.invoicePrefix || settings.invoice_prefix,
        orderPrefix: settings.orderPrefix || settings.order_prefix,
        lowStockDefaultThreshold:
          settings.lowStockDefaultThreshold ?? settings.low_stock_default_threshold,
        taxRate: settings.taxRate ?? settings.tax_rate,
      },
      "General settings saved successfully.",
    );
  }

  async function handleCompanySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings) return;
    await saveSettings(
      {
        companyName: settings.companyName || settings.company_name,
        logoUrl: settings.logoUrl ?? settings.logo_url,
        invoiceFooterNote: settings.invoiceFooterNote ?? settings.invoice_footer_note,
        invoiceTerms: settings.invoiceTerms ?? settings.invoice_terms,
        paymentInstructions: settings.paymentInstructions ?? settings.payment_instructions,
      },
      "Company information saved successfully.",
    );
  }

  function openTemplateModal(template?: InvoiceTemplate) {
    setEditingTemplate(template || null);
    setTemplateForm(
      template
        ? {
            templateName: template.templateName || template.name,
            slug: template.slug,
            description: template.description || "",
            accentColor: template.accentColor || template.accent_color || "",
            headerText: template.headerText || template.header_text || "",
            footerText: template.footerText || template.footer_text || "",
            termsText: template.termsText || template.terms_text || "",
            paymentInstructions:
              template.paymentInstructions || template.payment_instructions || "",
            isActive: template.isActive ?? template.is_active,
          }
        : initialTemplateForm,
    );
    setIsTemplateModalOpen(true);
    setError("");
    setSuccess("");
  }

  function closeTemplateModal() {
    setEditingTemplate(null);
    setTemplateForm(initialTemplateForm);
    setIsTemplateModalOpen(false);
  }

  async function handleTemplateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSavingTemplate(true);

    const payload = {
      templateName: templateForm.templateName,
      slug: templateForm.slug,
      description: templateForm.description || null,
      accentColor: templateForm.accentColor || null,
      headerText: templateForm.headerText || null,
      footerText: templateForm.footerText || null,
      termsText: templateForm.termsText || null,
      paymentInstructions: templateForm.paymentInstructions || null,
      isActive: templateForm.isActive,
    };

    try {
      if (editingTemplate) {
        await api.patch<InvoiceTemplate>(`/invoice-templates/${editingTemplate.id}`, payload);
        setSuccess("Invoice template updated.");
      } else {
        await api.post<InvoiceTemplate>("/invoice-templates", payload);
        setSuccess("Invoice template created.");
      }
      closeTemplateModal();
      await refreshCoreData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save template");
    } finally {
      setIsSavingTemplate(false);
    }
  }

  async function handleSetDefault(template: InvoiceTemplate) {
    setBusyTemplateId(template.id);
    setError("");
    setSuccess("");
    try {
      await api.post<InvoiceTemplate>(`/invoice-templates/${template.id}/set-default`);
      setSuccess(`Default template set to ${template.templateName || template.name}.`);
      await refreshCoreData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update default template");
    } finally {
      setBusyTemplateId(null);
    }
  }

  async function handleDeactivate(template: InvoiceTemplate) {
    setBusyTemplateId(template.id);
    setError("");
    setSuccess("");
    try {
      await api.delete(`/invoice-templates/${template.id}`);
      setSuccess("Template deactivated.");
      await refreshCoreData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to deactivate template");
    } finally {
      setBusyTemplateId(null);
    }
  }

  if (isLoading || !settings) {
    return <LoadingState label="Loading settings center..." />;
  }

  return (
    <div className="space-y-5">
      <section className="card-base p-6 sm:p-8">
        <OpsPageHeader
          eyebrow="Settings"
          title="Settings"
          description="Manage your account, integrations, system preferences, invoice defaults, and connected admin tools in the same broad control center the v1 app used."
          meta={`${summary?.active_users || 0} active users`}
          actions={
            <button
              type="button"
              onClick={() => void refreshCoreData()}
              className="rounded-full border border-[var(--color-brd)] px-4 py-2 text-sm font-semibold text-[var(--color-txt-sec)] transition hover:bg-[var(--color-surf-hover)]"
            >
              Refresh
            </button>
          }
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <OpsSummaryCard
            key={card.label}
            label={card.label}
            value={card.value}
            icon={card.icon}
            tone={card.tone as "success" | "warning" | "info" | "default"}
            helper={card.helper}
          />
        ))}
      </section>

      {error ? <ErrorAlert message={error} /> : null}
      {success ? (
        <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-700">
          {success}
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <div className="card-base p-4">
            <div className="space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex w-full items-center gap-3 rounded-full px-4 py-3 text-left text-[13px] font-bold transition ${
                      isActive
                        ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                        : "text-[var(--color-txt-sec)] hover:bg-[var(--color-surf-hover)]"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.id}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <Link
              href="/dashboard/users"
              className="block rounded-[24px] border border-[var(--color-brd)] bg-[var(--color-surf)] px-5 py-5 shadow-[var(--shadow-sub)] transition hover:bg-[var(--color-surf-hover)]"
            >
              <p className="text-sm font-bold text-[var(--color-txt-pri)]">Team Management</p>
              <p className="mt-2 text-sm leading-6 text-[var(--color-txt-sec)]">
                Open the v1-style member list, role badges, and permission editor.
              </p>
            </Link>
            <Link
              href="/dashboard/activity-logs"
              className="block rounded-[24px] border border-[var(--color-brd)] bg-[var(--color-surf)] px-5 py-5 shadow-[var(--shadow-sub)] transition hover:bg-[var(--color-surf-hover)]"
            >
              <p className="text-sm font-bold text-[var(--color-txt-pri)]">Activity Logs</p>
              <p className="mt-2 text-sm leading-6 text-[var(--color-txt-sec)]">
                Review the same embedded audit feed the v1 settings center surfaced.
              </p>
            </Link>
            <Link
              href="/dashboard/admin-tools"
              className="block rounded-[24px] border border-[var(--color-brd)] bg-[var(--color-surf)] px-5 py-5 shadow-[var(--shadow-sub)] transition hover:bg-[var(--color-surf-hover)]"
            >
              <p className="text-sm font-bold text-[var(--color-txt-pri)]">Data Management</p>
              <p className="mt-2 text-sm leading-6 text-[var(--color-txt-sec)]">
                Safe backup guidance, system health, maintenance checklist, and browser exports only.
              </p>
            </Link>
          </div>
        </aside>

        <div className="space-y-5">
          {activeTab === "General" ? (
            <form onSubmit={handleGeneralSubmit} className="card-base p-6">
              <div className="flex items-center gap-3">
                <SettingsIcon className="h-5 w-5 text-[var(--color-accent)]" />
                <h2 className="text-lg font-bold text-[var(--color-txt-pri)]">General Settings</h2>
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <Field label="Company Name">
                  <input
                    value={settings.companyName || settings.company_name}
                    onChange={(event) =>
                      setSettings((current) =>
                        current
                          ? {
                              ...current,
                              companyName: event.target.value,
                              company_name: event.target.value,
                            }
                          : current,
                      )
                    }
                    className={inputClassName}
                  />
                </Field>
                <Field label="Business Email">
                  <input
                    value={settings.businessEmail ?? settings.business_email ?? ""}
                    onChange={(event) =>
                      setSettings((current) =>
                        current
                          ? {
                              ...current,
                              businessEmail: event.target.value,
                              business_email: event.target.value,
                            }
                          : current,
                      )
                    }
                    className={inputClassName}
                  />
                </Field>
                <Field label="Business Phone">
                  <input
                    value={settings.businessPhone ?? settings.business_phone ?? ""}
                    onChange={(event) =>
                      setSettings((current) =>
                        current
                          ? {
                              ...current,
                              businessPhone: event.target.value,
                              business_phone: event.target.value,
                            }
                          : current,
                      )
                    }
                    className={inputClassName}
                  />
                </Field>
                <Field label="Website">
                  <input
                    value={settings.website || ""}
                    onChange={(event) =>
                      setSettings((current) =>
                        current ? { ...current, website: event.target.value } : current,
                      )
                    }
                    className={inputClassName}
                  />
                </Field>
                <Field label="Currency">
                  <input
                    value={settings.currency}
                    onChange={(event) =>
                      setSettings((current) =>
                        current ? { ...current, currency: event.target.value } : current,
                      )
                    }
                    className={inputClassName}
                  />
                </Field>
                <Field label="Timezone">
                  <input
                    value={settings.timezone}
                    onChange={(event) =>
                      setSettings((current) =>
                        current ? { ...current, timezone: event.target.value } : current,
                      )
                    }
                    className={inputClassName}
                  />
                </Field>
                <Field label="Invoice Prefix">
                  <input
                    value={settings.invoicePrefix || settings.invoice_prefix}
                    onChange={(event) =>
                      setSettings((current) =>
                        current
                          ? {
                              ...current,
                              invoicePrefix: event.target.value,
                              invoice_prefix: event.target.value,
                            }
                          : current,
                      )
                    }
                    className={inputClassName}
                  />
                </Field>
                <Field label="Order Prefix">
                  <input
                    value={settings.orderPrefix || settings.order_prefix}
                    onChange={(event) =>
                      setSettings((current) =>
                        current
                          ? {
                              ...current,
                              orderPrefix: event.target.value,
                              order_prefix: event.target.value,
                            }
                          : current,
                      )
                    }
                    className={inputClassName}
                  />
                </Field>
                <Field label="Low Stock Threshold">
                  <input
                    type="number"
                    min="0"
                    value={String(
                      settings.lowStockDefaultThreshold ?? settings.low_stock_default_threshold,
                    )}
                    onChange={(event) =>
                      setSettings((current) =>
                        current
                          ? {
                              ...current,
                              lowStockDefaultThreshold: Number(event.target.value),
                              low_stock_default_threshold: Number(event.target.value),
                            }
                          : current,
                      )
                    }
                    className={inputClassName}
                  />
                </Field>
                <Field label="Tax Rate">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={String(settings.taxRate ?? settings.tax_rate)}
                    onChange={(event) =>
                      setSettings((current) =>
                        current
                          ? {
                              ...current,
                              taxRate: event.target.value,
                              tax_rate: event.target.value,
                            }
                          : current,
                      )
                    }
                    className={inputClassName}
                  />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Business Address">
                    <textarea
                      rows={3}
                      value={settings.businessAddress ?? settings.business_address ?? ""}
                      onChange={(event) =>
                        setSettings((current) =>
                          current
                            ? {
                                ...current,
                                businessAddress: event.target.value,
                                business_address: event.target.value,
                              }
                            : current,
                        )
                      }
                      className={inputClassName}
                    />
                  </Field>
                </div>
              </div>

              <SaveButton isSaving={isSavingSettings} label="Save Changes" />
            </form>
          ) : null}

          {activeTab === "Company Info" ? (
            <form onSubmit={handleCompanySubmit} className="card-base p-6">
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-[var(--color-accent)]" />
                <h2 className="text-lg font-bold text-[var(--color-txt-pri)]">Company Information</h2>
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <Field label="Logo URL">
                  <input
                    value={settings.logoUrl ?? settings.logo_url ?? ""}
                    onChange={(event) =>
                      setSettings((current) =>
                        current
                          ? {
                              ...current,
                              logoUrl: event.target.value,
                              logo_url: event.target.value,
                            }
                          : current,
                      )
                    }
                    className={inputClassName}
                    placeholder="https://example.com/logo.png"
                  />
                </Field>
                <Field label="Invoice Title">
                  <input
                    value={settings.invoiceTitle || settings.invoice_title}
                    onChange={(event) =>
                      setSettings((current) =>
                        current
                          ? {
                              ...current,
                              invoiceTitle: event.target.value,
                              invoice_title: event.target.value,
                            }
                          : current,
                      )
                    }
                    className={inputClassName}
                  />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Invoice Footer Note">
                    <textarea
                      rows={3}
                      value={settings.invoiceFooterNote ?? settings.invoice_footer_note ?? ""}
                      onChange={(event) =>
                        setSettings((current) =>
                          current
                            ? {
                                ...current,
                                invoiceFooterNote: event.target.value,
                                invoice_footer_note: event.target.value,
                              }
                            : current,
                        )
                      }
                      className={inputClassName}
                    />
                  </Field>
                </div>
                <div className="md:col-span-2">
                  <Field label="Invoice Terms">
                    <textarea
                      rows={4}
                      value={settings.invoiceTerms ?? settings.invoice_terms ?? ""}
                      onChange={(event) =>
                        setSettings((current) =>
                          current
                            ? {
                                ...current,
                                invoiceTerms: event.target.value,
                                invoice_terms: event.target.value,
                              }
                            : current,
                        )
                      }
                      className={inputClassName}
                    />
                  </Field>
                </div>
                <div className="md:col-span-2">
                  <Field label="Payment Instructions">
                    <textarea
                      rows={4}
                      value={settings.paymentInstructions ?? settings.payment_instructions ?? ""}
                      onChange={(event) =>
                        setSettings((current) =>
                          current
                            ? {
                                ...current,
                                paymentInstructions: event.target.value,
                                payment_instructions: event.target.value,
                              }
                            : current,
                        )
                      }
                      className={inputClassName}
                    />
                  </Field>
                </div>
              </div>

              <SaveButton isSaving={isSavingSettings} label="Save Company Info" />
            </form>
          ) : null}

          {activeTab === "Account" ? (
            <section className="card-base p-6">
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-[var(--color-accent)]" />
                <h2 className="text-lg font-bold text-[var(--color-txt-pri)]">Account Settings</h2>
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <Field label="Full Name">
                  <input
                    value={accountDraft.fullName}
                    onChange={(event) =>
                      setAccountDraft((current) => ({ ...current, fullName: event.target.value }))
                    }
                    className={inputClassName}
                  />
                </Field>
                <Field label="Email Address">
                  <input value={accountDraft.email} className={inputClassName} disabled />
                </Field>
              </div>
              <div className="mt-5 rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-800">
                Per-user account preferences are not first-class backend rows in this phase, so this panel mirrors the v1 layout but stays read-mostly for now.
              </div>
            </section>
          ) : null}

          {activeTab === "Notifications" ? (
            <section className="card-base p-6">
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-[var(--color-accent)]" />
                <h2 className="text-lg font-bold text-[var(--color-txt-pri)]">Notifications</h2>
              </div>
              <div className="mt-6 space-y-3">
                {[
                  ["emailOrders", "Email on new orders"],
                  ["emailInventory", "Email on low inventory"],
                  ["pushOrders", "Push notifications for orders"],
                  ["pushInventory", "Push notifications for inventory"],
                  ["smsAlerts", "SMS alerts"],
                ].map(([key, label]) => (
                  <ToggleRow
                    key={key}
                    label={label}
                    checked={notificationDraft[key as keyof typeof notificationDraft]}
                    onChange={(value) =>
                      setNotificationDraft((current) => ({
                        ...current,
                        [key]: value,
                      }))
                    }
                  />
                ))}
              </div>
              <div className="mt-5 rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-800">
                This keeps the v1 toggle layout visible, but per-user notification preferences are still not persisted as first-class backend rows.
              </div>
            </section>
          ) : null}

          {activeTab === "Security" ? (
            <section className="card-base p-6">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-[var(--color-accent)]" />
                <h2 className="text-lg font-bold text-[var(--color-txt-pri)]">Security Settings</h2>
              </div>
              <div className="mt-6 space-y-4">
                <ToggleRow
                  label="Two-factor authentication"
                  checked={securityDraft.twoFactor}
                  onChange={(value) =>
                    setSecurityDraft((current) => ({ ...current, twoFactor: value }))
                  }
                />
                <Field label="Session Timeout (minutes)">
                  <input
                    value={securityDraft.sessionTimeout}
                    onChange={(event) =>
                      setSecurityDraft((current) => ({
                        ...current,
                        sessionTimeout: event.target.value,
                      }))
                    }
                    className={inputClassName}
                  />
                </Field>
                <Field label="IP Whitelist">
                  <input
                    value={securityDraft.ipWhitelist}
                    onChange={(event) =>
                      setSecurityDraft((current) => ({
                        ...current,
                        ipWhitelist: event.target.value,
                      }))
                    }
                    className={inputClassName}
                    placeholder="Optional restricted IP list"
                  />
                </Field>
              </div>
              <div className="mt-5 rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-800">
                Security preferences remain visually represented here, but this phase does not add a new per-user security settings backend model.
              </div>
            </section>
          ) : null}

          {activeTab === "Integrations" ? (
            <section className="card-base p-6">
              <div className="flex items-center gap-3">
                <Globe className="h-5 w-5 text-[var(--color-accent)]" />
                <h2 className="text-lg font-bold text-[var(--color-txt-pri)]">Integrations</h2>
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <LinkCard
                  href="/dashboard/woocommerce"
                  title="WooCommerce"
                  description="Use the existing safe settings, manual preview/import, and sync logs."
                />
                <LinkCard
                  href="/dashboard/courier-integrations"
                  title="Courier Integrations"
                  description="Open encrypted provider settings, manual send/sync, and sanitized API logs."
                />
              </div>
            </section>
          ) : null}

          {activeTab === "SMS Settings" ? (
            <section className="card-base p-6">
              <div className="flex items-center gap-3">
                <Smartphone className="h-5 w-5 text-[var(--color-accent)]" />
                <h2 className="text-lg font-bold text-[var(--color-txt-pri)]">
                  SMS Confirmation Settings
                </h2>
              </div>
              <div className="mt-6 space-y-4">
                <ToggleRow
                  label="Enable order confirmation SMS"
                  checked={smsDraft.enableOrderConfirmation}
                  onChange={(value) =>
                    setSmsDraft((current) => ({ ...current, enableOrderConfirmation: value }))
                  }
                />
                <Field label="SMS Gateway">
                  <select
                    value={smsDraft.gateway}
                    onChange={(event) =>
                      setSmsDraft((current) => ({ ...current, gateway: event.target.value }))
                    }
                    className={inputClassName}
                  >
                    <option>Twilio</option>
                    <option>BulksmsBD</option>
                    <option>MimSMS</option>
                  </select>
                </Field>
                <Field label="Sender ID">
                  <input
                    value={smsDraft.senderId}
                    onChange={(event) =>
                      setSmsDraft((current) => ({ ...current, senderId: event.target.value }))
                    }
                    className={inputClassName}
                  />
                </Field>
                <Field label="Message Template">
                  <textarea
                    rows={4}
                    value={smsDraft.template}
                    onChange={(event) =>
                      setSmsDraft((current) => ({ ...current, template: event.target.value }))
                    }
                    className={inputClassName}
                  />
                </Field>
              </div>
              <div className="mt-5 rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-800">
                SMS layout is restored for parity, but this phase does not introduce a new SMS backend settings model.
              </div>
            </section>
          ) : null}

          {activeTab === "Data Management" ? (
            <section className="card-base p-6">
              <div className="flex items-center gap-3">
                <Database className="h-5 w-5 text-[var(--color-accent)]" />
                <h2 className="text-lg font-bold text-[var(--color-txt-pri)]">Data Management</h2>
              </div>
              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-5">
                  <p className="text-sm font-bold text-amber-900">Safe export only</p>
                  <p className="mt-2 text-sm leading-6 text-amber-800">
                    CSV exports, backup guidance, and maintenance checks remain available through the existing safe admin surfaces.
                  </p>
                  <Link
                    href="/dashboard/admin-tools"
                    className="mt-4 inline-flex rounded-full border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-900 transition hover:bg-white/60"
                  >
                    Open Admin Tools
                  </Link>
                </div>
                <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-5 py-5">
                  <p className="text-sm font-bold text-rose-900">No destructive restore execution</p>
                  <p className="mt-2 text-sm leading-6 text-rose-800">
                    The v1 control-center feel is preserved, but restore and purge operations are intentionally kept as guidance-only to protect the current backend safety model.
                  </p>
                </div>
              </div>
            </section>
          ) : null}

          {activeTab === "Mobile App" ? (
            <section className="card-base p-6">
              <div className="flex items-center gap-3">
                <Smartphone className="h-5 w-5 text-[var(--color-accent)]" />
                <h2 className="text-lg font-bold text-[var(--color-txt-pri)]">Mobile App Settings</h2>
              </div>
              <div className="mt-6 rounded-[24px] border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-5 py-5">
                <p className="text-sm font-bold text-[var(--color-txt-pri)]">Install workflow placeholder</p>
                <p className="mt-2 text-sm leading-6 text-[var(--color-txt-sec)]">
                  The v1 mobile panel is represented here, but mobile preference persistence is still not a first-class backend row in this phase.
                </p>
                <p className="mt-4 text-sm text-[var(--color-txt-sec)]">
                  App URL:{" "}
                  <span className="font-semibold text-[var(--color-txt-pri)]">
                    {typeof window !== "undefined" ? window.location.origin : "Current host"}
                  </span>
                </p>
              </div>
            </section>
          ) : null}

          {activeTab === "Activity Logs" ? (
            <section className="card-base p-6">
              <div className="flex items-center gap-3">
                <ClipboardList className="h-5 w-5 text-[var(--color-accent)]" />
                <h2 className="text-lg font-bold text-[var(--color-txt-pri)]">Activity Logs</h2>
              </div>
              <div className="mt-6 overflow-x-auto">
                <table className="min-w-full text-left">
                  <thead>
                    <tr className="border-b border-[var(--color-brd)] text-[11px] uppercase tracking-[0.18em] text-[var(--color-txt-mut)]">
                      <th className="px-3 py-3">Time</th>
                      <th className="px-3 py-3">User</th>
                      <th className="px-3 py-3">Action</th>
                      <th className="px-3 py-3">Module</th>
                      <th className="px-3 py-3">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-3 py-10 text-center text-sm text-[var(--color-txt-mut)]"
                        >
                          No recent settings activity found.
                        </td>
                      </tr>
                    ) : (
                      logs.map((log) => (
                        <tr key={log.id} className="border-b border-[var(--color-brd)]/60">
                          <td className="px-3 py-4 text-sm text-[var(--color-txt-sec)]">
                            {formatDateTime(log.createdAt || log.created_at || null)}
                          </td>
                          <td className="px-3 py-4 text-sm font-semibold text-[var(--color-txt-pri)]">
                            {log.userName || "System"}
                          </td>
                          <td className="px-3 py-4">
                            <OpsStatusBadge label={log.actionLabel || log.action} tone="info" />
                          </td>
                          <td className="px-3 py-4 text-sm text-[var(--color-txt-sec)]">
                            {log.moduleLabel || "Settings"}
                          </td>
                          <td className="px-3 py-4 text-sm text-[var(--color-txt-sec)]">
                            {log.message}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          <section className="card-base p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-[var(--color-txt-pri)]">Invoice Templates</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--color-txt-sec)]">
                  Default template selection and reusable invoice copy stay in the same broad settings center, just like v1.
                </p>
              </div>
              <button
                type="button"
                onClick={() => openTemplateModal()}
                className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--color-accent-hover)]"
              >
                Add Template
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {templates.length === 0 ? (
                <div className="rounded-[20px] border border-dashed border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-5 py-8 text-sm text-[var(--color-txt-mut)]">
                  No invoice templates created yet.
                </div>
              ) : (
                templates.map((template) => {
                  const isDefault = template.isDefault ?? template.is_default;
                  const isActive = template.isActive ?? template.is_active;
                  return (
                    <article
                      key={template.id}
                      className="rounded-[24px] border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-5 py-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-base font-bold text-[var(--color-txt-pri)]">
                              {template.templateName || template.name}
                            </h4>
                            <OpsStatusBadge
                              label={isDefault ? "Default" : isActive ? "Active" : "Inactive"}
                              tone={isDefault ? "success" : isActive ? "info" : "warning"}
                            />
                          </div>
                          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[var(--color-txt-mut)]">
                            {template.slug}
                          </p>
                          {template.description ? (
                            <p className="mt-3 text-sm leading-6 text-[var(--color-txt-sec)]">
                              {template.description}
                            </p>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {!isDefault ? (
                            <button
                              type="button"
                              onClick={() => void handleSetDefault(template)}
                              disabled={busyTemplateId === template.id}
                              className="rounded-full border border-[var(--color-brd)] px-4 py-2 text-sm font-semibold text-[var(--color-txt-sec)] transition hover:bg-white disabled:opacity-60"
                            >
                              Set Default
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => openTemplateModal(template)}
                            className="rounded-full border border-[var(--color-brd)] px-4 py-2 text-sm font-semibold text-[var(--color-txt-sec)] transition hover:bg-white"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeactivate(template)}
                            disabled={busyTemplateId === template.id}
                            className="rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"
                          >
                            Deactivate
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </div>

      {isTemplateModalOpen ? (
        <ControlModal
          title={editingTemplate ? "Edit Invoice Template" : "Add Invoice Template"}
          description="Keep the template editor in a modal-first loop so the settings center stays close to the v1 workflow."
          onClose={closeTemplateModal}
        >
          <form onSubmit={handleTemplateSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Template Name">
                <input
                  value={templateForm.templateName}
                  onChange={(event) =>
                    setTemplateForm((current) => ({
                      ...current,
                      templateName: event.target.value,
                    }))
                  }
                  className={inputClassName}
                  required
                />
              </Field>
              <Field label="Slug">
                <input
                  value={templateForm.slug}
                  onChange={(event) =>
                    setTemplateForm((current) => ({ ...current, slug: event.target.value }))
                  }
                  className={inputClassName}
                  required
                />
              </Field>
            </div>
            <Field label="Description">
              <textarea
                rows={2}
                value={templateForm.description}
                onChange={(event) =>
                  setTemplateForm((current) => ({ ...current, description: event.target.value }))
                }
                className={inputClassName}
              />
            </Field>
            <Field label="Accent Color">
              <input
                value={templateForm.accentColor}
                onChange={(event) =>
                  setTemplateForm((current) => ({ ...current, accentColor: event.target.value }))
                }
                className={inputClassName}
                placeholder="#0866FF"
              />
            </Field>
            <Field label="Header Text">
              <textarea
                rows={2}
                value={templateForm.headerText}
                onChange={(event) =>
                  setTemplateForm((current) => ({ ...current, headerText: event.target.value }))
                }
                className={inputClassName}
              />
            </Field>
            <Field label="Footer Text">
              <textarea
                rows={3}
                value={templateForm.footerText}
                onChange={(event) =>
                  setTemplateForm((current) => ({ ...current, footerText: event.target.value }))
                }
                className={inputClassName}
              />
            </Field>
            <Field label="Terms Text">
              <textarea
                rows={3}
                value={templateForm.termsText}
                onChange={(event) =>
                  setTemplateForm((current) => ({ ...current, termsText: event.target.value }))
                }
                className={inputClassName}
              />
            </Field>
            <Field label="Payment Instructions">
              <textarea
                rows={3}
                value={templateForm.paymentInstructions}
                onChange={(event) =>
                  setTemplateForm((current) => ({
                    ...current,
                    paymentInstructions: event.target.value,
                  }))
                }
                className={inputClassName}
              />
            </Field>
            <ToggleRow
              label="Template is active"
              checked={templateForm.isActive}
              onChange={(value) =>
                setTemplateForm((current) => ({ ...current, isActive: value }))
              }
            />
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="submit"
                disabled={isSavingTemplate}
                className="rounded-full bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
              >
                {isSavingTemplate ? "Saving..." : editingTemplate ? "Update Template" : "Create Template"}
              </button>
              <button
                type="button"
                onClick={closeTemplateModal}
                className="rounded-full border border-[var(--color-brd)] px-5 py-2.5 text-sm font-semibold text-[var(--color-txt-sec)] transition hover:bg-[var(--color-surf-hover)]"
              >
                Cancel
              </button>
            </div>
          </form>
        </ControlModal>
      ) : null}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-txt-mut)]">
        {label}
      </span>
      {children}
    </label>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-[20px] border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3">
      <span className="text-sm font-medium text-[var(--color-txt-pri)]">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-12 rounded-full transition ${checked ? "bg-slate-950" : "bg-slate-300"}`}
      >
        <span
          className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${checked ? "right-1" : "left-1"}`}
        />
      </button>
    </label>
  );
}

function SaveButton({ isSaving, label }: { isSaving: boolean; label: string }) {
  return (
    <div className="mt-6 flex justify-end">
      <button
        type="submit"
        disabled={isSaving}
        className="inline-flex items-center gap-2 rounded-full bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
      >
        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {isSaving ? "Saving..." : label}
      </button>
    </div>
  );
}

function LinkCard({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-[24px] border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-5 py-5 shadow-[var(--shadow-sub)] transition hover:bg-white"
    >
      <p className="text-sm font-bold text-[var(--color-txt-pri)]">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[var(--color-txt-sec)]">{description}</p>
    </Link>
  );
}

const inputClassName =
  "w-full rounded-[18px] border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm text-[var(--color-txt-pri)] outline-none transition focus:border-[var(--color-accent)] focus:bg-white";
