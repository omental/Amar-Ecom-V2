"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, Truck } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { api, ApiError } from "@/lib/api";
import { formatCurrency, formatDate, formatLabel } from "@/lib/format";

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
  tracking_number: string | null;
  status: string;
  delivery_charge: number | string;
  cod_amount: number | string;
  shipped_at: string | null;
  delivered_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  order?: OrderOption | null;
  courier?: CourierOption | null;
};

type ShipmentForm = {
  courier_id: string;
  tracking_number: string;
  status: string;
  delivery_charge: string;
  cod_amount: string;
  notes: string;
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
    tracking_number: shipment.tracking_number || "",
    status: shipment.status,
    delivery_charge: String(shipment.delivery_charge),
    cod_amount: String(shipment.cod_amount),
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
        tracking_number: form.tracking_number || null,
        status: form.status,
        delivery_charge: toNumber(form.delivery_charge),
        cod_amount: toNumber(form.cod_amount),
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
              description="Review shipment routing, courier assignment, delivery values, and operational timeline from one logistics workspace."
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
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Courier</p>
              <p className="mt-2 text-sm font-semibold text-slate-950">
                {selectedCourier?.name || "Not assigned"}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Tracking</p>
              <p className="mt-2 text-sm font-semibold text-slate-950">
                {shipment.tracking_number || "Pending"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
          <PageHeader
            eyebrow="Update Shipment"
            title="Shipment controls"
            description="Adjust courier assignment, tracking details, and lifecycle status. Backend timestamps are set automatically when shipment milestones are reached."
          />

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
                Delivery charge: <span className="font-semibold text-slate-950">{formatCurrency(shipment.delivery_charge)}</span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                COD amount: <span className="font-semibold text-slate-950">{formatCurrency(shipment.cod_amount)}</span>
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
            <h2 className="text-lg font-semibold text-slate-950">Timeline</h2>
            <div className="mt-5 grid gap-3 text-sm text-slate-600">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                Shipped at: <span className="font-semibold text-slate-950">{shipment.shipped_at ? formatDate(shipment.shipped_at) : "Not shipped yet"}</span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                Delivered at: <span className="font-semibold text-slate-950">{shipment.delivered_at ? formatDate(shipment.delivered_at) : "Not delivered yet"}</span>
              </div>
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
