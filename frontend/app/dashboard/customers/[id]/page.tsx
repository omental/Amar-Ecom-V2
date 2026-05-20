"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Loader2,
  Mail,
  MessageSquareText,
  PhoneCall,
  Save,
  ShieldCheck,
  ShoppingBag,
  StickyNote,
  UserCircle2,
} from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading-state";
import { OpsActionButton } from "@/components/ui/ops-action-button";
import { OpsDataTable } from "@/components/ui/ops-data-table";
import { OpsPageHeader } from "@/components/ui/ops-page-header";
import { OpsStatusBadge } from "@/components/ui/ops-status-badge";
import { OpsSummaryCard } from "@/components/ui/ops-summary-card";
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

function customerTone(customerType: string | null | undefined) {
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

function followUpState(customer: CustomerDetail) {
  if (!customer.follow_up_date) {
    return { label: "No follow-up set", tone: "default" as const };
  }

  const followUp = new Date(customer.follow_up_date);
  if (Number.isNaN(followUp.getTime())) {
    return { label: "Follow-up scheduled", tone: "info" as const };
  }

  if (followUp <= new Date()) {
    return { label: `Due ${formatDate(customer.follow_up_date)}`, tone: "warning" as const };
  }

  return { label: `Scheduled ${formatDate(customer.follow_up_date)}`, tone: "info" as const };
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
      <EmptyState title="Customer not found" description="The CRM record could not be loaded." />
    );
  }

  const tagList = parseTags(customer.tags);
  const followUp = followUpState(customer);

  return (
    <div className="space-y-5">
      <section className="card-base px-6 py-7 sm:px-8">
        <OpsPageHeader
          eyebrow="CRM Profile"
          title={customer.name}
          description="Review contact context, follow-up state, recent orders, and activity history from one customer operator panel."
          meta={<span>{formatLabel(customer.customer_type || "regular")}</span>}
          actions={
            <div className="flex flex-wrap gap-2">
              <OpsStatusBadge label={formatLabel(customer.customer_type || "regular")} tone={customerTone(customer.customer_type)} />
              <OpsStatusBadge label={followUp.label} tone={followUp.tone} dot />
              {tagList.slice(0, 2).map((tag) => (
                <OpsStatusBadge key={tag} label={tag} tone="default" />
              ))}
            </div>
          }
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <OpsSummaryCard eyebrow="CRM KPI" label="Total orders" value={customer.total_order_count} icon={ShoppingBag} tone="info" />
        <OpsSummaryCard eyebrow="CRM KPI" label="Total spend" value={formatCurrency(customer.total_spend)} icon={ShieldCheck} tone="success" />
        <OpsSummaryCard eyebrow="CRM KPI" label="Pending follow-ups" value={customer.pending_follow_up_count} icon={CalendarClock} tone="warning" />
        <OpsSummaryCard eyebrow="CRM KPI" label="Last contacted" value={formatDateTime(customer.last_contacted_at)} icon={Mail} tone="default" />
      </section>

      {error ? <ErrorAlert message={error} /> : null}

      <div className="grid gap-4 xl:grid-cols-[0.98fr_1.02fr]">
        <section className="space-y-4">
          <article className="card-base p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="ops-micro-label">Profile Summary</p>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--color-txt-pri)]">
                  Customer workspace
                </h2>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] text-[var(--color-txt-sec)]">
                <UserCircle2 className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <div className="rounded-[20px] border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-4">
                <p className="ops-micro-label">Contact</p>
                <p className="mt-2 text-sm font-semibold text-[var(--color-txt-pri)]">{customer.phone}</p>
                <p className="mt-1 text-sm text-[var(--color-txt-sec)]">{customer.email || "No email on record"}</p>
              </div>
              <div className="rounded-[20px] border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-4">
                <p className="ops-micro-label">Location</p>
                <p className="mt-2 text-sm font-semibold text-[var(--color-txt-pri)]">{customer.city || "City not set"}</p>
                <p className="mt-1 text-sm text-[var(--color-txt-sec)]">{customer.address || "Address not recorded"}</p>
              </div>
              <div className="rounded-[20px] border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-4">
                <p className="ops-micro-label">Follow-up</p>
                <p className="mt-2 text-sm font-semibold text-[var(--color-txt-pri)]">{followUp.label}</p>
                <p className="mt-1 text-sm text-[var(--color-txt-sec)]">
                  Updated {formatDateTime(customer.updated_at)}
                </p>
              </div>
              <div className="rounded-[20px] border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-4">
                <p className="ops-micro-label">Tags</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {tagList.length > 0 ? (
                    tagList.map((tag) => (
                      <OpsStatusBadge key={tag} label={tag} tone="default" />
                    ))
                  ) : (
                    <p className="text-sm text-[var(--color-txt-mut)]">No tags yet</p>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-[20px] border border-[var(--color-brd)] bg-white px-4 py-4">
              <p className="ops-micro-label">Notes</p>
              <p className="mt-3 text-sm leading-7 text-[var(--color-txt-sec)]">
                {customer.notes || "No CRM notes saved yet."}
              </p>
            </div>
          </article>

          <article className="card-base p-6">
            <OpsPageHeader
              eyebrow="Order History"
              title="Recent orders"
              description="Review the most recent order and payment context without leaving the customer workspace."
              meta={<span>{customer.orders.length} recent</span>}
            />

            <div className="mt-6">
              {customer.orders.length === 0 ? (
                <EmptyState
                  title="No orders yet"
                  description="Order history will appear here once this customer is linked to orders."
                />
              ) : (
                <OpsDataTable columns={["Order", "Status", "Payment", "Value", "Created", "Action"]}>
                  {customer.orders.map((order) => (
                    <div
                      key={order.id}
                      className="grid grid-cols-1 gap-4 px-5 py-4 text-sm text-[var(--color-txt-sec)] xl:grid-cols-6 xl:items-center"
                    >
                      <div>
                        <p className="font-semibold text-[var(--color-txt-pri)]">{order.order_number}</p>
                        <p className="mt-1 text-xs text-[var(--color-txt-mut)]">Created {formatDate(order.created_at)}</p>
                      </div>
                      <span><OpsStatusBadge label={formatLabel(order.status)} tone="info" /></span>
                      <span><OpsStatusBadge label={formatLabel(order.payment_status)} tone={order.payment_status === "paid" ? "success" : "warning"} /></span>
                      <span className="font-semibold text-[var(--color-txt-pri)]">{formatCurrency(order.total)}</span>
                      <span>{formatDate(order.created_at)}</span>
                      <Link href={`/dashboard/orders/${order.id}`} className="ops-filter-chip">
                        View order
                      </Link>
                    </div>
                  ))}
                </OpsDataTable>
              )}
            </div>
          </article>
        </section>

        <section className="space-y-4">
          <article id="crm-panel" className="card-base p-6">
            <OpsPageHeader
              eyebrow="CRM Edit Panel"
              title="Update customer profile"
              description="Edit contact details, segmentation, notes, and follow-up timing with the same safe CRM behavior."
            />

            <form onSubmit={handleSaveProfile} className="mt-6 space-y-4">
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
                    onChange={(event) => setForm((current) => ({ ...current, customer_type: event.target.value }))}
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
                    onChange={(event) => setForm((current) => ({ ...current, follow_up_date: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                  />
                </label>
              </div>

              {success ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {success}
                </div>
              ) : null}

              <OpsActionButton type="submit" variant="primary" disabled={isSaving}>
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
              </OpsActionButton>
            </form>
          </article>

          <article id="activity-panel" className="card-base p-6">
            <OpsPageHeader
              eyebrow="Activity Timeline"
              title="Notes and follow-ups"
              description="Track calls, notes, complaints, and follow-up actions in a clearer v1-style operator timeline."
              meta={<span>{customer.activities.length} entries</span>}
            />

            <form onSubmit={handleCreateActivity} className="mt-6 space-y-4 rounded-[24px] border border-[var(--color-brd)] bg-[var(--color-surf-hover)] p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Activity type</span>
                  <select
                    value={activityForm.activity_type}
                    onChange={(event) => setActivityForm((current) => ({ ...current, activity_type: event.target.value }))}
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
                    onChange={(event) => setActivityForm((current) => ({ ...current, due_date: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400"
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Title</span>
                <input
                  value={activityForm.title}
                  onChange={(event) => setActivityForm((current) => ({ ...current, title: event.target.value }))}
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
                  onChange={(event) => setActivityForm((current) => ({ ...current, description: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400"
                  placeholder="Add context for the team..."
                />
              </label>

              {activitySuccess ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {activitySuccess}
                </div>
              ) : null}

              <OpsActionButton type="submit" variant="primary" disabled={isActivitySaving}>
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
              </OpsActionButton>
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
                      className="rounded-[24px] border border-[var(--color-brd)] bg-white p-4 shadow-[var(--shadow-subtle)]"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="flex gap-3">
                          <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] text-[var(--color-txt-sec)]">
                            <ActivityIcon className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-sm font-semibold text-[var(--color-txt-pri)]">{activity.title}</h3>
                              <OpsStatusBadge label={formatLabel(activity.activity_type)} tone="info" />
                              {activity.completed_at ? (
                                <OpsStatusBadge label="Completed" tone="success" dot />
                              ) : null}
                            </div>
                            <p className="mt-2 text-sm text-[var(--color-txt-sec)]">
                              {activity.description || "No extra description"}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-4 text-xs text-[var(--color-txt-mut)]">
                              <span>Created {formatDateTime(activity.created_at)}</span>
                              <span>By {activity.created_by?.full_name || "System"}</span>
                              <span>Due {formatDateTime(activity.due_date)}</span>
                            </div>
                          </div>
                        </div>

                        {!activity.completed_at ? (
                          <OpsActionButton type="button" variant="secondary" onClick={() => void markActivityCompleted(activity.id)}>
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Mark completed
                          </OpsActionButton>
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
