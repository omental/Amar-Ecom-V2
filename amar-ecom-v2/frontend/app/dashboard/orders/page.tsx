"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  Filter,
  Globe,
  LayoutGrid,
  List,
  Loader2,
  MessageCircle,
  MessageSquare,
  Package,
  PackageCheck,
  PackageOpen,
  PackagePlus,
  PackageX,
  PauseCircle,
  Pencil,
  Phone,
  Plus,
  Printer,
  RefreshCcw,
  Search,
  Truck,
  User,
  Warehouse,
  X,
  Zap,
  Flame,
} from "lucide-react";

import { api, ApiError } from "@/lib/api";
import { formatCurrency, formatDate, formatDateTime, formatLabel } from "@/lib/format";

type CustomerOption = {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  city?: string | null;
};

type ProductOption = {
  id: string;
  name: string;
  sku: string;
  price: number | string;
};

type WarehouseOption = {
  id: string;
  name: string;
  code: string;
  address?: string | null;
  is_active?: boolean;
};

type CourierOption = {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
};

type OrderItemRead = {
  id: string;
  product_id: string | null;
  variant_id: string | null;
  product_name: string;
  sku: string | null;
  quantity: number;
  unit_price: number | string;
  total_price: number | string;
};

type ShipmentSummary = {
  id: string;
  shipment_number: string;
  status: string;
  tracking_number?: string | null;
  external_tracking_number?: string | null;
  external_consignment_id?: string | null;
  external_status?: string | null;
  courier_id?: string | null;
  courier_name?: string | null;
  delivery_charge: number | string;
  courier_charge: number | string;
  cod_amount: number | string;
  collected_amount: number | string;
  reconciliation_status: string;
  sent_to_courier_at?: string | null;
  shipped_at?: string | null;
  delivered_at?: string | null;
};

type OrderActionFlags = {
  can_print: boolean;
  can_edit: boolean;
  can_create_shipment: boolean;
  can_refresh_woo: boolean;
  can_deduct_stock_by_status: boolean;
  can_cancel: boolean;
  can_mark_delivered: boolean;
};

type OrderLog = {
  id: string;
  action: string;
  details: string;
  user?: string | null;
  timestamp: string;
};

type OrderCustomerSummary = {
  id?: string | null;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  customer_type?: string | null;
  tags?: string | null;
  notes?: string | null;
};

type OrderShippingSummary = {
  recipient_name?: string | null;
  recipient_phone?: string | null;
  address?: string | null;
  shipping_address?: string | null;
  warehouse_id?: string | null;
};

type OrderTotalsSummary = {
  subtotal: number | string;
  discount: number | string;
  delivery_charge: number | string;
  total: number | string;
  paid_amount: number | string;
  due_amount: number | string;
};

type OrderEvent = {
  id: string;
  event_type: string;
  message: string;
  created_at: string;
  created_by?: {
    id: string;
    full_name?: string;
    email?: string;
  } | null;
};

type OrderRow = {
  id: string;
  order_number: string;
  orderNumber: string;
  customer_id: string | null;
  warehouse_id: string | null;
  customer_name: string | null;
  customerName?: string | null;
  customer_phone: string | null;
  customerPhone?: string | null;
  shipping_address: string | null;
  customer_address?: string | null;
  customerAddress?: string | null;
  notes: string | null;
  tags: string | null;
  status: string;
  payment_status: string;
  payment_method?: string | null;
  paymentMethod?: string | null;
  source: string;
  external_id?: string | null;
  external_number?: string | null;
  external_status?: string | null;
  external_synced_at?: string | null;
  subtotal: number | string;
  discount: number | string;
  delivery_charge: number | string;
  deliveryCharge?: number | string | null;
  paid_amount?: number | string;
  paidAmount?: number | string | null;
  total: number | string;
  totalAmount?: number | string | null;
  due_amount?: number | string | null;
  dueAmount?: number | string | null;
  stock_deducted: boolean;
  printed_count: number;
  last_printed_at: string | null;
  lastPrintedAt?: string | null;
  created_at: string;
  createdAt: string;
  updated_at: string;
  updatedAt?: string;
  item_count: number;
  first_item_summary?: {
    product_name: string;
    sku?: string | null;
    quantity: number;
    unit_price: number | string;
    total_price: number | string;
  } | null;
  warehouse_summary?: WarehouseOption | null;
  shipment_summary?: ShipmentSummary | null;
  courierName?: string | null;
  trackingNumber?: string | null;
  items: OrderItemRead[];
};

type OrderDetail = OrderRow & {
  customer_summary?: OrderCustomerSummary | null;
  shipping_summary?: OrderShippingSummary | null;
  totals_summary?: OrderTotalsSummary | null;
  warehouse?: WarehouseOption | null;
  logs: OrderLog[];
  action_flags: OrderActionFlags;
  events: OrderEvent[];
  external_payload_snapshot?: string | null;
};

type OrderSummary = {
  total_orders: number;
  pending_orders: number;
  confirmed_orders: number;
  processing_orders: number;
  ready_to_ship_orders_count: number;
  shipped_orders_count: number;
  delivered_orders_count: number;
  cancelled_orders_count: number;
  returned_orders_count: number;
  partial_delivered_orders: number;
  urgent_orders: number;
  hold_orders: number;
  orders_with_shipments: number;
  orders_without_shipments_ready_to_ship: number;
  orders_stock_not_deducted: number;
  orders_printed_count: number;
  orders_unprinted_count: number;
  orders_with_woo_source: number;
  orders_needing_woo_refresh: number;
};

type DuplicateRow = {
  id: string;
  order_number: string;
  orderNumber: string;
  status: string;
  source: string;
  customer_name?: string | null;
  customerName?: string | null;
  customer_phone?: string | null;
  customerPhone?: string | null;
  customer_address?: string | null;
  customerAddress?: string | null;
  total: number | string;
  created_at: string;
  createdAt: string;
};

type OrderItemForm = {
  row_id: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: string;
  unitPrice: string;
  totalPrice: string;
};

type OrderFormState = {
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerCity: string;
  customerZone: string;
  district: string;
  division: string;
  area: string;
  landmark: string;
  warehouseId: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  channel: string;
  notes: string;
  tags: string;
  courierName: string;
  trackingNumber: string;
  customShipmentNumber: string;
  isExchange: boolean;
  discount: string;
  deliveryCharge: string;
  paidAmount: string;
  items: OrderItemForm[];
};

type ShipmentFormState = {
  courier_id: string;
  tracking_number: string;
  delivery_charge: string;
  courier_charge: string;
  cod_amount: string;
  collected_amount: string;
  notes: string;
  order_status: string;
};

const STATUS_TABS = [
  "all",
  "urgent",
  "hold",
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "partial_delivered",
  "cancelled",
  "returned",
] as const;

const EDITABLE_STATUSES = [
  "urgent",
  "hold",
  "pending",
  "confirmed",
  "processing",
  "ready_to_ship",
  "shipped",
  "delivered",
  "partial_delivered",
  "cancelled",
  "returned",
];

const PAYMENT_STATUSES = ["unpaid", "paid", "partial", "refunded"];
const PAYMENT_METHODS = ["COD", "Cash", "bKash", "Bank Transfer", "Card"];
const SOURCE_OPTIONS = [
  "Facebook",
  "Website",
  "Instagram",
  "Messenger",
  "WhatsApp",
  "Call",
  "TikTok",
  "Manual",
];

const statusStyleMap: Record<
  string,
  {
    label: string;
    className: string;
    icon: typeof Package;
  }
> = {
  urgent: {
    label: "Urgent",
    className: "bg-red-50 text-red-600 ring-1 ring-red-100",
    icon: Flame,
  },
  hold: {
    label: "Hold",
    className: "bg-amber-50 text-amber-600 ring-1 ring-amber-100",
    icon: PauseCircle,
  },
  pending: {
    label: "Pending",
    className: "bg-orange-50 text-orange-600 ring-1 ring-orange-100",
    icon: Clock3,
  },
  confirmed: {
    label: "Confirmed",
    className: "bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100",
    icon: CheckCircle2,
  },
  processing: {
    label: "Processing",
    className: "bg-blue-50 text-blue-700 ring-1 ring-blue-100",
    icon: Zap,
  },
  ready_to_ship: {
    label: "Ready To Ship",
    className: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
    icon: PackagePlus,
  },
  shipped: {
    label: "Shipped",
    className: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100",
    icon: Truck,
  },
  delivered: {
    label: "Delivered",
    className: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100",
    icon: PackageCheck,
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-rose-50 text-rose-700 ring-1 ring-rose-100",
    icon: PackageX,
  },
  returned: {
    label: "Returned",
    className: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
    icon: RefreshCcw,
  },
  partial_delivered: {
    label: "Partial Delivered",
    className: "bg-orange-50 text-orange-700 ring-1 ring-orange-100",
    icon: PackageOpen,
  },
};

function statusMeta(status: string) {
  return (
    statusStyleMap[status] || {
      label: formatLabel(status),
      className: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
      icon: Package,
    }
  );
}

function numeric(value: string | number | null | undefined) {
  const next = Number(value ?? 0);
  return Number.isFinite(next) ? next : 0;
}

function buildDateRangeForToday() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return {
    date_from: start.toISOString(),
    date_to: end.toISOString(),
  };
}

function buildItemRow(): OrderItemForm {
  return {
    row_id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    productId: "",
    productName: "",
    sku: "",
    quantity: "1",
    unitPrice: "0",
    totalPrice: "0",
  };
}

function recalcItem(item: OrderItemForm): OrderItemForm {
  const quantity = Math.max(0, numeric(item.quantity));
  const unitPrice = Math.max(0, numeric(item.unitPrice));
  return {
    ...item,
    quantity: String(quantity),
    unitPrice: String(unitPrice),
    totalPrice: String(quantity * unitPrice),
  };
}

const initialFormState: OrderFormState = {
  orderNumber: "",
  customerId: "",
  customerName: "",
  customerPhone: "",
  customerAddress: "",
  customerCity: "Dhaka",
  customerZone: "Inside Dhaka",
  district: "",
  division: "",
  area: "",
  landmark: "",
  warehouseId: "",
  status: "pending",
  paymentStatus: "unpaid",
  paymentMethod: "COD",
  channel: "Facebook",
  notes: "",
  tags: "",
  courierName: "",
  trackingNumber: "",
  customShipmentNumber: "",
  isExchange: false,
  discount: "0",
  deliveryCharge: "80",
  paidAmount: "0",
  items: [buildItemRow()],
};

const initialShipmentState: ShipmentFormState = {
  courier_id: "",
  tracking_number: "",
  delivery_charge: "0",
  courier_charge: "0",
  cod_amount: "0",
  collected_amount: "0",
  notes: "",
  order_status: "ready_to_ship",
};

function buildSearchParams(
  current: URLSearchParams,
  next: Record<string, string | null | undefined>,
) {
  const params = new URLSearchParams(current.toString());
  Object.entries(next).forEach(([key, value]) => {
    if (!value) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
  });
  return params.toString();
}

function downloadCsv(
  filename: string,
  columns: string[],
  rows: Array<Array<string | number | null | undefined>>,
) {
  const lines = [
    columns.join(","),
    ...rows.map((row) =>
      row
        .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
        .join(","),
    ),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function StatusPill({ status }: { status: string }) {
  const meta = statusMeta(status);
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] ${meta.className}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {meta.label}
    </span>
  );
}

function PaymentPill({ value }: { value: string }) {
  const tone =
    value === "paid"
      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
      : value === "partial"
        ? "bg-amber-50 text-amber-700 ring-1 ring-amber-100"
        : value === "refunded"
          ? "bg-slate-100 text-slate-700 ring-1 ring-slate-200"
          : "bg-rose-50 text-rose-700 ring-1 ring-rose-100";
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${tone}`}>
      {formatLabel(value)}
    </span>
  );
}

function SourcePill({ source, externalStatus }: { source: string; externalStatus?: string | null }) {
  const value = (source || "").toLowerCase();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-slate-700 ring-1 ring-slate-200">
        {value === "messenger" || value === "whatsapp" ? (
          <MessageCircle className="h-3.5 w-3.5" />
        ) : (
          <Globe className="h-3.5 w-3.5" />
        )}
        {source}
      </span>
      {externalStatus ? (
        <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-blue-700 ring-1 ring-blue-100">
          {externalStatus}
        </span>
      ) : null}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  amount,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  amount?: number;
  icon: typeof Package;
  accent: string;
}) {
  return (
    <div className="relative flex min-h-[150px] flex-col justify-between overflow-hidden rounded-[20px] border border-[var(--color-brd)] bg-[var(--color-surf)] p-5 shadow-subtle">
      <div>
        <p className={`mb-2 text-[10px] font-black uppercase tracking-[0.18em] ${accent}`}>{label}</p>
        <div className="flex items-end gap-2">
          <span className="text-3xl font-bold text-[var(--color-txt-pri)]">{value}</span>
          <span className="pb-1 text-xs font-semibold text-[var(--color-txt-sec)]">Orders</span>
        </div>
      </div>
      <div className="relative z-10 text-sm font-bold text-[var(--color-txt-pri)]">
        {amount !== undefined ? formatCurrency(amount) : "Live status overview"}
      </div>
      <div className="pointer-events-none absolute inset-y-0 right-5 flex items-center opacity-15">
        <Icon className={`h-8 w-8 ${accent}`} />
      </div>
    </div>
  );
}

function Overlay({
  children,
  onClose,
  wide = false,
}: {
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-3 backdrop-blur-sm">
      <button
        aria-label="Close"
        className="absolute inset-0"
        onClick={onClose}
      />
      <div
        className={`relative z-10 max-h-[94vh] w-full overflow-hidden rounded-[28px] border border-[var(--color-brd)] bg-[var(--color-surf)] shadow-2xl ${wide ? "max-w-6xl" : "max-w-4xl"}`}
      >
        {children}
      </div>
    </div>
  );
}

export default function OrdersPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const modeParam = searchParams.get("mode");
  const detailOrderId = searchParams.get("order");
  const editOrderId = searchParams.get("edit");
  const formMode = modeParam === "new" || modeParam === "edit" ? modeParam : null;

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [summary, setSummary] = useState<OrderSummary | null>(null);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [couriers, setCouriers] = useState<CourierOption[]>([]);

  const [activeTab, setActiveTab] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [searchTerm, setSearchTerm] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("");
  const [printedFilter, setPrintedFilter] = useState("");
  const [hasShipmentFilter, setHasShipmentFilter] = useState("");
  const [datePreset, setDatePreset] = useState<"all" | "today" | "month" | "custom">("all");
  const [monthFilter, setMonthFilter] = useState(() => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  });
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);

  const [form, setForm] = useState<OrderFormState>(initialFormState);
  const [editingOrder, setEditingOrder] = useState<OrderDetail | null>(null);
  const [duplicateRows, setDuplicateRows] = useState<DuplicateRow[]>([]);
  const [duplicateLoading, setDuplicateLoading] = useState(false);
  const [duplicateError, setDuplicateError] = useState("");

  const [detailOrder, setDetailOrder] = useState<OrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [modalStatus, setModalStatus] = useState("");

  const [shipmentForm, setShipmentForm] = useState<ShipmentFormState>(initialShipmentState);
  const [shipmentModalOpen, setShipmentModalOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshingList, setIsRefreshingList] = useState(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [isCreatingShipment, setIsCreatingShipment] = useState(false);
  const [isRefreshingWoo, setIsRefreshingWoo] = useState(false);
  const [isMarkingPrinted, setIsMarkingPrinted] = useState(false);
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [batchStatus, setBatchStatus] = useState("ready_to_ship");

  const [pageError, setPageError] = useState("");
  const [pageSuccess, setPageSuccess] = useState("");

  const itemsPerPage = 20;

  const customerMap = useMemo(() => new Map(customers.map((item) => [item.id, item])), [customers]);
  const productMap = useMemo(() => new Map(products.map((item) => [item.id, item])), [products]);
  const warehouseMap = useMemo(() => new Map(warehouses.map((item) => [item.id, item])), [warehouses]);

  const formSubtotal = useMemo(
    () => form.items.reduce((sum, item) => sum + numeric(item.totalPrice), 0),
    [form.items],
  );
  const formTotal = useMemo(
    () => formSubtotal - numeric(form.discount) + numeric(form.deliveryCharge),
    [form.deliveryCharge, form.discount, formSubtotal],
  );
  const formDue = useMemo(
    () => Math.max(0, formTotal - numeric(form.paidAmount)),
    [form.paidAmount, formTotal],
  );

  const buildOrdersQuery = useCallback(() => {
    const params = new URLSearchParams({ skip: "0", limit: "100" });
    if (activeTab !== "all") params.set("status", activeTab);
    if (paymentFilter) params.set("payment_status", paymentFilter);
    if (sourceFilter) params.set("source", sourceFilter);
    if (warehouseFilter) params.set("warehouse_id", warehouseFilter);
    if (printedFilter) params.set("printed", printedFilter);
    if (hasShipmentFilter) params.set("has_shipment", hasShipmentFilter);
    if (searchTerm.trim()) params.set("search", searchTerm.trim());

    if (datePreset === "today") {
      const today = buildDateRangeForToday();
      params.set("date_from", today.date_from);
      params.set("date_to", today.date_to);
    } else if (datePreset === "month" && monthFilter) {
      params.set("month", monthFilter);
    } else if (datePreset === "custom") {
      if (dateFrom) params.set("date_from", new Date(`${dateFrom}T00:00:00`).toISOString());
      if (dateTo) params.set("date_to", new Date(`${dateTo}T23:59:59`).toISOString());
    }

    return params.toString();
  }, [activeTab, paymentFilter, sourceFilter, warehouseFilter, printedFilter, hasShipmentFilter, searchTerm, datePreset, monthFilter, dateFrom, dateTo]);

  const refreshOrders = useCallback(
    async (showSpinner = false) => {
      if (showSpinner) setIsRefreshingList(true);
      setPageError("");

      try {
        const [ordersData, summaryData] = await Promise.all([
          api.get<OrderRow[]>(`/orders?${buildOrdersQuery()}`),
          api.get<OrderSummary>("/orders/operations-summary"),
        ]);
        setOrders(ordersData);
        setSummary(summaryData);
      } catch (err) {
        setPageError(err instanceof ApiError ? err.message : "Failed to load orders");
      } finally {
        setIsLoading(false);
        setIsRefreshingList(false);
      }
    },
    [buildOrdersQuery],
  );

  const loadCatalogData = useCallback(async () => {
    try {
      const [customersData, productsData, warehousesData, couriersData] = await Promise.all([
        api.get<CustomerOption[]>("/customers?skip=0&limit=100"),
        api.get<ProductOption[]>("/products?skip=0&limit=100"),
        api.get<WarehouseOption[]>("/warehouses?skip=0&limit=100"),
        api.get<CourierOption[]>("/couriers?skip=0&limit=100"),
      ]);
      setCustomers(customersData);
      setProducts(productsData);
      setWarehouses(warehousesData);
      setCouriers(couriersData.filter((item) => item.is_active));
    } catch (err) {
      setPageError(err instanceof ApiError ? err.message : "Failed to load order helpers");
    }
  }, []);

  useEffect(() => {
    void Promise.all([refreshOrders(), loadCatalogData()]);
  }, [loadCatalogData, refreshOrders]);

  useEffect(() => {
    if (isLoading) return;
    setCurrentPage(1);
    void refreshOrders(true);
  }, [activeTab, paymentFilter, sourceFilter, warehouseFilter, printedFilter, hasShipmentFilter, searchTerm, datePreset, monthFilter, dateFrom, dateTo, isLoading, refreshOrders]);

  const closeDetailModal = useCallback(() => {
    const next = buildSearchParams(searchParams, { order: null });
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    setDetailOrder(null);
    setDetailError("");
  }, [pathname, router, searchParams]);

  const openDetailModal = useCallback((orderId: string) => {
    const next = buildSearchParams(searchParams, { order: orderId });
    router.replace(`${pathname}?${next}`, { scroll: false });
  }, [pathname, router, searchParams]);

  const openNewOrderPanel = useCallback(() => {
    const next = buildSearchParams(searchParams, { mode: "new", edit: null });
    router.replace(`${pathname}?${next}`, { scroll: false });
  }, [pathname, router, searchParams]);

  const openEditOrderPanel = useCallback((orderId: string) => {
    const next = buildSearchParams(searchParams, { mode: "edit", edit: orderId });
    router.replace(`${pathname}?${next}`, { scroll: false });
  }, [pathname, router, searchParams]);

  const closeFormPanel = useCallback(() => {
    const next = buildSearchParams(searchParams, { mode: null, edit: null });
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    setForm(initialFormState);
    setEditingOrder(null);
    setDuplicateRows([]);
    setDuplicateError("");
  }, [pathname, router, searchParams]);

  const loadOrderDetail = useCallback(async (orderId: string) => {
    setDetailLoading(true);
    setDetailError("");
    try {
      const order = await api.get<OrderDetail>(`/orders/${orderId}`);
      setDetailOrder(order);
      setModalStatus(order.status);
    } catch (err) {
      setDetailError(err instanceof ApiError ? err.message : "Failed to load order detail");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!detailOrderId) return;
    void loadOrderDetail(detailOrderId);
  }, [detailOrderId, loadOrderDetail]);

  useEffect(() => {
    if (formMode !== "edit" || !editOrderId) return;
    let active = true;
    async function loadEditOrder() {
      try {
        const order = await api.get<OrderDetail>(`/orders/${editOrderId}`);
        if (!active) return;
        setEditingOrder(order);
        setForm({
          orderNumber: order.orderNumber || order.order_number,
          customerId: order.customer_id || "",
          customerName: order.customerName || order.customer_name || "",
          customerPhone: order.customerPhone || order.customer_phone || "",
          customerAddress: order.customerAddress || order.shipping_address || "",
          customerCity: order.customer_summary?.city || "Dhaka",
          customerZone: "",
          district: "",
          division: "",
          area: "",
          landmark: "",
          warehouseId: order.warehouse_id || "",
          status: order.status,
          paymentStatus: order.payment_status,
          paymentMethod: order.paymentMethod || order.payment_method || "COD",
          channel: order.source || "Facebook",
          notes: order.notes || "",
          tags: order.tags || "",
          courierName: order.courierName || "",
          trackingNumber: order.trackingNumber || "",
          customShipmentNumber: "",
          isExchange: false,
          discount: String(numeric(order.discount)),
          deliveryCharge: String(numeric(order.deliveryCharge ?? order.delivery_charge)),
          paidAmount: String(numeric(order.paidAmount ?? order.paid_amount)),
          items:
            order.items.length > 0
              ? order.items.map((item) =>
                  recalcItem({
                    row_id: `${item.id}-${Math.random().toString(16).slice(2)}`,
                    productId: item.product_id || "",
                    productName: item.product_name,
                    sku: item.sku || "",
                    quantity: String(item.quantity),
                    unitPrice: String(numeric(item.unit_price)),
                    totalPrice: String(numeric(item.total_price)),
                  }),
                )
              : [buildItemRow()],
        });
      } catch (err) {
        setPageError(err instanceof ApiError ? err.message : "Failed to load order for editing");
      }
    }
    void loadEditOrder();
    return () => {
      active = false;
    };
  }, [editOrderId, formMode]);

  useEffect(() => {
    if (formMode === "new") {
      setEditingOrder(null);
      setForm((current) => ({
        ...initialFormState,
        warehouseId:
          current.warehouseId ||
          (warehouses.length === 1 ? warehouses[0].id : ""),
      }));
    }
  }, [formMode, warehouses]);

  useEffect(() => {
    if (form.customerPhone.trim().length < 11) {
      setDuplicateRows([]);
      setDuplicateError("");
      return;
    }

    const timer = window.setTimeout(async () => {
      setDuplicateLoading(true);
      setDuplicateError("");
      try {
        const rows = await api.get<DuplicateRow[]>(
          `/orders/duplicate-check?phone=${encodeURIComponent(form.customerPhone.trim())}&limit=5`,
        );
        setDuplicateRows(
          editingOrder ? rows.filter((row) => row.id !== editingOrder.id) : rows,
        );
      } catch (err) {
        setDuplicateRows([]);
        setDuplicateError(err instanceof ApiError ? err.message : "Failed to check duplicates");
      } finally {
        setDuplicateLoading(false);
      }
    }, 350);

    return () => window.clearTimeout(timer);
  }, [editingOrder, form.customerPhone]);

  const filteredOrders = orders;
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / itemsPerPage));
  const paginatedOrders = useMemo(
    () => filteredOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage),
    [currentPage, filteredOrders],
  );

  const visibleTotalAmount = useMemo(
    () => filteredOrders.reduce((sum, order) => sum + numeric(order.totalAmount ?? order.total), 0),
    [filteredOrders],
  );
  const visiblePendingAmount = useMemo(
    () =>
      filteredOrders
        .filter((order) => order.status === "pending")
        .reduce((sum, order) => sum + numeric(order.totalAmount ?? order.total), 0),
    [filteredOrders],
  );
  const visibleDeliveredAmount = useMemo(
    () =>
      filteredOrders
        .filter((order) => order.status === "delivered")
        .reduce((sum, order) => sum + numeric(order.totalAmount ?? order.total), 0),
    [filteredOrders],
  );

  const selectedRows = useMemo(
    () => orders.filter((order) => selectedIds.includes(order.id)),
    [orders, selectedIds],
  );
  const allVisibleSelected =
    paginatedOrders.length > 0 && paginatedOrders.every((order) => selectedIds.includes(order.id));

  function toggleSelection(orderId: string) {
    setSelectedIds((current) =>
      current.includes(orderId) ? current.filter((id) => id !== orderId) : [...current, orderId],
    );
  }

  function toggleSelectAllVisible() {
    setSelectedIds((current) => {
      if (allVisibleSelected) {
        return current.filter((id) => !paginatedOrders.some((order) => order.id === id));
      }
      const next = new Set(current);
      paginatedOrders.forEach((order) => next.add(order.id));
      return Array.from(next);
    });
  }

  function updateFormItem(rowId: string, updater: (item: OrderItemForm) => OrderItemForm) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => (item.row_id === rowId ? recalcItem(updater(item)) : item)),
    }));
  }

  function addItemRow() {
    setForm((current) => ({ ...current, items: [...current.items, buildItemRow()] }));
  }

  function removeItemRow(rowId: string) {
    setForm((current) => ({
      ...current,
      items: current.items.length === 1 ? [buildItemRow()] : current.items.filter((item) => item.row_id !== rowId),
    }));
  }

  function handleCustomerSelect(customerId: string) {
    const selected = customerMap.get(customerId);
    setForm((current) => ({
      ...current,
      customerId,
      customerName: selected?.name || current.customerName,
      customerPhone: current.customerPhone || selected?.phone || "",
      customerAddress: current.customerAddress || selected?.address || "",
      customerCity: selected?.city || current.customerCity,
    }));
  }

  function handleProductSelect(rowId: string, productId: string) {
    const product = productMap.get(productId);
    updateFormItem(rowId, (item) => ({
      ...item,
      productId,
      productName: product?.name || "",
      sku: product?.sku || "",
      unitPrice: String(numeric(product?.price)),
    }));
  }

  async function submitOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmittingOrder(true);
    setPageError("");
    setPageSuccess("");

    try {
      const validItems = form.items.filter((item) => item.productId && numeric(item.quantity) > 0);
      if (validItems.length === 0) {
        throw new Error("Add at least one order item before saving.");
      }
      if (!form.customerPhone.trim()) {
        throw new Error("Customer phone is required for the v1 workflow.");
      }

      if (editingOrder) {
        await api.patch(`/orders/${editingOrder.id}`, {
          warehouseId: form.warehouseId || null,
          customerName: form.customerName || null,
          customerPhone: form.customerPhone || null,
          customerAddress: form.customerAddress || null,
          notes: form.notes || null,
          tags: form.tags || null,
          status: form.status,
          payment_status: form.paymentStatus,
          paymentMethod: form.paymentMethod || null,
          deliveryCharge: numeric(form.deliveryCharge),
          paidAmount: numeric(form.paidAmount),
        });
        setPageSuccess("Order basics updated successfully.");
      } else {
        await api.post("/orders", {
          orderNumber: form.orderNumber || null,
          customerId: form.customerId || null,
          warehouseId: form.warehouseId || null,
          customerName: form.customerName || null,
          customerPhone: form.customerPhone || null,
          customerAddress: form.customerAddress || null,
          customer_city: form.customerCity || null,
          customer_zone: form.customerZone || null,
          district: form.district || null,
          division: form.division || null,
          area: form.area || null,
          landmark: form.landmark || null,
          paymentMethod: form.paymentMethod || null,
          channel: form.channel,
          status: form.status,
          payment_status: form.paymentStatus,
          notes: form.notes || null,
          tags: form.tags || null,
          courier_name: form.courierName || null,
          tracking_number: form.trackingNumber || null,
          custom_shipment_number: form.customShipmentNumber || null,
          is_exchange: form.isExchange,
          subtotal: formSubtotal,
          discountAmount: numeric(form.discount),
          deliveryCharge: numeric(form.deliveryCharge),
          paidAmount: numeric(form.paidAmount),
          totalAmount: formTotal,
          items: validItems.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            sku: item.sku || null,
            quantity: numeric(item.quantity),
            unitPrice: numeric(item.unitPrice),
            totalPrice: numeric(item.totalPrice),
          })),
        });
        setPageSuccess("Order created successfully.");
      }

      closeFormPanel();
      await refreshOrders(true);
    } catch (err) {
      setPageError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to save order",
      );
    } finally {
      setIsSubmittingOrder(false);
    }
  }

  async function saveModalStatus() {
    if (!detailOrder) return;
    setIsSavingStatus(true);
    setDetailError("");
    setPageSuccess("");
    try {
      const updated = await api.patch<OrderDetail>(`/orders/${detailOrder.id}`, {
        status: modalStatus,
      });
      setDetailOrder(updated);
      setModalStatus(updated.status);
      setPageSuccess("Order status updated successfully.");
      await refreshOrders(true);
    } catch (err) {
      setDetailError(err instanceof ApiError ? err.message : "Failed to update order status");
    } finally {
      setIsSavingStatus(false);
    }
  }

  async function refreshWooOrder() {
    if (!detailOrder) return;
    setIsRefreshingWoo(true);
    setDetailError("");
    try {
      await api.post(`/woocommerce/orders/${detailOrder.id}/refresh`, {});
      await loadOrderDetail(detailOrder.id);
      await refreshOrders(true);
      setPageSuccess("WooCommerce order refreshed safely.");
    } catch (err) {
      setDetailError(err instanceof ApiError ? err.message : "Failed to refresh WooCommerce order");
    } finally {
      setIsRefreshingWoo(false);
    }
  }

  function openShipmentModal(order: OrderDetail) {
    setShipmentForm({
      ...initialShipmentState,
      delivery_charge: String(
        numeric(order.totals_summary?.delivery_charge ?? order.deliveryCharge ?? order.delivery_charge),
      ),
      cod_amount: String(numeric(order.totals_summary?.due_amount ?? order.dueAmount ?? order.due_amount ?? 0)),
      order_status: order.status === "confirmed" || order.status === "processing" ? "ready_to_ship" : order.status,
    });
    setShipmentModalOpen(true);
  }

  async function createShipment() {
    if (!detailOrder) return;
    setIsCreatingShipment(true);
    setDetailError("");
    try {
      await api.post(`/orders/${detailOrder.id}/create-shipment`, {
        courier_id: shipmentForm.courier_id,
        tracking_number: shipmentForm.tracking_number || null,
        delivery_charge: numeric(shipmentForm.delivery_charge),
        courier_charge: numeric(shipmentForm.courier_charge),
        cod_amount: numeric(shipmentForm.cod_amount),
        collected_amount: numeric(shipmentForm.collected_amount),
        notes: shipmentForm.notes || null,
        order_status: shipmentForm.order_status || null,
      });
      setShipmentModalOpen(false);
      await loadOrderDetail(detailOrder.id);
      await refreshOrders(true);
      setPageSuccess("Shipment created successfully.");
    } catch (err) {
      setDetailError(err instanceof ApiError ? err.message : "Failed to create shipment");
    } finally {
      setIsCreatingShipment(false);
    }
  }

  async function markPrintedFromModal() {
    if (!detailOrder) return;
    setIsMarkingPrinted(true);
    setDetailError("");
    try {
      const updated = await api.post<OrderDetail>(`/orders/${detailOrder.id}/mark-printed`);
      setDetailOrder(updated);
      await refreshOrders(true);
      setPageSuccess("Print tracking updated.");
    } catch (err) {
      setDetailError(err instanceof ApiError ? err.message : "Failed to update print tracking");
    } finally {
      setIsMarkingPrinted(false);
    }
  }

  async function runBatchStatusUpdate() {
    if (selectedIds.length === 0) return;
    setIsBatchRunning(true);
    setPageError("");
    try {
      await api.post("/orders/batch-actions", {
        action: "update_status",
        order_ids: selectedIds,
        options: { status: batchStatus },
      });
      setPageSuccess(`Updated selected orders to ${formatLabel(batchStatus)}.`);
      await refreshOrders(true);
      setSelectedIds([]);
    } catch (err) {
      setPageError(err instanceof ApiError ? err.message : "Failed to update selected orders");
    } finally {
      setIsBatchRunning(false);
    }
  }

  async function runBatchMarkPrinted() {
    if (selectedIds.length === 0) return;
    setIsBatchRunning(true);
    setPageError("");
    try {
      await api.post("/orders/batch-actions", {
        action: "mark_printed",
        order_ids: selectedIds,
      });
      setPageSuccess("Marked selected orders as printed.");
      await refreshOrders(true);
      setSelectedIds([]);
    } catch (err) {
      setPageError(err instanceof ApiError ? err.message : "Failed to mark selected orders as printed");
    } finally {
      setIsBatchRunning(false);
    }
  }

  function openInvoice(orderId: string) {
    window.open(`/dashboard/orders/${orderId}/invoice`, "_blank", "noopener,noreferrer");
  }

  async function copyPrintLinks() {
    if (selectedRows.length === 0) return;
    try {
      await navigator.clipboard.writeText(
        selectedRows
          .map((order) => `${window.location.origin}/dashboard/orders/${order.id}/invoice`)
          .join("\n"),
      );
      setPageSuccess("Copied print links for the selected orders.");
    } catch {
      setPageError("Could not copy invoice links from this browser session.");
    }
  }

  function exportFilteredCsv() {
    downloadCsv(
      `orders-${Date.now()}.csv`,
      [
        "order_number",
        "customer_name",
        "customer_phone",
        "customer_address",
        "status",
        "payment_status",
        "source",
        "total",
        "printed_count",
        "courier_name",
        "tracking_number",
        "created_at",
      ],
      filteredOrders.map((order) => [
        order.orderNumber,
        order.customerName || order.customer_name || "",
        order.customerPhone || order.customer_phone || "",
        order.customerAddress || order.shipping_address || "",
        order.status,
        order.payment_status,
        order.source,
        order.totalAmount ?? order.total,
        order.printed_count,
        order.courierName || "",
        order.trackingNumber || "",
        order.createdAt,
      ]),
    );
  }

  function exportDispatchCsv() {
    const rows = filteredOrders.filter(
      (order) =>
        ["confirmed", "processing", "ready_to_ship"].includes(order.status) &&
        !order.shipment_summary,
    );
    downloadCsv(
      `dispatch-ready-${Date.now()}.csv`,
      ["order_number", "customer", "phone", "warehouse", "payment_status", "source", "notes", "tags"],
      rows.map((order) => [
        order.orderNumber,
        order.customerName || order.customer_name || "",
        order.customerPhone || order.customer_phone || "",
        order.warehouse_summary?.name || warehouseMap.get(order.warehouse_id || "")?.name || "",
        order.payment_status,
        order.source,
        order.notes || "",
        order.tags || "",
      ]),
    );
  }

  function statusTabCount(tab: string) {
    if (!summary) return 0;
    if (tab === "all") return summary.total_orders;
    if (tab === "pending") return summary.pending_orders;
    if (tab === "confirmed") return summary.confirmed_orders;
    if (tab === "processing") return summary.processing_orders;
    if (tab === "ready_to_ship") return summary.ready_to_ship_orders_count;
    if (tab === "shipped") return summary.shipped_orders_count;
    if (tab === "delivered") return summary.delivered_orders_count;
    if (tab === "cancelled") return summary.cancelled_orders_count;
    if (tab === "returned") return summary.returned_orders_count;
    if (tab === "partial_delivered") return summary.partial_delivered_orders;
    if (tab === "urgent") return summary.urgent_orders;
    if (tab === "hold") return summary.hold_orders;
    return 0;
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="card-base p-8">
          <div className="flex items-center gap-4">
            <Loader2 className="h-7 w-7 animate-spin text-[var(--color-txt-mut)]" />
            <div>
              <p className="ops-micro-label">Orders Sync</p>
              <p className="mt-1 text-sm font-semibold text-[var(--color-txt-pri)]">Syncing orders cockpit...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full overflow-x-hidden px-1 pb-4">
      <div className="mx-auto max-w-[1600px] space-y-8">
        <section className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-[var(--color-txt-pri)] sm:text-4xl">Order Flows</h1>
            <p className="text-sm font-medium text-[var(--color-txt-sec)]">
              Execute and track multi-channel fulfillment across your entire retail network.
            </p>
          </div>

          <div className="flex w-full flex-wrap items-center gap-3 xl:w-auto xl:justify-end">
            <div className="flex items-center gap-2 rounded-lg border border-[var(--color-brd)] bg-[var(--color-surf)] px-3 py-2 shadow-subtle">
              <Calendar className="h-4 w-4 text-[var(--color-txt-mut)]" />
              <select
                value={datePreset}
                onChange={(event) => setDatePreset(event.target.value as "all" | "today" | "month" | "custom")}
                className="bg-transparent text-sm font-semibold text-[var(--color-txt-pri)] outline-none"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="month">This Month</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            {datePreset === "month" ? (
              <input
                type="month"
                value={monthFilter}
                onChange={(event) => setMonthFilter(event.target.value)}
                className="rounded-lg border border-[var(--color-brd)] bg-[var(--color-surf)] px-3 py-2 text-sm font-semibold text-[var(--color-txt-pri)] shadow-subtle outline-none"
              />
            ) : null}
            {datePreset === "custom" ? (
              <>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => setDateFrom(event.target.value)}
                  className="rounded-lg border border-[var(--color-brd)] bg-[var(--color-surf)] px-3 py-2 text-sm font-semibold text-[var(--color-txt-pri)] shadow-subtle outline-none"
                />
                <input
                  type="date"
                  value={dateTo}
                  onChange={(event) => setDateTo(event.target.value)}
                  className="rounded-lg border border-[var(--color-brd)] bg-[var(--color-surf)] px-3 py-2 text-sm font-semibold text-[var(--color-txt-pri)] shadow-subtle outline-none"
                />
              </>
            ) : null}

            <button
              onClick={exportFilteredCsv}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--color-brd)] bg-[var(--color-surf)] text-[var(--color-txt-sec)] shadow-subtle transition hover:bg-[var(--color-surf-hover)] hover:text-[var(--color-txt-pri)]"
              title="Export CSV"
            >
              <Download className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-1 rounded-lg border border-[var(--color-brd)] bg-[var(--color-surf)] p-1 shadow-subtle">
              <button
                onClick={() => setViewMode("table")}
                className={`rounded-md p-2 transition ${viewMode === "table" ? "bg-[var(--color-surf-hover)] text-[var(--color-txt-pri)]" : "text-[var(--color-txt-mut)]"}`}
              >
                <List className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`rounded-md p-2 transition ${viewMode === "grid" ? "bg-[var(--color-surf-hover)] text-[var(--color-txt-pri)]" : "text-[var(--color-txt-mut)]"}`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>

            <button
              onClick={openNewOrderPanel}
              className="inline-flex items-center gap-2 rounded-lg bg-[#1C2032] px-5 py-2.5 text-sm font-semibold text-white shadow-subtle transition hover:bg-[#2A2F45]"
            >
              <Plus className="h-4 w-4" />
              New Order
            </button>
          </div>
        </section>

        {pageError ? (
          <div className="rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {pageError}
          </div>
        ) : null}
        {pageSuccess ? (
          <div className="rounded-[20px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {pageSuccess}
          </div>
        ) : null}

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Total Orders" value={summary?.total_orders || 0} amount={visibleTotalAmount} icon={Package} accent="text-[#065F6B]" />
          <SummaryCard label="Completed Orders" value={summary?.delivered_orders_count || 0} amount={visibleDeliveredAmount} icon={PackageCheck} accent="text-[#1B9D33]" />
          <SummaryCard label="Pending Orders" value={summary?.pending_orders || 0} amount={visiblePendingAmount} icon={Clock3} accent="text-[#E57A21]" />
          <SummaryCard label="Cancelled Orders" value={summary?.cancelled_orders_count || 0} icon={PackageX} accent="text-[#845BC3]" />
        </section>

        <section className="space-y-4">
          <div className="flex h-14 items-center rounded-[20px] border border-[var(--color-brd)] bg-[var(--color-surf)] p-2 shadow-subtle">
            <div className="flex w-12 items-center justify-center text-[var(--color-txt-mut)]">
              <Search className="h-4.5 w-4.5" />
            </div>
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search orders..."
              className="min-w-0 flex-1 bg-transparent text-sm text-[var(--color-txt-pri)] outline-none placeholder:text-[var(--color-txt-mut)]"
            />
            <div className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--color-txt-sec)] transition hover:bg-[var(--color-surf-hover)]">
              <Filter className="h-4.5 w-4.5" />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 overflow-x-auto rounded-[20px] border border-[var(--color-brd)] bg-[var(--color-surf)] p-2 shadow-subtle">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-[0.14em] transition ${
                  activeTab === tab
                    ? "bg-[#1C2032] text-white"
                    : "bg-[var(--color-surf-hover)] text-[var(--color-txt-sec)] hover:bg-white"
                }`}
              >
                <span>{tab === "all" ? "All Orders" : formatLabel(tab)}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] ${activeTab === tab ? "bg-white/15 text-white" : "bg-white text-[var(--color-txt-pri)]"}`}>
                  {statusTabCount(tab)}
                </span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 rounded-[20px] border border-[var(--color-brd)] bg-[var(--color-surf)] p-4 shadow-subtle lg:grid-cols-6">
            <select value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)} className="rounded-xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-3 py-2.5 text-sm font-semibold text-[var(--color-txt-pri)] outline-none">
              <option value="">All Payments</option>
              {PAYMENT_STATUSES.map((item) => (
                <option key={item} value={item}>{formatLabel(item)}</option>
              ))}
            </select>
            <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} className="rounded-xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-3 py-2.5 text-sm font-semibold text-[var(--color-txt-pri)] outline-none">
              <option value="">All Sources</option>
              {[...SOURCE_OPTIONS, "woocommerce"].map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
            <select value={warehouseFilter} onChange={(event) => setWarehouseFilter(event.target.value)} className="rounded-xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-3 py-2.5 text-sm font-semibold text-[var(--color-txt-pri)] outline-none">
              <option value="">All Warehouses</option>
              {warehouses.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
            <select value={printedFilter} onChange={(event) => setPrintedFilter(event.target.value)} className="rounded-xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-3 py-2.5 text-sm font-semibold text-[var(--color-txt-pri)] outline-none">
              <option value="">Print State</option>
              <option value="true">Printed</option>
              <option value="false">Unprinted</option>
            </select>
            <select value={hasShipmentFilter} onChange={(event) => setHasShipmentFilter(event.target.value)} className="rounded-xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-3 py-2.5 text-sm font-semibold text-[var(--color-txt-pri)] outline-none">
              <option value="">Shipment State</option>
              <option value="true">Has Shipment</option>
              <option value="false">No Shipment</option>
            </select>
            <div className="flex gap-2">
              <button onClick={exportDispatchCsv} className="flex-1 rounded-xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-3 py-2.5 text-sm font-semibold text-[var(--color-txt-pri)] transition hover:bg-white">
                Dispatch CSV
              </button>
              <button onClick={() => void refreshOrders(true)} className="rounded-xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-3 py-2.5 text-sm font-semibold text-[var(--color-txt-pri)] transition hover:bg-white">
                {isRefreshingList ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
              </button>
            </div>
          </div>

          {selectedIds.length > 0 ? (
            <div className="flex flex-col gap-3 rounded-[20px] border border-[var(--color-brd)] bg-[var(--color-surf)] p-4 shadow-subtle lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[var(--color-txt-pri)]">
                <span>{selectedIds.length} selected</span>
                <button onClick={runBatchMarkPrinted} className="rounded-full bg-[var(--color-surf-hover)] px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--color-txt-pri)]">
                  Mark Printed
                </button>
                <button onClick={copyPrintLinks} className="rounded-full bg-[var(--color-surf-hover)] px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--color-txt-pri)]">
                  Copy Print Links
                </button>
                <button
                  onClick={() => selectedRows.forEach((row) => openInvoice(row.id))}
                  className="rounded-full bg-[var(--color-surf-hover)] px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--color-txt-pri)]"
                >
                  Print Selected
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={batchStatus}
                  onChange={(event) => setBatchStatus(event.target.value)}
                  className="rounded-xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-3 py-2.5 text-sm font-semibold text-[var(--color-txt-pri)] outline-none"
                >
                  {EDITABLE_STATUSES.map((item) => (
                    <option key={item} value={item}>{formatLabel(item)}</option>
                  ))}
                </select>
                <button
                  onClick={runBatchStatusUpdate}
                  disabled={isBatchRunning}
                  className="rounded-xl bg-[#1C2032] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2A2F45] disabled:opacity-60"
                >
                  {isBatchRunning ? "Updating..." : "Update Status"}
                </button>
              </div>
            </div>
          ) : null}
        </section>

        {viewMode === "table" ? (
          <section className="rounded-[20px] border border-[var(--color-brd)] bg-[var(--color-surf)] shadow-subtle">
            <div className="overflow-x-auto pb-2">
              <table className="min-w-[980px] w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-[var(--color-brd)]">
                    <th className="px-4 py-5">
                      <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAllVisible} className="h-4 w-4 rounded border-[var(--color-brd)]" />
                    </th>
                    <th className="px-3 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--color-txt-sec)]">Order Id</th>
                    <th className="px-3 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--color-txt-sec)]">Customer</th>
                    <th className="px-3 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--color-txt-sec)]">Item Qty</th>
                    <th className="px-3 py-4 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--color-txt-sec)]">Bill</th>
                    <th className="px-3 py-4 text-center text-[10px] font-black uppercase tracking-[0.18em] text-[var(--color-txt-sec)]">Status</th>
                    <th className="px-3 py-4 text-center text-[10px] font-black uppercase tracking-[0.18em] text-[var(--color-txt-sec)]">Sh No</th>
                    <th className="px-3 py-4 text-right text-[10px] font-black uppercase tracking-[0.18em] text-[var(--color-txt-sec)]">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-brd)]">
                  {paginatedOrders.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-8 py-20 text-center">
                        <div className="flex flex-col items-center gap-4">
                          <PackageOpen className="h-10 w-10 text-[var(--color-txt-mut)]" />
                          <p className="text-sm font-medium text-[var(--color-txt-sec)]">No transactions match your current lens.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedOrders.map((order) => {
                      const dueValue = numeric(order.dueAmount ?? order.due_amount);
                      const canShip = !order.shipment_summary && ["confirmed", "processing", "ready_to_ship", "pending"].includes(order.status);
                      return (
                        <tr key={order.id} className="transition hover:bg-[var(--color-surf-hover)]/50">
                          <td className="px-4 py-4">
                            <input type="checkbox" checked={selectedIds.includes(order.id)} onChange={() => toggleSelection(order.id)} className="h-4 w-4 rounded border-[var(--color-brd)]" />
                          </td>
                          <td className="px-3 py-4">
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-2">
                                <button onClick={() => openDetailModal(order.id)} className="text-sm font-bold text-[var(--color-txt-pri)] hover:text-[var(--color-accent)]">
                                  #{order.orderNumber}
                                </button>
                                {order.source?.toLowerCase() === "woocommerce" ? (
                                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.14em] text-blue-700">Woo</span>
                                ) : null}
                              </div>
                              <div className="text-[11px] font-medium text-[var(--color-txt-sec)]">{formatDate(order.createdAt)}</div>
                            </div>
                          </td>
                          <td className="px-3 py-4">
                            <div className="space-y-1.5">
                              <div className="text-sm font-semibold text-[var(--color-txt-pri)]">{order.customerName || order.customer_name || "Walk-in Customer"}</div>
                              <div className="flex items-center gap-2 text-xs font-medium text-[var(--color-txt-sec)]">
                                <Phone className="h-3.5 w-3.5" />
                                {order.customerPhone || order.customer_phone || "No phone"}
                              </div>
                              {order.customerPhone || order.customer_phone ? (
                                <a
                                  href={`https://wa.me/88${(order.customerPhone || order.customer_phone || "").replace(/\D/g, "")}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:text-emerald-700"
                                >
                                  <MessageSquare className="h-3.5 w-3.5" />
                                  WhatsApp
                                </a>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-3 py-4">
                            <div className="space-y-1.5">
                              <div className="text-sm font-bold text-[var(--color-txt-pri)]">{order.item_count || order.items.length} Products</div>
                              <div className="max-w-[180px] truncate text-[11px] font-medium text-[var(--color-txt-sec)]">
                                {order.first_item_summary?.product_name || order.items[0]?.product_name || "Direct Item"}
                                {(order.item_count || order.items.length) > 1 ? ", ..." : ""}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-4">
                            <div className="space-y-1.5">
                              <div className="text-sm font-bold text-[var(--color-txt-pri)]">{formatCurrency(order.totalAmount ?? order.total)}</div>
                              {dueValue > 0 ? (
                                <div className="text-xs font-bold text-[#FF6347]">Due: {formatCurrency(dueValue)}</div>
                              ) : (
                                <div className="text-xs font-semibold text-emerald-600">Paid / Settled</div>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-4 text-center">
                            <div className="space-y-2">
                              <StatusPill status={order.status} />
                              <div className="flex justify-center">
                                <PaymentPill value={order.payment_status} />
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-4 text-center">
                            {order.shipment_summary ? (
                              <div className="space-y-1">
                                <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--color-txt-pri)]">
                                  {order.shipment_summary.shipment_number}
                                </div>
                                <div className="text-[11px] font-medium text-[var(--color-txt-sec)]">
                                  {order.trackingNumber || "Tracking pending"}
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs font-medium text-[var(--color-txt-mut)]">No shipment</span>
                            )}
                          </td>
                          <td className="px-3 py-4">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => openDetailModal(order.id)} className="rounded-lg border border-transparent p-2 text-[var(--color-txt-sec)] transition hover:border-[var(--color-brd)] hover:bg-[var(--color-surf-hover)] hover:text-[var(--color-txt-pri)]" title="View Order">
                                <Eye className="h-4 w-4" />
                              </button>
                              <button onClick={() => openInvoice(order.id)} className="rounded-lg border border-transparent p-2 text-[var(--color-txt-sec)] transition hover:border-[var(--color-brd)] hover:bg-[var(--color-surf-hover)] hover:text-[var(--color-txt-pri)]" title="Print Invoice">
                                <Printer className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => {
                                  openDetailModal(order.id);
                                  setTimeout(() => {
                                    const detail = orders.find((item) => item.id === order.id);
                                    if (detail) {
                                      setShipmentForm((current) => ({
                                        ...current,
                                        delivery_charge: String(numeric(detail.deliveryCharge ?? detail.delivery_charge)),
                                        cod_amount: String(numeric(detail.dueAmount ?? detail.due_amount ?? detail.totalAmount ?? detail.total)),
                                      }));
                                      setShipmentModalOpen(true);
                                    }
                                  }, 100);
                                }}
                                disabled={!canShip}
                                className="rounded-lg border border-transparent p-2 text-[var(--color-txt-sec)] transition hover:border-[var(--color-brd)] hover:bg-[var(--color-surf-hover)] hover:text-[var(--color-txt-pri)] disabled:cursor-not-allowed disabled:opacity-40"
                                title="Ship Order"
                              >
                                <Truck className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => openEditOrderPanel(order.id)}
                                disabled={order.source?.toLowerCase() === "woocommerce"}
                                className="rounded-lg border border-transparent p-2 text-[var(--color-txt-sec)] transition hover:border-[var(--color-brd)] hover:bg-[var(--color-surf-hover)] hover:text-[var(--color-txt-pri)] disabled:cursor-not-allowed disabled:opacity-40"
                                title="Edit Order"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : (
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {paginatedOrders.map((order) => (
              <div key={order.id} className="rounded-[24px] border border-[var(--color-brd)] bg-[var(--color-surf)] p-5 shadow-subtle">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <button onClick={() => openDetailModal(order.id)} className="text-base font-bold text-[var(--color-txt-pri)] hover:text-[var(--color-accent)]">
                      #{order.orderNumber}
                    </button>
                    <p className="mt-1 text-xs font-medium text-[var(--color-txt-sec)]">{formatDate(order.createdAt)}</p>
                  </div>
                  <StatusPill status={order.status} />
                </div>

                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-[var(--color-surf-hover)] p-2 text-[var(--color-txt-sec)]">
                      <User className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[var(--color-txt-pri)]">{order.customerName || order.customer_name || "Walk-in Customer"}</p>
                      <p className="text-xs text-[var(--color-txt-sec)]">{order.customerPhone || order.customer_phone || "No phone"}</p>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-[var(--color-surf-hover)] p-4">
                    <p className="ops-micro-label">First Item</p>
                    <p className="mt-2 text-sm font-semibold text-[var(--color-txt-pri)]">
                      {order.first_item_summary?.product_name || order.items[0]?.product_name || "Direct Item"}
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-txt-sec)]">{order.item_count || order.items.length} total items</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="ops-micro-label">Bill</p>
                      <p className="mt-1 text-lg font-bold text-[var(--color-txt-pri)]">{formatCurrency(order.totalAmount ?? order.total)}</p>
                    </div>
                    <PaymentPill value={order.payment_status} />
                  </div>
                  <SourcePill source={order.source} externalStatus={order.external_status} />
                </div>

                <div className="mt-5 flex items-center justify-between gap-2">
                  <button onClick={() => openDetailModal(order.id)} className="inline-flex items-center gap-2 rounded-full bg-[#1C2032] px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-white">
                    <Eye className="h-3.5 w-3.5" />
                    View
                  </button>
                  <button onClick={() => openInvoice(order.id)} className="rounded-full bg-[var(--color-surf-hover)] p-2.5 text-[var(--color-txt-sec)]">
                    <Printer className="h-4 w-4" />
                  </button>
                  <button onClick={() => openEditOrderPanel(order.id)} className="rounded-full bg-[var(--color-surf-hover)] p-2.5 text-[var(--color-txt-sec)]">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => openDetailModal(order.id)} className="rounded-full bg-[var(--color-surf-hover)] p-2.5 text-[var(--color-txt-sec)]">
                    <Truck className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </section>
        )}

        {totalPages > 1 ? (
          <section className="flex flex-col gap-4 py-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--color-txt-mut)]">
              Phase <span className="text-[var(--color-txt-pri)]">{(currentPage - 1) * itemsPerPage + 1}</span> -
              <span className="text-[var(--color-txt-pri)]"> {Math.min(currentPage * itemsPerPage, filteredOrders.length)}</span> of {filteredOrders.length}
            </div>
            <div className="flex items-center gap-1 rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf)] p-1.5 shadow-subtle">
              <button onClick={() => setCurrentPage((current) => Math.max(1, current - 1))} disabled={currentPage === 1} className="rounded-xl px-3 py-2 text-sm font-semibold text-[var(--color-txt-sec)] disabled:opacity-30">
                Prev
              </button>
              {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${page === currentPage ? "bg-[#1C2032] text-white" : "text-[var(--color-txt-sec)]"}`}
                >
                  {page}
                </button>
              ))}
              <button onClick={() => setCurrentPage((current) => Math.min(totalPages, current + 1))} disabled={currentPage === totalPages} className="rounded-xl px-3 py-2 text-sm font-semibold text-[var(--color-txt-sec)] disabled:opacity-30">
                Next
              </button>
            </div>
          </section>
        ) : null}
      </div>

      {detailOrderId ? (
        <Overlay onClose={closeDetailModal} wide>
          <div className="flex max-h-[94vh] flex-col">
            <div className="sticky top-0 z-20 flex items-center justify-between border-b border-[var(--color-brd)] bg-[var(--color-surf)]/95 px-5 py-4 backdrop-blur-md sm:px-8">
              <div className="flex min-w-0 items-center gap-4">
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${statusMeta(detailOrder?.status || "pending").className}`}>
                  {(() => {
                    const Icon = statusMeta(detailOrder?.status || "pending").icon;
                    return <Icon className="h-5 w-5" />;
                  })()}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-lg font-bold text-[var(--color-txt-pri)]">
                      #{detailOrder?.orderNumber || detailOrderId}
                    </h3>
                    {detailOrder ? <StatusPill status={detailOrder.status} /> : null}
                  </div>
                  <p className="mt-1 text-xs font-medium text-[var(--color-txt-sec)]">
                    {detailOrder?.createdAt ? `Placed on ${formatDateTime(detailOrder.createdAt)}` : "Loading order detail"}
                  </p>
                </div>
              </div>
              <button onClick={closeDetailModal} className="rounded-xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] p-2 text-[var(--color-txt-sec)] transition hover:text-[var(--color-txt-pri)]">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="dashboard-scrollbar flex-1 overflow-y-auto">
              {detailLoading ? (
                <div className="flex items-center gap-3 px-8 py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-[var(--color-txt-mut)]" />
                  <span className="text-sm font-semibold text-[var(--color-txt-sec)]">Loading order detail...</span>
                </div>
              ) : detailError ? (
                <div className="px-8 py-8">
                  <div className="rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{detailError}</div>
                </div>
              ) : detailOrder ? (
                <div className="grid grid-cols-1 gap-0 lg:grid-cols-12 lg:divide-x lg:divide-[var(--color-brd)]">
                  <div className="space-y-8 p-5 sm:p-8 lg:col-span-8">
                    <div className="rounded-[24px] border border-[var(--color-brd)] bg-[var(--color-surf-hover)]/60 p-5">
                      <div className="flex min-w-[520px] items-center justify-between gap-2 overflow-x-auto">
                        {["pending", "confirmed", "processing", "shipped", "delivered"].map((step, index, steps) => {
                          const currentIndex = steps.indexOf((detailOrder.status || "").toLowerCase());
                          const active = currentIndex >= index;
                          const current = detailOrder.status.toLowerCase() === step;
                          return (
                            <div key={step} className="flex flex-1 items-center gap-2">
                              <div className="flex flex-col items-center gap-2">
                                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${current ? "bg-[var(--color-accent)] text-white ring-4 ring-blue-100" : active ? "bg-slate-900 text-white" : "bg-white text-[var(--color-txt-mut)] border border-[var(--color-brd)]"}`}>
                                  {current || active ? <CheckCircle2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
                                </div>
                                <span className={`text-[9px] font-black uppercase tracking-[0.14em] ${active ? "text-[var(--color-txt-pri)]" : "text-[var(--color-txt-mut)]"}`}>{formatLabel(step)}</span>
                              </div>
                              {index < steps.length - 1 ? <div className={`h-0.5 flex-1 rounded-full ${active && currentIndex > index ? "bg-slate-900" : "bg-slate-200"}`} /> : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--color-txt-mut)]">Order Items</h4>
                        <span className="rounded-full bg-[var(--color-surf-hover)] px-2 py-1 text-[10px] font-bold text-[var(--color-txt-sec)]">
                          {detailOrder.items.length} Products
                        </span>
                      </div>
                      <div className="divide-y divide-[var(--color-brd)]">
                        {detailOrder.items.map((item) => (
                          <div key={item.id} className="flex items-center gap-4 py-4">
                            <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] text-[var(--color-txt-mut)]">
                              <Package className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-bold text-[var(--color-txt-pri)]">{item.product_name}</p>
                              <p className="mt-1 text-xs font-medium text-[var(--color-txt-sec)]">
                                {item.sku || "No SKU"} / Quantity {item.quantity}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-[var(--color-txt-pri)]">{formatCurrency(item.total_price)}</p>
                              <p className="text-[10px] font-medium text-[var(--color-txt-sec)]">@ {formatCurrency(item.unit_price)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {detailOrder.notes ? (
                      <div className="rounded-[24px] border border-[var(--color-accent)]/10 bg-[var(--color-accent)]/5 p-5">
                        <div className="mb-3 flex items-center gap-2">
                          <Pencil className="h-4 w-4 text-[var(--color-accent)]" />
                          <h4 className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--color-accent)]">Order Note</h4>
                        </div>
                        <p className="text-sm font-medium leading-relaxed text-[var(--color-txt-pri)]/80">{detailOrder.notes}</p>
                      </div>
                    ) : null}

                    <div className="rounded-[24px] border border-[var(--color-brd)] bg-[var(--color-surf)] p-5 shadow-subtle">
                      <div className="mb-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Truck className="h-4 w-4 text-emerald-600" />
                          <h4 className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--color-txt-mut)]">Logistics</h4>
                        </div>
                        <span className="text-sm font-bold text-emerald-600">
                          {formatCurrency(detailOrder.totals_summary?.delivery_charge ?? detailOrder.deliveryCharge ?? detailOrder.delivery_charge)}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl bg-[var(--color-surf-hover)] p-4">
                          <p className="ops-micro-label">Courier</p>
                          <p className="mt-2 text-sm font-semibold text-[var(--color-txt-pri)]">{detailOrder.courierName || "Standard Shipping"}</p>
                        </div>
                        <div className="rounded-2xl bg-[var(--color-surf-hover)] p-4">
                          <p className="ops-micro-label">Tracking</p>
                          <p className="mt-2 text-sm font-semibold text-[var(--color-txt-pri)]">{detailOrder.trackingNumber || "Not assigned yet"}</p>
                        </div>
                        {detailOrder.shipment_summary ? (
                          <>
                            <div className="rounded-2xl bg-[var(--color-surf-hover)] p-4">
                              <p className="ops-micro-label">Shipment Number</p>
                              <p className="mt-2 text-sm font-semibold text-[var(--color-txt-pri)]">{detailOrder.shipment_summary.shipment_number}</p>
                            </div>
                            <div className="rounded-2xl bg-[var(--color-surf-hover)] p-4">
                              <p className="ops-micro-label">Shipment Status</p>
                              <p className="mt-2 text-sm font-semibold text-[var(--color-txt-pri)]">{formatLabel(detailOrder.shipment_summary.status)}</p>
                            </div>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-8 bg-[var(--color-surf-hover)]/30 p-5 sm:p-8 lg:col-span-4">
                    <div className="space-y-5">
                      <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--color-accent)]">
                        <User className="h-3.5 w-3.5" />
                        Customer Details
                      </h4>
                      <div className="space-y-4">
                        <div className="flex gap-4">
                          <div className="rounded-xl border border-[var(--color-brd)] bg-[var(--color-surf)] p-3 text-[var(--color-txt-sec)]">
                            <User className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[var(--color-txt-mut)]">Full Name</p>
                            <p className="mt-1 text-sm font-bold text-[var(--color-txt-pri)]">{detailOrder.customer_summary?.name || detailOrder.customerName}</p>
                          </div>
                        </div>
                        <div className="flex gap-4">
                          <div className="rounded-xl border border-[var(--color-brd)] bg-[var(--color-surf)] p-3 text-[var(--color-txt-sec)]">
                            <Phone className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[var(--color-txt-mut)]">Phone Number</p>
                            <p className="mt-1 text-sm font-bold text-[var(--color-txt-pri)]">{detailOrder.customer_summary?.phone || detailOrder.customerPhone}</p>
                          </div>
                        </div>
                        <div className="flex gap-4">
                          <div className="rounded-xl border border-[var(--color-brd)] bg-[var(--color-surf)] p-3 text-[var(--color-txt-sec)]">
                            <Warehouse className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[var(--color-txt-mut)]">Warehouse</p>
                            <p className="mt-1 text-sm font-bold text-[var(--color-txt-pri)]">
                              {detailOrder.warehouse_summary?.name || detailOrder.warehouse?.name || "Not assigned"}
                            </p>
                            <p className="text-xs font-medium text-[var(--color-txt-sec)]">
                              {detailOrder.warehouse_summary?.code || detailOrder.warehouse?.code || "No code"}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-4">
                          <div className="rounded-xl border border-[var(--color-brd)] bg-[var(--color-surf)] p-3 text-[var(--color-txt-sec)]">
                            <Globe className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[var(--color-txt-mut)]">Delivery Address</p>
                            <p className="mt-1 text-sm font-medium leading-relaxed text-[var(--color-txt-pri)]/85">
                              {detailOrder.shipping_summary?.address || detailOrder.customerAddress || "No address"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 rounded-[24px] border border-[var(--color-brd)] bg-[var(--color-surf)] p-5 shadow-subtle">
                      <div className="flex items-center justify-between text-[11px] font-bold text-[var(--color-txt-sec)]">
                        <span>Subtotal</span>
                        <span className="text-[var(--color-txt-pri)]">{formatCurrency(detailOrder.totals_summary?.subtotal ?? detailOrder.subtotal)}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] font-bold text-[var(--color-txt-sec)]">
                        <span>Shipping</span>
                        <span className="text-[var(--color-txt-pri)]">{formatCurrency(detailOrder.totals_summary?.delivery_charge ?? detailOrder.deliveryCharge ?? detailOrder.delivery_charge)}</span>
                      </div>
                      {numeric(detailOrder.totals_summary?.discount ?? detailOrder.discount) > 0 ? (
                        <div className="flex items-center justify-between text-[11px] font-bold text-emerald-600">
                          <span>Discount</span>
                          <span>-{formatCurrency(detailOrder.totals_summary?.discount ?? detailOrder.discount)}</span>
                        </div>
                      ) : null}
                      <div className="h-px bg-[var(--color-brd)]" />
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase text-[var(--color-txt-pri)]">Order Total</span>
                        <span className="text-lg font-black text-[var(--color-accent)]">{formatCurrency(detailOrder.totals_summary?.total ?? detailOrder.totalAmount ?? detailOrder.total)}</span>
                      </div>
                      <div className="flex items-center justify-between border-t border-[var(--color-brd)] pt-4">
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[var(--color-txt-mut)]">Due Amount</p>
                          <p className={`mt-1 text-xl font-black ${numeric(detailOrder.totals_summary?.due_amount ?? detailOrder.dueAmount ?? detailOrder.due_amount) > 0 ? "text-orange-500" : "text-emerald-600"}`}>
                            {formatCurrency(detailOrder.totals_summary?.due_amount ?? detailOrder.dueAmount ?? detailOrder.due_amount)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[var(--color-txt-mut)]">Paid</p>
                          <p className="mt-1 text-sm font-bold text-[var(--color-txt-pri)]">{formatCurrency(detailOrder.totals_summary?.paid_amount ?? detailOrder.paidAmount ?? detailOrder.paid_amount)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--color-txt-mut)]">
                          <Clock3 className="h-3.5 w-3.5" />
                          Recent History
                        </h4>
                        <span className="text-[10px] font-bold text-[var(--color-txt-mut)]">{detailOrder.logs.length} Total</span>
                      </div>
                      <div className="max-h-[220px] space-y-3 overflow-y-auto">
                        {detailOrder.logs.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-[var(--color-brd)] bg-[var(--color-surf)] px-4 py-6 text-center text-[11px] font-semibold text-[var(--color-txt-mut)]">
                            No history yet
                          </div>
                        ) : (
                          detailOrder.logs.slice(0, 6).map((log) => (
                            <div key={log.id} className="rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf)] p-3">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-[11px] font-bold text-[var(--color-txt-pri)]">{formatLabel(log.action)}</p>
                                <span className="text-[10px] font-medium text-[var(--color-txt-mut)]">{formatDate(log.timestamp)}</span>
                              </div>
                              <p className="mt-2 text-xs font-medium leading-relaxed text-[var(--color-txt-sec)]">{log.details}</p>
                              {log.user ? <p className="mt-2 text-[10px] font-semibold text-[var(--color-txt-mut)]">{log.user}</p> : null}
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="space-y-3 rounded-[24px] border border-[var(--color-brd)] bg-[var(--color-surf)] p-5 shadow-subtle">
                      <div className="flex items-center justify-between">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--color-txt-mut)]">Order Controls</h4>
                        <div className="text-xs font-semibold text-[var(--color-txt-sec)]">
                          {detailOrder.stock_deducted ? "Stock deducted" : "Stock pending"}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3">
                        <select
                          value={modalStatus}
                          onChange={(event) => setModalStatus(event.target.value)}
                          className="rounded-xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-3 py-2.5 text-sm font-semibold text-[var(--color-txt-pri)] outline-none"
                        >
                          {EDITABLE_STATUSES.map((item) => (
                            <option key={item} value={item}>{formatLabel(item)}</option>
                          ))}
                        </select>
                        {detailOrder.action_flags.can_deduct_stock_by_status || (!detailOrder.stock_deducted && (modalStatus === "shipped" || modalStatus === "delivered")) ? (
                          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
                            Moving this order into a fulfilled state will follow the existing stock-deduction safety rule.
                          </div>
                        ) : null}
                        <div className="flex flex-wrap gap-2">
                          <button onClick={saveModalStatus} disabled={isSavingStatus} className="rounded-xl bg-[#1C2032] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                            {isSavingStatus ? "Updating..." : "Update Status"}
                          </button>
                          <button onClick={closeDetailModal} className="rounded-xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-2.5 text-sm font-semibold text-[var(--color-txt-pri)]">
                            Close
                          </button>
                          <button onClick={() => openInvoice(detailOrder.id)} className="rounded-xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-2.5 text-sm font-semibold text-[var(--color-txt-pri)]">
                            A5 Invoice
                          </button>
                          <button onClick={markPrintedFromModal} disabled={isMarkingPrinted} className="rounded-xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-2.5 text-sm font-semibold text-[var(--color-txt-pri)] disabled:opacity-60">
                            {isMarkingPrinted ? "Saving..." : "Print Label"}
                          </button>
                          {detailOrder.action_flags.can_edit ? (
                            <button
                              onClick={() => {
                                closeDetailModal();
                                openEditOrderPanel(detailOrder.id);
                              }}
                              className="rounded-xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-2.5 text-sm font-semibold text-[var(--color-txt-pri)]"
                            >
                              Edit
                            </button>
                          ) : null}
                          {detailOrder.action_flags.can_create_shipment ? (
                            <button onClick={() => openShipmentModal(detailOrder)} className="rounded-xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-2.5 text-sm font-semibold text-[var(--color-txt-pri)]">
                              Ship Order
                            </button>
                          ) : null}
                          {detailOrder.action_flags.can_refresh_woo ? (
                            <button onClick={refreshWooOrder} disabled={isRefreshingWoo} className="rounded-xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-2.5 text-sm font-semibold text-[var(--color-txt-pri)] disabled:opacity-60">
                              {isRefreshingWoo ? "Refreshing..." : "Refresh Woo"}
                            </button>
                          ) : null}
                          <Link href={`/dashboard/orders/${detailOrder.id}`} className="rounded-xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-2.5 text-sm font-semibold text-[var(--color-txt-pri)]">
                            Open Full Page
                          </Link>
                        </div>
                      </div>
                    </div>

                    {(detailOrder.source?.toLowerCase() === "woocommerce" || detailOrder.external_status) ? (
                      <div className="rounded-[24px] border border-blue-200 bg-blue-50 p-5">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-700">WooCommerce Context</h4>
                        <div className="mt-3 space-y-2 text-sm font-medium text-blue-900">
                          <p>Source: {detailOrder.source}</p>
                          {detailOrder.external_status ? <p>External status: {detailOrder.external_status}</p> : null}
                          {detailOrder.external_synced_at ? <p>Last synced: {formatDateTime(detailOrder.external_synced_at)}</p> : null}
                          <p className="text-xs text-blue-700">Refresh remains manual and guarded. Stock and Woo safety rules stay unchanged.</p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </Overlay>
      ) : null}

      {formMode ? (
        <Overlay onClose={closeFormPanel} wide>
          <div className="flex max-h-[94vh] flex-col">
            <div className="sticky top-0 z-20 flex items-center justify-between border-b border-[var(--color-brd)] bg-[var(--color-surf)] px-5 py-4 sm:px-8">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <button onClick={closeFormPanel} className="rounded-full bg-[var(--color-surf-hover)] p-2 text-[var(--color-txt-sec)]">
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--color-txt-mut)]">
                    {editingOrder ? "Edit Order" : "New Order"}
                  </p>
                </div>
                <h3 className="text-2xl font-bold text-[var(--color-txt-pri)]">
                  {editingOrder ? `Update #${editingOrder.orderNumber}` : "Create New Order"}
                </h3>
                <p className="text-sm font-medium text-[var(--color-txt-sec)]">
                  {editingOrder
                    ? "The backend currently supports safe basics editing here while the exact v1 item-edit loop is restored."
                    : "Customer details, duplicate warning, product selection, totals, and dispatch helper fields stay inside the same v1-style workflow."}
                </p>
              </div>
              <button onClick={closeFormPanel} className="rounded-xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] p-2 text-[var(--color-txt-sec)]">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={submitOrder} className="dashboard-scrollbar flex-1 overflow-y-auto px-5 py-5 sm:px-8 sm:py-8">
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
                <div className="space-y-6 xl:col-span-8">
                  <section className="rounded-[24px] border border-[var(--color-brd)] bg-[var(--color-surf)] p-5 shadow-subtle">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <p className="ops-micro-label">Customer Section</p>
                        <h4 className="mt-1 text-lg font-bold text-[var(--color-txt-pri)]">Buyer & Delivery Contact</h4>
                      </div>
                      <span className="rounded-full bg-[var(--color-surf-hover)] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--color-txt-sec)]">
                        V1 Flow
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <label className="space-y-2">
                        <span className="ops-micro-label">Existing Customer</span>
                        <select value={form.customerId} onChange={(event) => handleCustomerSelect(event.target.value)} className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm font-semibold text-[var(--color-txt-pri)] outline-none">
                          <option value="">Select customer</option>
                          {customers.map((item) => (
                            <option key={item.id} value={item.id}>{item.name} / {item.phone}</option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-2">
                        <span className="ops-micro-label">Order Number</span>
                        <input value={form.orderNumber} onChange={(event) => setForm((current) => ({ ...current, orderNumber: event.target.value }))} disabled={Boolean(editingOrder)} className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm font-semibold text-[var(--color-txt-pri)] outline-none disabled:opacity-60" placeholder="Leave blank to auto-generate" />
                      </label>
                      <label className="space-y-2">
                        <span className="ops-micro-label">Customer Name</span>
                        <input value={form.customerName} onChange={(event) => setForm((current) => ({ ...current, customerName: event.target.value }))} className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm font-semibold text-[var(--color-txt-pri)] outline-none" />
                      </label>
                      <label className="space-y-2">
                        <span className="ops-micro-label">Customer Phone</span>
                        <input value={form.customerPhone} onChange={(event) => setForm((current) => ({ ...current, customerPhone: event.target.value }))} className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm font-semibold text-[var(--color-txt-pri)] outline-none" />
                      </label>
                      <label className="space-y-2 md:col-span-2">
                        <span className="ops-micro-label">Customer Address</span>
                        <textarea value={form.customerAddress} onChange={(event) => setForm((current) => ({ ...current, customerAddress: event.target.value }))} rows={3} className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm font-semibold text-[var(--color-txt-pri)] outline-none" />
                      </label>
                      <label className="space-y-2">
                        <span className="ops-micro-label">Customer City</span>
                        <input value={form.customerCity} onChange={(event) => setForm((current) => ({ ...current, customerCity: event.target.value }))} className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm font-semibold text-[var(--color-txt-pri)] outline-none" />
                      </label>
                      <label className="space-y-2">
                        <span className="ops-micro-label">Customer Zone</span>
                        <input value={form.customerZone} onChange={(event) => setForm((current) => ({ ...current, customerZone: event.target.value }))} className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm font-semibold text-[var(--color-txt-pri)] outline-none" />
                      </label>
                    </div>

                    {duplicateLoading ? (
                      <div className="mt-4 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Checking duplicate orders...
                      </div>
                    ) : null}
                    {duplicateError ? (
                      <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{duplicateError}</div>
                    ) : null}
                    {duplicateRows.length > 0 ? (
                      <div className="mt-4 rounded-[24px] border border-amber-200 bg-amber-50 p-4">
                        <div className="mb-3 flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-amber-600" />
                          <h5 className="text-sm font-bold text-amber-800">Duplicate warning only</h5>
                        </div>
                        <p className="mb-4 text-xs font-medium text-amber-700">
                          Similar phone matches were found recently. This does not block order creation.
                        </p>
                        <div className="space-y-3">
                          {duplicateRows.map((row) => (
                            <div key={row.id} className="rounded-2xl border border-amber-200 bg-white/70 p-3">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <p className="text-sm font-bold text-[var(--color-txt-pri)]">#{row.orderNumber}</p>
                                  <p className="mt-1 text-xs font-medium text-[var(--color-txt-sec)]">
                                    {(row.customerName || row.customer_name || "Customer")} / {row.customerPhone || row.customer_phone || "No phone"}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-bold text-[var(--color-txt-pri)]">{formatCurrency(row.total)}</p>
                                  <p className="mt-1 text-xs font-medium text-[var(--color-txt-sec)]">{formatDate(row.createdAt)}</p>
                                </div>
                              </div>
                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                <StatusPill status={row.status} />
                                <SourcePill source={row.source} />
                              </div>
                              {(row.customerAddress || row.customer_address) ? (
                                <p className="mt-3 text-xs font-medium text-[var(--color-txt-sec)]">{row.customerAddress || row.customer_address}</p>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </section>

                  <section className="rounded-[24px] border border-[var(--color-brd)] bg-[var(--color-surf)] p-5 shadow-subtle">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <p className="ops-micro-label">Product Section</p>
                        <h4 className="mt-1 text-lg font-bold text-[var(--color-txt-pri)]">Items & Product Search</h4>
                      </div>
                      <button type="button" onClick={addItemRow} className="inline-flex items-center gap-2 rounded-full bg-[var(--color-surf-hover)] px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--color-txt-pri)]">
                        <Plus className="h-3.5 w-3.5" />
                        Add Product
                      </button>
                    </div>
                    <div className="space-y-4">
                      {form.items.map((item, index) => (
                        <div key={item.row_id} className="rounded-[22px] border border-[var(--color-brd)] bg-[var(--color-surf-hover)]/60 p-4">
                          <div className="mb-4 flex items-center justify-between">
                            <p className="text-sm font-bold text-[var(--color-txt-pri)]">Item {index + 1}</p>
                            <button type="button" onClick={() => removeItemRow(item.row_id)} className="rounded-full bg-white p-2 text-[var(--color-txt-sec)] shadow-subtle">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
                            <label className="space-y-2 md:col-span-2">
                              <span className="ops-micro-label">Product</span>
                              <select value={item.productId} onChange={(event) => handleProductSelect(item.row_id, event.target.value)} disabled={Boolean(editingOrder)} className="w-full rounded-2xl border border-[var(--color-brd)] bg-white px-4 py-3 text-sm font-semibold text-[var(--color-txt-pri)] outline-none disabled:opacity-60">
                                <option value="">Select product</option>
                                {products.map((product) => (
                                  <option key={product.id} value={product.id}>{product.name} / {product.sku}</option>
                                ))}
                              </select>
                            </label>
                            <label className="space-y-2">
                              <span className="ops-micro-label">SKU</span>
                              <input value={item.sku} onChange={(event) => updateFormItem(item.row_id, (current) => ({ ...current, sku: event.target.value }))} disabled className="w-full rounded-2xl border border-[var(--color-brd)] bg-white px-4 py-3 text-sm font-semibold text-[var(--color-txt-pri)] outline-none disabled:opacity-70" />
                            </label>
                            <label className="space-y-2">
                              <span className="ops-micro-label">Quantity</span>
                              <input type="number" min="1" value={item.quantity} onChange={(event) => updateFormItem(item.row_id, (current) => ({ ...current, quantity: event.target.value }))} disabled={Boolean(editingOrder)} className="w-full rounded-2xl border border-[var(--color-brd)] bg-white px-4 py-3 text-sm font-semibold text-[var(--color-txt-pri)] outline-none disabled:opacity-60" />
                            </label>
                            <label className="space-y-2">
                              <span className="ops-micro-label">Unit Price</span>
                              <input type="number" min="0" step="0.01" value={item.unitPrice} onChange={(event) => updateFormItem(item.row_id, (current) => ({ ...current, unitPrice: event.target.value }))} disabled={Boolean(editingOrder)} className="w-full rounded-2xl border border-[var(--color-brd)] bg-white px-4 py-3 text-sm font-semibold text-[var(--color-txt-pri)] outline-none disabled:opacity-60" />
                            </label>
                            <label className="space-y-2">
                              <span className="ops-micro-label">Line Total</span>
                              <input value={item.totalPrice} disabled className="w-full rounded-2xl border border-[var(--color-brd)] bg-white px-4 py-3 text-sm font-semibold text-[var(--color-txt-pri)] outline-none disabled:opacity-70" />
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>

                <div className="space-y-6 xl:col-span-4">
                  <section className="rounded-[24px] border border-[var(--color-brd)] bg-[var(--color-surf)] p-5 shadow-subtle">
                    <p className="ops-micro-label">Workflow Fields</p>
                    <h4 className="mt-1 text-lg font-bold text-[var(--color-txt-pri)]">Status, Payment & Channel</h4>
                    <div className="mt-4 grid grid-cols-1 gap-4">
                      <label className="space-y-2">
                        <span className="ops-micro-label">Warehouse</span>
                        <select value={form.warehouseId} onChange={(event) => setForm((current) => ({ ...current, warehouseId: event.target.value }))} className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm font-semibold text-[var(--color-txt-pri)] outline-none">
                          <option value="">Select warehouse</option>
                          {warehouses.map((item) => (
                            <option key={item.id} value={item.id}>{item.name} / {item.code}</option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-2">
                        <span className="ops-micro-label">Status</span>
                        <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm font-semibold text-[var(--color-txt-pri)] outline-none">
                          {EDITABLE_STATUSES.map((item) => (
                            <option key={item} value={item}>{formatLabel(item)}</option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-2">
                        <span className="ops-micro-label">Payment Status</span>
                        <select value={form.paymentStatus} onChange={(event) => setForm((current) => ({ ...current, paymentStatus: event.target.value }))} className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm font-semibold text-[var(--color-txt-pri)] outline-none">
                          {PAYMENT_STATUSES.map((item) => (
                            <option key={item} value={item}>{formatLabel(item)}</option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-2">
                        <span className="ops-micro-label">Payment Method</span>
                        <select value={form.paymentMethod} onChange={(event) => setForm((current) => ({ ...current, paymentMethod: event.target.value }))} className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm font-semibold text-[var(--color-txt-pri)] outline-none">
                          {PAYMENT_METHODS.map((item) => (
                            <option key={item} value={item}>{item}</option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-2">
                        <span className="ops-micro-label">Source / Channel</span>
                        <select value={form.channel} onChange={(event) => setForm((current) => ({ ...current, channel: event.target.value }))} disabled={Boolean(editingOrder)} className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm font-semibold text-[var(--color-txt-pri)] outline-none disabled:opacity-60">
                          {SOURCE_OPTIONS.map((item) => (
                            <option key={item} value={item}>{item}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </section>

                  <section className="rounded-[24px] border border-[var(--color-brd)] bg-[var(--color-surf)] p-5 shadow-subtle">
                    <p className="ops-micro-label">Dispatch Helpers</p>
                    <h4 className="mt-1 text-lg font-bold text-[var(--color-txt-pri)]">Courier & Address Support</h4>
                    <div className="mt-4 grid grid-cols-1 gap-4">
                      <label className="space-y-2">
                        <span className="ops-micro-label">Courier Name</span>
                        <input value={form.courierName} onChange={(event) => setForm((current) => ({ ...current, courierName: event.target.value }))} className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm font-semibold text-[var(--color-txt-pri)] outline-none" />
                      </label>
                      <label className="space-y-2">
                        <span className="ops-micro-label">Tracking Number</span>
                        <input value={form.trackingNumber} onChange={(event) => setForm((current) => ({ ...current, trackingNumber: event.target.value }))} className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm font-semibold text-[var(--color-txt-pri)] outline-none" />
                      </label>
                      <label className="space-y-2">
                        <span className="ops-micro-label">Custom Shipment Number</span>
                        <input value={form.customShipmentNumber} onChange={(event) => setForm((current) => ({ ...current, customShipmentNumber: event.target.value }))} className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm font-semibold text-[var(--color-txt-pri)] outline-none" />
                      </label>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <label className="space-y-2">
                          <span className="ops-micro-label">District</span>
                          <input value={form.district} onChange={(event) => setForm((current) => ({ ...current, district: event.target.value }))} className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm font-semibold text-[var(--color-txt-pri)] outline-none" />
                        </label>
                        <label className="space-y-2">
                          <span className="ops-micro-label">Division</span>
                          <input value={form.division} onChange={(event) => setForm((current) => ({ ...current, division: event.target.value }))} className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm font-semibold text-[var(--color-txt-pri)] outline-none" />
                        </label>
                        <label className="space-y-2">
                          <span className="ops-micro-label">Area</span>
                          <input value={form.area} onChange={(event) => setForm((current) => ({ ...current, area: event.target.value }))} className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm font-semibold text-[var(--color-txt-pri)] outline-none" />
                        </label>
                        <label className="space-y-2">
                          <span className="ops-micro-label">Landmark</span>
                          <input value={form.landmark} onChange={(event) => setForm((current) => ({ ...current, landmark: event.target.value }))} className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm font-semibold text-[var(--color-txt-pri)] outline-none" />
                        </label>
                      </div>
                      <label className="flex items-center gap-3 rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm font-semibold text-[var(--color-txt-pri)]">
                        <input type="checkbox" checked={form.isExchange} onChange={(event) => setForm((current) => ({ ...current, isExchange: event.target.checked }))} className="h-4 w-4 rounded border-[var(--color-brd)]" />
                        Exchange request
                      </label>
                    </div>
                  </section>

                  <section className="rounded-[24px] border border-[var(--color-brd)] bg-[var(--color-surf)] p-5 shadow-subtle">
                    <p className="ops-micro-label">Totals Section</p>
                    <h4 className="mt-1 text-lg font-bold text-[var(--color-txt-pri)]">Bill, Notes & Save</h4>
                    <div className="mt-4 space-y-4">
                      <label className="space-y-2">
                        <span className="ops-micro-label">Notes</span>
                        <textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} rows={3} className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm font-semibold text-[var(--color-txt-pri)] outline-none" />
                      </label>
                      <label className="space-y-2">
                        <span className="ops-micro-label">Tags</span>
                        <input value={form.tags} onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))} className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm font-semibold text-[var(--color-txt-pri)] outline-none" placeholder="urgent, repeat, courier" />
                      </label>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <label className="space-y-2">
                          <span className="ops-micro-label">Discount</span>
                          <input type="number" min="0" step="0.01" value={form.discount} onChange={(event) => setForm((current) => ({ ...current, discount: event.target.value }))} className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm font-semibold text-[var(--color-txt-pri)] outline-none" />
                        </label>
                        <label className="space-y-2">
                          <span className="ops-micro-label">Delivery Charge</span>
                          <input type="number" min="0" step="0.01" value={form.deliveryCharge} onChange={(event) => setForm((current) => ({ ...current, deliveryCharge: event.target.value }))} className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm font-semibold text-[var(--color-txt-pri)] outline-none" />
                        </label>
                        <label className="space-y-2">
                          <span className="ops-micro-label">Paid Amount</span>
                          <input type="number" min="0" step="0.01" value={form.paidAmount} onChange={(event) => setForm((current) => ({ ...current, paidAmount: event.target.value }))} className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm font-semibold text-[var(--color-txt-pri)] outline-none" />
                        </label>
                      </div>
                      <div className="rounded-[24px] border border-[var(--color-brd)] bg-[var(--color-surf-hover)] p-4">
                        <div className="flex items-center justify-between text-sm font-semibold text-[var(--color-txt-sec)]">
                          <span>Subtotal</span>
                          <span>{formatCurrency(formSubtotal)}</span>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-sm font-semibold text-[var(--color-txt-sec)]">
                          <span>Total Amount</span>
                          <span>{formatCurrency(formTotal)}</span>
                        </div>
                        <div className="mt-3 flex items-center justify-between text-base font-bold text-[var(--color-txt-pri)]">
                          <span>Due Amount</span>
                          <span>{formatCurrency(formDue)}</span>
                        </div>
                      </div>
                      {editingOrder ? (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-700">
                          Item-level editing is still limited in this pass. The panel safely updates the main v1-visible order basics while the full v1 edit loop is restored.
                        </div>
                      ) : null}
                      <div className="flex flex-wrap items-center gap-3">
                        <button type="submit" disabled={isSubmittingOrder} className="rounded-xl bg-[#1C2032] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#2A2F45] disabled:opacity-60">
                          {isSubmittingOrder ? "Saving..." : editingOrder ? "Update Order" : "Save Order"}
                        </button>
                        <button type="button" onClick={closeFormPanel} className="rounded-xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-5 py-3 text-sm font-semibold text-[var(--color-txt-pri)]">
                          Cancel
                        </button>
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            </form>
          </div>
        </Overlay>
      ) : null}

      {shipmentModalOpen && detailOrder ? (
        <Overlay onClose={() => setShipmentModalOpen(false)}>
          <div className="flex max-h-[94vh] flex-col">
            <div className="flex items-center justify-between border-b border-[var(--color-brd)] px-5 py-4 sm:px-8">
              <div>
                <p className="ops-micro-label">Shipment Path</p>
                <h3 className="mt-1 text-xl font-bold text-[var(--color-txt-pri)]">Ship Order #{detailOrder.orderNumber}</h3>
              </div>
              <button onClick={() => setShipmentModalOpen(false)} className="rounded-xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] p-2 text-[var(--color-txt-sec)]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-5 px-5 py-5 sm:px-8 sm:py-8">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="ops-micro-label">Courier</span>
                  <select value={shipmentForm.courier_id} onChange={(event) => setShipmentForm((current) => ({ ...current, courier_id: event.target.value }))} className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm font-semibold text-[var(--color-txt-pri)] outline-none">
                    <option value="">Select courier</option>
                    {couriers.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="ops-micro-label">Tracking Number</span>
                  <input value={shipmentForm.tracking_number} onChange={(event) => setShipmentForm((current) => ({ ...current, tracking_number: event.target.value }))} className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm font-semibold text-[var(--color-txt-pri)] outline-none" />
                </label>
                <label className="space-y-2">
                  <span className="ops-micro-label">Delivery Charge</span>
                  <input type="number" min="0" step="0.01" value={shipmentForm.delivery_charge} onChange={(event) => setShipmentForm((current) => ({ ...current, delivery_charge: event.target.value }))} className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm font-semibold text-[var(--color-txt-pri)] outline-none" />
                </label>
                <label className="space-y-2">
                  <span className="ops-micro-label">Courier Charge</span>
                  <input type="number" min="0" step="0.01" value={shipmentForm.courier_charge} onChange={(event) => setShipmentForm((current) => ({ ...current, courier_charge: event.target.value }))} className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm font-semibold text-[var(--color-txt-pri)] outline-none" />
                </label>
                <label className="space-y-2">
                  <span className="ops-micro-label">COD Amount</span>
                  <input type="number" min="0" step="0.01" value={shipmentForm.cod_amount} onChange={(event) => setShipmentForm((current) => ({ ...current, cod_amount: event.target.value }))} className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm font-semibold text-[var(--color-txt-pri)] outline-none" />
                </label>
                <label className="space-y-2">
                  <span className="ops-micro-label">Order Status</span>
                  <select value={shipmentForm.order_status} onChange={(event) => setShipmentForm((current) => ({ ...current, order_status: event.target.value }))} className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm font-semibold text-[var(--color-txt-pri)] outline-none">
                    {["confirmed", "processing", "ready_to_ship", "shipped"].map((item) => (
                      <option key={item} value={item}>{formatLabel(item)}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2 md:col-span-2">
                  <span className="ops-micro-label">Notes</span>
                  <textarea value={shipmentForm.notes} onChange={(event) => setShipmentForm((current) => ({ ...current, notes: event.target.value }))} rows={3} className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm font-semibold text-[var(--color-txt-pri)] outline-none" />
                </label>
              </div>
              <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-medium text-blue-700">
                This maps the v1 send-to-courier action to the existing safe shipment creation flow. It does not trigger destructive external courier automation.
              </div>
              <div className="flex gap-3">
                <button onClick={createShipment} disabled={isCreatingShipment} className="rounded-xl bg-[#1C2032] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">
                  {isCreatingShipment ? "Creating..." : "Create Shipment"}
                </button>
                <button onClick={() => setShipmentModalOpen(false)} className="rounded-xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-5 py-3 text-sm font-semibold text-[var(--color-txt-pri)]">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </Overlay>
      ) : null}
    </div>
  );
}
