"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Clock3,
  Loader2,
  PackagePlus,
  Printer,
  RefreshCcw,
  Tags,
} from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { api, ApiError } from "@/lib/api";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatLabel,
} from "@/lib/format";

type Customer = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  city: string | null;
  notes: string | null;
};

type Warehouse = {
  id: string;
  name: string;
  code: string;
  address: string | null;
  is_active: boolean;
};

type OrderItem = {
  id: string;
  product_id: string | null;
  variant_id: string | null;
  product_name: string;
  sku: string | null;
  quantity: number;
  unit_price: number | string;
  total_price: number | string;
  created_at: string;
};

type OrderEvent = {
  id: string;
  event_type: string;
  message: string;
  created_at: string;
  created_by_id: string | null;
  created_by?: {
    id: string;
    full_name: string;
    email: string;
  } | null;
};

type OrderDetail = {
  id: string;
  order_number: string;
  customer_id: string | null;
  warehouse_id: string | null;
  customer_phone: string | null;
  shipping_address: string | null;
  notes: string | null;
  tags: string | null;
  status: string;
  payment_status: string;
  source: string;
  subtotal: number | string;
  discount: number | string;
  delivery_charge: number | string;
  total: number | string;
  stock_deducted: boolean;
  printed_count: number;
  last_printed_at: string | null;
  created_at: string;
  updated_at: string;
  customer: Customer | null;
  warehouse: Warehouse | null;
  items: OrderItem[];
  events: OrderEvent[];
};

type Shipment = {
  id: string;
  shipment_number: string;
  order_id: string;
  courier_id: string | null;
  tracking_number: string | null;
  status: string;
  delivery_charge: number | string;
  cod_amount: number | string;
  shipped_at: string | null;
  delivered_at: string | null;
  created_at: string;
  courier?: { id: string; name: string; code: string } | null;
};

const statusOptions = [
  "pending",
  "confirmed",
  "processing",
  "ready_to_ship",
  "shipped",
  "partial_delivered",
  "delivered",
  "cancelled",
  "returned",
];

function parseTags(tags: string | null | undefined) {
  return (tags || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const orderId = params.id;
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [selectedStatus, setSelectedStatus] = useState("pending");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isMarkingPrinted, setIsMarkingPrinted] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const tags = useMemo(() => parseTags(order?.tags), [order?.tags]);

  const shouldWarnForDeduction = useMemo(() => {
    if (!order || order.stock_deducted) {
      return false;
    }

    return selectedStatus === "shipped" || selectedStatus === "delivered";
  }, [order, selectedStatus]);

  useEffect(() => {
    let isMounted = true;

    async function loadOrder() {
      try {
        const [data, shipmentsData] = await Promise.all([
          api.get<OrderDetail>(`/orders/${orderId}`),
          api.get<Shipment[]>(`/shipments?order_id=${orderId}&skip=0&limit=20`),
        ]);
        if (!isMounted) return;
        setOrder(data);
        setShipments(shipmentsData);
        setSelectedStatus(data.status);
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof ApiError ? err.message : "Failed to load order detail");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadOrder();
    return () => {
      isMounted = false;
    };
  }, [orderId]);

  async function handleStatusUpdate() {
    if (!order) {
      return;
    }

    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
      const updated = await api.patch<OrderDetail>(`/orders/${order.id}`, {
        status: selectedStatus,
      });
      setOrder(updated);
      setSelectedStatus(updated.status);
      setSuccess("Order status updated successfully.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update order status");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleMarkPrinted() {
    if (!order) {
      return;
    }

    setError("");
    setSuccess("");
    setIsMarkingPrinted(true);

    try {
      const updated = await api.post<OrderDetail>(`/orders/${order.id}/mark-printed`);
      setOrder(updated);
      setSuccess("Print count updated successfully.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update print tracking");
    } finally {
      setIsMarkingPrinted(false);
    }
  }

  if (isLoading) {
    return <LoadingState label="Loading order detail..." />;
  }

  if (!order) {
    return (
      <EmptyState
        title="Order not found"
        description="The requested order could not be loaded from the backend API."
      />
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)] sm:p-8">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-4">
            <Link
              href="/dashboard/orders"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to orders
            </Link>
            <PageHeader
              eyebrow="Order Detail"
              title={order.order_number}
              description="Review contact, shipping, print history, shipment linkage, and operational events before moving the order forward."
              meta={order.stock_deducted ? "Stock deducted" : "Stock pending"}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/dashboard/orders/${order.id}/invoice`}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
            >
              <Printer className="h-4 w-4" />
              Print Invoice
            </Link>
            <Link
              href={`/dashboard/shipments?order_id=${order.id}`}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
            >
              <PackagePlus className="h-4 w-4" />
              {shipments.length > 0 ? "Create/View Shipment" : "Create Shipment"}
            </Link>
            <a
              href="#update-status"
              className="inline-flex items-center gap-2 rounded-full border border-slate-950 bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              <RefreshCcw className="h-4 w-4" />
              Update Status
            </a>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Status</p>
            <div className="mt-2">
              <StatusBadge status={order.status} />
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Payment</p>
            <div className="mt-2">
              <StatusBadge status={order.payment_status} />
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Source</p>
            <p className="mt-2 text-sm font-semibold text-slate-950">
              {formatLabel(order.source)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Printed</p>
            <p className="mt-2 text-sm font-semibold text-slate-950">
              {order.printed_count} times
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Last printed</p>
            <p className="mt-2 text-sm font-semibold text-slate-950">
              {order.last_printed_at ? formatDateTime(order.last_printed_at) : "Never"}
            </p>
          </div>
        </div>
      </section>

      {(error || success) && (
        <section className="space-y-3">
          {error ? <ErrorAlert message={error} /> : null}
          {success ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {success}
            </div>
          ) : null}
        </section>
      )}

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-950">Order items</h2>
            <p className="text-sm text-slate-500">{order.items.length} line items</p>
          </div>

          <div className="mt-6 space-y-3">
            {order.items.map((item) => (
              <div
                key={item.id}
                className="rounded-3xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-slate-950">
                      {item.product_name}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      SKU: {item.sku || "No SKU"}
                    </p>
                  </div>
                  <div className="text-left md:text-right">
                    <p className="text-sm text-slate-500">Line total</p>
                    <p className="mt-1 text-base font-semibold text-slate-950">
                      {formatCurrency(item.total_price)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    Quantity: <span className="font-semibold text-slate-950">{item.quantity}</span>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    Unit price: <span className="font-semibold text-slate-950">{formatCurrency(item.unit_price)}</span>
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
            <h2 className="text-lg font-semibold text-slate-950">Shipping and contact</h2>
            <div className="mt-5 space-y-3 text-sm text-slate-600">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                Customer: <span className="font-semibold text-slate-950">{order.customer?.name || "Guest customer"}</span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                Phone: <span className="font-semibold text-slate-950">{order.customer_phone || order.customer?.phone || "No phone"}</span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                Email: <span className="font-semibold text-slate-950">{order.customer?.email || "No email"}</span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                Shipping address: <span className="font-semibold text-slate-950">{order.shipping_address || order.customer?.address || "No shipping address"}</span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                City: <span className="font-semibold text-slate-950">{order.customer?.city || "No city"}</span>
              </div>
            </div>
          </article>

          <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-950">Notes and tags</h2>
              <Tags className="h-4 w-4 text-slate-400" />
            </div>
            <div className="mt-5 space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                {order.notes ? order.notes : "No internal notes recorded for this order."}
              </div>
              {tags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No tags added.</p>
              )}
            </div>
          </article>

          <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-950">Warehouse</h2>
              {order.warehouse ? <StatusBadge status={order.warehouse.is_active ? "active" : "inactive"} /> : null}
            </div>
            {order.warehouse ? (
              <div className="mt-5 space-y-3 text-sm text-slate-600">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <span className="font-medium text-slate-950">{order.warehouse.name}</span>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  Code: {order.warehouse.code}
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  Address: {order.warehouse.address || "No address"}
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                No warehouse assigned. Stock deduction may use fallback behavior.
              </div>
            )}
          </article>

          <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-950">Shipments</h2>
              <Link
                href={`/dashboard/shipments?order_id=${order.id}`}
                className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
              >
                Create or view shipments
              </Link>
            </div>
            <div className="mt-5 space-y-3">
              {shipments.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                  No shipments recorded for this order yet.
                </div>
              ) : (
                shipments.map((shipment) => (
                  <div key={shipment.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <Link
                          href={`/dashboard/shipments/${shipment.id}`}
                          className="font-semibold text-slate-950 transition hover:text-slate-700 hover:underline"
                        >
                          {shipment.shipment_number}
                        </Link>
                        <p className="mt-1 text-slate-500">
                          Courier: {shipment.courier?.name || "Not assigned"}
                        </p>
                        <p className="mt-1 text-slate-500">
                          Tracking: {shipment.tracking_number || "Pending"}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <StatusBadge status={shipment.status} />
                        <Link
                          href={`/dashboard/shipments/${shipment.id}`}
                          className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                        >
                          View shipment
                        </Link>
                        <p className="text-xs text-slate-500">
                          Created {formatDate(shipment.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-950">Print tracking</h2>
              <button
                type="button"
                onClick={handleMarkPrinted}
                disabled={isMarkingPrinted}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isMarkingPrinted ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Marking...
                  </>
                ) : (
                  <>
                    <Printer className="h-4 w-4" />
                    Mark Printed
                  </>
                )}
              </button>
            </div>
            <div className="mt-5 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                Printed count: <span className="font-semibold text-slate-950">{order.printed_count}</span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                Last printed: <span className="font-semibold text-slate-950">{order.last_printed_at ? formatDateTime(order.last_printed_at) : "Never"}</span>
              </div>
            </div>
          </article>

          <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
            <h2 className="text-lg font-semibold text-slate-950">Totals</h2>
            <div className="mt-5 grid gap-3 text-sm text-slate-600">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                Subtotal: <span className="font-semibold text-slate-950">{formatCurrency(order.subtotal)}</span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                Discount: <span className="font-semibold text-slate-950">{formatCurrency(order.discount)}</span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                Delivery charge: <span className="font-semibold text-slate-950">{formatCurrency(order.delivery_charge)}</span>
              </div>
              <div className="rounded-2xl border border-slate-950 bg-slate-950 px-4 py-3 text-white">
                Total: <span className="font-semibold">{formatCurrency(order.total)}</span>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <article id="update-status" className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
          <h2 className="text-lg font-semibold text-slate-950">Update status</h2>
          <p className="mt-3 text-sm leading-7 text-slate-500">
            Moving an order to shipped or delivered deducts stock once if it has not already been fulfilled.
          </p>

          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                Order status
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

            {shouldWarnForDeduction ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4" />
                  <p>
                    Changing this order to {formatLabel(selectedStatus)} will attempt to deduct stock
                    {order.warehouse ? ` from ${order.warehouse.name}` : " from available inventory"}.
                  </p>
                </div>
              </div>
            ) : null}

            <button
              type="button"
              onClick={handleStatusUpdate}
              disabled={isSaving || selectedStatus === order.status}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Update Order Status"
              )}
            </button>
          </div>
        </article>

        <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-950">Event timeline</h2>
            <Clock3 className="h-4 w-4 text-slate-400" />
          </div>

          <div className="mt-5 space-y-4">
            {order.events.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                No order events recorded yet.
              </div>
            ) : (
              order.events.map((event) => (
                <div key={event.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={event.event_type} label={formatLabel(event.event_type)} />
                      </div>
                      <p className="mt-3 text-sm text-slate-700">{event.message}</p>
                      <p className="mt-2 text-xs text-slate-500">
                        {event.created_by?.full_name || "System"} • {formatDateTime(event.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
