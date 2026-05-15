"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Rows3, Truck } from "lucide-react";

import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorAlert } from "@/components/ui/error-alert";
import { FormCard } from "@/components/ui/form-card";
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

type Shipment = {
  id: string;
  shipment_number: string;
  order_id: string;
  courier_id: string | null;
  tracking_number: string | null;
  external_provider: string | null;
  external_consignment_id: string | null;
  external_tracking_number: string | null;
  external_status: string | null;
  external_synced_at: string | null;
  status: string;
  delivery_charge: number | string;
  cod_amount: number | string;
  shipped_at: string | null;
  delivered_at: string | null;
  notes: string | null;
  created_at: string;
  order?: OrderOption | null;
  courier?: CourierOption | null;
};

type ShipmentForm = {
  shipment_number: string;
  order_id: string;
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

const initialForm: ShipmentForm = {
  shipment_number: "",
  order_id: "",
  courier_id: "",
  tracking_number: "",
  status: "pending",
  delivery_charge: "0",
  cod_amount: "0",
  notes: "",
};

function toNumber(value: string | number | null | undefined) {
  const numericValue = Number(value ?? 0);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

export default function ShipmentsPage() {
  const searchParams = useSearchParams();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [couriers, setCouriers] = useState<CourierOption[]>([]);
  const [form, setForm] = useState<ShipmentForm>(initialForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const orderMap = useMemo(() => new Map(orders.map((order) => [order.id, order])), [orders]);
  const courierMap = useMemo(() => new Map(couriers.map((courier) => [courier.id, courier])), [couriers]);
  const requestedOrderId = searchParams.get("order_id") || "";

  useEffect(() => {
    let isMounted = true;

    async function loadInitialData() {
      try {
        const [shipmentsData, ordersData, couriersData] = await Promise.all([
          api.get<Shipment[]>("/shipments?skip=0&limit=20"),
          api.get<OrderOption[]>("/orders?skip=0&limit=100"),
          api.get<CourierOption[]>("/couriers?skip=0&limit=100"),
        ]);

        if (!isMounted) return;
        setShipments(shipmentsData);
        setOrders(ordersData);
        setCouriers(couriersData);
        if (requestedOrderId) {
          setForm((current) => ({ ...current, order_id: requestedOrderId }));
        }
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof ApiError ? err.message : "Failed to load shipment data");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadInitialData();
    return () => {
      isMounted = false;
    };
  }, [requestedOrderId]);

  async function loadShipments() {
    setError("");
    try {
      const data = await api.get<Shipment[]>("/shipments?skip=0&limit=20");
      setShipments(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load shipments");
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSubmitting(true);

    try {
      await api.post<Shipment>("/shipments", {
        shipment_number: form.shipment_number,
        order_id: form.order_id,
        courier_id: form.courier_id || null,
        tracking_number: form.tracking_number || null,
        status: form.status,
        delivery_charge: toNumber(form.delivery_charge),
        cod_amount: toNumber(form.cod_amount),
        notes: form.notes || null,
      });
      setForm(initialForm);
      setSuccess("Shipment created successfully.");
      await loadShipments();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create shipment");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)] sm:p-8">
        <PageHeader
          eyebrow="Logistics Operations"
          title="Shipments"
          description="Create internal shipment records, assign couriers, and review safe external courier linkage without destructive local changes."
          meta={`${shipments.length} shipments`}
        />
        <div className="mt-4">
          <Link
            href="/dashboard/courier-integrations"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
          >
            <Truck className="h-4 w-4" />
            Open Courier Integrations
          </Link>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <FormCard
          title="Create shipment"
          description="Link a shipment to an order, assign a courier, and track core delivery fields such as COD and dispatch state."
          action={
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <Truck className="h-5 w-5" />
            </div>
          }
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Shipment number</span>
                <input
                  value={form.shipment_number}
                  onChange={(event) => setForm((current) => ({ ...current, shipment_number: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                  placeholder="SHP-20260511-001"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Order</span>
                <select
                  value={form.order_id}
                  onChange={(event) => setForm((current) => ({ ...current, order_id: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                  required
                >
                  <option value="">Select order</option>
                  {orders.map((order) => (
                    <option key={order.id} value={order.id}>
                      {order.order_number}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Courier</span>
                <select
                  value={form.courier_id}
                  onChange={(event) => setForm((current) => ({ ...current, courier_id: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                >
                  <option value="">No courier selected</option>
                  {couriers.filter((courier) => courier.is_active).map((courier) => (
                    <option key={courier.id} value={courier.id}>
                      {courier.name} ({courier.code})
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Tracking number</span>
                <input
                  value={form.tracking_number}
                  onChange={(event) => setForm((current) => ({ ...current, tracking_number: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                  placeholder="TRK-123456789"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Status</span>
                <select
                  value={form.status}
                  onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {formatLabel(status)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Delivery charge</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.delivery_charge}
                  onChange={(event) => setForm((current) => ({ ...current, delivery_charge: event.target.value }))}
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
                  onChange={(event) => setForm((current) => ({ ...current, cod_amount: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Notes</span>
              <textarea
                rows={3}
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                placeholder="Pickup, hub, delivery notes"
              />
            </label>

            {error ? <ErrorAlert message={error} /> : null}
            {success ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}

            <button
              type="submit"
              disabled={isSubmitting || isLoading}
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
                  Create Shipment
                </>
              )}
            </button>
          </form>
        </FormCard>

        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
          <PageHeader
            eyebrow="Saved Records"
            title="Recent shipments"
            description="Review internal shipment records created for order dispatch and delivery tracking."
          />

          <div className="mt-6">
            {isLoading ? (
              <LoadingState label="Loading shipments..." />
            ) : shipments.length === 0 ? (
              <EmptyState
                title="No shipments yet"
                description="Create the first shipment after an order is ready to move into logistics."
              />
            ) : (
              <DataTable columns={["Shipment #", "Order", "Courier", "Tracking", "External", "Status", "Delivery", "COD", "Created"]}>
                {shipments.map((shipment) => (
                  <div key={shipment.id} className="grid grid-cols-1 gap-3 px-5 py-4 text-sm text-slate-600 2xl:grid-cols-9 2xl:gap-4">
                    <div>
                      <Link
                        href={`/dashboard/shipments/${shipment.id}`}
                        className="font-medium text-slate-950 transition hover:text-slate-700 hover:underline"
                      >
                        {shipment.shipment_number}
                      </Link>
                      <div className="mt-2">
                        <Link
                          href={`/dashboard/shipments/${shipment.id}`}
                          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                        >
                          <Rows3 className="h-3.5 w-3.5" />
                          View
                        </Link>
                      </div>
                    </div>
                    <span>
                      {shipment.order?.order_number ||
                        orderMap.get(shipment.order_id)?.order_number ||
                        "Unknown order"}
                    </span>
                    <span>
                      {shipment.courier?.name ||
                        (shipment.courier_id ? courierMap.get(shipment.courier_id)?.name || "Unknown courier" : "Not assigned")}
                    </span>
                    <span>{shipment.tracking_number || "Pending"}</span>
                    <div>
                      {shipment.external_provider ? (
                        <>
                          <StatusBadge status={shipment.external_provider} />
                          <p className="mt-1 text-xs text-slate-500">
                            {shipment.external_status || shipment.external_tracking_number || shipment.external_consignment_id || "Linked"}
                          </p>
                        </>
                      ) : (
                        <span className="text-slate-400">No external link</span>
                      )}
                    </div>
                    <span>
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
                    </span>
                    <span>{formatCurrency(shipment.delivery_charge)}</span>
                    <span>{formatCurrency(shipment.cod_amount)}</span>
                    <span>{formatDate(shipment.created_at)}</span>
                  </div>
                ))}
              </DataTable>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
