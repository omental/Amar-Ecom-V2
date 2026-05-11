"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CalendarClock,
  Loader2,
  Plus,
  Search,
  StickyNote,
  Tag,
  UserRoundPlus,
} from "lucide-react";

import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorAlert } from "@/components/ui/error-alert";
import { FormCard } from "@/components/ui/form-card";
import { LoadingState } from "@/components/ui/loading-state";
import { PageHeader } from "@/components/ui/page-header";
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

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)] sm:p-8">
        <PageHeader
          eyebrow="CRM Workspace"
          title="Customers"
          description="Move beyond a simple directory with customer type, follow-up planning, notes, tags, and direct access to each customer CRM workspace."
          meta={`${customers.length} loaded`}
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-[0.96fr_1.04fr]">
        <FormCard
          title="Create customer"
          description="Capture the profile, segmentation, and follow-up metadata needed for day-to-day CRM work."
          action={
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
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
                  onChange={(event) =>
                    setForm((current) => ({ ...current, customer_type: event.target.value }))
                  }
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
                  onChange={(event) =>
                    setForm((current) => ({ ...current, follow_up_date: event.target.value }))
                  }
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

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
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
            </button>
          </form>
        </FormCard>

        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
          <PageHeader
            eyebrow="CRM Directory"
            title="Customer list"
            description="Search by contact details or CRM notes, filter by type, and jump into each customer workspace."
            meta={`${customers.length} showing`}
          />

          <div className="mt-6 space-y-4">
            <div className="grid gap-4 md:grid-cols-[1fr_220px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                  placeholder="Search by name, phone, email, city, tags, or notes"
                />
              </div>

              <select
                value={customerTypeFilter}
                onChange={(event) => setCustomerTypeFilter(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
              >
                {customerTypeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === "all" ? "All types" : formatLabel(option)}
                  </option>
                ))}
              </select>
            </div>

            {isLoading ? (
              <LoadingState label="Loading customers..." />
            ) : customers.length === 0 ? (
              <EmptyState
                title="No customers match the current filters"
                description="Try a broader search, switch the type filter, or add a new customer from the CRM form."
              />
            ) : (
              <DataTable
                columns={[
                  "Name",
                  "Phone",
                  "Email",
                  "City",
                  "Type",
                  "CRM",
                  "Follow-up",
                  "Created",
                  "Actions",
                ]}
              >
                {customers.map((customer) => {
                  const tagList = parseTags(customer.tags);
                  const hasNotes = Boolean(customer.notes?.trim());
                  return (
                    <div
                      key={customer.id}
                      className="grid grid-cols-1 gap-3 px-5 py-4 text-sm text-slate-600 xl:grid-cols-9 xl:gap-4"
                    >
                      <div>
                        <p className="font-medium text-slate-950">{customer.name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Last contacted: {formatDateTime(customer.last_contacted_at)}
                        </p>
                      </div>
                      <span>{customer.phone}</span>
                      <span>{customer.email || "No email"}</span>
                      <span>{customer.city || "No city"}</span>
                      <span>
                        <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                          {formatLabel(customer.customer_type || "regular")}
                        </span>
                      </span>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {tagList.length > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700">
                              <Tag className="h-3.5 w-3.5" />
                              {tagList.length} tags
                            </span>
                          ) : null}
                          {hasNotes ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700">
                              <StickyNote className="h-3.5 w-3.5" />
                              Notes
                            </span>
                          ) : null}
                        </div>
                        <p className="text-xs text-slate-500">
                          {tagList.length > 0 ? tagList.slice(0, 2).join(", ") : "No tags"}
                        </p>
                      </div>
                      <div>
                        {customer.follow_up_date ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                            <CalendarClock className="h-3.5 w-3.5" />
                            {formatDate(customer.follow_up_date)}
                          </span>
                        ) : (
                          <span className="text-slate-400">No follow-up</span>
                        )}
                      </div>
                      <span>{formatDate(customer.created_at)}</span>
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/dashboard/customers/${customer.id}`}
                          className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                        >
                          View CRM
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </DataTable>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
