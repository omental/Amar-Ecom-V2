"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Loader2,
  MessageSquareText,
  PhoneCall,
  Save,
  StickyNote,
  Tag,
  UserCircle2,
} from "lucide-react";

import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { api, ApiError } from "@/lib/api";
import { formatCurrency, formatDate, formatDateTime, formatLabel } from "@/lib/format";

type CustomerOrder = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  total: number | string;
  created_at: string;
};

type CustomerActivity = {
  id: string;
  customer_id: string;
  activity_type: string;
  title: string;
  description: string | null;
  created_by_id: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  created_by?: {
    id: string;
    full_name: string;
  } | null;
};

type CustomerDetail = {
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
  orders: CustomerOrder[];
  activities: CustomerActivity[];
  total_order_count: number;
  total_spend: number | string;
  pending_follow_up_count: number;
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

type ActivityForm = {
  activity_type: string;
  title: string;
  description: string;
  due_date: string;
};

const customerTypeOptions = ["regular", "vip", "wholesale", "reseller", "blocked"];
const activityTypeOptions = ["note", "call", "follow_up", "complaint", "order_related", "system"];

function parseTags(tags: string | null | undefined) {
  return (tags || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function activityIcon(activityType: string) {
  if (activityType === "call") {
    return PhoneCall;
  }

  if (activityType === "follow_up") {
    return CalendarClock;
  }

  return MessageSquareText;
}

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const customerId = params.id;

  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [form, setForm] = useState<CustomerForm>({
    name: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    customer_type: "regular",
    tags: "",
    notes: "",
    follow_up_date: "",
  });
  const [activityForm, setActivityForm] = useState<ActivityForm>({
    activity_type: "note",
    title: "",
    description: "",
    due_date: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isActivitySaving, setIsActivitySaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activitySuccess, setActivitySuccess] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadCustomer() {
      try {
        const data = await api.get<CustomerDetail>(`/customers/${customerId}`);
        if (!isMounted) {
          return;
        }

        setCustomer(data);
        setForm({
          name: data.name,
          phone: data.phone,
          email: data.email || "",
          address: data.address || "",
          city: data.city || "",
          customer_type: data.customer_type || "regular",
          tags: data.tags || "",
          notes: data.notes || "",
          follow_up_date: data.follow_up_date || "",
        });
      } catch (err) {
        if (!isMounted) {
          return;
        }
        setError(err instanceof ApiError ? err.message : "Failed to load customer CRM detail");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadCustomer();
    return () => {
      isMounted = false;
    };
  }, [customerId]);

  async function refreshCustomer() {
    const data = await api.get<CustomerDetail>(`/customers/${customerId}`);
    setCustomer(data);
    setForm({
      name: data.name,
      phone: data.phone,
      email: data.email || "",
      address: data.address || "",
      city: data.city || "",
      customer_type: data.customer_type || "regular",
      tags: data.tags || "",
      notes: data.notes || "",
      follow_up_date: data.follow_up_date || "",
    });
  }

  async function handleSaveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
      await api.patch(`/customers/${customerId}`, {
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
      await refreshCustomer();
      setSuccess("Customer CRM profile updated.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update customer CRM profile");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCreateActivity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setActivitySuccess("");
    setIsActivitySaving(true);

    try {
      await api.post(`/customers/${customerId}/activities`, {
        activity_type: activityForm.activity_type,
        title: activityForm.title,
        description: activityForm.description || null,
        due_date: activityForm.due_date ? new Date(activityForm.due_date).toISOString() : null,
      });
      setActivityForm({
        activity_type: "note",
        title: "",
        description: "",
        due_date: "",
      });
      await refreshCustomer();
      setActivitySuccess("Customer activity added.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create customer activity");
    } finally {
      setIsActivitySaving(false);
    }
  }

  async function markActivityCompleted(activityId: string) {
    setError("");
    setActivitySuccess("");

    try {
      await api.patch(`/customers/${customerId}/activities/${activityId}`, {
        completed_at: new Date().toISOString(),
      });
      await refreshCustomer();
      setActivitySuccess("Activity marked as completed.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update activity");
    }
  }

  if (isLoading) {
    return <LoadingState label="Loading customer CRM detail..." />;
  }

  if (!customer) {
    return (
      <EmptyState
        title="Customer not found"
        description="The CRM record could not be loaded."
      />
    );
  }

  const tagList = parseTags(customer.tags);

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)] sm:p-8">
        <PageHeader
          eyebrow="Customer CRM"
          title={customer.name}
          description="Manage segmentation, notes, follow-ups, and recent order context from one customer-centric workspace."
          meta={customer.customer_type ? formatLabel(customer.customer_type) : "Regular"}
        />

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <article className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Total orders</p>
            <p className="mt-3 text-2xl font-semibold text-slate-950">{customer.total_order_count}</p>
          </article>
          <article className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Total spend</p>
            <p className="mt-3 text-2xl font-semibold text-slate-950">
              {formatCurrency(customer.total_spend)}
            </p>
          </article>
          <article className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Pending follow-ups</p>
            <p className="mt-3 text-2xl font-semibold text-slate-950">
              {customer.pending_follow_up_count}
            </p>
          </article>
          <article className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Last contacted</p>
            <p className="mt-3 text-sm font-semibold text-slate-950">
              {formatDateTime(customer.last_contacted_at)}
            </p>
          </article>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.02fr_0.98fr]">
        <section className="space-y-4 rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Profile Summary</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-950">Customer profile</h2>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <UserCircle2 className="h-5 w-5" />
            </div>
          </div>

          <div className="grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 md:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Phone</p>
              <p className="mt-2 font-medium text-slate-950">{customer.phone}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Email</p>
              <p className="mt-2 font-medium text-slate-950">{customer.email || "No email"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Follow-up date</p>
              <p className="mt-2 font-medium text-slate-950">{formatDate(customer.follow_up_date)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Created</p>
              <p className="mt-2 font-medium text-slate-950">{formatDateTime(customer.created_at)}</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Tags</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {tagList.length > 0 ? (
                  tagList.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
                    >
                      <Tag className="h-3.5 w-3.5" />
                      {tag}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-400">No tags</span>
                )}
              </div>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Name</span>
                <input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                  required
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Phone</span>
                <input
                  value={form.phone}
                  onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                  required
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Email</span>
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">City</span>
                <input
                  value={form.city}
                  onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Address</span>
              <textarea
                rows={3}
                value={form.address}
                onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
              />
            </label>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Customer type</span>
                <select
                  value={form.customer_type}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, customer_type: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                >
                  {customerTypeOptions.map((option) => (
                    <option key={option} value={option}>
                      {formatLabel(option)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-medium text-slate-700">Tags</span>
                <input
                  value={form.tags}
                  onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-[1fr_220px]">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Notes</span>
                <textarea
                  rows={4}
                  value={form.notes}
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
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

            {error ? <ErrorAlert message={error} /> : null}
            {success ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {success}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Customer CRM
                </>
              )}
            </button>
          </form>
        </section>

        <section className="space-y-4">
          <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
            <PageHeader
              eyebrow="Order History"
              title="Recent orders"
              description="Quickly review order context without leaving the customer workspace."
              meta={`${customer.orders.length} recent`}
            />

            <div className="mt-6">
              {customer.orders.length === 0 ? (
                <EmptyState
                  title="No orders yet"
                  description="Order history will appear here once this customer is linked to orders."
                />
              ) : (
                <DataTable columns={["Order #", "Status", "Payment", "Total", "Created", "Action"]}>
                  {customer.orders.map((order) => (
                    <div
                      key={order.id}
                      className="grid grid-cols-1 gap-3 px-5 py-4 text-sm text-slate-600 xl:grid-cols-6 xl:gap-4"
                    >
                      <span className="font-medium text-slate-950">{order.order_number}</span>
                      <span>
                        <StatusBadge status={order.status} />
                      </span>
                      <span>
                        <StatusBadge status={order.payment_status} />
                      </span>
                      <span className="font-medium text-slate-950">{formatCurrency(order.total)}</span>
                      <span>{formatDate(order.created_at)}</span>
                      <Link
                        href={`/dashboard/orders/${order.id}`}
                        className="inline-flex w-fit items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                      >
                        View order
                      </Link>
                    </div>
                  ))}
                </DataTable>
              )}
            </div>
          </article>

          <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
            <PageHeader
              eyebrow="Activity Timeline"
              title="Notes and follow-ups"
              description="Track calls, complaints, and manual follow-ups alongside a quick add form."
              meta={`${customer.activities.length} entries`}
            />

            <form onSubmit={handleCreateActivity} className="mt-6 space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Activity type</span>
                  <select
                    value={activityForm.activity_type}
                    onChange={(event) =>
                      setActivityForm((current) => ({ ...current, activity_type: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400"
                  >
                    {activityTypeOptions.map((option) => (
                      <option key={option} value={option}>
                        {formatLabel(option)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Due date</span>
                  <input
                    type="datetime-local"
                    value={activityForm.due_date}
                    onChange={(event) =>
                      setActivityForm((current) => ({ ...current, due_date: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Title</span>
                <input
                  value={activityForm.title}
                  onChange={(event) =>
                    setActivityForm((current) => ({ ...current, title: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400"
                  placeholder="Call customer about delivery preference"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Description</span>
                <textarea
                  rows={3}
                  value={activityForm.description}
                  onChange={(event) =>
                    setActivityForm((current) => ({ ...current, description: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400"
                  placeholder="Add context for the team..."
                />
              </label>

              {activitySuccess ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {activitySuccess}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isActivitySaving}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isActivitySaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving activity...
                  </>
                ) : (
                  <>
                    <StickyNote className="h-4 w-4" />
                    Add activity
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 space-y-3">
              {customer.activities.length === 0 ? (
                <EmptyState
                  title="No customer activity yet"
                  description="Add a note, follow-up, complaint, or call log to begin the CRM timeline."
                />
              ) : (
                customer.activities.map((activity) => {
                  const ActivityIcon = activityIcon(activity.activity_type);
                  return (
                    <article
                      key={activity.id}
                      className="rounded-3xl border border-slate-200 bg-white p-4"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="flex gap-3">
                          <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                            <ActivityIcon className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-sm font-semibold text-slate-950">{activity.title}</h3>
                              <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                                {formatLabel(activity.activity_type)}
                              </span>
                              {activity.completed_at ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Completed
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-2 text-sm text-slate-600">
                              {activity.description || "No extra description"}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
                              <span>Created {formatDateTime(activity.created_at)}</span>
                              <span>
                                By {activity.created_by?.full_name || "System"}
                              </span>
                              <span>Due {formatDateTime(activity.due_date)}</span>
                            </div>
                          </div>
                        </div>

                        {!activity.completed_at ? (
                          <button
                            type="button"
                            onClick={() => void markActivityCompleted(activity.id)}
                            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Mark completed
                          </button>
                        ) : null}
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </article>
        </section>
      </div>
    </div>
  );
}
