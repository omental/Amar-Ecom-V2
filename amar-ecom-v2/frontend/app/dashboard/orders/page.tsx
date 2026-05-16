"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Loader2,
  PackagePlus,
  Printer,
  RefreshCw,
  Search,
  ShoppingCart,
  StickyNote,
  Tag,
  Truck,
  Plus,
} from "lucide-react";

import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorAlert } from "@/components/ui/error-alert";
import { FormCard } from "@/components/ui/form-card";
import { LoadingState } from "@/components/ui/loading-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { api, ApiError } from "@/lib/api";
import { formatCurrency, formatDate, formatDateTime, formatLabel } from "@/lib/format";

type CustomerOption = {
  id: string;
  name: string;
  phone: string;
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
  created_at?: string;
};

type Order = {
  id: string;
  order_number: string;
  customer_id: string | null;
  warehouse_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  shipping_address: string | null;
  notes: string | null;
  tags: string | null;
  status: string;
  payment_status: string;
  source: string;
  external_id?: string | null;
  external_status?: string | null;
  external_synced_at?: string | null;
  subtotal: number | string;
  discount: number | string;
  delivery_charge: number | string;
  total: number | string;
  stock_deducted?: boolean;
  printed_count: number;
  last_printed_at: string | null;
  created_at: string;
  customer?: CustomerOption | null;
  warehouse?: WarehouseOption | null;
  items: OrderItem[];
};

type ShipmentSummary = {
  id: string;
  order_id: string;
  shipment_number: string;
  status: string;
  external_provider?: string | null;
  external_status?: string | null;
  external_tracking_number?: string | null;
  tracking_number?: string | null;
  courier?: {
    name: string;
  } | null;
};

type OrderOperationsSummary = {
  total_open_orders: number;
  ready_to_ship_orders: number;
  shipped_orders: number;
  delivered_orders: number;
  cancelled_orders: number;
  orders_with_woo_source: number;
  orders_needing_woo_refresh: number;
  orders_with_shipments: number;
  orders_without_shipments_ready_to_ship: number;
  orders_stock_not_deducted: number;
  orders_printed_count: number;
  orders_unprinted_count: number;
};

type OrderFilters = {
  payment_status: string;
  source: string;
  warehouse_id: string;
  stock_deducted: string;
  has_shipment: string;
  printed: string;
};

type OrderDuplicate = {
  id: string;
  order_number: string;
  status: string;
  source: string;
  customer_phone: string | null;
  total: number | string;
  created_at: string;
  customer?: CustomerOption | null;
};

type OrderItemForm = {
  row_id: string;
  product_id: string;
  product_name: string;
  sku: string;
  quantity: string;
  unit_price: string;
  total_price: string;
};

type OrderForm = {
  order_number: string;
  customer_id: string;
  warehouse_id: string;
  customer_phone: string;
  shipping_address: string;
  notes: string;
  tags: string;
  status: string;
  payment_status: string;
  source: string;
  discount: string;
  delivery_charge: string;
  items: OrderItemForm[];
};

const orderStatusOptions = [
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

const statusTabs = ["all", ...orderStatusOptions];
const paymentStatusOptions = ["unpaid", "paid", "partial", "refunded"];
const sourceOptions = ["manual", "website", "facebook", "woocommerce"];

function createOrderItemRow(): OrderItemForm {
  return {
    row_id: crypto.randomUUID(),
    product_id: "",
    product_name: "",
    sku: "",
    quantity: "1",
    unit_price: "0",
    total_price: "0",
  };
}

const initialForm: OrderForm = {
  order_number: "",
  customer_id: "",
  warehouse_id: "",
  customer_phone: "",
  shipping_address: "",
  notes: "",
  tags: "",
  status: "pending",
  payment_status: "unpaid",
  source: "manual",
  discount: "0",
  delivery_charge: "0",
  items: [createOrderItemRow()],
};

const initialOrderFilters: OrderFilters = {
  payment_status: "",
  source: "",
  warehouse_id: "",
  stock_deducted: "",
  has_shipment: "",
  printed: "",
};

function toNumber(value: string | number | null | undefined) {
  const numericValue = Number(value ?? 0);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function recalculateItem(item: OrderItemForm) {
  const quantity = Math.max(0, toNumber(item.quantity));
  const unitPrice = Math.max(0, toNumber(item.unit_price));
  return {
    ...item,
    quantity: String(quantity),
    unit_price: String(unitPrice),
    total_price: String(quantity * unitPrice),
  };
}

function parseTags(tags: string | null | undefined) {
  return (tags || "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [shipments, setShipments] = useState<ShipmentSummary[]>([]);
  const [operationsSummary, setOperationsSummary] = useState<OrderOperationsSummary | null>(null);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [form, setForm] = useState<OrderForm>(initialForm);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeStatusTab, setActiveStatusTab] = useState("all");
  const [orderFilters, setOrderFilters] = useState<OrderFilters>(initialOrderFilters);
  const [duplicateMatches, setDuplicateMatches] = useState<OrderDuplicate[]>([]);
  const [duplicateError, setDuplicateError] = useState("");
  const [duplicateLoading, setDuplicateLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshingWooOrderId, setIsRefreshingWooOrderId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const customerMap = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer])),
    [customers],
  );
  const productMap = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );
  const warehouseMap = useMemo(
    () => new Map(warehouses.map((warehouse) => [warehouse.id, warehouse])),
    [warehouses],
  );
  const shipmentOrderMap = useMemo(() => {
    const map = new Map<string, ShipmentSummary[]>();
    shipments.forEach((shipment) => {
      const current = map.get(shipment.order_id) || [];
      current.push(shipment);
      map.set(shipment.order_id, current);
    });
    return map;
  }, [shipments]);

  const subtotal = useMemo(
    () =>
      form.items.reduce((sum, item) => {
        return sum + toNumber(item.total_price);
      }, 0),
    [form.items],
  );
  const total = useMemo(() => {
    return subtotal - toNumber(form.discount) + toNumber(form.delivery_charge);
  }, [form.delivery_charge, form.discount, subtotal]);

  const filteredOrders = orders;
  const ordersQuery = useMemo(() => {
    const params = new URLSearchParams({ skip: "0", limit: "100" });
    if (activeStatusTab !== "all") {
      params.set("status", activeStatusTab);
    }
    if (orderFilters.payment_status) {
      params.set("payment_status", orderFilters.payment_status);
    }
    if (orderFilters.source) {
      params.set("source", orderFilters.source);
    }
    if (orderFilters.warehouse_id) {
      params.set("warehouse_id", orderFilters.warehouse_id);
    }
    if (orderFilters.stock_deducted) {
      params.set("stock_deducted", orderFilters.stock_deducted);
    }
    if (orderFilters.has_shipment) {
      params.set("has_shipment", orderFilters.has_shipment);
    }
    if (orderFilters.printed) {
      params.set("printed", orderFilters.printed);
    }
    if (searchTerm.trim()) {
      params.set("search", searchTerm.trim());
    }
    return params.toString();
  }, [activeStatusTab, orderFilters, searchTerm]);

  useEffect(() => {
    let isMounted = true;

    async function loadInitialData() {
      try {
        const [ordersData, customersData, productsData, warehousesData, shipmentsData, summaryData] = await Promise.all([
          api.get<Order[]>("/orders?skip=0&limit=100"),
          api.get<CustomerOption[]>("/customers?skip=0&limit=100"),
          api.get<ProductOption[]>("/products?skip=0&limit=100"),
          api.get<WarehouseOption[]>("/warehouses?skip=0&limit=100"),
          api.get<ShipmentSummary[]>("/shipments?skip=0&limit=100"),
          api.get<OrderOperationsSummary>("/orders/operations-summary"),
        ]);

        if (!isMounted) return;
        setOrders(ordersData);
        setCustomers(customersData);
        setProducts(productsData);
        setWarehouses(warehousesData);
        setShipments(shipmentsData);
        setOperationsSummary(summaryData);
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof ApiError ? err.message : "Failed to load order data");
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
  }, []);

  const loadOrders = useCallback(async (query = ordersQuery) => {
    setError("");

    try {
      const [ordersData, shipmentsData, summaryData] = await Promise.all([
        api.get<Order[]>(`/orders?${query}`),
        api.get<ShipmentSummary[]>("/shipments?skip=0&limit=100"),
        api.get<OrderOperationsSummary>("/orders/operations-summary"),
      ]);
      setOrders(ordersData);
      setShipments(shipmentsData);
      setOperationsSummary(summaryData);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load orders");
    }
  }, [ordersQuery]);

  useEffect(() => {
    if (isLoading) {
      return;
    }
    const refreshTimer = window.setTimeout(() => {
      void loadOrders(ordersQuery);
    }, 0);

    return () => {
      window.clearTimeout(refreshTimer);
    };
  }, [isLoading, loadOrders, ordersQuery]);

  function updateItem(rowId: string, updater: (item: OrderItemForm) => OrderItemForm) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => {
        if (item.row_id !== rowId) {
          return item;
        }

        return recalculateItem(updater(item));
      }),
    }));
  }

  function handleProductSelect(rowId: string, productId: string) {
    const selectedProduct = productMap.get(productId);

    updateItem(rowId, (item) => ({
      ...item,
      product_id: productId,
      product_name: selectedProduct?.name || "",
      sku: selectedProduct?.sku || "",
      unit_price: String(toNumber(selectedProduct?.price)),
    }));
  }

  function addOrderItem() {
    setForm((current) => ({
      ...current,
      items: [...current.items, createOrderItemRow()],
    }));
  }

  function removeOrderItem(rowId: string) {
    setForm((current) => ({
      ...current,
      items:
        current.items.length === 1
          ? [createOrderItemRow()]
          : current.items.filter((item) => item.row_id !== rowId),
    }));
  }

  async function runDuplicateCheck(phone: string) {
    const normalizedPhone = phone.trim();
    if (!normalizedPhone) {
      setDuplicateMatches([]);
      setDuplicateError("");
      return;
    }

    setDuplicateLoading(true);
    setDuplicateError("");

    try {
      const matches = await api.get<OrderDuplicate[]>(
        `/orders/duplicate-check?phone=${encodeURIComponent(normalizedPhone)}&limit=5`,
      );
      setDuplicateMatches(matches);
    } catch (err) {
      setDuplicateMatches([]);
      setDuplicateError(
        err instanceof ApiError ? err.message : "Failed to check duplicate orders",
      );
    } finally {
      setDuplicateLoading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSubmitting(true);

    try {
      const validItems = form.items.filter((item) => item.product_id && toNumber(item.quantity) > 0);

      if (validItems.length === 0) {
        throw new Error("Add at least one order item before creating the order.");
      }

      await api.post<Order>("/orders", {
        order_number: form.order_number || null,
        customer_id: form.customer_id || null,
        warehouse_id: form.warehouse_id || null,
        customer_phone: form.customer_phone || null,
        shipping_address: form.shipping_address || null,
        notes: form.notes || null,
        tags: form.tags || null,
        status: form.status,
        payment_status: form.payment_status,
        source: form.source,
        subtotal,
        discount: toNumber(form.discount),
        delivery_charge: toNumber(form.delivery_charge),
        total,
        items: validItems.map((item) => ({
          product_id: item.product_id || null,
          variant_id: null,
          product_name: item.product_name,
          sku: item.sku || null,
          quantity: toNumber(item.quantity),
          unit_price: toNumber(item.unit_price),
          total_price: toNumber(item.total_price),
        })),
      });

      setForm({
        ...initialForm,
        items: [createOrderItemRow()],
      });
      setDuplicateMatches([]);
      setDuplicateError("");
      setSuccess("Order created successfully.");
      await loadOrders();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to create order",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRefreshWooOrder(orderId: string) {
    setError("");
    setSuccess("");
    setIsRefreshingWooOrderId(orderId);
    try {
      const result = await api.post<{ rows: Array<{ message: string }> }>(`/woocommerce/orders/${orderId}/refresh`, {});
      await loadOrders();
      setSuccess(result.rows?.[0]?.message || "WooCommerce order refreshed safely.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to refresh WooCommerce order");
    } finally {
      setIsRefreshingWooOrderId(null);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)] sm:p-8">
        <PageHeader
          eyebrow="Sales Flow"
          title="Orders"
          description="Create manual orders, scan for duplicate phone activity, print invoices, and move orders toward logistics with clearer operational controls."
          meta={`${orders.length} loaded`}
        />
      </section>

      {operationsSummary ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          {[
            { label: "Open Orders", value: operationsSummary.total_open_orders, tone: "border-slate-200 bg-slate-50 text-slate-950" },
            { label: "Ready to Ship", value: operationsSummary.ready_to_ship_orders, tone: "border-sky-200 bg-sky-50 text-sky-900" },
            { label: "Need Shipment", value: operationsSummary.orders_without_shipments_ready_to_ship, tone: "border-amber-200 bg-amber-50 text-amber-900" },
            { label: "Woo Orders", value: operationsSummary.orders_with_woo_source, tone: "border-violet-200 bg-violet-50 text-violet-900" },
            { label: "Need Woo Refresh", value: operationsSummary.orders_needing_woo_refresh, tone: "border-orange-200 bg-orange-50 text-orange-900" },
            { label: "Unprinted", value: operationsSummary.orders_unprinted_count, tone: "border-rose-200 bg-rose-50 text-rose-900" },
          ].map((card) => (
            <article key={card.label} className={`rounded-[28px] border p-5 shadow-[var(--shadow-soft)] ${card.tone}`}>
              <p className="text-sm opacity-80">{card.label}</p>
              <p className="mt-3 text-3xl font-semibold tracking-tight">{card.value}</p>
            </article>
          ))}
        </section>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.02fr_0.98fr]">
        <FormCard
          title="Create order"
          description="Build a manual order with customer, contact, shipping, operational notes, and line items."
          action={
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <ShoppingCart className="h-5 w-5" />
            </div>
          }
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Order number
                </span>
                <input
                  value={form.order_number}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      order_number: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                  placeholder="ORD-20260511-001"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Customer
                </span>
                <select
                  value={form.customer_id}
                  onChange={(event) => {
                    const nextCustomerId = event.target.value;
                    const selectedCustomer = customerMap.get(nextCustomerId);
                    setForm((current) => ({
                      ...current,
                      customer_id: nextCustomerId,
                      customer_phone:
                        current.customer_phone.trim() || !selectedCustomer?.phone
                          ? current.customer_phone
                          : selectedCustomer.phone,
                    }));
                  }}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                >
                  <option value="">Guest / no customer</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} ({customer.phone})
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Warehouse
                </span>
                <select
                  value={form.warehouse_id}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      warehouse_id: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                >
                  <option value="">No warehouse assigned</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name} ({warehouse.code})
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Customer phone
                </span>
                <input
                  value={form.customer_phone}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      customer_phone: event.target.value,
                    }))
                  }
                  onBlur={(event) => void runDuplicateCheck(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                  placeholder="017XXXXXXXX"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Tags
                </span>
                <input
                  value={form.tags}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      tags: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                  placeholder="repeat, urgent, cash-on-delivery"
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                Shipping address
              </span>
              <textarea
                rows={3}
                value={form.shipping_address}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    shipping_address: event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                placeholder="House, road, area, city"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                Notes
              </span>
              <textarea
                rows={3}
                value={form.notes}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                placeholder="Internal delivery note, call before dispatch, packaging detail..."
              />
            </label>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Choosing a warehouse is recommended. Fulfillment will deduct stock from the selected warehouse instead of using fallback inventory selection.
            </div>

            {form.customer_phone.trim() ? (
              duplicateLoading ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Checking recent orders for this phone number...
                  </div>
                </div>
              ) : duplicateError ? (
                <ErrorAlert message={duplicateError} />
              ) : duplicateMatches.length > 0 ? (
                <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-700" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">Possible duplicate warning</p>
                      <p className="mt-1 text-amber-800">
                        Recent orders already exist for this phone number. You can still create the order.
                      </p>
                      <div className="mt-3 space-y-2">
                        {duplicateMatches.map((match) => (
                          <div
                            key={match.id}
                            className="rounded-2xl border border-amber-200 bg-white px-4 py-3"
                          >
                            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                              <div>
                                <Link
                                  href={`/dashboard/orders/${match.id}`}
                                  className="font-semibold text-slate-950 transition hover:underline"
                                >
                                  {match.order_number}
                                </Link>
                                <p className="mt-1 text-xs text-slate-500">
                                  {match.customer?.name || "Guest"} • {match.customer_phone || "No phone"} • {formatDateTime(match.created_at)}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <StatusBadge status={match.status} />
                                <span className="text-sm font-semibold text-slate-950">
                                  {formatCurrency(match.total)}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  No recent duplicate orders found for this phone number.
                </div>
              )
            ) : null}

            <div className="grid gap-4 md:grid-cols-3">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Status
                </span>
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, status: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                >
                  {orderStatusOptions.map((status) => (
                    <option key={status} value={status}>
                      {formatLabel(status)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Payment status
                </span>
                <select
                  value={form.payment_status}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      payment_status: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                >
                  {paymentStatusOptions.map((status) => (
                    <option key={status} value={status}>
                      {formatLabel(status)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Source
                </span>
                <select
                  value={form.source}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, source: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                >
                  {sourceOptions.map((source) => (
                    <option key={source} value={source}>
                      {formatLabel(source)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="space-y-3 rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-950">Order items</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Select products to auto-fill product name, SKU, and unit price.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={addOrderItem}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                >
                  <Plus className="h-4 w-4" />
                  Add item
                </button>
              </div>

              <div className="space-y-3">
                {form.items.map((item, index) => (
                  <div
                    key={item.row_id}
                    className="rounded-3xl border border-slate-200 bg-white p-4"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-950">
                        Item {index + 1}
                      </p>
                      <button
                        type="button"
                        onClick={() => removeOrderItem(item.row_id)}
                        className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <label className="block">
                        <span className="mb-2 block text-sm font-medium text-slate-700">
                          Product
                        </span>
                        <select
                          value={item.product_id}
                          onChange={(event) =>
                            handleProductSelect(item.row_id, event.target.value)
                          }
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                          required
                        >
                          <option value="">Select product</option>
                          {products.map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.name} ({product.sku})
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="block">
                        <span className="mb-2 block text-sm font-medium text-slate-700">
                          Product name
                        </span>
                        <input
                          value={item.product_name}
                          onChange={(event) =>
                            updateItem(item.row_id, (current) => ({
                              ...current,
                              product_name: event.target.value,
                            }))
                          }
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                          required
                        />
                      </label>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-4">
                      <label className="block">
                        <span className="mb-2 block text-sm font-medium text-slate-700">
                          SKU
                        </span>
                        <input
                          value={item.sku}
                          onChange={(event) =>
                            updateItem(item.row_id, (current) => ({
                              ...current,
                              sku: event.target.value,
                            }))
                          }
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                        />
                      </label>

                      <label className="block">
                        <span className="mb-2 block text-sm font-medium text-slate-700">
                          Quantity
                        </span>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(event) =>
                            updateItem(item.row_id, (current) => ({
                              ...current,
                              quantity: event.target.value,
                            }))
                          }
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                          required
                        />
                      </label>

                      <label className="block">
                        <span className="mb-2 block text-sm font-medium text-slate-700">
                          Unit price
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_price}
                          onChange={(event) =>
                            updateItem(item.row_id, (current) => ({
                              ...current,
                              unit_price: event.target.value,
                            }))
                          }
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                          required
                        />
                      </label>

                      <label className="block">
                        <span className="mb-2 block text-sm font-medium text-slate-700">
                          Total price
                        </span>
                        <input
                          value={formatCurrency(item.total_price)}
                          readOnly
                          className="w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-700 outline-none"
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Discount
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.discount}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, discount: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Delivery charge
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.delivery_charge}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      delivery_charge: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                />
              </label>
            </div>

            <div className="grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 md:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                  Subtotal
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-950">
                  {formatCurrency(subtotal)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                  Discount
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-950">
                  {formatCurrency(form.discount)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                  Total
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-950">
                  {formatCurrency(total)}
                </p>
              </div>
            </div>

            {error ? <ErrorAlert message={error} /> : null}
            {success ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {success}
              </div>
            ) : null}

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
                  Create Order
                </>
              )}
            </button>
          </form>
        </FormCard>

        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
          <PageHeader
            eyebrow="Saved Records"
            title="Recent orders"
            description="Search, filter by operational status, and jump into print or shipment workflows."
            meta={`${filteredOrders.length} showing`}
          />

          <div className="mt-6 space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                placeholder="Search by order, customer, phone, tags, notes, or address"
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <select
                value={orderFilters.payment_status}
                onChange={(event) => setOrderFilters((current) => ({ ...current, payment_status: event.target.value }))}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
              >
                <option value="">All payment statuses</option>
                {paymentStatusOptions.map((statusValue) => (
                  <option key={statusValue} value={statusValue}>
                    {formatLabel(statusValue)}
                  </option>
                ))}
              </select>
              <select
                value={orderFilters.source}
                onChange={(event) => setOrderFilters((current) => ({ ...current, source: event.target.value }))}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
              >
                <option value="">All sources</option>
                {sourceOptions.map((sourceValue) => (
                  <option key={sourceValue} value={sourceValue}>
                    {formatLabel(sourceValue)}
                  </option>
                ))}
              </select>
              <select
                value={orderFilters.warehouse_id}
                onChange={(event) => setOrderFilters((current) => ({ ...current, warehouse_id: event.target.value }))}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
              >
                <option value="">All warehouses</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </select>
              <select
                value={orderFilters.stock_deducted}
                onChange={(event) => setOrderFilters((current) => ({ ...current, stock_deducted: event.target.value }))}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
              >
                <option value="">All stock states</option>
                <option value="true">Stock deducted</option>
                <option value="false">Stock not deducted</option>
              </select>
              <select
                value={orderFilters.has_shipment}
                onChange={(event) => setOrderFilters((current) => ({ ...current, has_shipment: event.target.value }))}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
              >
                <option value="">All shipment states</option>
                <option value="true">Has shipment</option>
                <option value="false">Needs shipment</option>
              </select>
              <select
                value={orderFilters.printed}
                onChange={(event) => setOrderFilters((current) => ({ ...current, printed: event.target.value }))}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
              >
                <option value="">All print states</option>
                <option value="true">Printed</option>
                <option value="false">Unprinted</option>
              </select>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {statusTabs.map((tab) => {
                const isActive = activeStatusTab === tab;
                const label = tab === "all" ? "All" : formatLabel(tab);
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveStatusTab(tab)}
                    className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition ${
                      isActive
                        ? "border-slate-950 bg-slate-950 text-white"
                        : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {isLoading ? (
              <LoadingState label="Loading orders..." />
            ) : filteredOrders.length === 0 ? (
              <EmptyState
                title="No orders match the current filters"
                description="Try another search term or status tab, or create a fresh order from the form."
              />
            ) : (
              <DataTable
                columns={[
                  "Order #",
                  "Customer",
                  "Status",
                  "Ops",
                  "Warehouse",
                  "Total",
                  "Printed",
                  "Created",
                  "Actions",
                ]}
              >
                {filteredOrders.map((order) => {
                  const hasNotes = Boolean(order.notes?.trim());
                  const tagList = parseTags(order.tags);
                  const linkedShipments = shipmentOrderMap.get(order.id) || [];
                  const hasShipment = linkedShipments.length > 0;
                  const primaryShipment = linkedShipments[0] || null;
                  const canCreateShipment =
                    ["confirmed", "processing", "ready_to_ship"].includes(order.status) &&
                    !hasShipment;
                  return (
                    <div
                      key={order.id}
                      className="grid grid-cols-1 gap-3 px-5 py-4 text-sm text-slate-600 xl:grid-cols-9 xl:gap-4"
                    >
                      <div>
                        <Link
                          href={`/dashboard/orders/${order.id}`}
                          className="font-semibold text-slate-950 transition hover:text-slate-700 hover:underline"
                        >
                          {order.order_number}
                        </Link>
                        <p className="mt-1 text-xs text-slate-500">
                          {order.source === "woocommerce" ? "WooCommerce" : formatLabel(order.source)}
                        </p>
                        {order.source === "woocommerce" ? (
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">
                              WooCommerce
                            </span>
                            {order.external_status ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-medium text-sky-700">
                                {formatLabel(order.external_status)}
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                        {order.external_synced_at ? (
                          <p className="mt-1 text-xs text-slate-500">Synced {formatDateTime(order.external_synced_at)}</p>
                        ) : null}
                      </div>
                      <div>
                        <p className="font-medium text-slate-950">
                          {order.customer_name ||
                            order.customer?.name ||
                            (order.customer_id
                              ? customerMap.get(order.customer_id)?.name || "Unknown customer"
                              : "Guest")}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {order.customer_phone ||
                            order.customer?.phone ||
                            "No phone on file"}
                        </p>
                      </div>
                      <span>
                        <StatusBadge status={order.status} />
                      </span>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {order.stock_deducted ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                              Stock deducted
                            </span>
                          ) : null}
                          {hasShipment ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-medium text-sky-700">
                              Shipment linked
                            </span>
                          ) : null}
                          {primaryShipment?.external_status ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700">
                              Courier {formatLabel(primaryShipment.external_status)}
                            </span>
                          ) : null}
                          {hasNotes ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700">
                              <StickyNote className="h-3.5 w-3.5" />
                              Notes
                            </span>
                          ) : null}
                          {tagList.length > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700">
                              <Tag className="h-3.5 w-3.5" />
                              {tagList.length} tags
                            </span>
                          ) : null}
                        </div>
                        {tagList.length > 0 ? (
                          <p className="text-xs text-slate-500">
                            {tagList.slice(0, 2).join(", ")}
                            {tagList.length > 2 ? "..." : ""}
                          </p>
                        ) : (
                          <p className="text-xs text-slate-400">
                            {order.source === "woocommerce" && order.external_synced_at
                              ? `Woo synced ${formatDateTime(order.external_synced_at)}`
                              : "No notes or tags"}
                          </p>
                        )}
                      </div>
                      <span>
                        {order.warehouse?.name ||
                          (order.warehouse_id
                            ? warehouseMap.get(order.warehouse_id)?.name || "Unknown warehouse"
                            : "Not assigned")}
                      </span>
                      <span className="font-medium text-slate-950">{formatCurrency(order.total)}</span>
                      <div>
                        <p className="font-medium text-slate-950">{order.printed_count}x</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {order.last_printed_at ? formatDateTime(order.last_printed_at) : "Never"}
                        </p>
                      </div>
                      <span>{formatDate(order.created_at)}</span>
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/dashboard/orders/${order.id}`}
                          className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                        >
                          View
                        </Link>
                        <Link
                          href={`/dashboard/orders/${order.id}/invoice`}
                          className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                          title={
                            order.printed_count > 0
                              ? `Printed ${order.printed_count} times`
                              : "Open invoice print view"
                          }
                        >
                          <Printer className="h-3.5 w-3.5" />
                          Print
                        </Link>
                        {order.source === "woocommerce" && order.external_id ? (
                          <button
                            type="button"
                            onClick={() => void handleRefreshWooOrder(order.id)}
                            disabled={isRefreshingWooOrderId === order.id}
                            className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-100 disabled:opacity-60"
                          >
                            {isRefreshingWooOrderId === order.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                            Refresh Woo
                          </button>
                        ) : null}
                        {hasShipment ? (
                          <Link
                            href={`/dashboard/logistics?order_id=${order.id}`}
                            className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-100"
                          >
                            <Truck className="h-3.5 w-3.5" />
                            Open Logistics
                          </Link>
                        ) : canCreateShipment ? (
                          <Link
                            href={`/dashboard/logistics?order_id=${order.id}`}
                            className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                          >
                            <PackagePlus className="h-3.5 w-3.5" />
                            Create Shipment
                          </Link>
                        ) : ["confirmed", "processing", "ready_to_ship"].includes(order.status) ? (
                          <Link
                            href={`/dashboard/logistics?order_id=${order.id}`}
                            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                          >
                            <Truck className="h-3.5 w-3.5" />
                            Open Logistics
                          </Link>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-400">
                            <PackagePlus className="h-3.5 w-3.5" />
                            Dispatch later
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </DataTable>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
