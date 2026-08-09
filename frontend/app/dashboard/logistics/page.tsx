"use client";

import Link from "next/link";
import {
  FormEvent,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  CheckCircle2,
  Clock,
  Download,
  Edit,
  Eye,
  FileText,
  Filter,
  Loader2,
  MoreVertical,
  Navigation,
  Package,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  Truck,
  X,
  XCircle,
  Zap,
} from "lucide-react";

import { api, ApiError } from "@/lib/api";
import { formatCurrency, formatDate, formatDateTime, formatLabel } from "@/lib/format";
import { useDialogAccessibility } from "@/components/ui/use-dialog-accessibility";
import { ErrorAlert } from "@/components/ui/error-alert";

type CommandSummary = {
  pending_dispatch_count: number;
  ready_to_ship_count: number;
  active_shipments: number;
  shipped_shipments: number;
  delivered_shipments: number;
  failed_shipments: number;
  returned_shipments: number;
  pending_reconciliation: number;
  settled_reconciliation: number;
  total_cod_amount: number | string;
  total_collected_amount: number | string;
  total_courier_charge: number | string;
  external_sent_count: number;
  external_pending_sync_count: number;
  external_failed_count: number;
  courier_count: number;
  active_courier_count: number;
  returns_pending: number;
  returns_restocked: number;
  purchase_orders_pending: number;
  suppliers_count: number;
};

type PendingDispatchOrder = {
  id: string;
  order_number: string;
  orderNumber?: string;
  customer_name?: string | null;
  customerName?: string | null;
  customer_phone: string | null;
  customerPhone?: string | null;
  shipping_address: string | null;
  shippingAddress?: string | null;
  customerAddress?: string | null;
  warehouseName?: string | null;
  itemCount?: number;
  total: number | string;
  totalAmount?: number | string;
  payment_status: string;
  paymentStatus?: string;
  status: string;
  orderStatus?: string;
  source: string;
  created_at: string;
  createdAt?: string;
  courierReady?: boolean;
  hasShipment?: boolean;
  canCreateShipment?: boolean;
  canPrint?: boolean;
  canOpenOrder?: boolean;
};

type CourierRow = {
  id: string;
  name: string;
  courierName?: string;
  code: string;
  contact_phone: string | null;
  contactPhone?: string | null;
  website: string | null;
  is_active: boolean;
  status?: string;
  active_shipment_count?: number;
  activeShipmentCount?: number;
  delivered_count?: number;
  deliveredCount?: number;
  pending_reconciliation_count?: number;
  pendingReconciliationCount?: number;
  created_at: string;
  updated_at: string;
  createdAt?: string;
  updatedAt?: string;
};

type ShipmentEvent = {
  id: string;
  event_type: string;
  activityType?: string;
  message: string;
  created_at: string;
  createdAt?: string;
  createdBy?: string | null;
};

type ShipmentRow = {
  id: string;
  shipment_number: string;
  shipmentNumber?: string;
  order_id: string;
  orderNumber?: string | null;
  courier_id: string | null;
  customerName?: string | null;
  recipient_name: string | null;
  recipientName?: string | null;
  recipient_phone: string | null;
  recipientPhone?: string | null;
  delivery_address: string | null;
  deliveryAddress?: string | null;
  tracking_number: string | null;
  trackingNumber?: string | null;
  status: string;
  statusLabel?: string;
  delivery_charge: number | string;
  deliveryCharge?: number | string;
  reconciliation_status: string;
  reconciliationStatus?: string;
  cod_amount: number | string;
  codAmount?: number | string;
  collected_amount: number | string;
  collectedAmount?: number | string;
  courier_charge: number | string;
  courierCharge?: number | string;
  pendingAmount?: number | string;
  external_provider: string | null;
  externalProvider?: string | null;
  external_status: string | null;
  externalStatus?: string | null;
  external_synced_at: string | null;
  externalSyncedAt?: string | null;
  sent_to_courier_at: string | null;
  sentToCourier?: boolean;
  created_at: string;
  createdAt?: string;
  updated_at: string;
  updatedAt?: string;
  shipped_at: string | null;
  shippedAt?: string | null;
  delivered_at: string | null;
  deliveredAt?: string | null;
  reconciled_at: string | null;
  reconciledAt?: string | null;
  notes: string | null;
  courierName?: string | null;
  action_flags?: {
    can_send_to_courier?: boolean;
    can_sync_status?: boolean;
    can_mark_shipped?: boolean;
    can_mark_delivered?: boolean;
    can_reconcile?: boolean;
  };
  canSendToCourier?: boolean;
  canSyncStatus?: boolean;
  canMarkShipped?: boolean;
  canMarkDelivered?: boolean;
  canReconcile?: boolean;
  logs?: Array<{
    id: string;
    activityType: string;
    message: string;
    createdBy: string | null;
    createdAt: string;
  }>;
  events?: ShipmentEvent[];
};

type CourierLog = {
  id: string;
  provider: string;
  action: string;
  status: string;
  shipment_id: string | null;
  shipment_number?: string | null;
  order_number?: string | null;
  external_id: string | null;
  message: string | null;
  request_snapshot: unknown;
  response_snapshot: unknown;
  response_summary?: string | null;
  requestAt?: string | null;
  created_at: string;
  createdAt?: string;
};

type ShipmentFormState = {
  orderId: string;
  courierId: string;
  recipientName: string;
  recipientPhone: string;
  deliveryAddress: string;
  trackingNumber: string;
  shipmentNumber: string;
  deliveryCharge: string;
  courierCharge: string;
  codAmount: string;
  collectedAmount: string;
  reconciliationStatus: string;
  notes: string;
  orderStatus: string;
};

type CourierFormState = {
  name: string;
  code: string;
  contactPhone: string;
  website: string;
  isActive: boolean;
};

type ReconciliationFormState = {
  shipmentId: string;
  courierCharge: string;
  collectedAmount: string;
  reconciliationStatus: string;
};

type StatusFormState = {
  shipmentId: string;
  status: string;
};

type ExternalActionState = {
  shipmentId: string;
  provider: string;
  applySafeStatus: boolean;
};

type LogFilters = {
  provider: string;
  action: string;
  status: string;
  search: string;
};

const tabs = [
  { id: "shipments", label: "Shipments", icon: Package },
  { id: "pending", label: "Pending Ready-to-Ship", icon: Clock },
  { id: "couriers", label: "Courier Partners", icon: Truck },
  { id: "reconciliation", label: "Charge Reconciliation", icon: RefreshCw },
  { id: "logs", label: "API Logs", icon: FileText },
] as const;

type TabId = (typeof tabs)[number]["id"];

const providerOptions = ["manual", "steadfast", "pathao", "redx", "paperfly"];
const shipmentStatusOptions = ["pending", "ready_to_ship", "shipped", "in_transit", "delivered", "failed", "returned", "cancelled"];
const reconciliationStatusOptions = ["pending", "matched", "mismatch", "settled", "cancelled"];

const initialShipmentForm: ShipmentFormState = {
  orderId: "",
  courierId: "",
  recipientName: "",
  recipientPhone: "",
  deliveryAddress: "",
  trackingNumber: "",
  shipmentNumber: "",
  deliveryCharge: "0",
  courierCharge: "0",
  codAmount: "0",
  collectedAmount: "0",
  reconciliationStatus: "pending",
  notes: "",
  orderStatus: "ready_to_ship",
};

const initialCourierForm: CourierFormState = {
  name: "",
  code: "",
  contactPhone: "",
  website: "",
  isActive: true,
};

const initialReconciliationForm: ReconciliationFormState = {
  shipmentId: "",
  courierCharge: "0",
  collectedAmount: "0",
  reconciliationStatus: "pending",
};

const initialStatusForm: StatusFormState = {
  shipmentId: "",
  status: "pending",
};

const initialExternalActionState: ExternalActionState = {
  shipmentId: "",
  provider: "",
  applySafeStatus: false,
};

function toNumber(value: string | number | null | undefined) {
  const numericValue = Number(value ?? 0);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function downloadCsv(filename: string, columns: string[], rows: Array<Array<string | number | null | undefined>>) {
  const csvLines = [
    columns.join(","),
    ...rows.map((row) =>
      row
        .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
        .join(","),
    ),
  ];

  const blob = new Blob([csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function getInitials(name: string) {
  const cleaned = name.trim();
  if (!cleaned) return "CR";
  const parts = cleaned.split(" ").filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase();
}

function guessProvider(shipment: ShipmentRow) {
  const explicit = shipment.externalProvider || shipment.external_provider;
  if (explicit) {
    return explicit.toLowerCase();
  }
  const courierName = (shipment.courierName || "").toLowerCase();
  return providerOptions.find((provider) => courierName.includes(provider)) || "manual";
}

function courierStatusClass(status: string | undefined) {
  if ((status || "").toLowerCase() === "active") {
    return "bg-green-50 text-green-700 border-green-200";
  }
  return "bg-slate-100 text-slate-600 border-slate-200";
}

function shipmentBadgeClass(status: string | undefined) {
  const normalized = (status || "").toLowerCase();
  if (normalized === "delivered") return "bg-green-50 text-green-700";
  if (normalized === "cancelled" || normalized === "failed" || normalized === "returned") return "bg-red-50 text-red-700";
  if (normalized.includes("transit") || normalized === "shipped") return "bg-blue-50 text-blue-700";
  return "bg-slate-100 text-slate-700";
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
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm" onClick={requestClose}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Logistics form" tabIndex={-1} className="mt-6 w-full max-w-4xl rounded-[28px] bg-white shadow-2xl outline-none" onClick={(event) => event.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function ModalShell({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex max-h-[88vh] flex-col">
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-950">{title}</h3>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        <button type="button" onClick={onClose} aria-label={`Close ${title}`} className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-950">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return <input {...rest} className={`w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white ${className}`} />;
}

function SelectInput(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = "", children, ...rest } = props;
  return <select {...rest} className={`w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white ${className}`}>{children}</select>;
}

function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = "", ...rest } = props;
  return <textarea {...rest} className={`w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white ${className}`} />;
}

export default function LogisticsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("shipments");
  const [summary, setSummary] = useState<CommandSummary | null>(null);
  const [pendingOrders, setPendingOrders] = useState<PendingDispatchOrder[]>([]);
  const [shipments, setShipments] = useState<ShipmentRow[]>([]);
  const [couriers, setCouriers] = useState<CourierRow[]>([]);
  const [logs, setLogs] = useState<CourierLog[]>([]);
  const [selectedPendingIds, setSelectedPendingIds] = useState<string[]>([]);
  const [pendingSearch, setPendingSearch] = useState("");
  const [shipmentSearch, setShipmentSearch] = useState("");
  const [shipmentStatusFilter, setShipmentStatusFilter] = useState("all");
  const [logFilters, setLogFilters] = useState<LogFilters>({ provider: "", action: "", status: "", search: "" });
  const [isLoading, setIsLoading] = useState(true);
  const [isLogsLoading, setIsLogsLoading] = useState(false);
  const [logsUnavailable, setLogsUnavailable] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [warning, setWarning] = useState("");
  const [busyShipmentId, setBusyShipmentId] = useState<string | null>(null);
  const [busyCourierId, setBusyCourierId] = useState<string | null>(null);
  const [isSavingShipment, setIsSavingShipment] = useState(false);
  const [isSavingCourier, setIsSavingCourier] = useState(false);
  const [isSavingReconciliation, setIsSavingReconciliation] = useState(false);
  const [isBulkSyncing, setIsBulkSyncing] = useState(false);
  const [shipmentForm, setShipmentForm] = useState<ShipmentFormState>(initialShipmentForm);
  const [courierForm, setCourierForm] = useState<CourierFormState>(initialCourierForm);
  const [reconciliationForm, setReconciliationForm] = useState<ReconciliationFormState>(initialReconciliationForm);
  const [statusForm, setStatusForm] = useState<StatusFormState>(initialStatusForm);
  const [sendAction, setSendAction] = useState<ExternalActionState>(initialExternalActionState);
  const [syncAction, setSyncAction] = useState<ExternalActionState>(initialExternalActionState);
  const [editingShipment, setEditingShipment] = useState<ShipmentRow | null>(null);
  const [editingCourier, setEditingCourier] = useState<CourierRow | null>(null);
  const [selectedShipment, setSelectedShipment] = useState<ShipmentRow | null>(null);
  const [selectedLog, setSelectedLog] = useState<CourierLog | null>(null);
  const [modal, setModal] = useState<
    | null
    | "shipment"
    | "bulk-book"
    | "courier"
    | "shipment-detail"
    | "status"
    | "reconciliation"
    | "send"
    | "sync"
    | "log"
  >(null);

  const pendingOrderMap = useMemo(() => new Map(pendingOrders.map((order) => [order.id, order])), [pendingOrders]);

  const filteredPendingOrders = useMemo(() => {
    const search = pendingSearch.trim().toLowerCase();
    return pendingOrders.filter((order) => {
      if (!search) return true;
      return [
        order.orderNumber || order.order_number,
        order.customerName || order.customer_name,
        order.customerPhone || order.customer_phone,
        order.customerAddress || order.shipping_address,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search);
    });
  }, [pendingOrders, pendingSearch]);

  const filteredShipments = useMemo(() => {
    const search = shipmentSearch.trim().toLowerCase();
    return shipments.filter((shipment) => {
      if (shipmentStatusFilter !== "all" && shipment.status !== shipmentStatusFilter) {
        return false;
      }
      if (!search) return true;
      return [
        shipment.shipmentNumber || shipment.shipment_number,
        shipment.orderNumber,
        shipment.customerName,
        shipment.recipientName || shipment.recipient_name,
        shipment.trackingNumber || shipment.tracking_number,
        shipment.courierName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search);
    });
  }, [shipmentSearch, shipmentStatusFilter, shipments]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (logFilters.provider && log.provider !== logFilters.provider) return false;
      if (logFilters.action && log.action !== logFilters.action) return false;
      if (logFilters.status && log.status !== logFilters.status) return false;
      if (logFilters.search.trim()) {
        const search = logFilters.search.trim().toLowerCase();
        const haystack = [
          log.provider,
          log.action,
          log.message,
          log.shipment_number,
          log.order_number,
          log.external_id,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(search);
      }
      return true;
    });
  }, [logFilters, logs]);

  const reconciliationRows = useMemo(
    () => shipments.filter((shipment) => shipment.reconciliationStatus || shipment.reconciliation_status),
    [shipments],
  );

  const reconciliationTotals = useMemo(
    () =>
      reconciliationRows.reduce(
        (totals, shipment) => {
          const codAmount = toNumber(shipment.codAmount || shipment.cod_amount);
          const collectedAmount = toNumber(shipment.collectedAmount || shipment.collected_amount);
          const courierCharge = toNumber(shipment.courierCharge || shipment.courier_charge);
          const pendingAmount = toNumber(shipment.pendingAmount);
          totals.cod += codAmount;
          totals.collected += collectedAmount;
          totals.courierCharge += courierCharge;
          totals.pending += pendingAmount;
          return totals;
        },
        { cod: 0, collected: 0, courierCharge: 0, pending: 0 },
      ),
    [reconciliationRows],
  );

  async function loadWorkspace() {
    setError("");
    const [summaryData, pendingData, shipmentData, courierData] = await Promise.all([
      api.get<CommandSummary>("/logistics/command-summary"),
      api.get<PendingDispatchOrder[]>("/logistics/pending-dispatch?skip=0&limit=100"),
      api.get<ShipmentRow[]>("/shipments?skip=0&limit=100"),
      api.get<CourierRow[]>("/couriers?skip=0&limit=100"),
    ]);
    setSummary(summaryData);
    setPendingOrders(pendingData);
    setShipments(shipmentData);
    setCouriers(courierData);
  }

  async function loadLogs() {
    setIsLogsLoading(true);
    setLogsUnavailable("");
    try {
      const params = new URLSearchParams({ limit: "80" });
      if (logFilters.provider) params.set("provider", logFilters.provider);
      if (logFilters.action) params.set("action", logFilters.action);
      if (logFilters.status) params.set("status", logFilters.status);
      if (logFilters.search.trim()) params.set("search", logFilters.search.trim());
      const data = await api.get<CourierLog[]>(`/courier-integrations/logs?${params.toString()}`);
      setLogs(data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setLogs([]);
        setLogsUnavailable("Courier API logs are admin-only in the current backend safety model.");
      } else {
        setLogsUnavailable(err instanceof ApiError ? err.message : "Failed to load courier API logs.");
      }
    } finally {
      setIsLogsLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    async function run() {
      try {
        setError("");
        const [summaryData, pendingData, shipmentData, courierData] = await Promise.all([
          api.get<CommandSummary>("/logistics/command-summary"),
          api.get<PendingDispatchOrder[]>("/logistics/pending-dispatch?skip=0&limit=100"),
          api.get<ShipmentRow[]>("/shipments?skip=0&limit=100"),
          api.get<CourierRow[]>("/couriers?skip=0&limit=100"),
        ]);
        if (!mounted) return;
        setSummary(summaryData);
        setPendingOrders(pendingData);
        setShipments(shipmentData);
        setCouriers(courierData);

        setIsLogsLoading(true);
        try {
          const data = await api.get<CourierLog[]>("/courier-integrations/logs?limit=80");
          if (!mounted) return;
          setLogs(data);
          setLogsUnavailable("");
        } catch (err) {
          if (!mounted) return;
          if (err instanceof ApiError && err.status === 403) {
            setLogs([]);
            setLogsUnavailable("Courier API logs are admin-only in the current backend safety model.");
          } else {
            setLogsUnavailable(err instanceof ApiError ? err.message : "Failed to load courier API logs.");
          }
        } finally {
          if (mounted) {
            setIsLogsLoading(false);
          }
        }
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof ApiError ? err.message : "Failed to load logistics workspace.");
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    void run();
    return () => {
      mounted = false;
    };
  }, []);

  async function refreshWorkspace() {
    await loadWorkspace();
    if (activeTab === "logs") {
      await loadLogs();
    }
  }

  function resetMessages() {
    setError("");
    setSuccess("");
    setWarning("");
  }

  function openShipmentModal(order?: PendingDispatchOrder, shipment?: ShipmentRow) {
    resetMessages();
    setEditingShipment(shipment || null);
    if (shipment) {
      setShipmentForm({
        orderId: shipment.order_id,
        courierId: shipment.courier_id || "",
        recipientName: shipment.recipientName || shipment.recipient_name || "",
        recipientPhone: shipment.recipientPhone || shipment.recipient_phone || "",
        deliveryAddress: shipment.deliveryAddress || shipment.delivery_address || "",
        trackingNumber: shipment.trackingNumber || shipment.tracking_number || "",
        shipmentNumber: shipment.shipmentNumber || shipment.shipment_number || "",
        deliveryCharge: String(shipment.delivery_charge),
        courierCharge: String(shipment.courierCharge || shipment.courier_charge || 0),
        codAmount: String(shipment.codAmount || shipment.cod_amount || 0),
        collectedAmount: String(shipment.collectedAmount || shipment.collected_amount || 0),
        reconciliationStatus: shipment.reconciliationStatus || shipment.reconciliation_status || "pending",
        notes: shipment.notes || "",
        orderStatus: "ready_to_ship",
      });
    } else {
      const selectedOrder = order || null;
      setShipmentForm({
        ...initialShipmentForm,
        orderId: selectedOrder?.id || "",
        recipientName: selectedOrder?.customerName || selectedOrder?.customer_name || "",
        recipientPhone: selectedOrder?.customerPhone || selectedOrder?.customer_phone || "",
        deliveryAddress: selectedOrder?.shippingAddress || selectedOrder?.shipping_address || "",
        codAmount: String(selectedOrder?.totalAmount || selectedOrder?.total || 0),
      });
    }
    setModal("shipment");
  }

  function openBulkBookModal() {
    resetMessages();
    setShipmentForm({
      ...initialShipmentForm,
      orderStatus: "ready_to_ship",
    });
    setModal("bulk-book");
  }

  function openCourierModal(courier?: CourierRow) {
    resetMessages();
    setEditingCourier(courier || null);
    setCourierForm(
      courier
        ? {
            name: courier.courierName || courier.name,
            code: courier.code,
            contactPhone: courier.contactPhone || courier.contact_phone || "",
            website: courier.website || "",
            isActive: courier.is_active,
          }
        : initialCourierForm,
    );
    setModal("courier");
  }

  function openShipmentDetail(shipment: ShipmentRow) {
    resetMessages();
    setSelectedShipment(shipment);
    setModal("shipment-detail");
  }

  function openStatusModal(shipment: ShipmentRow, status?: string) {
    resetMessages();
    setSelectedShipment(shipment);
    setStatusForm({
      shipmentId: shipment.id,
      status: status || shipment.status,
    });
    setModal("status");
  }

  function openReconciliationModal(shipment: ShipmentRow) {
    resetMessages();
    setSelectedShipment(shipment);
    setReconciliationForm({
      shipmentId: shipment.id,
      courierCharge: String(shipment.courierCharge || shipment.courier_charge || 0),
      collectedAmount: String(shipment.collectedAmount || shipment.collected_amount || 0),
      reconciliationStatus: shipment.reconciliationStatus || shipment.reconciliation_status || "pending",
    });
    setModal("reconciliation");
  }

  function openSendModal(shipment: ShipmentRow) {
    resetMessages();
    setSelectedShipment(shipment);
    setSendAction({
      shipmentId: shipment.id,
      provider: guessProvider(shipment),
      applySafeStatus: false,
    });
    setModal("send");
  }

  function openSyncModal(shipment: ShipmentRow) {
    resetMessages();
    setSelectedShipment(shipment);
    setSyncAction({
      shipmentId: shipment.id,
      provider: guessProvider(shipment),
      applySafeStatus: false,
    });
    setModal("sync");
  }

  function closeModal() {
    setModal(null);
    setEditingShipment(null);
    setEditingCourier(null);
    setSelectedShipment(null);
    setSelectedLog(null);
  }

  async function handleSaveShipment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resetMessages();
    setIsSavingShipment(true);
    try {
      if (modal === "bulk-book") {
        if (!selectedPendingIds.length) {
          setWarning("Select at least one pending order for bulk booking.");
          return;
        }
        for (const orderId of selectedPendingIds) {
          await api.post(`/orders/${orderId}/create-shipment`, {
            courierId: shipmentForm.courierId,
            deliveryCharge: toNumber(shipmentForm.deliveryCharge),
            courierCharge: toNumber(shipmentForm.courierCharge),
            codAmount: toNumber(shipmentForm.codAmount),
            collectedAmount: toNumber(shipmentForm.collectedAmount),
            notes: shipmentForm.notes || null,
            orderStatus: shipmentForm.orderStatus || null,
          });
        }
        setSuccess(`Bulk booked ${selectedPendingIds.length} order${selectedPendingIds.length === 1 ? "" : "s"} successfully.`);
        setSelectedPendingIds([]);
      } else if (editingShipment) {
        await api.patch(`/shipments/${editingShipment.id}`, {
          courierId: shipmentForm.courierId || null,
          recipientName: shipmentForm.recipientName || null,
          recipientPhone: shipmentForm.recipientPhone || null,
          deliveryAddress: shipmentForm.deliveryAddress || null,
          trackingNumber: shipmentForm.trackingNumber || null,
          deliveryCharge: toNumber(shipmentForm.deliveryCharge),
          courierCharge: toNumber(shipmentForm.courierCharge),
          codAmount: toNumber(shipmentForm.codAmount),
          collectedAmount: toNumber(shipmentForm.collectedAmount),
          reconciliationStatus: shipmentForm.reconciliationStatus,
          notes: shipmentForm.notes || null,
        });
        setSuccess("Shipment updated successfully.");
      } else if (pendingOrderMap.has(shipmentForm.orderId)) {
        await api.post(`/orders/${shipmentForm.orderId}/create-shipment`, {
          courierId: shipmentForm.courierId || null,
          trackingNumber: shipmentForm.trackingNumber || null,
          shipmentNumber: shipmentForm.shipmentNumber || null,
          deliveryCharge: toNumber(shipmentForm.deliveryCharge),
          courierCharge: toNumber(shipmentForm.courierCharge),
          codAmount: toNumber(shipmentForm.codAmount),
          collectedAmount: toNumber(shipmentForm.collectedAmount),
          notes: shipmentForm.notes || null,
          orderStatus: shipmentForm.orderStatus || null,
        });
        setSuccess("Shipment created from pending dispatch successfully.");
      } else {
        await api.post("/shipments", {
          shipmentNumber: shipmentForm.shipmentNumber || `SHP-${Date.now()}`,
          orderId: shipmentForm.orderId,
          courierId: shipmentForm.courierId || null,
          recipientName: shipmentForm.recipientName || null,
          recipientPhone: shipmentForm.recipientPhone || null,
          deliveryAddress: shipmentForm.deliveryAddress || null,
          trackingNumber: shipmentForm.trackingNumber || null,
          deliveryCharge: toNumber(shipmentForm.deliveryCharge),
          courierCharge: toNumber(shipmentForm.courierCharge),
          codAmount: toNumber(shipmentForm.codAmount),
          collectedAmount: toNumber(shipmentForm.collectedAmount),
          reconciliationStatus: shipmentForm.reconciliationStatus,
          notes: shipmentForm.notes || null,
        });
        setSuccess("Shipment created successfully.");
      }
      await refreshWorkspace();
      closeModal();
      setActiveTab("shipments");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save shipment.");
    } finally {
      setIsSavingShipment(false);
    }
  }

  async function handleSaveCourier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resetMessages();
    setIsSavingCourier(true);
    try {
      if (editingCourier) {
        await api.patch(`/couriers/${editingCourier.id}`, {
          courierName: courierForm.name,
          code: courierForm.code,
          contactPhone: courierForm.contactPhone || null,
          website: courierForm.website || null,
          isActive: courierForm.isActive,
        });
        setSuccess("Courier updated successfully.");
      } else {
        await api.post("/couriers", {
          courierName: courierForm.name,
          code: courierForm.code,
          contactPhone: courierForm.contactPhone || null,
          website: courierForm.website || null,
          isActive: courierForm.isActive,
        });
        setSuccess("Courier added successfully.");
      }
      await refreshWorkspace();
      closeModal();
      setActiveTab("couriers");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save courier.");
    } finally {
      setIsSavingCourier(false);
    }
  }

  async function handleDeactivateCourier(courier: CourierRow) {
    resetMessages();
    setBusyCourierId(courier.id);
    try {
      await api.delete(`/couriers/${courier.id}`);
      await refreshWorkspace();
      setSuccess(`${courier.courierName || courier.name} was marked inactive.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to deactivate courier.");
    } finally {
      setBusyCourierId(null);
    }
  }

  async function handleSaveReconciliation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resetMessages();
    setIsSavingReconciliation(true);
    try {
      await api.patch(`/shipments/${reconciliationForm.shipmentId}`, {
        courierCharge: toNumber(reconciliationForm.courierCharge),
        collectedAmount: toNumber(reconciliationForm.collectedAmount),
        reconciliationStatus: reconciliationForm.reconciliationStatus,
      });
      await refreshWorkspace();
      closeModal();
      setSuccess("Reconciliation updated successfully.");
      setActiveTab("reconciliation");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update reconciliation.");
    } finally {
      setIsSavingReconciliation(false);
    }
  }

  async function handleSaveStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resetMessages();
    setBusyShipmentId(statusForm.shipmentId);
    try {
      await api.patch(`/shipments/${statusForm.shipmentId}`, {
        status: statusForm.status,
      });
      await refreshWorkspace();
      closeModal();
      setSuccess(`Shipment marked ${formatLabel(statusForm.status)}.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update shipment status.");
    } finally {
      setBusyShipmentId(null);
    }
  }

  async function handleSendToCourier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resetMessages();
    setBusyShipmentId(sendAction.shipmentId);
    try {
      const result = await api.post<{
        message: string;
        external_status?: string | null;
        external_tracking_number?: string | null;
      }>(`/courier-integrations/shipments/${sendAction.shipmentId}/send`, {
        provider: sendAction.provider,
      });
      await refreshWorkspace();
      closeModal();
      setSuccess(result.message || "Shipment sent to courier provider.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to send shipment to courier.");
    } finally {
      setBusyShipmentId(null);
    }
  }

  async function handleSyncStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resetMessages();
    setBusyShipmentId(syncAction.shipmentId);
    try {
      const result = await api.post<{
        message: string;
        warnings?: string[];
      }>(`/courier-integrations/shipments/${syncAction.shipmentId}/sync-status`, {
        provider: syncAction.provider || null,
        apply_safe_status: syncAction.applySafeStatus,
      });
      await refreshWorkspace();
      closeModal();
      if (result.warnings?.length) {
        setWarning(result.warnings.join(" "));
      }
      setSuccess(result.message || "Courier status synced successfully.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to sync courier status.");
    } finally {
      setBusyShipmentId(null);
    }
  }

  async function handleBulkSync() {
    resetMessages();
    setIsBulkSyncing(true);
    try {
      const result = await api.post<{
        synced_count: number;
        skipped_count: number;
        failed_count: number;
        rows?: Array<{ warnings?: string[] }>;
      }>("/courier-integrations/status-sync/bulk", {
        provider: null,
        status: shipmentStatusFilter === "all" ? null : shipmentStatusFilter,
        limit: Math.min(filteredShipments.length || 20, 100),
        apply_safe_status: false,
      });
      await refreshWorkspace();
      const warningCount = result.rows?.filter((row) => row.warnings?.length).length || 0;
      if (warningCount) {
        setWarning(`${warningCount} synced shipment${warningCount === 1 ? "" : "s"} returned warning-first results and were not auto-applied destructively.`);
      }
      setSuccess(`Bulk sync finished. Synced ${result.synced_count}, skipped ${result.skipped_count}, failed ${result.failed_count}.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to bulk sync courier statuses.");
    } finally {
      setIsBulkSyncing(false);
    }
  }

  function exportShipments() {
    downloadCsv(
      `deliveries_export_${new Date().toISOString().slice(0, 10)}.csv`,
      ["Shipment Number", "Order Number", "Courier", "Tracking", "Status", "Reconciliation", "COD", "Collected", "Courier Charge", "Created At"],
      filteredShipments.map((shipment) => [
        shipment.shipmentNumber || shipment.shipment_number,
        shipment.orderNumber || "",
        shipment.courierName || "",
        shipment.trackingNumber || shipment.tracking_number || "",
        shipment.statusLabel || formatLabel(shipment.status),
        shipment.reconciliationStatus || shipment.reconciliation_status,
        shipment.codAmount || shipment.cod_amount,
        shipment.collectedAmount || shipment.collected_amount,
        shipment.courierCharge || shipment.courier_charge,
        shipment.createdAt || shipment.created_at,
      ]),
    );
  }

  const selectedPendingOrders = filteredPendingOrders.filter((order) => selectedPendingIds.includes(order.id));

  return (
    <div className="space-y-6">
      <div className="space-y-6">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
            <div className="shrink-0">
              <h2 className="text-3xl font-bold tracking-tight text-primary">Logistics &amp; Delivery</h2>
              <p className="mt-1 pb-2 text-sm text-secondary">Track shipments, manage couriers, and optimize delivery operations.</p>
            </div>

            <div className="flex w-full items-center gap-3 overflow-x-auto pb-2 xl:w-auto xl:pb-0">
              <button
                type="button"
                onClick={exportShipments}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-[13px] font-semibold transition-colors hover:bg-surface-hover"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </button>
              <button
                type="button"
                onClick={() => openShipmentModal()}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-brand px-5 py-2 text-[13px] font-semibold text-white shadow-subtle transition-colors hover:bg-brand-hover"
              >
                <Plus className="h-4 w-4" />
                Add Shipment
              </button>
              <button
                type="button"
                onClick={() => openCourierModal()}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-[13px] font-semibold transition-colors hover:bg-surface-hover"
              >
                <Plus className="h-4 w-4" />
                Connect Courier
              </button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-border bg-surface p-5 shadow-subtle">
              <div className="mb-4 flex gap-4">
                <div className="flex h-[45px] w-[45px] items-center justify-center rounded-2xl bg-brand/10 text-brand">
                  <Navigation className="h-5 w-5" />
                </div>
                <div>
                  <p className="mb-0.5 text-[11px] font-semibold text-secondary">Total Shipments</p>
                  <h3 className="text-2xl font-bold leading-tight text-primary">{summary?.active_shipments ?? 0}</h3>
                </div>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-medium text-muted">
                <span className="rounded-[4px] bg-green-50 px-2 py-0.5 font-bold text-green-600">Live Data</span>
                active logistics workload
              </div>
            </div>
            <div className="rounded-xl border border-border bg-surface p-5 shadow-subtle">
              <div className="mb-4 flex gap-4">
                <div className="flex h-[45px] w-[45px] items-center justify-center rounded-2xl bg-orange-50 text-orange-500">
                  <Truck className="h-5 w-5" />
                </div>
                <div>
                  <p className="mb-0.5 text-[11px] font-semibold text-secondary">In Transit</p>
                  <h3 className="text-2xl font-bold leading-tight text-primary">{summary?.shipped_shipments ?? 0}</h3>
                </div>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-medium text-muted">
                <span className="rounded-[4px] bg-orange-50 px-2 py-0.5 font-bold text-orange-600">Active</span>
                currently moving
              </div>
            </div>
            <div className="rounded-xl border border-border bg-surface p-5 shadow-subtle">
              <div className="mb-4 flex gap-4">
                <div className="flex h-[45px] w-[45px] items-center justify-center rounded-2xl bg-purple-50 text-purple-600">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="mb-0.5 text-[11px] font-semibold text-secondary">Delivered</p>
                  <h3 className="text-2xl font-bold leading-tight text-primary">{summary?.delivered_shipments ?? 0}</h3>
                </div>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-medium text-muted">
                <span className="rounded-[4px] bg-green-50 px-2 py-0.5 font-bold text-green-600">Completed</span>
                successfully delivered
              </div>
            </div>
            <div className="rounded-xl border border-border bg-surface p-5 shadow-subtle">
              <div className="mb-4 flex gap-4">
                <div className="flex h-[45px] w-[45px] items-center justify-center rounded-2xl bg-red-50 text-red-500">
                  <XCircle className="h-5 w-5" />
                </div>
                <div>
                  <p className="mb-0.5 text-[11px] font-semibold text-secondary">Failed / Returned</p>
                  <h3 className="text-2xl font-bold leading-tight text-primary">{(summary?.failed_shipments ?? 0) + (summary?.returned_shipments ?? 0)}</h3>
                </div>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-medium text-muted">
                <span className="rounded-[4px] bg-red-50 px-2 py-0.5 font-bold text-red-600">Issues</span>
                needs attention
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[
              ["Pending Dispatch", summary?.pending_dispatch_count],
              ["Ready to Ship", summary?.ready_to_ship_count],
              ["Pending Reconciliation", summary?.pending_reconciliation],
              ["Settled", summary?.settled_reconciliation],
              ["COD Amount", formatCurrency(summary?.total_cod_amount)],
              ["Collected", formatCurrency(summary?.total_collected_amount)],
              ["Courier Charge", formatCurrency(summary?.total_courier_charge)],
              ["External Sent", summary?.external_sent_count],
              ["Pending Sync", summary?.external_pending_sync_count],
              ["External Failed", summary?.external_failed_count],
              ["Couriers", summary?.courier_count],
              ["Active Couriers", summary?.active_courier_count],
              ["Returns Pending", summary?.returns_pending],
              ["Returns Restocked", summary?.returns_restocked],
              ["PO Pending", summary?.purchase_orders_pending],
              ["Suppliers", summary?.suppliers_count],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-2xl border border-border bg-surface px-4 py-3 shadow-subtle">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</p>
                <p className="mt-2 text-lg font-bold text-primary">{value ?? 0}</p>
              </div>
            ))}
          </div>

          <div className="flex w-min items-center gap-x-0.5 overflow-x-auto rounded-[20px] border border-border bg-surface p-1 shadow-subtle">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-[11px] font-bold transition-all ${isActive ? "bg-brand/10 text-brand shadow-subtle" : "text-secondary hover:bg-surface-hover hover:text-primary"}`}
                >
                  <Icon className={`h-3.5 w-3.5 ${isActive ? "text-brand" : "text-muted"}`} />
                  <span>{tab.label}</span>
                  {tab.id === "pending" ? (
                    <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[9px] font-black ${isActive ? "bg-brand text-white" : "bg-slate-800 text-white"}`}>
                      {pendingOrders.length}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {error ? <ErrorAlert message={error} onRetry={() => void loadWorkspace()} /> : null}
      {warning ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">{warning}</div>
      ) : null}
      {success ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>
      ) : null}

      {isLoading ? (
        <div className="rounded-3xl border border-border bg-surface p-8 shadow-subtle">
          <div className="flex items-center gap-3 text-sm text-secondary">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading logistics workspace...
          </div>
        </div>
      ) : null}

      {!isLoading && activeTab === "shipments" ? (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="flex flex-col gap-4 rounded-3xl border border-border bg-surface p-5 shadow-subtle lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
              <div className="relative w-full lg:min-w-[420px]">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  value={shipmentSearch}
                  onChange={(event) => setShipmentSearch(event.target.value)}
                  placeholder="Search by tracking ID, shipment, customer, or courier..."
                  className="w-full rounded-lg border border-border bg-surface py-2.5 pl-10 pr-4 text-[13px] outline-none transition focus:border-brand"
                />
              </div>
              <button type="button" className="rounded-lg border border-border bg-surface p-2.5 text-secondary transition hover:bg-surface-hover">
                <Filter className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleBulkSync}
                disabled={isBulkSyncing || filteredShipments.length === 0}
                className="inline-flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5 text-[13px] font-semibold text-green-700 transition hover:bg-green-100 disabled:opacity-50"
              >
                {isBulkSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Sync All Status
              </button>
              <SelectInput value={shipmentStatusFilter} onChange={(event) => setShipmentStatusFilter(event.target.value)} className="min-w-[170px] py-2.5">
                <option value="all">All Statuses</option>
                {shipmentStatusOptions.map((status) => (
                  <option key={status} value={status}>
                    {formatLabel(status)}
                  </option>
                ))}
              </SelectInput>
              <div className="flex gap-2">
                <Link href="/dashboard/shipments" className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-[13px] font-semibold text-secondary transition hover:bg-surface-hover">
                  <Eye className="h-4 w-4" />
                  Full Route
                </Link>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-subtle">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-left whitespace-nowrap">
                <thead>
                  <tr className="border-b border-border bg-surface-hover text-[10px] font-bold uppercase tracking-wider text-muted">
                    <th className="px-6 py-4">Tracking info</th>
                    <th className="px-6 py-4">Order</th>
                    <th className="px-6 py-4">Courier</th>
                    <th className="px-6 py-4">Recipient</th>
                    <th className="px-6 py-4">ETA / Status</th>
                    <th className="px-6 py-4">Reconciliation</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredShipments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <Truck className="text-muted" size={48} />
                          <span className="text-sm text-secondary">No deliveries found</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredShipments.map((shipment) => (
                      <tr key={shipment.id} className="transition-colors hover:bg-surface-hover">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-[10px] bg-brand/10 text-brand shadow-subtle">
                              <Truck className="h-4 w-4" />
                            </div>
                            <div className="flex flex-col">
                              <span className="font-mono text-xs font-bold text-primary">{shipment.trackingNumber || shipment.tracking_number || shipment.shipmentNumber || shipment.shipment_number}</span>
                              <div className="mt-0.5 flex items-center gap-1 text-[10px] font-medium text-secondary">
                                <Truck className="h-2.5 w-2.5" />
                                Standard Delivery
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-primary">#{shipment.orderNumber || shipment.order_id.slice(0, 8)}</span>
                            <span className="text-[10px] text-secondary">{formatDate(shipment.createdAt || shipment.created_at)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border border-border bg-surface text-[13px] font-bold text-primary shadow-subtle">
                              {(shipment.courierName || "M").charAt(0)}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[13px] font-bold text-primary">{shipment.courierName || "Manual Courier"}</span>
                              <span className="text-[11px] font-medium text-muted">{shipment.externalProvider || shipment.external_provider || "internal"}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-primary">{shipment.customerName || shipment.recipientName || shipment.recipient_name || "Unknown Recipient"}</span>
                            <span className="text-[10px] text-secondary">{shipment.recipientPhone || shipment.recipient_phone || "No phone"}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col items-start gap-1">
                            <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${shipmentBadgeClass(shipment.status)}`}>
                              <Clock className="h-3 w-3" />
                              <span className="text-[10px] font-bold tracking-wide">{shipment.statusLabel || formatLabel(shipment.status)}</span>
                            </div>
                            <span className="text-[10px] font-medium text-muted">{shipment.externalStatus || shipment.external_status || "Manual tracking"}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold text-primary">{formatCurrency(shipment.pendingAmount || 0)}</span>
                            <span className="text-[10px] text-secondary">{formatLabel(shipment.reconciliationStatus || shipment.reconciliation_status)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {(shipment.canSyncStatus ?? shipment.action_flags?.can_sync_status) ? (
                              <button type="button" onClick={() => openSyncModal(shipment)} aria-label="Sync shipment status" className="flex h-[32px] w-[32px] items-center justify-center rounded-lg border border-border bg-surface text-muted shadow-subtle transition hover:border-green-500 hover:bg-green-50 hover:text-green-600" title="Sync Status">
                                <RefreshCw className="h-3.5 w-3.5" />
                              </button>
                            ) : null}
                            {(shipment.canSendToCourier ?? shipment.action_flags?.can_send_to_courier) ? (
                              <button type="button" onClick={() => openSendModal(shipment)} aria-label="Send shipment to courier" className="flex h-[32px] w-[32px] items-center justify-center rounded-lg border border-border bg-surface text-muted shadow-subtle transition hover:border-brand hover:bg-brand/10 hover:text-brand" title="Send To Courier">
                                <Send className="h-3.5 w-3.5" />
                              </button>
                            ) : null}
                            <button type="button" onClick={() => openShipmentDetail(shipment)} aria-label="View shipment" className="flex h-[32px] w-[32px] items-center justify-center rounded-lg border border-border bg-surface text-muted shadow-subtle transition hover:border-brand hover:bg-brand/10 hover:text-brand" title="View Shipment">
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" onClick={() => openShipmentModal(undefined, shipment)} aria-label="Edit shipment" className="flex h-[32px] w-[32px] items-center justify-center rounded-lg border border-border bg-surface text-muted shadow-subtle transition hover:border-brand hover:bg-brand/10 hover:text-brand" title="Edit Shipment">
                              <Edit className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" className="flex h-[32px] w-[32px] items-center justify-center rounded-lg border border-border bg-surface text-muted shadow-subtle transition hover:border-slate-500 hover:bg-slate-100 hover:text-slate-700" title="More Actions" aria-label="More shipment actions" onClick={() => openStatusModal(shipment)}>
                              <MoreVertical className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {!isLoading && activeTab === "pending" ? (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="flex items-center justify-between rounded-2xl border border-[#f3f4f6] bg-surface p-4 shadow-subtle">
            <div className="flex items-center gap-4">
              <div className="rounded-xl bg-brand/10 p-3 text-brand">
                <Truck className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-primary">Pending Shipments</h3>
                <p className="text-xs text-secondary">Orders ready to be sent to courier partners.</p>
              </div>
            </div>
            {selectedPendingIds.length > 0 ? (
              <button type="button" onClick={openBulkBookModal} className="inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:bg-brand-hover">
                <Zap className="h-4 w-4" />
                Bulk Book ({selectedPendingIds.length})
              </button>
            ) : null}
          </div>

          <div className="flex flex-col gap-4 rounded-2xl border border-[#f3f4f6] bg-surface p-4 shadow-subtle md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-[420px]">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                value={pendingSearch}
                onChange={(event) => setPendingSearch(event.target.value)}
                className="w-full rounded-lg border border-border bg-surface py-2.5 pl-10 pr-4 text-[13px] outline-none transition focus:border-brand"
                placeholder="Search order, customer, or phone"
              />
            </div>
            <div className="flex items-center gap-3 text-xs text-secondary">
              <span>{filteredPendingOrders.length} ready rows</span>
              <Link href="/dashboard/orders" className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-[13px] font-semibold text-secondary transition hover:bg-surface-hover">
                <Eye className="h-4 w-4" />
                Orders Route
              </Link>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[#f3f4f6] bg-surface shadow-subtle">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse text-left whitespace-nowrap">
                <thead>
                  <tr className="border-b border-[#f9fafb] bg-[#f9fafb]/50">
                    <th className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedPendingIds.length === filteredPendingOrders.length && filteredPendingOrders.length > 0}
                        onChange={(event) => {
                          if (event.target.checked) {
                            setSelectedPendingIds(filteredPendingOrders.map((order) => order.id));
                          } else {
                            setSelectedPendingIds([]);
                          }
                        }}
                        className="rounded border-[#d1d5db]"
                      />
                    </th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-[#9ca3af]">Order</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-[#9ca3af]">Customer</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-[#9ca3af]">Address</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-[#9ca3af]">Amount</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-[#9ca3af]">Status</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-wider text-[#9ca3af]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f9fafb]">
                  {filteredPendingOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-sm italic text-muted">
                        No pending shipments found.
                      </td>
                    </tr>
                  ) : (
                    filteredPendingOrders.map((order) => (
                      <tr key={order.id} className="group transition-colors hover:bg-[#f9fafb]/50">
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={selectedPendingIds.includes(order.id)}
                            onChange={(event) => {
                              if (event.target.checked) {
                                setSelectedPendingIds((current) => [...current, order.id]);
                              } else {
                                setSelectedPendingIds((current) => current.filter((id) => id !== order.id));
                              }
                            }}
                            className="rounded border-[#d1d5db]"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-primary">#{order.orderNumber || order.order_number}</span>
                            <span className="text-[10px] text-[#9ca3af]">{formatDate(order.createdAt || order.created_at)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-primary">{order.customerName || order.customer_name || "Guest customer"}</span>
                            <span className="text-[10px] text-[#9ca3af]">{order.customerPhone || order.customer_phone || "No phone"}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="max-w-[220px] truncate text-[10px] text-[#6b7280]">{order.customerAddress || order.shippingAddress || order.shipping_address || "No address"}</span>
                        </td>
                        <td className="px-6 py-4 text-xs font-bold text-primary">{formatCurrency(order.totalAmount || order.total)}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${order.status === "confirmed" ? "bg-green-50 text-green-600" : "bg-brand/10 text-brand"}`}>
                            {order.orderStatus || order.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {(order.canCreateShipment ?? order.courierReady) ? (
                              <button type="button" onClick={() => openShipmentModal(order)} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-white">
                                Create Shipment
                              </button>
                            ) : null}
                            <Link href={`/dashboard/orders/${order.id}`} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-white">
                              Open Order
                            </Link>
                            {(order.canPrint ?? true) ? (
                              <Link href={`/dashboard/orders/${order.id}/invoice`} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-white">
                                Print
                              </Link>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {!isLoading && activeTab === "couriers" ? (
        <div className="space-y-8 animate-in fade-in duration-300">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold tracking-tight text-primary">Courier Partners</h3>
              <p className="mt-1 text-sm text-secondary">Connect and manage the delivery partners used in the logistics command center.</p>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/dashboard/courier-integrations" className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-secondary transition hover:bg-surface-hover">
                <Settings className="h-4 w-4" />
                Integrations
              </Link>
              <button type="button" onClick={() => openCourierModal()} className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-subtle transition hover:bg-brand-hover">
                <Plus className="h-4 w-4" />
                Add Courier
              </button>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-3">
            {couriers.map((courier) => {
              const name = courier.courierName || courier.name;
              return (
                <div key={courier.id} className="flex flex-col rounded-[20px] border border-border bg-surface shadow-subtle transition-shadow hover:shadow-premium">
                  <div className="flex items-start justify-between border-b border-border p-5">
                    <div className="flex gap-4">
                      <div className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-2xl border border-border bg-surface shadow-subtle">
                        <div className="flex h-[44px] w-[44px] items-center justify-center rounded-full bg-brand text-lg font-bold tracking-tight text-white">
                          {getInitials(name)}
                        </div>
                      </div>
                      <div className="flex flex-col justify-center">
                        <h4 className="text-[15px] font-bold leading-tight text-primary">{name}</h4>
                        <p className="mt-1 text-[12px] font-medium leading-tight text-secondary">{courier.website || courier.code}</p>
                      </div>
                    </div>
                    <button type="button" onClick={() => openCourierModal(courier)} className="text-muted transition-colors hover:text-secondary">
                      <MoreVertical className="h-4.5 w-4.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-4 border-b border-border/50 px-6 py-5">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[11px] font-medium text-muted">Status</span>
                      <span className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${courierStatusClass(courier.status || (courier.is_active ? "Active" : "Inactive"))}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${(courier.status || (courier.is_active ? "Active" : "Inactive")).toLowerCase() === "active" ? "bg-green-500" : "bg-gray-400"}`} />
                        {courier.status || (courier.is_active ? "Active" : "Inactive")}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1.5 border-l border-border pl-4">
                      <span className="text-[11px] font-medium text-muted">Active Shipments</span>
                      <span className="pt-0.5 text-[13px] font-bold text-primary">{courier.activeShipmentCount || courier.active_shipment_count || 0}</span>
                    </div>
                    <div className="flex flex-col gap-1.5 border-l border-border pl-4">
                      <span className="text-[11px] font-medium text-muted">Delivered</span>
                      <span className="pt-0.5 text-[13px] font-bold text-primary">{courier.deliveredCount || courier.delivered_count || 0}</span>
                    </div>
                  </div>

                  <div className="mt-auto flex items-center gap-3 rounded-b-[20px] bg-surface-hover/30 p-4">
                    <button type="button" onClick={() => openCourierModal(courier)} className="flex-1 rounded-lg border border-brand/20 px-4 py-2 text-[13px] font-semibold text-brand transition-all hover:bg-brand/10">
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeactivateCourier(courier)}
                      disabled={busyCourierId === courier.id}
                      className="flex-1 rounded-lg border border-border px-4 py-2 text-[13px] font-semibold text-secondary transition-all hover:bg-surface-hover disabled:opacity-50"
                    >
                      {busyCourierId === courier.id ? "Updating..." : courier.is_active ? "Deactivate" : "Inactive"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {!isLoading && activeTab === "reconciliation" ? (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-border bg-surface p-4 shadow-subtle">
              <p className="text-[11px] font-semibold text-secondary">COD</p>
              <p className="mt-2 text-2xl font-bold text-primary">{formatCurrency(reconciliationTotals.cod)}</p>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-4 shadow-subtle">
              <p className="text-[11px] font-semibold text-secondary">Collected</p>
              <p className="mt-2 text-2xl font-bold text-primary">{formatCurrency(reconciliationTotals.collected)}</p>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-4 shadow-subtle">
              <p className="text-[11px] font-semibold text-secondary">Courier Charge</p>
              <p className="mt-2 text-2xl font-bold text-primary">{formatCurrency(reconciliationTotals.courierCharge)}</p>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-4 shadow-subtle">
              <p className="text-[11px] font-semibold text-secondary">Pending Amount</p>
              <p className="mt-2 text-2xl font-bold text-primary">{formatCurrency(reconciliationTotals.pending)}</p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-border bg-surface p-4 shadow-subtle">
            <div>
              <h3 className="text-lg font-bold text-primary">Charge Reconciliation</h3>
              <p className="text-xs text-secondary">Review courier collection, charges, and settlement state without changing the guarded courier sync rules.</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  downloadCsv(
                    `reconciliation_${new Date().toISOString().slice(0, 10)}.csv`,
                    ["Courier", "Order", "Tracking", "COD", "Collected", "Courier Charge", "Pending", "Reconciliation Status", "Reconciled", "External Status"],
                    reconciliationRows.map((shipment) => [
                      shipment.courierName || "",
                      shipment.orderNumber || "",
                      shipment.trackingNumber || shipment.tracking_number || "",
                      shipment.codAmount || shipment.cod_amount,
                      shipment.collectedAmount || shipment.collected_amount,
                      shipment.courierCharge || shipment.courier_charge,
                      shipment.pendingAmount || 0,
                      shipment.reconciliationStatus || shipment.reconciliation_status,
                      shipment.reconciledAt || shipment.reconciled_at || "",
                      shipment.externalStatus || shipment.external_status || "",
                    ]),
                  )
                }
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-[13px] font-semibold text-secondary transition hover:bg-surface-hover"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-subtle">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-left whitespace-nowrap">
                <thead>
                  <tr className="border-b border-border bg-surface-hover text-[10px] font-bold uppercase tracking-wider text-muted">
                    <th className="px-6 py-4">Courier</th>
                    <th className="px-6 py-4">Order</th>
                    <th className="px-6 py-4">Tracking</th>
                    <th className="px-6 py-4">COD</th>
                    <th className="px-6 py-4">Collected</th>
                    <th className="px-6 py-4">Charge</th>
                    <th className="px-6 py-4">Pending</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">External</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {reconciliationRows.map((shipment) => (
                    <tr key={shipment.id} className="transition-colors hover:bg-surface-hover">
                      <td className="px-6 py-4 text-sm font-semibold text-primary">{shipment.courierName || "Manual"}</td>
                      <td className="px-6 py-4 text-sm text-secondary">#{shipment.orderNumber || shipment.order_id.slice(0, 8)}</td>
                      <td className="px-6 py-4 text-sm text-secondary">{shipment.trackingNumber || shipment.tracking_number || "No tracking"}</td>
                      <td className="px-6 py-4 text-sm text-secondary">{formatCurrency(shipment.codAmount || shipment.cod_amount)}</td>
                      <td className="px-6 py-4 text-sm text-secondary">{formatCurrency(shipment.collectedAmount || shipment.collected_amount)}</td>
                      <td className="px-6 py-4 text-sm text-secondary">{formatCurrency(shipment.courierCharge || shipment.courier_charge)}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-primary">{formatCurrency(shipment.pendingAmount || 0)}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700">
                          {formatLabel(shipment.reconciliationStatus || shipment.reconciliation_status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-secondary">{shipment.externalStatus || shipment.external_status || "No external status"}</td>
                      <td className="px-6 py-4 text-right">
                        <button type="button" onClick={() => openReconciliationModal(shipment)} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100">
                          Update
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {!isLoading && activeTab === "logs" ? (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="rounded-xl border border-border bg-surface shadow-subtle">
            <div className="flex items-center justify-between border-b border-border bg-surface-hover/50 p-4">
              <div>
                <h4 className="text-sm font-bold text-primary">Courier API Logs</h4>
                <p className="mt-1 text-xs text-secondary">Sanitized courier provider activity kept manual-first and non-destructive.</p>
              </div>
              <button type="button" onClick={() => void loadLogs()} className="rounded-md p-1 transition-all hover:bg-surface-hover">
                <RefreshCw className={`h-4 w-4 ${isLogsLoading ? "animate-spin" : ""}`} />
              </button>
            </div>

            <div className="grid gap-3 border-b border-border p-4 md:grid-cols-4">
              <TextInput placeholder="Search logs" value={logFilters.search} onChange={(event) => setLogFilters((current) => ({ ...current, search: event.target.value }))} />
              <SelectInput value={logFilters.provider} onChange={(event) => setLogFilters((current) => ({ ...current, provider: event.target.value }))}>
                <option value="">All providers</option>
                {providerOptions.map((provider) => (
                  <option key={provider} value={provider}>
                    {formatLabel(provider)}
                  </option>
                ))}
              </SelectInput>
              <SelectInput value={logFilters.action} onChange={(event) => setLogFilters((current) => ({ ...current, action: event.target.value }))}>
                <option value="">All actions</option>
                <option value="connection_test">Connection Test</option>
                <option value="send_shipment">Send Shipment</option>
                <option value="status_sync">Status Sync</option>
              </SelectInput>
              <SelectInput value={logFilters.status} onChange={(event) => setLogFilters((current) => ({ ...current, status: event.target.value }))}>
                <option value="">All statuses</option>
                <option value="success">Success</option>
                <option value="failed">Failed</option>
                <option value="warning">Warning</option>
              </SelectInput>
            </div>

            {logsUnavailable ? (
              <div className="px-6 py-8 text-sm text-secondary">{logsUnavailable}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-left whitespace-nowrap">
                  <thead>
                    <tr className="bg-surface-hover text-[10px] font-bold uppercase tracking-wider text-muted">
                      <th className="px-6 py-3">Timestamp</th>
                      <th className="px-6 py-3">Courier</th>
                      <th className="px-6 py-3">Order</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredLogs.map((log) => (
                      <tr key={log.id} className="transition-colors hover:bg-surface-hover">
                        <td className="px-6 py-4 text-xs text-secondary">{formatDateTime(log.requestAt || log.createdAt || log.created_at)}</td>
                        <td className="px-6 py-4">
                          <span className="text-xs font-bold uppercase text-primary">{log.provider}</span>
                        </td>
                        <td className="px-6 py-4 text-xs font-medium text-secondary">{log.order_number ? `#${log.order_number}` : log.shipment_number || "No order"}</td>
                        <td className="px-6 py-4">
                          <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${log.status === "success" ? "bg-green-50 text-green-600" : log.status === "warning" ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600"}`}>
                            {log.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-between gap-3">
                            <span className="max-w-[340px] truncate text-xs text-secondary">{log.message || log.response_summary || "No details"}</span>
                            <button type="button" onClick={() => { setSelectedLog(log); setModal("log"); }} className="rounded-full border border-slate-200 px-3 py-1 text-[10px] font-semibold text-slate-700 transition hover:bg-slate-100">
                              View
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!isLogsLoading && filteredLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-sm text-muted">
                          No logs found.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {modal === "shipment" || modal === "bulk-book" ? (
        <Overlay onClose={closeModal}>
          <ModalShell
            title={
              modal === "bulk-book"
                ? `Bulk Book ${selectedPendingOrders.length} Pending Orders`
                : editingShipment
                  ? "Edit Shipment"
                  : "Add New Shipment"
            }
            description={
              modal === "bulk-book"
                ? "Apply one courier booking payload across the selected pending-dispatch orders while preserving existing backend shipment safety."
                : editingShipment
                  ? "Update the shipment using the v1-style logistics modal."
                  : "Create a shipment from the logistics command center."
            }
            onClose={closeModal}
          >
            <form onSubmit={handleSaveShipment} className="space-y-4">
              {modal !== "bulk-book" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Order">
                    <SelectInput value={shipmentForm.orderId} onChange={(event) => setShipmentForm((current) => ({ ...current, orderId: event.target.value }))} required disabled={Boolean(editingShipment)}>
                      <option value="">Select Order</option>
                      {pendingOrders.map((order) => (
                        <option key={order.id} value={order.id}>
                          {(order.orderNumber || order.order_number)} - {order.customerName || order.customer_name || "Guest"}
                        </option>
                      ))}
                    </SelectInput>
                  </Field>
                  <Field label="Courier">
                    <SelectInput value={shipmentForm.courierId} onChange={(event) => setShipmentForm((current) => ({ ...current, courierId: event.target.value }))} required>
                      <option value="">Select Courier</option>
                      {couriers.filter((courier) => courier.is_active).map((courier) => (
                        <option key={courier.id} value={courier.id}>
                          {(courier.courierName || courier.name)} ({courier.code})
                        </option>
                      ))}
                    </SelectInput>
                  </Field>
                </div>
              ) : (
                <Field label="Courier">
                  <SelectInput value={shipmentForm.courierId} onChange={(event) => setShipmentForm((current) => ({ ...current, courierId: event.target.value }))} required>
                    <option value="">Select Courier</option>
                    {couriers.filter((courier) => courier.is_active).map((courier) => (
                      <option key={courier.id} value={courier.id}>
                        {(courier.courierName || courier.name)} ({courier.code})
                      </option>
                    ))}
                  </SelectInput>
                </Field>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Status">
                  <SelectInput value={shipmentForm.orderStatus} onChange={(event) => setShipmentForm((current) => ({ ...current, orderStatus: event.target.value }))}>
                    <option value="">Do not change order</option>
                    <option value="ready_to_ship">Ready to Ship</option>
                    <option value="shipped">Shipped</option>
                  </SelectInput>
                </Field>
                <Field label="Shipment Number">
                  <TextInput value={shipmentForm.shipmentNumber} onChange={(event) => setShipmentForm((current) => ({ ...current, shipmentNumber: event.target.value }))} placeholder="Leave blank to auto-generate" />
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Recipient Name">
                  <TextInput value={shipmentForm.recipientName} onChange={(event) => setShipmentForm((current) => ({ ...current, recipientName: event.target.value }))} />
                </Field>
                <Field label="Recipient Phone">
                  <TextInput value={shipmentForm.recipientPhone} onChange={(event) => setShipmentForm((current) => ({ ...current, recipientPhone: event.target.value }))} />
                </Field>
              </div>

              <Field label="Delivery Address">
                <TextArea rows={3} value={shipmentForm.deliveryAddress} onChange={(event) => setShipmentForm((current) => ({ ...current, deliveryAddress: event.target.value }))} />
              </Field>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Tracking Number">
                  <TextInput value={shipmentForm.trackingNumber} onChange={(event) => setShipmentForm((current) => ({ ...current, trackingNumber: event.target.value }))} placeholder="TRK-123456789" />
                </Field>
                <Field label="Reconciliation Status">
                  <SelectInput value={shipmentForm.reconciliationStatus} onChange={(event) => setShipmentForm((current) => ({ ...current, reconciliationStatus: event.target.value }))}>
                    {reconciliationStatusOptions.map((status) => (
                      <option key={status} value={status}>
                        {formatLabel(status)}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Delivery Charge">
                  <TextInput type="number" min="0" step="0.01" value={shipmentForm.deliveryCharge} onChange={(event) => setShipmentForm((current) => ({ ...current, deliveryCharge: event.target.value }))} />
                </Field>
                <Field label="Courier Charge">
                  <TextInput type="number" min="0" step="0.01" value={shipmentForm.courierCharge} onChange={(event) => setShipmentForm((current) => ({ ...current, courierCharge: event.target.value }))} />
                </Field>
                <Field label="COD Amount">
                  <TextInput type="number" min="0" step="0.01" value={shipmentForm.codAmount} onChange={(event) => setShipmentForm((current) => ({ ...current, codAmount: event.target.value }))} />
                </Field>
                <Field label="Collected Amount">
                  <TextInput type="number" min="0" step="0.01" value={shipmentForm.collectedAmount} onChange={(event) => setShipmentForm((current) => ({ ...current, collectedAmount: event.target.value }))} />
                </Field>
              </div>

              <Field label="Notes">
                <TextArea rows={3} value={shipmentForm.notes} onChange={(event) => setShipmentForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Prepared for dispatch" />
              </Field>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={closeModal} className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
                  Cancel
                </button>
                <button type="submit" disabled={isSavingShipment} className="flex-1 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-black disabled:opacity-50">
                  {isSavingShipment ? "Saving..." : modal === "bulk-book" ? "Bulk Book" : editingShipment ? "Save Changes" : "Add Shipment"}
                </button>
              </div>
            </form>
          </ModalShell>
        </Overlay>
      ) : null}

      {modal === "courier" ? (
        <Overlay onClose={closeModal}>
          <ModalShell
            title={editingCourier ? "Edit Courier" : "Connect New Courier"}
            description="Manage manual courier rows from inside the same v1-style logistics command center."
            onClose={closeModal}
          >
            <form onSubmit={handleSaveCourier} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Courier Name">
                  <TextInput required value={courierForm.name} onChange={(event) => setCourierForm((current) => ({ ...current, name: event.target.value }))} placeholder="Pathao, RedX, Steadfast" />
                </Field>
                <Field label="Code">
                  <TextInput required value={courierForm.code} onChange={(event) => setCourierForm((current) => ({ ...current, code: event.target.value }))} placeholder="CR-001" />
                </Field>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Contact Phone">
                  <TextInput value={courierForm.contactPhone} onChange={(event) => setCourierForm((current) => ({ ...current, contactPhone: event.target.value }))} placeholder="01700000000" />
                </Field>
                <Field label="Website">
                  <TextInput value={courierForm.website} onChange={(event) => setCourierForm((current) => ({ ...current, website: event.target.value }))} placeholder="https://courier.example.com" />
                </Field>
              </div>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <input type="checkbox" checked={courierForm.isActive} onChange={(event) => setCourierForm((current) => ({ ...current, isActive: event.target.checked }))} />
                Mark courier active
              </label>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={closeModal} className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
                  Cancel
                </button>
                <button type="submit" disabled={isSavingCourier} className="flex-1 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-black disabled:opacity-50">
                  {isSavingCourier ? "Saving..." : editingCourier ? "Save Changes" : "Connect Courier"}
                </button>
              </div>
            </form>
          </ModalShell>
        </Overlay>
      ) : null}

      {modal === "shipment-detail" && selectedShipment ? (
        <Overlay onClose={closeModal}>
          <ModalShell
            title={`Shipment ${selectedShipment.shipmentNumber || selectedShipment.shipment_number}`}
            description="Inspect shipment, courier sync context, and lifecycle activity without leaving the logistics workspace."
            onClose={closeModal}
          >
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[11px] font-semibold text-secondary">Order</p>
                  <p className="mt-2 text-sm font-bold text-primary">#{selectedShipment.orderNumber || selectedShipment.order_id.slice(0, 8)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[11px] font-semibold text-secondary">Courier</p>
                  <p className="mt-2 text-sm font-bold text-primary">{selectedShipment.courierName || "Manual Courier"}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[11px] font-semibold text-secondary">Status</p>
                  <p className="mt-2 text-sm font-bold text-primary">{selectedShipment.statusLabel || formatLabel(selectedShipment.status)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[11px] font-semibold text-secondary">Tracking</p>
                  <p className="mt-2 text-sm font-bold text-primary">{selectedShipment.trackingNumber || selectedShipment.tracking_number || "No tracking"}</p>
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
                  <h4 className="text-sm font-bold text-primary">Recipient &amp; Delivery</h4>
                  <div className="space-y-3 text-sm text-secondary">
                    <p><span className="font-semibold text-primary">Recipient:</span> {selectedShipment.recipientName || selectedShipment.recipient_name || "Unknown"}</p>
                    <p><span className="font-semibold text-primary">Phone:</span> {selectedShipment.recipientPhone || selectedShipment.recipient_phone || "No phone"}</p>
                    <p><span className="font-semibold text-primary">Address:</span> {selectedShipment.deliveryAddress || selectedShipment.delivery_address || "No address"}</p>
                    <p><span className="font-semibold text-primary">External Provider:</span> {selectedShipment.externalProvider || selectedShipment.external_provider || "Manual / none"}</p>
                    <p><span className="font-semibold text-primary">External Status:</span> {selectedShipment.externalStatus || selectedShipment.external_status || "Not synced yet"}</p>
                    <p><span className="font-semibold text-primary">Last Sync:</span> {formatDateTime(selectedShipment.externalSyncedAt || selectedShipment.external_synced_at)}</p>
                  </div>
                </div>

                <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
                  <h4 className="text-sm font-bold text-primary">Charges &amp; Reconciliation</h4>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <p className="text-[11px] font-semibold text-secondary">COD</p>
                      <p className="mt-1 text-sm font-bold text-primary">{formatCurrency(selectedShipment.codAmount || selectedShipment.cod_amount)}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <p className="text-[11px] font-semibold text-secondary">Collected</p>
                      <p className="mt-1 text-sm font-bold text-primary">{formatCurrency(selectedShipment.collectedAmount || selectedShipment.collected_amount)}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <p className="text-[11px] font-semibold text-secondary">Courier Charge</p>
                      <p className="mt-1 text-sm font-bold text-primary">{formatCurrency(selectedShipment.courierCharge || selectedShipment.courier_charge)}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-3">
                      <p className="text-[11px] font-semibold text-secondary">Pending</p>
                      <p className="mt-1 text-sm font-bold text-primary">{formatCurrency(selectedShipment.pendingAmount || 0)}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(selectedShipment.canMarkShipped ?? selectedShipment.action_flags?.can_mark_shipped) ? (
                      <button type="button" onClick={() => openStatusModal(selectedShipment, "shipped")} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100">
                        Mark Shipped
                      </button>
                    ) : null}
                    {(selectedShipment.canMarkDelivered ?? selectedShipment.action_flags?.can_mark_delivered) ? (
                      <button type="button" onClick={() => openStatusModal(selectedShipment, "delivered")} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100">
                        Mark Delivered
                      </button>
                    ) : null}
                    {(selectedShipment.canReconcile ?? selectedShipment.action_flags?.can_reconcile) ? (
                      <button type="button" onClick={() => openReconciliationModal(selectedShipment)} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100">
                        Update Reconciliation
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <h4 className="mb-4 text-sm font-bold text-primary">Activity Log</h4>
                <div className="space-y-3">
                  {(selectedShipment.logs || []).length === 0 ? (
                    <p className="text-sm text-secondary">No shipment events recorded yet.</p>
                  ) : (
                    (selectedShipment.logs || []).map((log) => (
                      <div key={log.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-secondary">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold text-primary">{formatLabel(log.activityType)}</p>
                          <p className="text-xs text-muted">{formatDateTime(log.createdAt)}</p>
                        </div>
                        <p className="mt-2">{log.message}</p>
                        {log.createdBy ? <p className="mt-2 text-xs text-muted">By {log.createdBy}</p> : null}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </ModalShell>
        </Overlay>
      ) : null}

      {modal === "status" ? (
        <Overlay onClose={closeModal}>
          <ModalShell title="Update Shipment Status" description="Keep shipment state changes manual and operator-confirmed like the v1 logistics command center." onClose={closeModal}>
            <form onSubmit={handleSaveStatus} className="space-y-4">
              <Field label="Status">
                <SelectInput value={statusForm.status} onChange={(event) => setStatusForm((current) => ({ ...current, status: event.target.value }))}>
                  {shipmentStatusOptions.map((status) => (
                    <option key={status} value={status}>
                      {formatLabel(status)}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                Manual-only status changes are preserved. No destructive external courier state is auto-applied here.
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={closeModal} className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
                  Cancel
                </button>
                <button type="submit" disabled={busyShipmentId === statusForm.shipmentId} className="flex-1 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-black disabled:opacity-50">
                  {busyShipmentId === statusForm.shipmentId ? "Saving..." : "Save Status"}
                </button>
              </div>
            </form>
          </ModalShell>
        </Overlay>
      ) : null}

      {modal === "reconciliation" ? (
        <Overlay onClose={closeModal}>
          <ModalShell title="Update Reconciliation" description="Adjust collection and settlement state using the existing guarded shipment update path." onClose={closeModal}>
            <form onSubmit={handleSaveReconciliation} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Courier Charge">
                  <TextInput type="number" min="0" step="0.01" value={reconciliationForm.courierCharge} onChange={(event) => setReconciliationForm((current) => ({ ...current, courierCharge: event.target.value }))} />
                </Field>
                <Field label="Collected Amount">
                  <TextInput type="number" min="0" step="0.01" value={reconciliationForm.collectedAmount} onChange={(event) => setReconciliationForm((current) => ({ ...current, collectedAmount: event.target.value }))} />
                </Field>
              </div>
              <Field label="Reconciliation Status">
                <SelectInput value={reconciliationForm.reconciliationStatus} onChange={(event) => setReconciliationForm((current) => ({ ...current, reconciliationStatus: event.target.value }))}>
                  {reconciliationStatusOptions.map((status) => (
                    <option key={status} value={status}>
                      {formatLabel(status)}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={closeModal} className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
                  Cancel
                </button>
                <button type="submit" disabled={isSavingReconciliation} className="flex-1 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-black disabled:opacity-50">
                  {isSavingReconciliation ? "Saving..." : "Update Reconciliation"}
                </button>
              </div>
            </form>
          </ModalShell>
        </Overlay>
      ) : null}

      {modal === "send" ? (
        <Overlay onClose={closeModal}>
          <ModalShell title="Send To Courier" description="External courier handoff remains manual and guarded. Nothing destructive is auto-applied locally." onClose={closeModal}>
            <form onSubmit={handleSendToCourier} className="space-y-4">
              <Field label="Provider">
                <SelectInput value={sendAction.provider} onChange={(event) => setSendAction((current) => ({ ...current, provider: event.target.value }))}>
                  {providerOptions.map((provider) => (
                    <option key={provider} value={provider}>
                      {formatLabel(provider)}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                Shipment send remains manual. This page does not introduce background workers or automatic courier dispatch.
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={closeModal} className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
                  Cancel
                </button>
                <button type="submit" disabled={busyShipmentId === sendAction.shipmentId} className="flex-1 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-black disabled:opacity-50">
                  {busyShipmentId === sendAction.shipmentId ? "Sending..." : "Send Shipment"}
                </button>
              </div>
            </form>
          </ModalShell>
        </Overlay>
      ) : null}

      {modal === "sync" ? (
        <Overlay onClose={closeModal}>
          <ModalShell title="Sync Courier Status" description="Courier sync remains warning-first. Safe delivered apply stays opt-in and destructive external states are not auto-applied." onClose={closeModal}>
            <form onSubmit={handleSyncStatus} className="space-y-4">
              <Field label="Provider">
                <SelectInput value={syncAction.provider} onChange={(event) => setSyncAction((current) => ({ ...current, provider: event.target.value }))}>
                  {providerOptions.map((provider) => (
                    <option key={provider} value={provider}>
                      {formatLabel(provider)}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <input type="checkbox" checked={syncAction.applySafeStatus} onChange={(event) => setSyncAction((current) => ({ ...current, applySafeStatus: event.target.checked }))} />
                Apply safe delivered status locally only
              </label>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                Returned, cancelled, and failed courier states remain warning-first and are not auto-applied destructively.
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={closeModal} className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
                  Cancel
                </button>
                <button type="submit" disabled={busyShipmentId === syncAction.shipmentId} className="flex-1 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-black disabled:opacity-50">
                  {busyShipmentId === syncAction.shipmentId ? "Syncing..." : "Sync Status"}
                </button>
              </div>
            </form>
          </ModalShell>
        </Overlay>
      ) : null}

      {modal === "log" && selectedLog ? (
        <Overlay onClose={closeModal}>
          <ModalShell
            title={`${formatLabel(selectedLog.provider)} ${formatLabel(selectedLog.action)}`}
            description="Sanitized request and response previews only. No courier secrets are exposed here."
            onClose={closeModal}
          >
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[11px] font-semibold text-secondary">Shipment</p>
                  <p className="mt-2 text-sm font-bold text-primary">{selectedLog.shipment_number || "No linked shipment"}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[11px] font-semibold text-secondary">Order</p>
                  <p className="mt-2 text-sm font-bold text-primary">{selectedLog.order_number || "No linked order"}</p>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-secondary">
                <p><span className="font-semibold text-primary">Status:</span> {selectedLog.status}</p>
                <p className="mt-2"><span className="font-semibold text-primary">Message:</span> {selectedLog.message || "No message"}</p>
                <p className="mt-2"><span className="font-semibold text-primary">Created:</span> {formatDateTime(selectedLog.requestAt || selectedLog.createdAt || selectedLog.created_at)}</p>
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                <div>
                  <h4 className="mb-2 text-sm font-bold text-primary">Request Snapshot</h4>
                  <pre className="max-h-[280px] overflow-auto rounded-2xl border border-slate-200 bg-slate-950 p-4 text-xs text-slate-100">{JSON.stringify(selectedLog.request_snapshot, null, 2) || "No snapshot"}</pre>
                </div>
                <div>
                  <h4 className="mb-2 text-sm font-bold text-primary">Response Snapshot</h4>
                  <pre className="max-h-[280px] overflow-auto rounded-2xl border border-slate-200 bg-slate-950 p-4 text-xs text-slate-100">{JSON.stringify(selectedLog.response_snapshot, null, 2) || "No snapshot"}</pre>
                </div>
              </div>
            </div>
          </ModalShell>
        </Overlay>
      ) : null}
    </div>
  );
}
