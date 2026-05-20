"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, Loader2 } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { api, ApiError } from "@/lib/api";
import { formatCurrency, formatDate, formatLabel } from "@/lib/format";

type Supplier = {
  id: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
};

type Warehouse = {
  id: string;
  name: string;
  code: string;
  address: string | null;
};

type PurchaseOrderItem = {
  id: string;
  product_id: string | null;
  variant_id: string | null;
  product_name: string;
  sku: string | null;
  quantity: number;
  received_quantity: number;
  unit_cost: number | string;
  total_cost: number | string;
  created_at: string;
};

type PurchaseOrderDetail = {
  id: string;
  po_number: string;
  supplier_id: string | null;
  warehouse_id: string | null;
  status: string;
  order_date: string | null;
  expected_date: string | null;
  received_date: string | null;
  subtotal: number | string;
  discount: number | string;
  total: number | string;
  notes: string | null;
  stock_received: boolean;
  created_at: string;
  updated_at: string;
  supplier: Supplier | null;
  warehouse: Warehouse | null;
  items: PurchaseOrderItem[];
};

const statusOptions = ["draft", "ordered", "partially_received", "received", "cancelled"];

export default function PurchaseOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const purchaseOrderId = params.id;
  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrderDetail | null>(null);
  const [selectedStatus, setSelectedStatus] = useState("draft");
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const shouldWarnForReceiving = useMemo(() => {
    if (!purchaseOrder || purchaseOrder.stock_received) {
      return false;
    }
    return selectedStatus === "received";
  }, [purchaseOrder, selectedStatus]);

  useEffect(() => {
    let isMounted = true;

    async function loadPurchaseOrder() {
      try {
        const data = await api.get<PurchaseOrderDetail>(`/purchase-orders/${purchaseOrderId}`);
        if (!isMounted) return;
        setPurchaseOrder(data);
        setSelectedStatus(data.status);
        setNotes(data.notes || "");
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof ApiError ? err.message : "Failed to load purchase order detail");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadPurchaseOrder();
    return () => {
      isMounted = false;
    };
  }, [purchaseOrderId]);

  async function handleUpdate() {
    if (!purchaseOrder) {
      return;
    }

    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
      const updated = await api.patch<PurchaseOrderDetail>(`/purchase-orders/${purchaseOrder.id}`, {
        status: selectedStatus,
        notes: notes || null,
      });
      setPurchaseOrder(updated);
      setSelectedStatus(updated.status);
      setNotes(updated.notes || "");
      setSuccess("Purchase order updated successfully.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update purchase order");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <LoadingState label="Loading purchase order detail..." />;
  }

  if (!purchaseOrder) {
    return (
      <EmptyState
        title="Purchase order not found"
        description="The requested purchase order could not be loaded from the backend API."
      />
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)] sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-4">
            <Link
              href="/dashboard/purchase-orders"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to purchase orders
            </Link>
            <PageHeader
              eyebrow="Purchase Order Detail"
              title={purchaseOrder.po_number}
              description="Review purchase lines, vendor context, warehouse destination, and receiving readiness from one replenishment workspace."
              meta={purchaseOrder.stock_received ? "Stock received" : "Stock pending"}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Status</p>
              <div className="mt-2">
                <StatusBadge status={purchaseOrder.status} />
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Warehouse</p>
              <p className="mt-2 text-sm font-semibold text-slate-950">
                {purchaseOrder.warehouse?.name || "Not assigned"}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Received</p>
              <div className="mt-2">
                <StatusBadge
                  status={purchaseOrder.stock_received ? "received" : "pending"}
                  label={purchaseOrder.stock_received ? "Received" : "Pending"}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-950">Purchase items</h2>
            <p className="text-sm text-slate-500">{purchaseOrder.items.length} line items</p>
          </div>

          <div className="mt-6 space-y-3">
            {purchaseOrder.items.map((item) => (
              <div key={item.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-slate-950">{item.product_name}</h3>
                    <p className="mt-1 text-sm text-slate-500">SKU: {item.sku || "No SKU"}</p>
                  </div>
                  <div className="text-left md:text-right">
                    <p className="text-sm text-slate-500">Line total</p>
                    <p className="mt-1 text-base font-semibold text-slate-950">{formatCurrency(item.total_cost)}</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-4">
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    Quantity: <span className="font-semibold text-slate-950">{item.quantity}</span>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    Received: <span className="font-semibold text-slate-950">{item.received_quantity}</span>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    Unit cost: <span className="font-semibold text-slate-950">{formatCurrency(item.unit_cost)}</span>
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
            <h2 className="text-lg font-semibold text-slate-950">Supplier</h2>
            {purchaseOrder.supplier ? (
              <div className="mt-5 space-y-3 text-sm text-slate-600">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <span className="font-medium text-slate-950">{purchaseOrder.supplier.name}</span>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  Contact: {purchaseOrder.supplier.contact_person || "No contact"}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  Phone: {purchaseOrder.supplier.phone || "No phone"}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  Email: {purchaseOrder.supplier.email || "No email"}
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm leading-7 text-slate-500">
                This purchase order is currently not linked to a supplier record.
              </p>
            )}
          </article>

          <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
            <h2 className="text-lg font-semibold text-slate-950">Warehouse</h2>
            {purchaseOrder.warehouse ? (
              <div className="mt-5 space-y-3 text-sm text-slate-600">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <span className="font-medium text-slate-950">{purchaseOrder.warehouse.name}</span>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  Code: {purchaseOrder.warehouse.code}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  Address: {purchaseOrder.warehouse.address || "No address"}
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                No warehouse assigned. Receiving cannot increase inventory until a warehouse is selected.
              </div>
            )}
          </article>

          <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
            <h2 className="text-lg font-semibold text-slate-950">Totals</h2>
            <div className="mt-5 grid gap-3 text-sm text-slate-600">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                Subtotal: <span className="font-semibold text-slate-950">{formatCurrency(purchaseOrder.subtotal)}</span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                Discount: <span className="font-semibold text-slate-950">{formatCurrency(purchaseOrder.discount)}</span>
              </div>
              <div className="rounded-2xl border border-slate-950 bg-slate-950 px-4 py-3 text-white">
                Total: <span className="font-semibold">{formatCurrency(purchaseOrder.total)}</span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                Order date: <span className="font-semibold text-slate-950">{formatDate(purchaseOrder.order_date)}</span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                Expected date: <span className="font-semibold text-slate-950">{formatDate(purchaseOrder.expected_date)}</span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                Received date: <span className="font-semibold text-slate-950">{formatDate(purchaseOrder.received_date)}</span>
              </div>
            </div>
          </article>

          <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-950">Receiving controls</h2>
              <Link
                href="/dashboard/stock-movements"
                className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
              >
                View stock movements
              </Link>
            </div>
            <p className="mt-3 text-sm leading-7 text-slate-500">
              Move a purchase order to received only when the warehouse has actually accepted the incoming stock.
            </p>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Purchase order status</span>
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
                <span className="mb-2 block text-sm font-medium text-slate-700">Notes</span>
                <textarea
                  rows={4}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                />
              </label>

              {shouldWarnForReceiving ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4" />
                    <p>
                      This will increase inventory and create purchase_received stock movements.
                    </p>
                  </div>
                </div>
              ) : null}

              {error ? <ErrorAlert message={error} /> : null}
              {success ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}

              <button
                type="button"
                onClick={handleUpdate}
                disabled={isSaving || (selectedStatus === purchaseOrder.status && notes === (purchaseOrder.notes || ""))}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Update Purchase Order"
                )}
              </button>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
