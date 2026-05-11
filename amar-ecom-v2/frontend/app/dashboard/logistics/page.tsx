"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  PackageCheck,
  Rows3,
  Scale,
  Truck,
  Wallet,
} from "lucide-react";

import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorAlert } from "@/components/ui/error-alert";
import { FormCard } from "@/components/ui/form-card";
import { LoadingState } from "@/components/ui/loading-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { api, ApiError } from "@/lib/api";
import { formatCurrency, formatDate, formatLabel } from "@/lib/format";

type CustomerSummary = {
  id: string;
  name: string;
  phone: string;
};

type WarehouseSummary = {
  id: string;
  name: string;
  code: string;
};

type PendingDispatchOrder = {
  id: string;
  order_number: string;
  customer_id: string | null;
  warehouse_id: string | null;
  customer_phone: string | null;
  shipping_address: string | null;
  status: string;
  total: number | string;
  created_at: string;
  customer: CustomerSummary | null;
  warehouse: WarehouseSummary | null;
};

type Courier = {
  id: string;
  name: string;
  code: string;
  contact_phone: string | null;
  website: string | null;
  is_active: boolean;
};

type Shipment = {
  id: string;
  shipment_number: string;
  order_id: string;
  courier_id: string | null;
  recipient_name: string | null;
  recipient_phone: string | null;
  delivery_address: string | null;
  tracking_number: string | null;
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
  order?: {
    id: string;
    order_number: string;
    customer_phone: string | null;
    shipping_address: string | null;
    total: number | string | null;
    customer?: CustomerSummary | null;
    warehouse?: WarehouseSummary | null;
  } | null;
  courier?: Courier | null;
};

type CreateShipmentForm = {
  courier_id: string;
  tracking_number: string;
  shipment_number: string;
  delivery_charge: string;
  courier_charge: string;
  cod_amount: string;
  collected_amount: string;
  notes: string;
  order_status: string;
};

type ReconciliationForm = {
  shipment_id: string;
  courier_charge: string;
  collected_amount: string;
  reconciliation_status: string;
};

const tabs = [
  { id: "pending-dispatch", label: "Pending Dispatch" },
  { id: "shipments", label: "Shipments" },
  { id: "couriers", label: "Couriers" },
  { id: "reconciliation", label: "Reconciliation" },
] as const;

const reconciliationStatuses = ["pending", "matched", "mismatch", "settled", "cancelled"];

const initialCreateShipmentForm: CreateShipmentForm = {
  courier_id: "",
  tracking_number: "",
  shipment_number: "",
  delivery_charge: "0",
  courier_charge: "0",
  cod_amount: "0",
  collected_amount: "0",
  notes: "",
  order_status: "ready_to_ship",
};

const initialReconciliationForm: ReconciliationForm = {
  shipment_id: "",
  courier_charge: "0",
  collected_amount: "0",
  reconciliation_status: "pending",
};

function toNumber(value: string | number | null | undefined) {
  const numericValue = Number(value ?? 0);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

export default function LogisticsPage() {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]["id"]>("pending-dispatch");
  const [pendingDispatchOrders, setPendingDispatchOrders] = useState<PendingDispatchOrder[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<PendingDispatchOrder | null>(null);
  const [createShipmentForm, setCreateShipmentForm] = useState<CreateShipmentForm>(initialCreateShipmentForm);
  const [reconciliationForm, setReconciliationForm] = useState<ReconciliationForm>(initialReconciliationForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingShipment, setIsCreatingShipment] = useState(false);
  const [isUpdatingReconciliation, setIsUpdatingReconciliation] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const unsettledReconciliationCount = useMemo(
    () => shipments.filter((shipment) => !["settled", "cancelled"].includes(shipment.reconciliation_status)).length,
    [shipments],
  );

  useEffect(() => {
    let isMounted = true;

    async function loadLogisticsData() {
      try {
        const [pendingDispatchData, shipmentsData, couriersData] = await Promise.all([
          api.get<PendingDispatchOrder[]>("/logistics/pending-dispatch?skip=0&limit=100"),
          api.get<Shipment[]>("/shipments?skip=0&limit=100"),
          api.get<Courier[]>("/couriers?skip=0&limit=100"),
        ]);

        if (!isMounted) {
          return;
        }

        setPendingDispatchOrders(pendingDispatchData);
        setShipments(shipmentsData);
        setCouriers(couriersData);
      } catch (err) {
        if (!isMounted) {
          return;
        }
        setError(err instanceof ApiError ? err.message : "Failed to load logistics workspace");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadLogisticsData();
    return () => {
      isMounted = false;
    };
  }, []);

  async function refreshLogisticsData() {
    const [pendingDispatchData, shipmentsData, couriersData] = await Promise.all([
      api.get<PendingDispatchOrder[]>("/logistics/pending-dispatch?skip=0&limit=100"),
      api.get<Shipment[]>("/shipments?skip=0&limit=100"),
      api.get<Courier[]>("/couriers?skip=0&limit=100"),
    ]);
    setPendingDispatchOrders(pendingDispatchData);
    setShipments(shipmentsData);
    setCouriers(couriersData);
  }

  async function handleCreateShipment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedOrder) {
      return;
    }

    setError("");
    setSuccess("");
    setIsCreatingShipment(true);

    try {
      await api.post<Shipment>(`/orders/${selectedOrder.id}/create-shipment`, {
        courier_id: createShipmentForm.courier_id || null,
        tracking_number: createShipmentForm.tracking_number || null,
        shipment_number: createShipmentForm.shipment_number || null,
        delivery_charge: toNumber(createShipmentForm.delivery_charge),
        courier_charge: toNumber(createShipmentForm.courier_charge),
        cod_amount: toNumber(createShipmentForm.cod_amount),
        collected_amount: toNumber(createShipmentForm.collected_amount),
        notes: createShipmentForm.notes || null,
        order_status: createShipmentForm.order_status || null,
      });
      await refreshLogisticsData();
      setSelectedOrder(null);
      setCreateShipmentForm(initialCreateShipmentForm);
      setSuccess("Shipment created from order successfully.");
      setActiveTab("shipments");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create shipment from order");
    } finally {
      setIsCreatingShipment(false);
    }
  }

  function openReconciliationEditor(shipment: Shipment) {
    setActiveTab("reconciliation");
    setReconciliationForm({
      shipment_id: shipment.id,
      courier_charge: String(shipment.courier_charge),
      collected_amount: String(shipment.collected_amount),
      reconciliation_status: shipment.reconciliation_status,
    });
  }

  async function handleUpdateReconciliation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reconciliationForm.shipment_id) {
      return;
    }

    setError("");
    setSuccess("");
    setIsUpdatingReconciliation(true);

    try {
      await api.patch<Shipment>(`/shipments/${reconciliationForm.shipment_id}`, {
        courier_charge: toNumber(reconciliationForm.courier_charge),
        collected_amount: toNumber(reconciliationForm.collected_amount),
        reconciliation_status: reconciliationForm.reconciliation_status,
      });
      await refreshLogisticsData();
      setSuccess("Reconciliation updated successfully.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update reconciliation");
    } finally {
      setIsUpdatingReconciliation(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)] sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <PageHeader
            eyebrow="Logistics Workspace"
            title="Internal logistics hub"
            description="Work pending dispatch, shipment operations, courier coverage, and reconciliation from one workflow-oriented page without external courier APIs."
            meta={`${shipments.length} shipments`}
          />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Total shipments</p>
              <p className="mt-2 text-xl font-semibold text-slate-950">{shipments.length}</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.22em] text-amber-700">Pending shipments</p>
              <p className="mt-2 text-xl font-semibold text-amber-900">
                {shipments.filter((shipment) => shipment.status === "pending").length}
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.22em] text-emerald-700">Delivered shipments</p>
              <p className="mt-2 text-xl font-semibold text-emerald-900">
                {shipments.filter((shipment) => shipment.status === "delivered").length}
              </p>
            </div>
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.22em] text-rose-700">Unsettled reconciliation</p>
              <p className="mt-2 text-xl font-semibold text-rose-900">{unsettledReconciliationCount}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-[var(--shadow-soft)] sm:p-6">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  isActive
                    ? "border-slate-950 bg-slate-950 text-white"
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </section>

      {error ? <ErrorAlert message={error} /> : null}
      {success ? (
        <div className="rounded-[28px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-700 shadow-[var(--shadow-soft)]">
          {success}
        </div>
      ) : null}

      {isLoading ? <LoadingState label="Loading logistics workspace..." /> : null}

      {!isLoading && activeTab === "pending-dispatch" ? (
        <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
            <PageHeader
              eyebrow="Dispatch Queue"
              title="Pending dispatch"
              description="Orders that are operationally ready for shipment creation and internal logistics handoff."
            />

            <div className="mt-6">
              {pendingDispatchOrders.length === 0 ? (
                <EmptyState
                  title="No pending dispatch orders"
                  description="Orders with confirmed, processing, or ready-to-ship status and no active shipment will appear here."
                />
              ) : (
                <DataTable columns={["Order", "Customer", "Address", "Status", "Total", "Warehouse", "Actions"]}>
                  {pendingDispatchOrders.map((order) => (
                    <div
                      key={order.id}
                      className="grid grid-cols-1 gap-3 px-5 py-4 text-sm text-slate-600 2xl:grid-cols-7 2xl:gap-4"
                    >
                      <div>
                        <Link
                          href={`/dashboard/orders/${order.id}`}
                          className="font-medium text-slate-950 transition hover:text-slate-700 hover:underline"
                        >
                          {order.order_number}
                        </Link>
                        <p className="mt-1 text-xs text-slate-500">{formatDate(order.created_at)}</p>
                      </div>
                      <div>
                        <p className="font-medium text-slate-950">{order.customer?.name || "Guest customer"}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {order.customer_phone || order.customer?.phone || "No phone"}
                        </p>
                      </div>
                      <span>{order.shipping_address || "No delivery address"}</span>
                      <span>
                        <StatusBadge status={order.status} />
                      </span>
                      <span>{formatCurrency(order.total)}</span>
                      <span>{order.warehouse?.name || "No warehouse"}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedOrder(order);
                          setCreateShipmentForm((current) => ({
                            ...current,
                            cod_amount: String(order.total),
                          }));
                        }}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                      >
                        <Truck className="h-3.5 w-3.5" />
                        Create Shipment
                      </button>
                    </div>
                  ))}
                </DataTable>
              )}
            </div>
          </section>

          <FormCard
            title={selectedOrder ? `Create shipment for ${selectedOrder.order_number}` : "Create shipment from dispatch queue"}
            description={
              selectedOrder
                ? "Prefill shipment details from the order and move it into active logistics tracking."
                : "Select a pending-dispatch order from the table to open the shipment creation form."
            }
            action={
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <PackageCheck className="h-5 w-5" />
              </div>
            }
          >
            {!selectedOrder ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                No order selected yet.
              </div>
            ) : (
              <form onSubmit={handleCreateShipment} className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                  <p className="font-semibold text-slate-950">{selectedOrder.order_number}</p>
                  <p className="mt-1">{selectedOrder.customer?.name || "Guest customer"}</p>
                  <p className="mt-1">{selectedOrder.shipping_address || "No delivery address"}</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Courier</span>
                    <select
                      value={createShipmentForm.courier_id}
                      onChange={(event) =>
                        setCreateShipmentForm((current) => ({ ...current, courier_id: event.target.value }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                      required
                    >
                      <option value="">Select courier</option>
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
                      value={createShipmentForm.tracking_number}
                      onChange={(event) =>
                        setCreateShipmentForm((current) => ({ ...current, tracking_number: event.target.value }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                      placeholder="TRK-123456789"
                    />
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Shipment number</span>
                    <input
                      value={createShipmentForm.shipment_number}
                      onChange={(event) =>
                        setCreateShipmentForm((current) => ({ ...current, shipment_number: event.target.value }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                      placeholder="Leave blank to auto-generate"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Update order status</span>
                    <select
                      value={createShipmentForm.order_status}
                      onChange={(event) =>
                        setCreateShipmentForm((current) => ({ ...current, order_status: event.target.value }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                    >
                      <option value="">Do not change order</option>
                      <option value="ready_to_ship">Ready to Ship</option>
                      <option value="shipped">Shipped</option>
                    </select>
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Courier charge</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={createShipmentForm.courier_charge}
                      onChange={(event) =>
                        setCreateShipmentForm((current) => ({ ...current, courier_charge: event.target.value }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">COD amount</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={createShipmentForm.cod_amount}
                      onChange={(event) =>
                        setCreateShipmentForm((current) => ({ ...current, cod_amount: event.target.value }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Notes</span>
                  <textarea
                    rows={3}
                    value={createShipmentForm.notes}
                    onChange={(event) =>
                      setCreateShipmentForm((current) => ({ ...current, notes: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                    placeholder="Pickup, handoff, or internal dispatch note"
                  />
                </label>

                <button
                  type="submit"
                  disabled={isCreatingShipment}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isCreatingShipment ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Truck className="h-4 w-4" />
                      Create Shipment
                    </>
                  )}
                </button>
              </form>
            )}
          </FormCard>
        </div>
      ) : null}

      {!isLoading && activeTab === "shipments" ? (
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
          <PageHeader
            eyebrow="Operational Shipments"
            title="Shipment table"
            description="Track recipient details, courier routing, COD, and reconciliation state from one list."
          />

          <div className="mt-6">
            {shipments.length === 0 ? (
              <EmptyState
                title="No shipments yet"
                description="Create shipments from pending dispatch or the order detail page."
              />
            ) : (
              <DataTable columns={["Shipment", "Order", "Recipient", "Courier", "Status", "COD", "Collected", "Reconciliation", "Actions"]}>
                {shipments.map((shipment) => (
                  <div
                    key={shipment.id}
                    className="grid grid-cols-1 gap-3 px-5 py-4 text-sm text-slate-600 2xl:grid-cols-9 2xl:gap-4"
                  >
                    <div>
                      <Link
                        href={`/dashboard/shipments/${shipment.id}`}
                        className="font-medium text-slate-950 transition hover:text-slate-700 hover:underline"
                      >
                        {shipment.shipment_number}
                      </Link>
                      <p className="mt-1 text-xs text-slate-500">{shipment.tracking_number || "No tracking yet"}</p>
                    </div>
                    <span>{shipment.order?.order_number || "Unknown order"}</span>
                    <div>
                      <p className="font-medium text-slate-950">{shipment.recipient_name || shipment.order?.customer?.name || "No recipient"}</p>
                      <p className="mt-1 text-xs text-slate-500">{shipment.recipient_phone || shipment.order?.customer_phone || "No phone"}</p>
                    </div>
                    <span>{shipment.courier?.name || "No courier"}</span>
                    <span>
                      <StatusBadge status={shipment.status} />
                    </span>
                    <span>{formatCurrency(shipment.cod_amount)}</span>
                    <span>{formatCurrency(shipment.collected_amount)}</span>
                    <span>
                      <StatusBadge status={shipment.reconciliation_status} />
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/dashboard/shipments/${shipment.id}`}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                      >
                        <Rows3 className="h-3.5 w-3.5" />
                        View / Update
                      </Link>
                      <button
                        type="button"
                        onClick={() => openReconciliationEditor(shipment)}
                        className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-100"
                      >
                        <Wallet className="h-3.5 w-3.5" />
                        Reconcile
                      </button>
                    </div>
                  </div>
                ))}
              </DataTable>
            )}
          </div>
        </section>
      ) : null}

      {!isLoading && activeTab === "couriers" ? (
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
          <PageHeader
            eyebrow="Courier Coverage"
            title="Courier list"
            description="Keep existing courier masters visible inside the logistics workspace without replacing the standalone page."
          />

          <div className="mt-6">
            {couriers.length === 0 ? (
              <EmptyState
                title="No couriers yet"
                description="Add couriers from the standalone couriers page or keep using manual internal shipment tracking."
              />
            ) : (
              <DataTable columns={["Courier", "Code", "Phone", "Website", "Status"]}>
                {couriers.map((courier) => (
                  <div
                    key={courier.id}
                    className="grid grid-cols-1 gap-3 px-5 py-4 text-sm text-slate-600 xl:grid-cols-5 xl:gap-4"
                  >
                    <span className="font-medium text-slate-950">{courier.name}</span>
                    <span>{courier.code}</span>
                    <span>{courier.contact_phone || "No phone"}</span>
                    <span>{courier.website || "No website"}</span>
                    <span>
                      <StatusBadge status={courier.is_active ? "active" : "inactive"} />
                    </span>
                  </div>
                ))}
              </DataTable>
            )}
          </div>

          <Link
            href="/dashboard/couriers"
            className="mt-6 inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
          >
            Open standalone couriers page
          </Link>
        </section>
      ) : null}

      {!isLoading && activeTab === "reconciliation" ? (
        <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
            <PageHeader
              eyebrow="Money Reconciliation"
              title="Shipment reconciliation"
              description="Compare COD, courier charges, collections, and settlement state for internal tracking."
            />

            <div className="mt-6">
              {shipments.length === 0 ? (
                <EmptyState
                  title="No shipments available for reconciliation"
                  description="Create shipments first to begin reconciliation work."
                />
              ) : (
                <DataTable columns={["Shipment", "Courier", "COD", "Courier Charge", "Collected", "Status", "Reconciled", "Actions"]}>
                  {shipments.map((shipment) => (
                    <div
                      key={shipment.id}
                      className="grid grid-cols-1 gap-3 px-5 py-4 text-sm text-slate-600 2xl:grid-cols-8 2xl:gap-4"
                    >
                      <span className="font-medium text-slate-950">{shipment.shipment_number}</span>
                      <span>{shipment.courier?.name || "No courier"}</span>
                      <span>{formatCurrency(shipment.cod_amount)}</span>
                      <span>{formatCurrency(shipment.courier_charge)}</span>
                      <span>{formatCurrency(shipment.collected_amount)}</span>
                      <span>
                        <StatusBadge status={shipment.reconciliation_status} />
                      </span>
                      <span>{shipment.reconciled_at ? formatDate(shipment.reconciled_at) : "Not reconciled"}</span>
                      <button
                        type="button"
                        onClick={() => openReconciliationEditor(shipment)}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                      >
                        <Scale className="h-3.5 w-3.5" />
                        Update
                      </button>
                    </div>
                  ))}
                </DataTable>
              )}
            </div>
          </section>

          <FormCard
            title="Update reconciliation"
            description="Select a shipment from the table and record the courier charge, collected amount, and settlement state."
            action={
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <Wallet className="h-5 w-5" />
              </div>
            }
          >
            {!reconciliationForm.shipment_id ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                No shipment selected yet.
              </div>
            ) : (
              <form onSubmit={handleUpdateReconciliation} className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                  Shipment:{" "}
                  <span className="font-semibold text-slate-950">
                    {shipments.find((shipment) => shipment.id === reconciliationForm.shipment_id)?.shipment_number || "Selected shipment"}
                  </span>
                </div>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Courier charge</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={reconciliationForm.courier_charge}
                    onChange={(event) =>
                      setReconciliationForm((current) => ({ ...current, courier_charge: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Collected amount</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={reconciliationForm.collected_amount}
                    onChange={(event) =>
                      setReconciliationForm((current) => ({ ...current, collected_amount: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Reconciliation status</span>
                  <select
                    value={reconciliationForm.reconciliation_status}
                    onChange={(event) =>
                      setReconciliationForm((current) => ({ ...current, reconciliation_status: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                  >
                    {reconciliationStatuses.map((status) => (
                      <option key={status} value={status}>
                        {formatLabel(status)}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="submit"
                  disabled={isUpdatingReconciliation}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isUpdatingReconciliation ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Wallet className="h-4 w-4" />
                      Save Reconciliation
                    </>
                  )}
                </button>
              </form>
            )}
          </FormCard>
        </div>
      ) : null}
    </div>
  );
}
