"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Loader2,
  PackageCheck,
  Rows3,
  Scale,
  Search,
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

type LogisticsOperationsSummary = {
  pending_dispatch_count: number;
  sent_to_external_courier_count: number;
  external_delivered_unsettled_count: number;
  external_failed_returned_count: number;
  unsettled_reconciliation_count: number;
  shipments_missing_tracking_count: number;
  shipments_waiting_status_sync_count: number;
  delivered_shipments: number;
  failed_shipments: number;
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
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]["id"]>("pending-dispatch");
  const [pendingDispatchOrders, setPendingDispatchOrders] = useState<PendingDispatchOrder[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [operationsSummary, setOperationsSummary] = useState<LogisticsOperationsSummary | null>(null);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<PendingDispatchOrder | null>(null);
  const [pendingSearch, setPendingSearch] = useState("");
  const [pendingStatusFilter, setPendingStatusFilter] = useState("all");
  const [pendingWarehouseFilter, setPendingWarehouseFilter] = useState("all");
  const [reconciliationStatusFilter, setReconciliationStatusFilter] = useState("all");
  const [reconciliationCourierFilter, setReconciliationCourierFilter] = useState("all");
  const [createShipmentForm, setCreateShipmentForm] = useState<CreateShipmentForm>(initialCreateShipmentForm);
  const [reconciliationForm, setReconciliationForm] = useState<ReconciliationForm>(initialReconciliationForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingShipment, setIsCreatingShipment] = useState(false);
  const [isUpdatingReconciliation, setIsUpdatingReconciliation] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const externallyDeliveredPendingReconciliationCount = useMemo(
    () =>
      shipments.filter(
        (shipment) =>
          shipment.external_status === "delivered" && !["settled", "cancelled"].includes(shipment.reconciliation_status),
      ).length,
    [shipments],
  );
  const externalFailedReturnedCount = useMemo(
    () => shipments.filter((shipment) => ["failed", "returned"].includes(shipment.external_status || "")).length,
    [shipments],
  );
  const pendingWarehouseOptions = useMemo(
    () =>
      Array.from(
        new Map(
          pendingDispatchOrders
            .filter((order) => order.warehouse)
            .map((order) => [order.warehouse!.id, order.warehouse!]),
        ).values(),
      ),
    [pendingDispatchOrders],
  );
  const filteredPendingDispatchOrders = useMemo(() => {
    const search = pendingSearch.trim().toLowerCase();
    return pendingDispatchOrders.filter((order) => {
      if (pendingStatusFilter !== "all" && order.status !== pendingStatusFilter) {
        return false;
      }
      if (pendingWarehouseFilter !== "all" && (order.warehouse?.id || "") !== pendingWarehouseFilter) {
        return false;
      }
      if (!search) {
        return true;
      }
      const haystack = [
        order.order_number,
        order.customer?.name,
        order.customer_phone,
        order.customer?.phone,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(search);
    });
  }, [pendingDispatchOrders, pendingSearch, pendingStatusFilter, pendingWarehouseFilter]);
  const filteredReconciliationShipments = useMemo(() => {
    return shipments.filter((shipment) => {
      if (
        reconciliationStatusFilter !== "all" &&
        shipment.reconciliation_status !== reconciliationStatusFilter
      ) {
        return false;
      }
      if (
        reconciliationCourierFilter !== "all" &&
        (shipment.courier?.id || "") !== reconciliationCourierFilter
      ) {
        return false;
      }
      return true;
    });
  }, [shipments, reconciliationStatusFilter, reconciliationCourierFilter]);
  const selectedOrderIdFromQuery = searchParams.get("order_id");
  const selectedOrderForForm =
    selectedOrder ||
    pendingDispatchOrders.find((item) => item.id === selectedOrderIdFromQuery) ||
    null;

  useEffect(() => {
    let isMounted = true;

    async function loadLogisticsData() {
      try {
        const [pendingDispatchData, shipmentsData, couriersData, summaryData] = await Promise.all([
          api.get<PendingDispatchOrder[]>("/logistics/pending-dispatch?skip=0&limit=100"),
          api.get<Shipment[]>("/shipments?skip=0&limit=100"),
          api.get<Courier[]>("/couriers?skip=0&limit=100"),
          api.get<LogisticsOperationsSummary>("/logistics/operations-summary"),
        ]);

        if (!isMounted) {
          return;
        }

        setPendingDispatchOrders(pendingDispatchData);
        setShipments(shipmentsData);
        setCouriers(couriersData);
        setOperationsSummary(summaryData);
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
    const [pendingDispatchData, shipmentsData, couriersData, summaryData] = await Promise.all([
      api.get<PendingDispatchOrder[]>("/logistics/pending-dispatch?skip=0&limit=100"),
      api.get<Shipment[]>("/shipments?skip=0&limit=100"),
      api.get<Courier[]>("/couriers?skip=0&limit=100"),
      api.get<LogisticsOperationsSummary>("/logistics/operations-summary"),
    ]);
    setPendingDispatchOrders(pendingDispatchData);
    setShipments(shipmentsData);
    setCouriers(couriersData);
    setOperationsSummary(summaryData);
  }

  async function handleCreateShipment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedOrderForForm) {
      return;
    }

    setError("");
    setSuccess("");
    setIsCreatingShipment(true);

    try {
      await api.post<Shipment>(`/orders/${selectedOrderForForm.id}/create-shipment`, {
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
            description="Work pending dispatch, shipment operations, courier coverage, reconciliation, and external courier handoff from one workflow-oriented page."
            meta={`${shipments.length} shipments`}
          />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">External Failed or Returned</p>
              <p className="mt-2 text-xl font-semibold text-slate-950">{operationsSummary?.external_failed_returned_count ?? externalFailedReturnedCount}</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.22em] text-amber-700">Pending Dispatch</p>
              <p className="mt-2 text-xl font-semibold text-amber-900">
                {operationsSummary?.pending_dispatch_count ?? pendingDispatchOrders.length}
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.22em] text-emerald-700">Sent to Courier</p>
              <p className="mt-2 text-xl font-semibold text-emerald-900">
                {operationsSummary?.sent_to_external_courier_count ?? 0}
              </p>
            </div>
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.22em] text-rose-700">External Delivered Unsettled</p>
              <p className="mt-2 text-xl font-semibold text-rose-900">{operationsSummary?.external_delivered_unsettled_count ?? externallyDeliveredPendingReconciliationCount}</p>
            </div>
            <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.22em] text-sky-700">Missing Tracking</p>
              <p className="mt-2 text-xl font-semibold text-sky-900">{operationsSummary?.shipments_missing_tracking_count ?? 0}</p>
            </div>
            <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.22em] text-orange-700">Needs Status Sync</p>
              <p className="mt-2 text-xl font-semibold text-orange-900">{operationsSummary?.shipments_waiting_status_sync_count ?? 0}</p>
            </div>
          </div>
        </div>
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
              <div className="mb-4 grid gap-3 xl:grid-cols-[1.2fr_0.8fr_0.8fr]">
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={pendingSearch}
                    onChange={(event) => setPendingSearch(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                    placeholder="Search order, customer, or phone"
                  />
                </label>
                <select
                  value={pendingStatusFilter}
                  onChange={(event) => setPendingStatusFilter(event.target.value)}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                >
                  <option value="all">All statuses</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="processing">Processing</option>
                  <option value="ready_to_ship">Ready to ship</option>
                </select>
                <select
                  value={pendingWarehouseFilter}
                  onChange={(event) => setPendingWarehouseFilter(event.target.value)}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                >
                  <option value="all">All warehouses</option>
                  {pendingWarehouseOptions.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name}
                    </option>
                  ))}
                </select>
              </div>

              {filteredPendingDispatchOrders.length === 0 ? (
                <EmptyState
                  title="No pending dispatch orders"
                  description="Orders with confirmed, processing, or ready-to-ship status and no active shipment will appear here."
                />
              ) : (
                <DataTable columns={["Order", "Customer", "Address", "Status", "Total", "Warehouse", "Actions"]}>
                  {filteredPendingDispatchOrders.map((order) => (
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
                      <Link
                        href={`/dashboard/orders/${order.id}`}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                      >
                        <Rows3 className="h-3.5 w-3.5" />
                        Order Detail
                      </Link>
                    </div>
                  ))}
                </DataTable>
              )}
            </div>
          </section>

          <FormCard
            title={selectedOrderForForm ? `Create shipment for ${selectedOrderForForm.order_number}` : "Create shipment from dispatch queue"}
            description={
              selectedOrderForForm
                ? "Prefill shipment details from the order and move it into active logistics tracking."
                : "Select a pending-dispatch order from the table to open the shipment creation form."
            }
            action={
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <PackageCheck className="h-5 w-5" />
              </div>
            }
          >
            {!selectedOrderForForm ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                No order selected yet.
              </div>
            ) : (
              <form onSubmit={handleCreateShipment} className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                  <p className="font-semibold text-slate-950">{selectedOrderForForm.order_number}</p>
                  <p className="mt-1">{selectedOrderForForm.customer?.name || "Guest customer"}</p>
                  <p className="mt-1">{selectedOrderForForm.shipping_address || "No delivery address"}</p>
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
              <DataTable columns={["Shipment", "Order", "Recipient", "Courier", "Status", "External", "COD", "Collected", "Reconciliation", "Actions"]}>
                {shipments.map((shipment) => (
                  <div
                    key={shipment.id}
                    className="grid grid-cols-1 gap-3 px-5 py-4 text-sm text-slate-600 2xl:grid-cols-10 2xl:gap-4"
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
                    <span>
                      {shipment.order?.order_number ? (
                        <Link href={`/dashboard/orders/${shipment.order_id}`} className="font-medium text-slate-950 transition hover:text-slate-700 hover:underline">
                          {shipment.order.order_number}
                        </Link>
                      ) : (
                        "Unknown order"
                      )}
                    </span>
                    <div>
                      <p className="font-medium text-slate-950">{shipment.recipient_name || shipment.order?.customer?.name || "No recipient"}</p>
                      <p className="mt-1 text-xs text-slate-500">{shipment.recipient_phone || shipment.order?.customer_phone || "No phone"}</p>
                    </div>
                    <span>{shipment.courier?.name || "No courier"}</span>
                    <span>
                      <StatusBadge status={shipment.status} />
                    </span>
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
                      <Link
                        href="/dashboard/courier-integrations"
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                      >
                        <Truck className="h-3.5 w-3.5" />
                        Courier APIs
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
              description="Compare COD, courier charges, collections, and settlement state for internal reconciliation tracking."
            />

            <div className="mt-6">
              <div className="mb-4 grid gap-3 xl:grid-cols-2">
                <select
                  value={reconciliationStatusFilter}
                  onChange={(event) => setReconciliationStatusFilter(event.target.value)}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                >
                  <option value="all">All reconciliation statuses</option>
                  {reconciliationStatuses.map((status) => (
                    <option key={status} value={status}>
                      {formatLabel(status)}
                    </option>
                  ))}
                </select>
                <select
                  value={reconciliationCourierFilter}
                  onChange={(event) => setReconciliationCourierFilter(event.target.value)}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                >
                  <option value="all">All couriers</option>
                  {couriers.map((courier) => (
                    <option key={courier.id} value={courier.id}>
                      {courier.name}
                    </option>
                  ))}
                </select>
              </div>

              {filteredReconciliationShipments.length === 0 ? (
                <EmptyState
                  title="No shipments available for reconciliation"
                  description="Create shipments first to begin reconciliation work."
                />
              ) : (
                <DataTable columns={["Shipment", "Courier", "COD", "Courier Charge", "Collected", "Status", "Reconciled", "Actions"]}>
                  {filteredReconciliationShipments.map((shipment) => (
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
