"use client";

import Link from "next/link";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import {
  Calendar,
  Download,
  Edit,
  History,
  Loader2,
  MessageSquare,
  MoreVertical,
  Phone,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  Users,
  X,
} from "lucide-react";

import { api, ApiError } from "@/lib/api";
import { formatCurrency, formatDate, formatDateTime, formatLabel } from "@/lib/format";
import { useDialogAccessibility } from "@/components/ui/use-dialog-accessibility";
import { ErrorAlert } from "@/components/ui/error-alert";
import { useAuthorization } from "@/components/dashboard/authorization-provider";

type CrmSummary = {
  total_customers: number;
  leads: number;
  regular_customers: number;
  vip_customers: number;
  wholesale_customers: number;
  reseller_customers: number;
  blocked_customers: number;
  followups_due: number;
  followups_today: number;
  overdue_followups: number;
  recent_activity_count: number;
  customers_with_orders: number;
  total_customer_spend: number | string;
  average_customer_value: number | string;
};

type CustomerRow = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  city: string | null;
  customer_type: string | null;
  tags: string | null;
  tagList?: string[];
  notes: string | null;
  follow_up_date: string | null;
  followUpDate?: string | null;
  last_contacted_at: string | null;
  lastContactedAt?: string | null;
  created_at: string;
  updated_at: string;
  createdAt?: string;
  updatedAt?: string;
  customerName?: string | null;
  customerPhone?: string | null;
  customerType?: string | null;
  segment?: string | null;
  total_order_count?: number;
  totalOrderCount?: number;
  total_spend?: number | string;
  totalSpend?: number | string;
  lastOrderAt?: string | null;
  lastOrderNumber?: string | null;
  activityCount?: number;
  openActivityCount?: number;
  followUpState?: string | null;
  stats?: {
    followUpState?: string | null;
  };
};

type CustomerOrder = {
  id: string;
  order_number: string;
  orderNumber?: string;
  status: string;
  payment_status: string;
  total: number | string;
  totalAmount?: number | string;
  created_at: string;
  createdAt?: string;
};

type CustomerActivity = {
  id: string;
  customer_id: string;
  activity_type: string;
  activityType?: string;
  title: string;
  description: string | null;
  created_by_id: string | null;
  due_date: string | null;
  dueDate?: string | null;
  completed_at: string | null;
  completedAt?: string | null;
  created_at: string;
  createdAt?: string;
  createdBy?: string | null;
  created_by?: {
    full_name?: string;
    email?: string;
  } | null;
};

type CustomerDetail = CustomerRow & {
  orders: CustomerOrder[];
  activities: CustomerActivity[];
  pending_follow_up_count: number;
  averageOrderValue?: number | string;
  followUpState?: string | null;
  stats?: {
    totalOrderCount: number;
    totalSpend: number | string;
    averageOrderValue: number | string;
    lastOrderAt: string | null;
    lastContactedAt: string | null;
    followUpState: string | null;
  };
};

type CustomerFormState = {
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  segment: "New" | "Repeat" | "VIP" | "At Risk";
  tags: string[];
  notes: string;
  followUpDate: string;
  lastContactedAt: string;
};

type ActivityFormState = {
  activityType: "note" | "follow_up" | "call" | "message";
  title: string;
  description: string;
  dueDate: string;
};

type ChipFilter = "all" | "new" | "regular";

const initialSummary: CrmSummary = {
  total_customers: 0,
  leads: 0,
  regular_customers: 0,
  vip_customers: 0,
  wholesale_customers: 0,
  reseller_customers: 0,
  blocked_customers: 0,
  followups_due: 0,
  followups_today: 0,
  overdue_followups: 0,
  recent_activity_count: 0,
  customers_with_orders: 0,
  total_customer_spend: 0,
  average_customer_value: 0,
};

const initialCustomerForm: CustomerFormState = {
  name: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  segment: "New",
  tags: [],
  notes: "",
  followUpDate: "",
  lastContactedAt: "",
};

const initialActivityForm: ActivityFormState = {
  activityType: "note",
  title: "",
  description: "",
  dueDate: "",
};

function parseTags(value: string | null | undefined) {
  return (value || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function getInitials(name: string) {
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || "CU";
}

function buildQuery({
  search,
  segment,
  followUpOnly,
  tag,
  city,
}: {
  search: string;
  segment: string;
  followUpOnly: boolean;
  tag: string;
  city: string;
}) {
  const params = new URLSearchParams({
    skip: "0",
    limit: "100",
  });

  if (search.trim()) params.set("search", search.trim());
  if (segment) params.set("segment", segment);
  if (followUpOnly) params.set("follow_up_due", "true");
  if (tag.trim()) params.set("tag", tag.trim());
  if (city.trim()) params.set("city", city.trim());
  return `/customers?${params.toString()}`;
}

function customerSegmentTone(segment: string | null | undefined) {
  switch ((segment || "").toLowerCase()) {
    case "vip":
      return "bg-purple-50 text-purple-700 border-purple-200";
    case "repeat":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "at risk":
    case "at_risk":
      return "bg-rose-50 text-rose-700 border-rose-200";
    default:
      return "bg-blue-50 text-blue-700 border-blue-200";
  }
}

function followUpBadge(detail: CustomerDetail | CustomerRow | null) {
  const state = detail?.followUpState || detail?.stats?.followUpState || "";
  const followUpDate = detail?.followUpDate || detail?.follow_up_date;

  if (!followUpDate) {
    return { label: "No follow-up set", tone: "bg-slate-100 text-slate-600 border-slate-200" };
  }
  if (state === "overdue") {
    return { label: `Due ${formatDate(followUpDate)}`, tone: "bg-rose-50 text-rose-700 border-rose-200" };
  }
  if (state === "today") {
    return { label: `Today ${formatDate(followUpDate)}`, tone: "bg-amber-50 text-amber-700 border-amber-200" };
  }
  return { label: `Scheduled ${formatDate(followUpDate)}`, tone: "bg-blue-50 text-blue-700 border-blue-200" };
}

function segmentToPayload(segment: CustomerFormState["segment"]) {
  if (segment === "VIP") return "vip";
  return "regular";
}

function rowMatchesChip(row: CustomerRow, chip: ChipFilter) {
  if (chip === "all") return true;
  const orderCount = row.totalOrderCount ?? row.total_order_count ?? 0;
  if (chip === "new") return orderCount <= 1;
  return orderCount > 1;
}

function Overlay({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  const { dialogRef, requestClose } = useDialogAccessibility(onClose);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={requestClose}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Customer form" tabIndex={-1} className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl outline-none" onClick={(event) => event.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export default function CustomersPage() {
  const { can } = useAuthorization();
  const [summary, setSummary] = useState<CrmSummary>(initialSummary);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDetail | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [chipFilter, setChipFilter] = useState<ChipFilter>("all");
  const [segmentFilter, setSegmentFilter] = useState("");
  const [followUpOnly, setFollowUpOnly] = useState(false);
  const [tagFilter, setTagFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isActivitySubmitting, setIsActivitySubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activitySuccess, setActivitySuccess] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerDetail | null>(null);
  const [customerForm, setCustomerForm] = useState<CustomerFormState>(initialCustomerForm);
  const [activityForm, setActivityForm] = useState<ActivityFormState>(initialActivityForm);

  const visibleCustomers = useMemo(
    () => customers.filter((row) => rowMatchesChip(row, chipFilter)),
    [customers, chipFilter],
  );

  const repeatPercentage = useMemo(() => {
    if (customers.length === 0) return 0;
    const repeatCount = customers.filter((customer) => (customer.totalOrderCount ?? customer.total_order_count ?? 0) > 1).length;
    return Math.round((repeatCount / customers.length) * 100);
  }, [customers]);

  async function loadWorkspace() {
    setIsLoading(true);
    setError("");
    try {
      const [summaryData, customerData] = await Promise.all([
        api.get<CrmSummary>("/customers/crm-summary"),
        api.get<CustomerRow[]>(
          buildQuery({
            search: searchTerm,
            segment: segmentFilter,
            followUpOnly,
            tag: tagFilter,
            city: cityFilter,
          }),
        ),
      ]);

      setSummary(summaryData);
      setCustomers(customerData);
      const nextSelectedId = customerData.some((row) => row.id === selectedCustomerId)
        ? selectedCustomerId
        : customerData[0]?.id || "";
      setSelectedCustomerId(nextSelectedId);
      if (!nextSelectedId) {
        setSelectedCustomer(null);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load CRM workspace.");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadCustomerDetail(customerId: string) {
    setIsDetailLoading(true);
    setError("");
    try {
      const data = await api.get<CustomerDetail>(`/customers/${customerId}`);
      setSelectedCustomer(data);
      if (editingCustomer && editingCustomer.id === customerId) {
        setEditingCustomer(data);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load customer details.");
    } finally {
      setIsDetailLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function run() {
      setIsLoading(true);
      setError("");
      try {
        const [summaryData, customerData] = await Promise.all([
          api.get<CrmSummary>("/customers/crm-summary"),
          api.get<CustomerRow[]>(
            buildQuery({
              search: searchTerm,
              segment: segmentFilter,
              followUpOnly,
              tag: tagFilter,
              city: cityFilter,
            }),
          ),
        ]);

        if (!isMounted) return;
        setSummary(summaryData);
        setCustomers(customerData);
        const nextSelectedId = customerData.some((row) => row.id === selectedCustomerId)
          ? selectedCustomerId
          : customerData[0]?.id || "";
        setSelectedCustomerId(nextSelectedId);
        if (!nextSelectedId) {
          setSelectedCustomer(null);
        }
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof ApiError ? err.message : "Failed to load CRM workspace.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void run();
    return () => {
      isMounted = false;
    };
  }, [cityFilter, followUpOnly, searchTerm, segmentFilter, selectedCustomerId, tagFilter]);

  useEffect(() => {
    if (!selectedCustomerId) return;
    let isMounted = true;

    async function run() {
      setIsDetailLoading(true);
      setError("");
      try {
        const data = await api.get<CustomerDetail>(`/customers/${selectedCustomerId}`);
        if (!isMounted) return;
        setSelectedCustomer(data);
        if (editingCustomer && editingCustomer.id === selectedCustomerId) {
          setEditingCustomer(data);
        }
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof ApiError ? err.message : "Failed to load customer details.");
      } finally {
        if (isMounted) {
          setIsDetailLoading(false);
        }
      }
    }

    void run();
    return () => {
      isMounted = false;
    };
  }, [editingCustomer, selectedCustomerId]);

  function openCustomerModal(customer?: CustomerDetail | CustomerRow) {
    setEditingCustomer(customer && "orders" in customer ? customer : null);
    const segmentValue = customer?.segment === "VIP" ? "VIP" : customer?.segment === "At Risk" ? "At Risk" : customer?.segment === "Repeat" ? "Repeat" : "New";
    setCustomerForm({
      name: customer?.customerName || customer?.name || "",
      phone: customer?.customerPhone || customer?.phone || "",
      email: customer?.email || "",
      address: customer?.address || "",
      city: customer?.city || "",
      segment: segmentValue,
      tags: customer?.tagList || parseTags(customer?.tags),
      notes: customer?.notes || "",
      followUpDate: customer?.followUpDate || customer?.follow_up_date || "",
      lastContactedAt: customer?.lastContactedAt || customer?.last_contacted_at || "",
    });
    setIsModalOpen(true);
  }

  function closeCustomerModal() {
    setIsModalOpen(false);
    setEditingCustomer(null);
    setCustomerForm(initialCustomerForm);
  }

  async function handleCustomerSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    setSuccess("");

    const payload = {
      customerName: customerForm.name,
      customerPhone: customerForm.phone,
      email: customerForm.email || null,
      address: customerForm.address || null,
      city: customerForm.city || null,
      customerType: segmentToPayload(customerForm.segment),
      tags: customerForm.tags,
      notes: customerForm.notes || null,
      followUpDate: customerForm.followUpDate || null,
      lastContactedAt: customerForm.lastContactedAt || null,
    };

    try {
      if (editingCustomer) {
        await api.patch(`/customers/${editingCustomer.id}`, payload);
        setSuccess("Customer updated successfully.");
      } else {
        await api.post("/customers", payload);
        setSuccess("Customer created successfully.");
      }
      closeCustomerModal();
      await loadWorkspace();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save customer.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteCustomer(customerId: string) {
    const confirmed = window.confirm("Are you sure you want to delete this customer? This action cannot be undone.");
    if (!confirmed) return;
    setError("");
    setSuccess("");
    try {
      await api.delete(`/customers/${customerId}`);
      setSuccess("Customer deleted successfully.");
      await loadWorkspace();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete customer.");
    }
  }

  async function handleActivitySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedCustomer) return;
    setIsActivitySubmitting(true);
    setError("");
    setActivitySuccess("");
    try {
      await api.post(`/customers/${selectedCustomer.id}/activities`, {
        activityType: activityForm.activityType,
        title: activityForm.title,
        description: activityForm.description || null,
        dueDate: activityForm.dueDate ? new Date(activityForm.dueDate).toISOString() : null,
      });
      setActivityForm(initialActivityForm);
      setActivitySuccess("CRM activity added.");
      await loadCustomerDetail(selectedCustomer.id);
      await loadWorkspace();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add CRM activity.");
    } finally {
      setIsActivitySubmitting(false);
    }
  }

  async function markActivityComplete(activityId: string) {
    if (!selectedCustomer) return;
    setError("");
    setActivitySuccess("");
    try {
      await api.patch(`/customers/${selectedCustomer.id}/activities/${activityId}`, {
        completedAt: new Date().toISOString(),
      });
      setActivitySuccess("Activity marked complete.");
      await loadCustomerDetail(selectedCustomer.id);
      await loadWorkspace();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update activity.");
    }
  }

  function exportCustomers() {
    if (visibleCustomers.length === 0) {
      setError("No customers to export.");
      return;
    }

    const headers = [
      "ID",
      "Name",
      "Phone",
      "Email",
      "Address",
      "City",
      "Segment",
      "Order Count",
      "Total Spend",
      "Last Order Number",
      "Created At",
    ];
    const rows = visibleCustomers.map((customer) => [
      customer.id,
      customer.customerName || customer.name,
      customer.customerPhone || customer.phone,
      customer.email || "",
      customer.address || "",
      customer.city || "",
      customer.segment || "",
      String(customer.totalOrderCount ?? customer.total_order_count ?? 0),
      String(customer.totalSpend ?? customer.total_spend ?? 0),
      customer.lastOrderNumber || "",
      customer.createdAt || customer.created_at,
    ]);
    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `customers_export_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  const selectedFollowUp = followUpBadge(selectedCustomer);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-[var(--color-primary)]">Customer CRM</h2>
          <p className="mt-1 text-sm text-[var(--color-secondary)]">
            Manage customer relationships, track history, and improve loyalty.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={exportCustomers}
            className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-[13px] font-semibold text-[var(--color-secondary)] shadow-[var(--shadow-subtle)] transition-colors hover:bg-[var(--color-surface-hover)]"
          >
            <Download className="h-4 w-4" />
            Export CRM
          </button>
          {can("customers.create") ? <button
            type="button"
            onClick={() => openCustomerModal()}
            className="flex items-center gap-2 rounded-xl bg-[#0866FF] px-5 py-2.5 text-[13px] font-semibold text-white shadow-[var(--shadow-subtle)] transition-colors hover:bg-[#0056e0]"
          >
            <Plus className="h-4 w-4" />
            Add Customer
          </button> : null}
        </div>
      </div>

      {error ? <ErrorAlert message={error} onRetry={() => void loadWorkspace()} /> : null}
      {success ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={<Users className="h-6 w-6 text-[#0866FF]" />}
          tone="bg-brand/10 dark:bg-brand/20"
          label="Total Customers"
          value={summary.total_customers}
          footnote="All time customers"
        />
        <SummaryCard
          icon={<History className="h-6 w-6 text-[#9333EA]" />}
          tone="bg-purple-50 dark:bg-purple-500/20"
          label="Repeat Customers"
          value={`${repeatPercentage}%`}
          footnote="Percentage of repeat"
        />
        <SummaryCard
          icon={<ShoppingBag className="h-6 w-6 text-[#059669]" />}
          tone="bg-green-50 dark:bg-green-500/20"
          label="Avg. Customer Value"
          value={formatCurrency(summary.average_customer_value)}
          footnote="Average order value"
        />
        <SummaryCard
          icon={<MessageSquare className="h-6 w-6 text-[#EA580C]" />}
          tone="bg-orange-50 dark:bg-orange-500/20"
          label="Active Chats"
          value="0"
          footnote="Open conversations"
        />
      </div>

      <div className="grid gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-[11px] font-semibold text-[var(--color-secondary)] shadow-[var(--shadow-subtle)] lg:grid-cols-3">
        <div className="flex flex-wrap gap-2"><span className="font-bold text-[var(--color-primary)]">Segments</span><span>Leads {summary.leads}</span><span>Regular {summary.regular_customers}</span><span>VIP {summary.vip_customers}</span><span>Wholesale {summary.wholesale_customers}</span><span>Reseller {summary.reseller_customers}</span><span>Blocked {summary.blocked_customers}</span></div>
        <div className="flex flex-wrap gap-2 border-[var(--color-border)] lg:border-l lg:pl-3"><span className="font-bold text-[var(--color-primary)]">Follow-ups</span><span>Due {summary.followups_due}</span><span>Today {summary.followups_today}</span><span>Overdue {summary.overdue_followups}</span><span>Recent activity {summary.recent_activity_count}</span></div>
        <div className="flex flex-wrap gap-2 border-[var(--color-border)] lg:border-l lg:pl-3"><span className="font-bold text-[var(--color-primary)]">Value</span><span>With orders {summary.customers_with_orders}</span><span>Total spend {formatCurrency(summary.total_customer_spend)}</span></div>
      </div>

      <div className="grid min-h-[600px] grid-cols-1 gap-6 lg:h-[calc(100vh-320px)] lg:grid-cols-12">
        <div className="max-h-[800px] overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-subtle)] lg:col-span-5 xl:col-span-4">
          <div className="space-y-4 border-b border-[var(--color-border)] p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[17px] font-bold text-[var(--color-primary)]">All Customers</h3>
              <div className="flex flex-1 items-center justify-end gap-2">
                <button className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-secondary)] shadow-[var(--shadow-subtle)] transition-colors hover:bg-[var(--color-surface-hover)]">
                  <History className="h-3.5 w-3.5 scale-x-[-1]" />
                </button>
                <div className="relative w-full max-w-[160px]">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-muted)]" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search customers..."
                    className="w-full rounded-full border border-[var(--color-border)] bg-[var(--color-background)] py-1.5 pl-8 pr-3 text-[12px] outline-none transition-all focus:border-[var(--color-brand)] focus:bg-[var(--color-surface)] focus:ring-1 focus:ring-[var(--color-brand)]"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-[11px] font-medium text-[var(--color-secondary)]">
              {[
                { key: "all" as const, label: `All (${customers.length})`, dot: "bg-[#0866FF]" },
                { key: "new" as const, label: `New (${customers.filter((item) => (item.totalOrderCount ?? item.total_order_count ?? 0) <= 1).length})`, dot: "bg-[#10B981]" },
                { key: "regular" as const, label: `Regular (${customers.filter((item) => (item.totalOrderCount ?? item.total_order_count ?? 0) > 1).length})`, dot: "bg-gray-400" },
              ].map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => setChipFilter(chip.key)}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1 ${chipFilter === chip.key ? "bg-brand/10 dark:bg-brand/20 font-bold text-[#0866FF]" : "transition-colors hover:text-[var(--color-primary)]"}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${chip.dot}`} />
                  {chip.label}
                </button>
              ))}
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <select
                value={segmentFilter}
                onChange={(event) => setSegmentFilter(event.target.value)}
                className="rounded-full border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-[12px] outline-none transition focus:border-[var(--color-brand)]"
              >
                <option value="">All segments</option>
                <option value="new">New</option>
                <option value="repeat">Repeat</option>
                <option value="vip">VIP</option>
                <option value="at_risk">At Risk</option>
              </select>
              <button
                type="button"
                onClick={() => setFollowUpOnly((current) => !current)}
                className={`rounded-full border px-3 py-2 text-[12px] font-semibold transition ${followUpOnly ? "border-amber-300 bg-amber-50 text-amber-700" : "border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-secondary)]"}`}
              >
                Follow-ups Due
              </button>
              <input
                value={tagFilter}
                onChange={(event) => setTagFilter(event.target.value)}
                placeholder="Filter by tag"
                className="rounded-full border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-[12px] outline-none transition focus:border-[var(--color-brand)]"
              />
              <input
                value={cityFilter}
                onChange={(event) => setCityFilter(event.target.value)}
                placeholder="Filter by city"
                className="rounded-full border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-[12px] outline-none transition focus:border-[var(--color-brand)]"
              />
            </div>
          </div>

          <div className="max-h-[660px] overflow-y-auto">
            {isLoading ? (
              <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-2 py-12">
                <Loader2 className="h-6 w-6 animate-spin text-[var(--color-muted)]" />
                <span className="text-xs text-[var(--color-muted)]">Loading...</span>
              </div>
            ) : visibleCustomers.length === 0 ? (
              <div className="py-12 text-center text-xs text-[var(--color-muted)]">No customers found</div>
            ) : (
              <div className="divide-y divide-[var(--color-border)]/50">
                {visibleCustomers.map((customer) => {
                  const isActive = selectedCustomerId === customer.id;
                  return (
                    <button
                      key={customer.id}
                      type="button"
                      onClick={() => setSelectedCustomerId(customer.id)}
                      className={`relative flex w-full items-center gap-3 px-4 py-3.5 text-left transition-all ${isActive ? "bg-[var(--color-background)]" : "hover:bg-[var(--color-surface-hover)]"}`}
                    >
                      {isActive ? <div className="absolute bottom-0 left-0 top-0 w-[3px] bg-[#0866FF]" /> : null}
                      <div className="shrink-0">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-full text-[13px] font-bold shadow-[var(--shadow-subtle)] ${isActive ? "bg-brand/10 text-[#0866FF]" : "border border-[var(--color-border)]/50 bg-[var(--color-surface-hover)] text-[var(--color-primary)]"}`}>
                          {getInitials(customer.customerName || customer.name)}
                        </div>
                      </div>
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="mb-0.5 flex items-center justify-between gap-2">
                          <span className="truncate text-[13px] font-bold text-[var(--color-primary)]">
                            {customer.customerName || customer.name || "Unnamed Customer"}
                          </span>
                          <div className="flex shrink-0 items-center gap-1.5 text-[var(--color-muted)]">
                            <span className="text-[10px] whitespace-nowrap">
                              {formatDate(customer.createdAt || customer.created_at)}
                            </span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                          </div>
                        </div>
                        <span className="block truncate text-[11px] text-[var(--color-secondary)]">{customer.email || customer.customerPhone || customer.phone || "No contact provided"}</span>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className={`rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${customerSegmentTone(customer.segment)}`}>
                            {customer.segment || "New"}
                          </span>
                          {(customer.openActivityCount ?? 0) > 0 ? (
                            <span className="text-[10px] font-semibold text-amber-700">{customer.openActivityCount} open</span>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-[var(--color-border)] p-3.5 text-[11px] font-medium text-[var(--color-secondary)]">
            <span>
              Showing 1 to {Math.min(10, visibleCustomers.length)} of {visibleCustomers.length}
            </span>
            <div className="flex items-center gap-1.5">
              <button className="flex h-6 w-6 items-center justify-center rounded text-[var(--color-muted)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-secondary)]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              </button>
              <button className="flex h-6 w-6 items-center justify-center rounded border border-[#0866FF] bg-brand/10 font-bold text-[#0866FF]">1</button>
              <button className="flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-[var(--color-surface-hover)]">2</button>
              <button className="flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-[var(--color-surface-hover)]">3</button>
              <span>...</span>
              <button className="flex h-6 w-6 items-center justify-center rounded text-[var(--color-muted)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-secondary)]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
              </button>
            </div>
          </div>
        </div>

        <div className="max-h-[800px] overflow-y-auto pr-2 lg:col-span-7 xl:col-span-8">
          {!selectedCustomerId ? (
            <div className="flex h-full min-h-[600px] flex-col items-center justify-center gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted)] shadow-[var(--shadow-subtle)]">
              <Users className="h-16 w-16" strokeWidth={1} />
              <p className="text-sm font-medium">Select a customer to view details</p>
            </div>
          ) : isDetailLoading || !selectedCustomer ? (
            <div className="flex h-full min-h-[600px] flex-col items-center justify-center gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted)] shadow-[var(--shadow-subtle)]">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm font-medium">Loading customer details...</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col gap-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-subtle)] md:flex-row md:items-start md:justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full border-4 border-white bg-brand/10 text-[#0866FF] shadow-[var(--shadow-subtle)]">
                    <Users className="h-8 w-8" />
                  </div>
                  <div className="pt-1">
                    <div className="mb-1.5 flex items-center gap-3">
                      <h3 className="text-[19px] font-bold text-[var(--color-primary)]">{selectedCustomer.customerName || selectedCustomer.name}</h3>
                      <span className={`rounded border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${customerSegmentTone(selectedCustomer.segment)}`}>
                        {selectedCustomer.segment || "New Customer"}
                      </span>
                    </div>
                    <div className="mb-2 flex items-center gap-2 text-[13px] text-[var(--color-secondary)]">
                      <span>{selectedCustomer.email || "No email provided"}</span>
                    </div>
                    <p className="mb-2 max-w-lg text-[12px] leading-relaxed text-[var(--color-secondary)]">
                      {selectedCustomer.address || "No address provided"}
                    </p>
                    <p className="text-[11px] font-medium text-[var(--color-muted)]">
                      Member Since {formatDate(selectedCustomer.createdAt || selectedCustomer.created_at)}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 pt-1 md:text-right">
                  <p className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-[var(--color-muted)]">Contact</p>
                  <div className="mb-6 flex items-center gap-2 md:justify-end">
                    <p className="text-[15px] font-bold text-[var(--color-primary)]">{selectedCustomer.customerPhone || selectedCustomer.phone || "No phone"}</p>
                    {(selectedCustomer.customerPhone || selectedCustomer.phone) ? (
                      <a
                        href={`https://wa.me/88${(selectedCustomer.customerPhone || selectedCustomer.phone).replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex h-6 w-6 items-center justify-center rounded-md bg-[#25D366] text-white shadow-[var(--shadow-subtle)] transition-colors hover:bg-[#128C7E]"
                        title="Chat on WhatsApp"
                      >
                        <Phone className="h-3.5 w-3.5" />
                      </a>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 md:justify-end">
                    {can("customers.update") ? <button
                      type="button"
                      onClick={() => openCustomerModal(selectedCustomer)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-secondary)] shadow-[var(--shadow-subtle)] transition-colors hover:bg-[var(--color-surface-hover)]"
                      title="Edit Customer"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </button> : null}
                    {can("customers.delete") ? <button
                      type="button"
                      onClick={() => void handleDeleteCustomer(selectedCustomer.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-secondary)] shadow-[var(--shadow-subtle)] transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-500"
                      title="Delete Customer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button> : null}
                    <div className="flex items-center gap-1.5 rounded-lg border border-[#FFEDD5] bg-orange-50 px-3 py-1.5 text-[11px] font-bold text-[#EA580C] shadow-[var(--shadow-subtle)]">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                      0 Loyalty points
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="Total Orders" value={selectedCustomer.stats?.totalOrderCount ?? selectedCustomer.totalOrderCount ?? selectedCustomer.total_order_count ?? 0} />
                <StatCard label="Total Spend" value={formatCurrency(selectedCustomer.stats?.totalSpend ?? selectedCustomer.totalSpend ?? selectedCustomer.total_spend ?? 0)} />
                <StatCard label="Average Order Value" value={formatCurrency(selectedCustomer.stats?.averageOrderValue ?? selectedCustomer.averageOrderValue ?? 0)} />
                <StatCard label="Follow-up" value={selectedFollowUp.label} />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <DetailBlock title="Contact">
                  <p className="text-sm font-semibold text-[var(--color-primary)]">{selectedCustomer.customerPhone || selectedCustomer.phone}</p>
                  <p className="mt-1 text-sm text-[var(--color-secondary)]">{selectedCustomer.email || "No email on record"}</p>
                </DetailBlock>
                <DetailBlock title="Location">
                  <p className="text-sm font-semibold text-[var(--color-primary)]">{selectedCustomer.city || "City not set"}</p>
                  <p className="mt-1 text-sm text-[var(--color-secondary)]">{selectedCustomer.address || "Address not recorded"}</p>
                </DetailBlock>
                <DetailBlock title="Follow-up State">
                  <p className="text-sm font-semibold text-[var(--color-primary)]">{selectedFollowUp.label}</p>
                  <p className="mt-1 text-sm text-[var(--color-secondary)]">Last contacted {formatDateTime(selectedCustomer.lastContactedAt || selectedCustomer.last_contacted_at)}</p>
                </DetailBlock>
                <DetailBlock title="Tags">
                  <div className="flex flex-wrap gap-2">
                    {(selectedCustomer.tagList || parseTags(selectedCustomer.tags)).length > 0 ? (
                      (selectedCustomer.tagList || parseTags(selectedCustomer.tags)).map((tag) => (
                        <span key={tag} className="rounded-full border border-[var(--color-border)] bg-white px-3 py-1 text-xs font-semibold text-[var(--color-secondary)]">
                          {tag}
                        </span>
                      ))
                    ) : (
                      <p className="text-sm text-[var(--color-muted)]">No tags yet</p>
                    )}
                  </div>
                </DetailBlock>
              </div>

              <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-subtle)]">
                <p className="text-[12px] font-bold uppercase tracking-wider text-[var(--color-secondary)]">Notes</p>
                <p className="mt-3 text-sm leading-7 text-[var(--color-secondary)]">
                  {selectedCustomer.notes || "No CRM notes saved yet."}
                </p>
              </div>

              <SectionCard
                title="Bills"
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>}
              >
                <div className="overflow-x-auto">
                  <table className="min-w-[720px] w-full whitespace-nowrap text-left">
                    <thead>
                      <tr className="border-b border-[var(--color-border)] text-[10px] font-bold uppercase tracking-wider text-[var(--color-secondary)]">
                        <th className="px-6 py-4">Bill no.</th>
                        <th className="px-6 py-4">Date</th>
                        <th className="px-6 py-4">Time</th>
                        <th className="px-6 py-4 text-right">Total Sales</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border)]">
                      {selectedCustomer.orders.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-12 text-center">
                            <p className="text-[12px] font-semibold text-[var(--color-primary)]">No bills found</p>
                            <p className="mt-1 text-[11px] text-[var(--color-secondary)]">This customer has no bills yet.</p>
                          </td>
                        </tr>
                      ) : (
                        selectedCustomer.orders.map((order) => {
                          const createdAt = order.createdAt || order.created_at;
                          return (
                            <tr key={order.id} className="transition-colors hover:bg-[var(--color-surface-hover)]">
                              <td className="px-6 py-4 text-xs font-bold text-[var(--color-primary)]">#{order.orderNumber || order.order_number}</td>
                              <td className="px-6 py-4 text-xs text-[var(--color-secondary)]">{formatDate(createdAt)}</td>
                              <td className="px-6 py-4 text-xs text-[var(--color-secondary)]">
                                {createdAt ? new Date(createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : "N/A"}
                              </td>
                              <td className="px-6 py-4 text-right text-xs font-black text-[var(--color-primary)]">{formatCurrency(order.totalAmount ?? order.total)}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </SectionCard>

              <SectionCard title="Order History" icon={<ShoppingBag className="h-4 w-4" />}>
                <div className="overflow-x-auto">
                  <table className="min-w-[860px] w-full whitespace-nowrap text-left">
                    <thead>
                      <tr className="border-b border-[var(--color-border)] text-[10px] font-bold uppercase tracking-wider text-[var(--color-secondary)]">
                        <th className="px-6 py-4">Order</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Payment</th>
                        <th className="px-6 py-4">Value</th>
                        <th className="px-6 py-4">Created</th>
                        <th className="px-6 py-4">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border)]">
                      {selectedCustomer.orders.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center">
                            <p className="text-[12px] font-semibold text-[var(--color-primary)]">No orders yet</p>
                            <p className="mt-1 text-[11px] text-[var(--color-secondary)]">Order history will appear here once this customer is linked to orders.</p>
                          </td>
                        </tr>
                      ) : (
                        selectedCustomer.orders.map((order) => (
                          <tr key={order.id} className="transition-colors hover:bg-[var(--color-surface-hover)]">
                            <td className="px-6 py-4 text-xs font-bold text-[var(--color-primary)]">{order.orderNumber || order.order_number}</td>
                            <td className="px-6 py-4 text-xs text-[var(--color-secondary)]">{formatLabel(order.status)}</td>
                            <td className="px-6 py-4 text-xs text-[var(--color-secondary)]">{formatLabel(order.payment_status)}</td>
                            <td className="px-6 py-4 text-xs font-black text-[var(--color-primary)]">{formatCurrency(order.totalAmount ?? order.total)}</td>
                            <td className="px-6 py-4 text-xs text-[var(--color-secondary)]">{formatDate(order.createdAt || order.created_at)}</td>
                            <td className="px-6 py-4">
                              <Link href={`/dashboard/orders/${order.id}`} className="rounded-full border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-secondary)] transition hover:bg-[var(--color-surface-hover)]">
                                View order
                              </Link>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </SectionCard>

              <SectionCard title="CRM Activities" icon={<Calendar className="h-4 w-4" />}>
                {activitySuccess ? (
                  <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{activitySuccess}</div>
                ) : null}

                <form onSubmit={handleActivitySubmit} className="mb-5 space-y-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--color-secondary)]">Activity Type</span>
                      <select
                        value={activityForm.activityType}
                        onChange={(event) => setActivityForm((current) => ({ ...current, activityType: event.target.value as ActivityFormState["activityType"] }))}
                        className="w-full rounded-lg border border-transparent bg-[var(--color-surface)] px-4 py-2 text-sm outline-none transition-all focus:border-[var(--color-border)]"
                      >
                        <option value="note">Note</option>
                        <option value="follow_up">Follow Up</option>
                        <option value="call">Call</option>
                        <option value="message">Message</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--color-secondary)]">Due Date</span>
                      <input
                        type="datetime-local"
                        value={activityForm.dueDate}
                        onChange={(event) => setActivityForm((current) => ({ ...current, dueDate: event.target.value }))}
                        className="w-full rounded-lg border border-transparent bg-[var(--color-surface)] px-4 py-2 text-sm outline-none transition-all focus:border-[var(--color-border)]"
                      />
                    </label>
                  </div>
                  <label className="block">
                    <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--color-secondary)]">Title</span>
                    <input
                      value={activityForm.title}
                      onChange={(event) => setActivityForm((current) => ({ ...current, title: event.target.value }))}
                      required
                      className="w-full rounded-lg border border-transparent bg-[var(--color-surface)] px-4 py-2 text-sm outline-none transition-all focus:border-[var(--color-border)]"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-[var(--color-secondary)]">Description</span>
                    <textarea
                      rows={3}
                      value={activityForm.description}
                      onChange={(event) => setActivityForm((current) => ({ ...current, description: event.target.value }))}
                      className="w-full rounded-lg border border-transparent bg-[var(--color-surface)] px-4 py-2 text-sm outline-none transition-all focus:border-[var(--color-border)]"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={isActivitySubmitting}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-black disabled:opacity-60"
                  >
                    {isActivitySubmitting ? "Saving..." : "Save Activity"}
                  </button>
                </form>

                <div className="space-y-3">
                  {selectedCustomer.activities.length === 0 ? (
                    <div className="py-12 text-center">
                      <p className="text-[12px] font-semibold text-[var(--color-primary)]">No CRM activity yet</p>
                      <p className="mt-1 text-[11px] text-[var(--color-secondary)]">Add a note, follow-up, call, or message from this panel.</p>
                    </div>
                  ) : (
                    selectedCustomer.activities.map((activity) => (
                      <div key={activity.id} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--color-secondary)]">
                                {formatLabel(activity.activityType || activity.activity_type)}
                              </span>
                              {activity.completedAt || activity.completed_at ? (
                                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                                  Completed
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-3 text-sm font-semibold text-[var(--color-primary)]">{activity.title}</p>
                            <p className="mt-1 text-sm text-[var(--color-secondary)]">{activity.description || "No additional description."}</p>
                            <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-[var(--color-muted)]">
                              <span>Created {formatDateTime(activity.createdAt || activity.created_at)}</span>
                              <span>By {activity.createdBy || activity.created_by?.full_name || activity.created_by?.email || "System"}</span>
                              {(activity.dueDate || activity.due_date) ? <span>Due {formatDateTime(activity.dueDate || activity.due_date)}</span> : null}
                              {(activity.completedAt || activity.completed_at) ? <span>Completed {formatDateTime(activity.completedAt || activity.completed_at)}</span> : null}
                            </div>
                          </div>
                          {!(activity.completedAt || activity.completed_at) ? (
                            <button
                              type="button"
                              onClick={() => void markActivityComplete(activity.id)}
                              className="rounded-full border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-secondary)] transition hover:bg-[var(--color-surface)]"
                            >
                              Mark Complete
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </SectionCard>

              <SectionCard title="Messages" icon={<MessageSquare className="h-4 w-4" />}>
                <div className="p-12 text-center">
                  <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-muted)] shadow-[var(--shadow-subtle)]">
                    <MessageSquare className="h-6 w-6" />
                  </div>
                  <p className="text-[12px] font-semibold text-[var(--color-primary)]">No messages yet</p>
                  <p className="mt-1 text-[11px] text-[var(--color-secondary)]">
                    This area remains a visual placeholder because the v1 chat or message blocks were not backed by a real workflow in the current v2 scope.
                  </p>
                </div>
              </SectionCard>

              <div className="flex justify-end">
                <Link href={`/dashboard/customers/${selectedCustomer.id}`} className="rounded-full border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-secondary)] transition hover:bg-[var(--color-surface-hover)]">
                  Open Fallback Detail Page
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {isModalOpen ? (
        <Overlay onClose={closeCustomerModal}>
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
            <h3 className="text-lg font-bold text-[var(--color-primary)]">{editingCustomer ? "Edit Customer" : "Add New Customer"}</h3>
            <button type="button" onClick={closeCustomerModal} className="rounded-full p-2 transition-colors hover:bg-[var(--color-surface-hover)]">
              <X className="h-5 w-5" />
            </button>
          </div>
          <form onSubmit={handleCustomerSubmit} className="space-y-4 p-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--color-secondary)]">Full Name</label>
              <input
                required
                type="text"
                value={customerForm.name}
                onChange={(event) => setCustomerForm((current) => ({ ...current, name: event.target.value }))}
                className="w-full rounded-lg border border-transparent bg-[var(--color-surface-hover)] px-4 py-2 text-sm outline-none transition-all focus:border-[var(--color-border)] focus:bg-[var(--color-surface)]"
                placeholder="e.g. Rahim Ahmed"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--color-secondary)]">Phone</label>
                <input
                  required
                  type="tel"
                  value={customerForm.phone}
                  onChange={(event) => setCustomerForm((current) => ({ ...current, phone: event.target.value }))}
                  className="w-full rounded-lg border border-transparent bg-[var(--color-surface-hover)] px-4 py-2 text-sm outline-none transition-all focus:border-[var(--color-border)] focus:bg-[var(--color-surface)]"
                  placeholder="017..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--color-secondary)]">Email</label>
                <input
                  required
                  type="email"
                  value={customerForm.email}
                  onChange={(event) => setCustomerForm((current) => ({ ...current, email: event.target.value }))}
                  className="w-full rounded-lg border border-transparent bg-[var(--color-surface-hover)] px-4 py-2 text-sm outline-none transition-all focus:border-[var(--color-border)] focus:bg-[var(--color-surface)]"
                  placeholder="rahim@example.com"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--color-secondary)]">Segment</label>
                <select
                  value={customerForm.segment}
                  onChange={(event) => setCustomerForm((current) => ({ ...current, segment: event.target.value as CustomerFormState["segment"] }))}
                  className="w-full rounded-lg border border-transparent bg-[var(--color-surface-hover)] px-4 py-2 text-sm outline-none transition-all focus:border-[var(--color-border)] focus:bg-[var(--color-surface)]"
                >
                  <option value="New">New</option>
                  <option value="Repeat">Repeat</option>
                  <option value="VIP">VIP</option>
                  <option value="At Risk">At Risk</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--color-secondary)]">Follow-up Date</label>
                <input
                  type="date"
                  value={customerForm.followUpDate}
                  onChange={(event) => setCustomerForm((current) => ({ ...current, followUpDate: event.target.value }))}
                  className="w-full rounded-lg border border-transparent bg-[var(--color-surface-hover)] px-4 py-2 text-sm outline-none transition-all focus:border-[var(--color-border)] focus:bg-[var(--color-surface)]"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--color-secondary)]">Tags (comma separated)</label>
              <input
                type="text"
                value={customerForm.tags.join(", ")}
                onChange={(event) =>
                  setCustomerForm((current) => ({
                    ...current,
                    tags: event.target.value.split(",").map((tag) => tag.trim()).filter(Boolean),
                  }))
                }
                className="w-full rounded-lg border border-transparent bg-[var(--color-surface-hover)] px-4 py-2 text-sm outline-none transition-all focus:border-[var(--color-border)] focus:bg-[var(--color-surface)]"
                placeholder="e.g. wholesale, high-value"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--color-secondary)]">Notes</label>
              <textarea
                value={customerForm.notes}
                onChange={(event) => setCustomerForm((current) => ({ ...current, notes: event.target.value }))}
                className="min-h-[60px] w-full resize-none rounded-lg border border-transparent bg-[var(--color-surface-hover)] px-4 py-2 text-sm outline-none transition-all focus:border-[var(--color-border)] focus:bg-[var(--color-surface)]"
                placeholder="Internal notes about this customer..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--color-secondary)]">Address</label>
              <textarea
                required
                value={customerForm.address}
                onChange={(event) => setCustomerForm((current) => ({ ...current, address: event.target.value }))}
                className="min-h-[80px] w-full resize-none rounded-lg border border-transparent bg-[var(--color-surface-hover)] px-4 py-2 text-sm outline-none transition-all focus:border-[var(--color-border)] focus:bg-[var(--color-surface)]"
                placeholder="Full address..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[var(--color-secondary)]">City</label>
              <input
                value={customerForm.city}
                onChange={(event) => setCustomerForm((current) => ({ ...current, city: event.target.value }))}
                className="w-full rounded-lg border border-transparent bg-[var(--color-surface-hover)] px-4 py-2 text-sm outline-none transition-all focus:border-[var(--color-border)] focus:bg-[var(--color-surface)]"
                placeholder="Dhaka"
              />
            </div>
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={closeCustomerModal}
                className="flex-1 rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium transition-colors hover:bg-[var(--color-surface-hover)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-black disabled:opacity-60"
              >
                {isSubmitting ? "Saving..." : editingCustomer ? "Save Changes" : "Save Customer"}
              </button>
            </div>
          </form>
        </Overlay>
      ) : null}
    </div>
  );
}

function SummaryCard({
  icon,
  tone,
  label,
  value,
  footnote,
}: {
  icon: ReactNode;
  tone: string;
  label: string;
  value: string | number;
  footnote: string;
}) {
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-subtle)] lg:p-6">
      <div className="flex items-start gap-4">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${tone}`}>{icon}</div>
        <div>
          <p className="mb-1 text-[12px] font-semibold text-[var(--color-secondary)]">{label}</p>
          <p className="text-2xl font-bold text-[var(--color-primary)]">{value}</p>
        </div>
      </div>
      <div className="mt-4">
        <p className="text-[11px] text-[var(--color-muted)]">{footnote}</p>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-subtle)]">
      <p className="text-[12px] font-bold uppercase tracking-wider text-[var(--color-secondary)]">{label}</p>
      <p className="mt-2 text-lg font-bold text-[var(--color-primary)]">{value}</p>
    </div>
  );
}

function DetailBlock({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface-hover)] px-4 py-4">
      <p className="text-[12px] font-bold uppercase tracking-wider text-[var(--color-secondary)]">{title}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-subtle)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/10 text-[#0866FF]">{icon}</div>
          <h3 className="text-[14px] font-bold text-[var(--color-primary)]">{title}</h3>
        </div>
        <button className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-border)] text-[var(--color-secondary)] shadow-[var(--shadow-subtle)] transition-colors hover:bg-[var(--color-surface-hover)]">
          <MoreVertical className="h-3.5 w-3.5" />
        </button>
      </div>
      <div>{children}</div>
    </div>
  );
}
