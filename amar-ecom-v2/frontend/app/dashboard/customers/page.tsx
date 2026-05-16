"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  Crown,
  Edit3,
  Loader2,
  Mail,
  Plus,
  Search,
  StickyNote,
  Tag,
  UserRoundPlus,
  Users,
  UserStar,
} from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { ErrorAlert } from "@/components/ui/error-alert";
import { FormCard } from "@/components/ui/form-card";
import { LoadingState } from "@/components/ui/loading-state";
import { OpsActionButton } from "@/components/ui/ops-action-button";
import { OpsDataTable } from "@/components/ui/ops-data-table";
import { OpsFilterBar } from "@/components/ui/ops-filter-bar";
import { OpsPageHeader } from "@/components/ui/ops-page-header";
import { OpsStatusBadge } from "@/components/ui/ops-status-badge";
import { OpsSummaryCard } from "@/components/ui/ops-summary-card";
import { api, ApiError } from "@/lib/api";
import { formatDate, formatDateTime, formatLabel } from "@/lib/format";

type Customer = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  city: string | null;
  customer_type: string | null;
  tags: string | null;
  notes: string | null;
  follow_up_date: string | null;
  last_contacted_at: string | null;
  created_at: string;
  updated_at: string;
};

type CustomerForm = {
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  customer_type: string;
  tags: string;
  notes: string;
  follow_up_date: string;
};

const customerTypeOptions = ["all", "regular", "vip", "wholesale", "reseller", "blocked"];

const initialForm: CustomerForm = {
  name: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  customer_type: "regular",
  tags: "",
  notes: "",
  follow_up_date: "",
};

function buildCustomerQuery(searchTerm: string, customerType: string) {
  const params = new URLSearchParams({
    skip: "0",
    limit: "100",
  });

  if (searchTerm.trim()) {
    params.set("search", searchTerm.trim());
  }

  if (customerType !== "all") {
    params.set("customer_type", customerType);
  }

  return `/customers?${params.toString()}`;
}

function parseTags(tags: string | null | undefined) {
  return (tags || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function getCustomerTone(customerType: string | null | undefined) {
  switch ((customerType || "regular").toLowerCase()) {
    case "vip":
      return "success" as const;
    case "wholesale":
      return "info" as const;
    case "reseller":
      return "warning" as const;
    case "blocked":
      return "danger" as const;
    default:
      return "default" as const;
  }
}

function isFollowUpDue(dateValue: string | null) {
  if (!dateValue) {
    return false;
  }

  const today = new Date();
  const candidate = new Date(dateValue);

  if (Number.isNaN(candidate.getTime())) {
    return false;
  }

  return candidate <= today;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [form, setForm] = useState<CustomerForm>(initialForm);
  const [searchTerm, setSearchTerm] = useState("");
  const [customerTypeFilter, setCustomerTypeFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadCustomers() {
      try {
        const data = await api.get<Customer[]>(buildCustomerQuery(searchTerm, customerTypeFilter));
        if (!isMounted) {
          return;
        }
        setCustomers(data);
      } catch (err) {
        if (!isMounted) {
          return;
        }
        setError(err instanceof ApiError ? err.message : "Failed to load customers");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadCustomers();
    return () => {
      isMounted = false;
    };
  }, [customerTypeFilter, searchTerm]);

  async function reloadCustomers() {
    setError("");
    const data = await api.get<Customer[]>(buildCustomerQuery(searchTerm, customerTypeFilter));
    setCustomers(data);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSubmitting(true);

    try {
      await api.post<Customer>("/customers", {
        name: form.name,
        phone: form.phone,
        email: form.email || null,
        address: form.address || null,
        city: form.city || null,
        customer_type: form.customer_type || null,
        tags: form.tags || null,
        notes: form.notes || null,
        follow_up_date: form.follow_up_date || null,
      });
      setForm(initialForm);
      setSuccess("Customer created successfully.");
      await reloadCustomers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create customer");
    } finally {
      setIsSubmitting(false);
    }
  }

  const crmSummary = useMemo(() => {
    const vip = customers.filter((customer) => customer.customer_type === "vip").length;
    const regular = customers.filter(
      (customer) => !customer.customer_type || customer.customer_type === "regular",
    ).length;
    const wholesale = customers.filter((customer) => customer.customer_type === "wholesale").length;
    const followUpDue = customers.filter((customer) => isFollowUpDue(customer.follow_up_date)).length;
    const recentlyContacted = customers.filter((customer) => {
      if (!customer.last_contacted_at) {
        return false;
      }
      const lastContacted = new Date(customer.last_contacted_at);
      const threshold = new Date();
      threshold.setDate(threshold.getDate() - 7);
      return !Number.isNaN(lastContacted.getTime()) && lastContacted >= threshold;
    }).length;

    return {
      total: customers.length,
      regular,
      vip,
      wholesale,
      followUpDue,
      recentlyContacted,
    };
  }, [customers]);

  return (
    <div className="space-y-5">
      <section className="card-base px-6 py-7 sm:px-8">
        <OpsPageHeader
          eyebrow="CRM Operations Console"
          title="Customers and follow-up workspace"
          description="Keep the customer directory, segmentation, follow-up planning, and quick CRM entry in one denser operator surface closer to the legacy v1 rhythm."
          meta={<span>{customers.length} profiles loaded</span>}
          actions={
            <div className="flex flex-wrap gap-3">
              <div className="rounded-[20px] border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm font-medium text-[var(--color-txt-sec)]">
                Manual CRM only
              </div>
            </div>
          }
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <OpsSummaryCard eyebrow="CRM KPI" label="Total customers" value={crmSummary.total} icon={Users} tone="default" />
        <OpsSummaryCard eyebrow="CRM KPI" label="Regular" value={crmSummary.regular} icon={Users} tone="info" />
        <OpsSummaryCard eyebrow="CRM KPI" label="VIP" value={crmSummary.vip} icon={Crown} tone="success" />
        <OpsSummaryCard eyebrow="CRM KPI" label="Wholesale" value={crmSummary.wholesale} icon={UserStar} tone="warning" />
        <OpsSummaryCard eyebrow="CRM KPI" label="Follow-ups due" value={crmSummary.followUpDue} icon={CalendarClock} tone="danger" />
        <OpsSummaryCard eyebrow="CRM KPI" label="Recent activity" value={crmSummary.recentlyContacted} icon={Mail} tone="default" />
      </section>

      <OpsFilterBar
        title="CRM Filters"
        description="Switch quickly between customer segments and follow-up queues while keeping the create panel open for new entries."
      >
        {[
          { label: "All", value: "all" },
          { label: "Regular", value: "regular" },
          { label: "VIP", value: "vip" },
          { label: "Wholesale", value: "wholesale" },
          { label: "Follow-up", value: "follow_up" },
        ].map((chip) => {
          const isActive =
            chip.value === "follow_up"
              ? customerTypeFilter === "all" && searchTerm.trim().toLowerCase() === "follow-up"
              : customerTypeFilter === chip.value;

          return (
            <button
              key={chip.value}
              type="button"
              onClick={() => {
                if (chip.value === "follow_up") {
                  setCustomerTypeFilter("all");
                  setSearchTerm("follow-up");
                  return;
                }
                setCustomerTypeFilter(chip.value);
                if (searchTerm.trim().toLowerCase() === "follow-up") {
                  setSearchTerm("");
                }
              }}
              className={`${isActive ? "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]" : "ops-filter-chip"}`}
            >
              {chip.label}
            </button>
          );
        })}

        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-txt-mut)]" />
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="w-full rounded-full border border-[var(--color-brd)] bg-white py-3 pl-11 pr-4 text-sm text-[var(--color-txt-pri)] outline-none transition focus:border-[var(--color-accent)]"
            placeholder="Search by name, phone, email, city, tags, or notes"
          />
        </div>

        <select
          value={customerTypeFilter}
          onChange={(event) => setCustomerTypeFilter(event.target.value)}
          className="rounded-full border border-[var(--color-brd)] bg-white px-4 py-3 text-sm text-[var(--color-txt-pri)] outline-none transition focus:border-[var(--color-accent)]"
        >
          {customerTypeOptions.map((option) => (
            <option key={option} value={option}>
              {option === "all" ? "All types" : formatLabel(option)}
            </option>
          ))}
        </select>
      </OpsFilterBar>

      <div className="grid gap-4 xl:grid-cols-[0.96fr_1.04fr]">
        <FormCard
          title="Create customer"
          description="Capture segmentation, contact details, follow-up date, and notes without leaving the CRM operations screen."
          action={
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-surf-hover)] text-[var(--color-txt-sec)]">
              <UserRoundPlus className="h-5 w-5" />
            </div>
          }
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Name</span>
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                placeholder="Rahim Uddin"
                required
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Phone</span>
                <input
                  value={form.phone}
                  onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                  placeholder="01700000000"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Email</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                  placeholder="rahim@example.com"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">City</span>
                <input
                  value={form.city}
                  onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                  placeholder="Dhaka"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Customer type</span>
                <select
                  value={form.customer_type}
                  onChange={(event) => setForm((current) => ({ ...current, customer_type: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                >
                  {customerTypeOptions
                    .filter((option) => option !== "all")
                    .map((option) => (
                      <option key={option} value={option}>
                        {formatLabel(option)}
                      </option>
                    ))}
                </select>
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Address</span>
              <textarea
                rows={3}
                value={form.address}
                onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                placeholder="House 12, road 5, Dhaka"
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Tags</span>
                <input
                  value={form.tags}
                  onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                  placeholder="repeat, vip, priority"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Follow-up date</span>
                <input
                  type="date"
                  value={form.follow_up_date}
                  onChange={(event) => setForm((current) => ({ ...current, follow_up_date: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Notes</span>
              <textarea
                rows={4}
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                placeholder="Preferred time to call, delivery preferences, complaint context..."
              />
            </label>

            {error ? <ErrorAlert message={error} /> : null}
            {success ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {success}
              </div>
            ) : null}

            <OpsActionButton type="submit" variant="primary" disabled={isSubmitting} className="flex w-full">
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Create Customer
                </>
              )}
            </OpsActionButton>
          </form>
        </FormCard>

        <section className="card-base p-6">
          <OpsPageHeader
            eyebrow="CRM Directory"
            title="Customer list"
            description="Search by contact details or CRM notes, filter by segment, and jump into each customer workspace with stronger row context."
            meta={<span>{customers.length} showing</span>}
          />

          <div className="mt-6">
            {isLoading ? (
              <LoadingState label="Loading customers..." />
            ) : customers.length === 0 ? (
              <EmptyState
                title="No customers match the current filters"
                description="Try a broader search, switch the customer type filter, or add a new customer from the CRM panel."
              />
            ) : (
              <OpsDataTable columns={["Customer", "CRM State", "Follow-up", "Contact", "Actions"]}>
                {customers.map((customer) => {
                  const tagList = parseTags(customer.tags);
                  const hasNotes = Boolean(customer.notes?.trim());
                  const followUpDue = isFollowUpDue(customer.follow_up_date);

                  return (
                    <div
                      key={customer.id}
                      className="grid grid-cols-1 gap-4 px-5 py-5 text-sm text-[var(--color-txt-sec)] xl:grid-cols-5 xl:items-start"
                    >
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-[var(--color-txt-pri)]">{customer.name}</p>
                          <OpsStatusBadge
                            label={formatLabel(customer.customer_type || "regular")}
                            tone={getCustomerTone(customer.customer_type)}
                          />
                        </div>
                        <div className="space-y-1 text-xs text-[var(--color-txt-mut)]">
                          <p>{customer.phone}</p>
                          <p>{customer.email || "No email on record"}</p>
                          <p>{customer.city || "City not set"}</p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2">
                          {tagList.length > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                              <Tag className="h-3.5 w-3.5" />
                              {tagList.length} tag{tagList.length > 1 ? "s" : ""}
                            </span>
                          ) : null}
                          {hasNotes ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                              <StickyNote className="h-3.5 w-3.5" />
                              Notes
                            </span>
                          ) : null}
                        </div>
                        <p className="text-xs leading-6 text-[var(--color-txt-mut)]">
                          {tagList.length > 0 ? tagList.slice(0, 3).join(", ") : "No CRM tags yet"}
                        </p>
                        <p className="text-xs text-[var(--color-txt-mut)]">
                          Last contacted: {formatDateTime(customer.last_contacted_at)}
                        </p>
                      </div>

                      <div className="space-y-2">
                        {customer.follow_up_date ? (
                          <OpsStatusBadge
                            label={followUpDue ? `Due ${formatDate(customer.follow_up_date)}` : `Scheduled ${formatDate(customer.follow_up_date)}`}
                            tone={followUpDue ? "warning" : "info"}
                            dot
                          />
                        ) : (
                          <OpsStatusBadge label="No follow-up set" tone="default" />
                        )}
                        <p className="text-xs text-[var(--color-txt-mut)]">
                          Created {formatDate(customer.created_at)}
                        </p>
                      </div>

                      <div className="space-y-1 text-xs text-[var(--color-txt-mut)]">
                        <p>{customer.address || "Address not set"}</p>
                        <p>Updated {formatDateTime(customer.updated_at)}</p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Link href={`/dashboard/customers/${customer.id}`} className="btn-primary">
                          View CRM
                        </Link>
                        <Link href={`/dashboard/customers/${customer.id}#crm-panel`} className="ops-filter-chip">
                          <Edit3 className="h-3.5 w-3.5" />
                          Edit
                        </Link>
                        <Link href={`/dashboard/customers/${customer.id}#activity-panel`} className="ops-filter-chip">
                          <CalendarClock className="h-3.5 w-3.5" />
                          Add Activity
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </OpsDataTable>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
