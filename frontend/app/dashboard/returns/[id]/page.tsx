"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Loader2, RotateCcw } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { api, ApiError } from "@/lib/api";
import { formatCurrency, formatDate, formatLabel } from "@/lib/format";

type Customer = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  city: string | null;
};

type Warehouse = {
  id: string;
  name: string;
  code: string;
  address: string | null;
};

type Order = {
  id: string;
  order_number: string;
  status: string;
  stock_deducted: boolean;
};

type ReturnItem = {
  id: string;
  product_id: string | null;
  variant_id: string | null;
  product_name: string;
  sku: string | null;
  quantity: number;
  condition: string | null;
  restocked_quantity: number;
  created_at: string;
};

type ReturnDetail = {
  id: string;
  return_number: string;
  order_id: string;
  customer_id: string | null;
  warehouse_id: string | null;
  status: string;
  reason: string | null;
  resolution: string | null;
  refund_amount: number | string;
  restock_items: boolean;
  stock_restocked: boolean;
  created_at: string;
  updated_at: string;
  customer: Customer | null;
  warehouse: Warehouse | null;
  order: Order | null;
  items: ReturnItem[];
};

const statusOptions = [
  "requested",
  "approved",
  "received",
  "restocked",
  "rejected",
  "cancelled",
];

const resolutionOptions = ["refund", "replacement", "store_credit", "no_refund"];

export default function ReturnDetailPage() {
  const params = useParams<{ id: string }>();
  const returnId = params.id;

  const [returnRequest, setReturnRequest] = useState<ReturnDetail | null>(null);
  const [selectedStatus, setSelectedStatus] = useState("requested");
  const [selectedResolution, setSelectedResolution] = useState("refund");
  const [refundAmount, setRefundAmount] = useState("0");
  const [restockItems, setRestockItems] = useState(false);
  const [reason, setReason] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const shouldWarnForRestock = useMemo(() => {
    if (!returnRequest || returnRequest.stock_restocked) {
      return false;
    }

    return selectedStatus === "restocked" && restockItems;
  }, [restockItems, returnRequest, selectedStatus]);

  useEffect(() => {
    let isMounted = true;

    async function loadReturnDetail() {
      try {
        const data = await api.get<ReturnDetail>(`/returns/${returnId}`);
        if (!isMounted) return;
        setReturnRequest(data);
        setSelectedStatus(data.status);
        setSelectedResolution(data.resolution || "refund");
        setRefundAmount(String(data.refund_amount));
        setRestockItems(data.restock_items);
        setReason(data.reason || "");
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof ApiError ? err.message : "Failed to load return detail");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadReturnDetail();
    return () => {
      isMounted = false;
    };
  }, [returnId]);

  async function handleUpdate() {
    if (!returnRequest) {
      return;
    }

    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
      const updated = await api.patch<ReturnDetail>(`/returns/${returnRequest.id}`, {
        status: selectedStatus,
        resolution: selectedResolution,
        refund_amount: Number(refundAmount),
        restock_items: restockItems,
        reason: reason || null,
      });
      setReturnRequest(updated);
      setSelectedStatus(updated.status);
      setSelectedResolution(updated.resolution || "refund");
      setRefundAmount(String(updated.refund_amount));
      setRestockItems(updated.restock_items);
      setReason(updated.reason || "");
      setSuccess("Return request updated successfully.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update return request");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <LoadingState label="Loading return detail..." />;
  }

  if (!returnRequest) {
    return (
      <EmptyState
        title="Return not found"
        description="The requested return record could not be loaded from the backend API."
      />
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)] sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-4">
            <Link
              href="/dashboard/returns"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to returns
            </Link>
            <PageHeader
              eyebrow="Return Detail"
              title={returnRequest.return_number}
              description="Review return context, confirm operational resolution, and restock items carefully when the physical return is received."
              meta={returnRequest.stock_restocked ? "Inventory restocked" : "Restock pending"}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Status</p>
              <div className="mt-2">
                <StatusBadge status={returnRequest.status} />
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Resolution</p>
              <p className="mt-2 text-sm font-semibold text-slate-950">
                {returnRequest.resolution ? formatLabel(returnRequest.resolution) : "Pending"}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Refund</p>
              <p className="mt-2 text-sm font-semibold text-slate-950">
                {formatCurrency(returnRequest.refund_amount)}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-950">Return items</h2>
            <p className="text-sm text-slate-500">{returnRequest.items.length} line items</p>
          </div>

          <div className="mt-6 space-y-3">
            {returnRequest.items.map((item) => (
              <div key={item.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-slate-950">{item.product_name}</h3>
                    <p className="mt-1 text-sm text-slate-500">SKU: {item.sku || "No SKU"}</p>
                  </div>
                  <div className="text-left md:text-right">
                    <p className="text-sm text-slate-500">Restocked</p>
                    <p className="mt-1 text-base font-semibold text-slate-950">
                      {item.restocked_quantity} / {item.quantity}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    Quantity: <span className="font-semibold text-slate-950">{item.quantity}</span>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    Condition: <span className="font-semibold text-slate-950">{item.condition || "Not noted"}</span>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    Added: <span className="font-semibold text-slate-950">{formatDate(item.created_at)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </article>

        <div className="space-y-4">
          <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
            <h2 className="text-lg font-semibold text-slate-950">Summary</h2>
            <div className="mt-5 grid gap-3 text-sm text-slate-600">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                Order: <span className="font-semibold text-slate-950">{returnRequest.order?.order_number || "Unknown order"}</span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                Customer: <span className="font-semibold text-slate-950">{returnRequest.customer?.name || "Guest"}</span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                Warehouse: <span className="font-semibold text-slate-950">{returnRequest.warehouse?.name || "Not assigned"}</span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                Created: <span className="font-semibold text-slate-950">{formatDate(returnRequest.created_at)}</span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                Stock restocked: <span className="font-semibold text-slate-950">{returnRequest.stock_restocked ? "Yes" : "No"}</span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                Reason: <span className="font-semibold text-slate-950">{returnRequest.reason || "No reason recorded"}</span>
              </div>
            </div>
          </article>

          <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
            <h2 className="text-lg font-semibold text-slate-950">Update return</h2>
            <p className="mt-3 text-sm leading-7 text-slate-500">
              Move the return through review and receiving stages, then mark it restocked when inventory has physically come back in.
            </p>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Status
                </span>
                <select
                  value={selectedStatus}
                  onChange={(event) => setSelectedStatus(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {formatLabel(status)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Resolution
                </span>
                <select
                  value={selectedResolution}
                  onChange={(event) => setSelectedResolution(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                >
                  {resolutionOptions.map((resolution) => (
                    <option key={resolution} value={resolution}>
                      {formatLabel(resolution)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Refund amount
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={refundAmount}
                  onChange={(event) => setRefundAmount(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Reason
                </span>
                <textarea
                  rows={3}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                />
              </label>

              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={restockItems}
                  onChange={(event) => setRestockItems(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Restock eligible items when this return reaches Restocked.
              </label>

              {shouldWarnForRestock ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4" />
                    <p>
                      This will increase inventory and create stock movement records.
                    </p>
                  </div>
                </div>
              ) : null}

              {error ? <ErrorAlert message={error} /> : null}
              {success ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {success}
                </div>
              ) : null}

              <button
                type="button"
                onClick={handleUpdate}
                disabled={isSaving}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-4 w-4" />
                    Update Return
                  </>
                )}
              </button>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
