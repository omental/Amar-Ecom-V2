"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Clock3, Loader2, RefreshCw, Truck, Wallet } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { api, ApiError } from "@/lib/api";
import { formatCurrency, formatDate, formatDateTime, formatLabel } from "@/lib/format";

type OrderOption = {
  id: string;
  order_number: string;
};

type CourierOption = {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
};

type ShipmentDetail = {
  id: string;
  shipment_number: string;
  order_id: string;
  courier_id: string | null;
  recipient_name: string | null;
  recipient_phone: string | null;
  delivery_address: string | null;
  tracking_number: string | null;
  external_provider: string | null;
  external_consignment_id: string | null;
  external_tracking_number: string | null;
  external_status: string | null;
  external_synced_at: string | null;
  sent_to_courier_at: string | null;
  status: string;
  delivery_charge: number | string;
  courier_charge: number | string;
  cod_amount: number | string;
  collected_amount: number | string;
  reconciliation_status: string;
  reconciled_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  order?: OrderOption | null;
  courier?: CourierOption | null;
  events: ShipmentEvent[];
};

type ShipmentForm = {
  courier_id: string;
  recipient_name: string;
  recipient_phone: string;
  delivery_address: string;
  tracking_number: string;
  status: string;
  delivery_charge: string;
  courier_charge: string;
  cod_amount: string;
  collected_amount: string;
  reconciliation_status: string;
  notes: string;
};

type ShipmentEvent = {
  id: string;
  event_type: string;
  message: string;
  created_at: string;
  created_by?: {
    id: string;
    full_name: string;
    email: string;
  } | null;
};

type ExternalStatusSyncResult = {
  old_external_status?: string | null;
  external_status: string | null;
  suggested_internal_status?: string | null;
  internal_status_changed?: boolean;
  warnings?: string[];
  message: string;
};

const statusOptions = [
  "pending",
  "ready_to_ship",
  "shipped",
  "in_transit",
  "delivered",
  "failed",
  "returned",
  "cancelled",
];

function toNumber(value: string | number | null | undefined) {
  const numericValue = Number(value ?? 0);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function shipmentToForm(shipment: ShipmentDetail): ShipmentForm {
  return {
    courier_id: shipment.courier_id || "",
    recipient_name: shipment.recipient_name || "",
    recipient_phone: shipment.recipient_phone || "",
    delivery_address: shipment.delivery_address || "",
    tracking_number: shipment.tracking_number || "",
    status: shipment.status,
    delivery_charge: String(shipment.delivery_charge),
    courier_charge: String(shipment.courier_charge),
    cod_amount: String(shipment.cod_amount),
    collected_amount: String(shipment.collected_amount),
    reconciliation_status: shipment.reconciliation_status,
    notes: shipment.notes || "",
  };
}

export default function ShipmentDetailPage() {
  const params = useParams<{ id: string }>();
  const shipmentId = params.id;

  const [shipment, setShipment] = useState<ShipmentDetail | null>(null);
  const [couriers, setCouriers] = useState<CourierOption[]>([]);
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [form, setForm] = useState<ShipmentForm | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncingExternalStatus, setIsSyncingExternalStatus] = useState(false);
  const [applySafeStatus, setApplySafeStatus] = useState(false);
  const [lastExternalSyncResult, setLastExternalSyncResult] = useState<ExternalStatusSyncResult | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedCourier = useMemo(() => {
    if (!shipment) return null;
    return shipment.courier || couriers.find((courier) => courier.id === shipment.courier_id) || null;
  }, [couriers, shipment]);

  useEffect(() => {
    let isMounted = true;

    async function loadShipmentDetail() {
      try {
        const [shipmentData, couriersData, ordersData] = await Promise.all([
          api.get<ShipmentDetail>(`/shipments/${shipmentId}`),
          api.get<CourierOption[]>("/couriers?skip=0&limit=100"),
          api.get<OrderOption[]>("/orders?skip=0&limit=100"),
        ]);

        if (!isMounted) return;
        setShipment(shipmentData);
        setCouriers(couriersData);
        setOrders(ordersData);
        setForm(shipmentToForm(shipmentData));
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof ApiError ? err.message : "Failed to load shipment detail");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadShipmentDetail();
    return () => {
      isMounted = false;
    };
  }, [shipmentId]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form || !shipment) {
      return;
    }

    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
      const updated = await api.patch<ShipmentDetail>(`/shipments/${shipment.id}`, {
        courier_id: form.courier_id || null,
        recipient_name: form.recipient_name || null,
        recipient_phone: form.recipient_phone || null,
        delivery_address: form.delivery_address || null,
        tracking_number: form.tracking_number || null,
        status: form.status,
        delivery_charge: toNumber(form.delivery_charge),
        courier_charge: toNumber(form.courier_charge),
        cod_amount: toNumber(form.cod_amount),
        collected_amount: toNumber(form.collected_amount),
        reconciliation_status: form.reconciliation_status,
        notes: form.notes || null,
      });
      setShipment(updated);
      setForm(shipmentToForm(updated));
      setSuccess("Shipment updated successfully.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update shipment");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSyncExternalStatus() {
    if (!shipment?.external_provider) {
      return;
    }

    setError("");
    setSuccess("");
    setIsSyncingExternalStatus(true);

    try {
      const syncResult = await api.post<ExternalStatusSyncResult>(`/courier-integrations/shipments/${shipment.id}/sync-status`, {
        provider: shipment.external_provider,
        apply_safe_status: applySafeStatus,
      });
      const refreshed = await api.get<ShipmentDetail>(`/shipments/${shipment.id}`);
      setShipment(refreshed);
      setForm(shipmentToForm(refreshed));
      setLastExternalSyncResult(syncResult);
      setSuccess(syncResult.message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to sync external courier status");
    } finally {
      setIsSyncingExternalStatus(false);
    }
  }

  if (isLoading) {
    return <LoadingState label="Loading shipment detail..." />;
  }

  if (!shipment || !form) {
    return (
      <EmptyState
        title="Shipment not found"
        description="The requested shipment could not be loaded from the backend API."
      />
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)] sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-4">
            <Link
              href="/dashboard/shipments"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to shipments
            </Link>
            <PageHeader
              eyebrow="Shipment Detail"
              title={shipment.shipment_number}
              description="Review recipient routing, courier assignment, reconciliation values, and event history from one logistics workspace."
              meta={shipment.order?.order_number || shipment.order_id}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Status</p>
              <div className="mt-2">
                <StatusBadge
                  status={shipment.status}
                  label={
                    shipment.status === "ready_to_ship"
                      ? "Ready to Ship"
                      : shipment.status === "in_transit"
                        ? "In Transit"
                        : undefined
                  }
                />
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Recipient</p>
              <p className="mt-2 text-sm font-semibold text-slate-950">
                {shipment.recipient_name || "No recipient"}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Reconciliation</p>
              <div className="mt-2">
                <StatusBadge status={shipment.reconciliation_status} />
              </div>
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/dashboard/courier-integrations"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
          >
            <Truck className="h-4 w-4" />
            Open Courier Integrations
          </Link>
          {shipment.external_provider ? (
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={applySafeStatus}
                  onChange={(event) => setApplySafeStatus(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-slate-950 focus:ring-slate-400"
                />
                Apply safe delivered status locally
              </label>
              <button
                type="button"
                onClick={() => void handleSyncExternalStatus()}
                disabled={isSyncingExternalStatus}
                className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700 transition hover:bg-sky-100 disabled:opacity-60"
              >
                {isSyncingExternalStatus ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Sync External Status
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
          <PageHeader
            eyebrow="Update Shipment"
            title="Shipment controls"
            description="Adjust recipient details, courier assignment, tracking, status, and reconciliation values. External courier sync remains safe and non-destructive."
          />

          {shipment.external_provider ? (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
              Sync external status updates courier tracking metadata safely. By default it does not change local shipment status unless you explicitly apply the safe delivered mapping.
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Courier</span>
                <select
                  value={form.courier_id}
                  onChange={(event) => setForm((current) => (current ? { ...current, courier_id: event.target.value } : current))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                >
                  <option value="">No courier selected</option>
                  {couriers.map((courier) => (
                    <option key={courier.id} value={courier.id}>
                      {courier.name} ({courier.code}){courier.is_active ? "" : " - Inactive"}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Recipient name</span>
                <input
                  value={form.recipient_name}
                  onChange={(event) => setForm((current) => (current ? { ...current, recipient_name: event.target.value } : current))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                  placeholder="Customer or delivery recipient"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Recipient phone</span>
                <input
                  value={form.recipient_phone}
                  onChange={(event) => setForm((current) => (current ? { ...current, recipient_phone: event.target.value } : current))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                  placeholder="01700000000"
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Delivery address</span>
              <textarea
                rows={3}
                value={form.delivery_address}
                onChange={(event) => setForm((current) => (current ? { ...current, delivery_address: event.target.value } : current))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Tracking number</span>
                <input
                  value={form.tracking_number}
                  onChange={(event) => setForm((current) => (current ? { ...current, tracking_number: event.target.value } : current))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                  placeholder="TRK-123456789"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Status</span>
                <select
                  value={form.status}
                  onChange={(event) => setForm((current) => (current ? { ...current, status: event.target.value } : current))}
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
                <span className="mb-2 block text-sm font-medium text-slate-700">Delivery charge</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.delivery_charge}
                  onChange={(event) => setForm((current) => (current ? { ...current, delivery_charge: event.target.value } : current))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Courier charge</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.courier_charge}
                  onChange={(event) => setForm((current) => (current ? { ...current, courier_charge: event.target.value } : current))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">COD amount</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.cod_amount}
                  onChange={(event) => setForm((current) => (current ? { ...current, cod_amount: event.target.value } : current))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Collected amount</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.collected_amount}
                  onChange={(event) => setForm((current) => (current ? { ...current, collected_amount: event.target.value } : current))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Reconciliation status</span>
                <select
                  value={form.reconciliation_status}
                  onChange={(event) => setForm((current) => (current ? { ...current, reconciliation_status: event.target.value } : current))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                >
                  {["pending", "matched", "mismatch", "settled", "cancelled"].map((status) => (
                    <option key={status} value={status}>
                      {formatLabel(status)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Notes</span>
              <textarea
                rows={4}
                value={form.notes}
                onChange={(event) => setForm((current) => (current ? { ...current, notes: event.target.value } : current))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
              />
            </label>

            {error ? <ErrorAlert message={error} /> : null}
            {success ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {success}
              </div>
            ) : null}
            {lastExternalSyncResult?.warnings?.length ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {lastExternalSyncResult.warnings.join(" | ")}
              </div>
            ) : null}

            <button
              type="submit"
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
                  <Truck className="h-4 w-4" />
                  Update Shipment
                </>
              )}
            </button>
          </form>
        </article>

        <div className="space-y-4">
          <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
            <h2 className="text-lg font-semibold text-slate-950">Shipment summary</h2>
            <div className="mt-5 grid gap-3 text-sm text-slate-600">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                Order:{" "}
                <span className="font-semibold text-slate-950">
                  {shipment.order?.order_number || orders.find((order) => order.id === shipment.order_id)?.order_number || "Unknown order"}
                </span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                Courier code: <span className="font-semibold text-slate-950">{selectedCourier?.code || "Not assigned"}</span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                External provider: <span className="font-semibold text-slate-950">{shipment.external_provider ? formatLabel(shipment.external_provider) : "Not linked"}</span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                External consignment: <span className="font-semibold text-slate-950">{shipment.external_consignment_id || "Not available"}</span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                External tracking: <span className="font-semibold text-slate-950">{shipment.external_tracking_number || "Not available"}</span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                External status: <span className="font-semibold text-slate-950">{shipment.external_status ? formatLabel(shipment.external_status) : "Not synced"}</span>
              </div>
              {lastExternalSyncResult ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  Sync suggestion: <span className="font-semibold text-slate-950">{lastExternalSyncResult.suggested_internal_status ? formatLabel(lastExternalSyncResult.suggested_internal_status) : "External-only update"}</span>
                </div>
              ) : null}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                External synced: <span className="font-semibold text-slate-950">{shipment.external_synced_at ? formatDateTime(shipment.external_synced_at) : "Never"}</span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                Recipient phone: <span className="font-semibold text-slate-950">{shipment.recipient_phone || "No phone"}</span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                Delivery address: <span className="font-semibold text-slate-950">{shipment.delivery_address || "No address"}</span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                Delivery charge: <span className="font-semibold text-slate-950">{formatCurrency(shipment.delivery_charge)}</span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                Courier charge: <span className="font-semibold text-slate-950">{formatCurrency(shipment.courier_charge)}</span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                COD amount: <span className="font-semibold text-slate-950">{formatCurrency(shipment.cod_amount)}</span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                Collected amount: <span className="font-semibold text-slate-950">{formatCurrency(shipment.collected_amount)}</span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                Created: <span className="font-semibold text-slate-950">{formatDate(shipment.created_at)}</span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                Updated: <span className="font-semibold text-slate-950">{formatDate(shipment.updated_at)}</span>
              </div>
            </div>
          </article>

          <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-950">Reconciliation and events</h2>
              <Wallet className="h-4 w-4 text-slate-400" />
            </div>
            <div className="mt-5 grid gap-3 text-sm text-slate-600">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                Shipped at: <span className="font-semibold text-slate-950">{shipment.shipped_at ? formatDate(shipment.shipped_at) : "Not shipped yet"}</span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                Delivered at: <span className="font-semibold text-slate-950">{shipment.delivered_at ? formatDate(shipment.delivered_at) : "Not delivered yet"}</span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                Reconciliation status: <span className="font-semibold text-slate-950">{formatLabel(shipment.reconciliation_status)}</span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                Reconciled at: <span className="font-semibold text-slate-950">{shipment.reconciled_at ? formatDate(shipment.reconciled_at) : "Not reconciled"}</span>
              </div>
              {lastExternalSyncResult ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  Last sync mapping: <span className="font-semibold text-slate-950">{lastExternalSyncResult.old_external_status ? formatLabel(lastExternalSyncResult.old_external_status) : "None"} to {lastExternalSyncResult.external_status ? formatLabel(lastExternalSyncResult.external_status) : "Unknown"}</span>
                </div>
              ) : null}
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-slate-950">Event timeline</h3>
                <Clock3 className="h-4 w-4 text-slate-400" />
              </div>
              {shipment.events.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                  No shipment events recorded yet.
                </div>
              ) : (
                shipment.events.map((event) => (
                  <div key={event.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={event.event_type} label={formatLabel(event.event_type)} />
                    </div>
                    <p className="mt-3 text-sm text-slate-700">{event.message}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      {event.created_by?.full_name || "System"} • {formatDate(event.created_at)}
                    </p>
                  </div>
                ))
              )}
            </div>

            <Link
              href={`/dashboard/orders/${shipment.order_id}`}
              className="mt-5 inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
            >
              Open Linked Order
            </Link>
          </article>
        </div>
      </section>
    </div>
  );
}
