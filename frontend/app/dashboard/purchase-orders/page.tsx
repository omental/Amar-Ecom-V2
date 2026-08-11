"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ClipboardList, Loader2, Plus, Trash2 } from "lucide-react";

import { useAuthorization } from "@/components/dashboard/authorization-provider";
import { ControlModal, ModalCancelButton } from "@/components/ui/control-modal";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorAlert } from "@/components/ui/error-alert";
import { FormCard } from "@/components/ui/form-card";
import { LoadingState } from "@/components/ui/loading-state";
import { OpsPageHeader } from "@/components/ui/ops-page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { api, ApiError } from "@/lib/api";
import { formatCount, formatCurrency, formatDate, formatLabel } from "@/lib/format";

type SupplierOption = {
  id: string;
  name: string;
  is_active: boolean;
};

type WarehouseOption = {
  id: string;
  name: string;
  code: string;
};

type ProductOption = {
  id: string;
  name: string;
  sku: string;
  cost_price: number | string;
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

type PurchaseOrder = {
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
  supplier?: SupplierOption | null;
  warehouse?: WarehouseOption | null;
  items: PurchaseOrderItem[];
};

type PurchaseOrderItemForm = {
  row_id: string;
  product_id: string;
  product_name: string;
  sku: string;
  quantity: string;
  received_quantity: string;
  unit_cost: string;
  total_cost: string;
};

type PurchaseOrderForm = {
  po_number: string;
  supplier_id: string;
  warehouse_id: string;
  status: string;
  order_date: string;
  expected_date: string;
  discount: string;
  notes: string;
  items: PurchaseOrderItemForm[];
};

const statusOptions = ["draft", "ordered", "partially_received", "received", "cancelled"];

function createPurchaseItemRow(): PurchaseOrderItemForm {
  return {
    row_id: crypto.randomUUID(),
    product_id: "",
    product_name: "",
    sku: "",
    quantity: "1",
    received_quantity: "0",
    unit_cost: "0",
    total_cost: "0",
  };
}

const initialForm: PurchaseOrderForm = {
  po_number: "",
  supplier_id: "",
  warehouse_id: "",
  status: "draft",
  order_date: "",
  expected_date: "",
  discount: "0",
  notes: "",
  items: [createPurchaseItemRow()],
};

function toNumber(value: string | number | null | undefined) {
  const numericValue = Number(value ?? 0);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function calculateItemTotal(quantity: string, unitCost: string) {
  return String(toNumber(quantity) * toNumber(unitCost));
}

export default function PurchaseOrdersPage() {
  const { can } = useAuthorization();
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [form, setForm] = useState<PurchaseOrderForm>(initialForm);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [modalBaseline, setModalBaseline] = useState(JSON.stringify(initialForm));
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const productMap = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );

  const subtotal = useMemo(
    () =>
      form.items.reduce(
        (sum, item) => sum + toNumber(item.total_cost),
        0,
      ),
    [form.items],
  );
  const total = Math.max(subtotal - toNumber(form.discount), 0);

  useEffect(() => {
    let isMounted = true;

    async function loadInitialData() {
      try {
        const [purchaseOrdersData, suppliersData, warehousesData, productsData] = await Promise.all([
          api.get<PurchaseOrder[]>("/purchase-orders?skip=0&limit=20"),
          api.get<SupplierOption[]>("/suppliers?skip=0&limit=100"),
          api.get<WarehouseOption[]>("/warehouses?skip=0&limit=100"),
          api.get<ProductOption[]>("/products?skip=0&limit=100"),
        ]);

        if (!isMounted) return;
        setPurchaseOrders(purchaseOrdersData);
        setSuppliers(suppliersData);
        setWarehouses(warehousesData);
        setProducts(productsData);
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof ApiError ? err.message : "Failed to load purchasing data");
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

  async function loadPurchaseOrders() {
    setError("");
    const data = await api.get<PurchaseOrder[]>("/purchase-orders?skip=0&limit=20");
    setPurchaseOrders(data);
  }

  function updateItem(rowId: string, updater: (item: PurchaseOrderItemForm) => PurchaseOrderItemForm) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => {
        if (item.row_id !== rowId) {
          return item;
        }
        const updated = updater(item);
        return {
          ...updated,
          total_cost: calculateItemTotal(updated.quantity, updated.unit_cost),
        };
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
      unit_cost: String(selectedProduct?.cost_price ?? 0),
    }));
  }

  function addItem() {
    setForm((current) => ({
      ...current,
      items: [...current.items, createPurchaseItemRow()],
    }));
  }

  function removeItem(rowId: string) {
    setForm((current) => ({
      ...current,
      items:
        current.items.length === 1
          ? [createPurchaseItemRow()]
          : current.items.filter((item) => item.row_id !== rowId),
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSubmitting(true);

    try {
      const validItems = form.items.filter((item) => item.product_id && toNumber(item.quantity) > 0);
      if (!form.po_number) {
        throw new Error("Purchase order number is required.");
      }
      if (validItems.length === 0) {
        throw new Error("Add at least one purchase order item before creating the purchase order.");
      }

      await api.post<PurchaseOrder>("/purchase-orders", {
        po_number: form.po_number,
        supplier_id: form.supplier_id || null,
        warehouse_id: form.warehouse_id || null,
        status: form.status,
        order_date: form.order_date || null,
        expected_date: form.expected_date || null,
        discount: toNumber(form.discount),
        notes: form.notes || null,
        items: validItems.map((item) => ({
          product_id: item.product_id || null,
          variant_id: null,
          product_name: item.product_name,
          sku: item.sku || null,
          quantity: toNumber(item.quantity),
          received_quantity: toNumber(item.received_quantity),
          unit_cost: toNumber(item.unit_cost),
          total_cost: toNumber(item.total_cost),
        })),
      });

      setForm({
        ...initialForm,
        items: [createPurchaseItemRow()],
      });
      setSuccess("Purchase order created successfully.");
      await loadPurchaseOrders();
      setIsCreateOpen(false);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to create purchase order",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)] sm:p-8">
        <OpsPageHeader
          eyebrow="Replenishment"
          title="Purchase Orders"
          description="Create purchase orders tied to suppliers and warehouses so replenishment can move into controlled stock receiving."
          meta={formatCount(purchaseOrders.length, "record")}
          actions={can("purchase_orders.create") ? <button type="button" onClick={() => { setModalBaseline(JSON.stringify(form)); setError(""); setIsCreateOpen(true); }} className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white"><Plus className="h-4 w-4" />Add Purchase Order</button> : null}
        />
      </section>

      {error && !isCreateOpen ? <ErrorAlert message={error} onRetry={() => void loadPurchaseOrders()} /> : null}
      {success ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}

      {isCreateOpen ? <ControlModal title="Add Purchase Order" description="Build a supplier and warehouse-linked purchase order without compressing the receiving queue." onClose={() => setIsCreateOpen(false)} size="xl" dirty={JSON.stringify(form) !== modalBaseline}>
        <FormCard
          title="Create purchase order"
          description="Build a purchasing document with supplier, warehouse, planned dates, and product lines ready for receiving later."
          action={
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <ClipboardList className="h-5 w-5" />
            </div>
          }
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">PO number</span>
                <input
                  value={form.po_number}
                  onChange={(event) => setForm((current) => ({ ...current, po_number: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                  placeholder="PO-20260511-001"
                  required
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Supplier</span>
                <select
                  value={form.supplier_id}
                  onChange={(event) => setForm((current) => ({ ...current, supplier_id: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                >
                  <option value="">No supplier selected</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}{supplier.is_active ? "" : " - Inactive"}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Warehouse</span>
                <select
                  value={form.warehouse_id}
                  onChange={(event) => setForm((current) => ({ ...current, warehouse_id: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                >
                  <option value="">Select warehouse</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name} ({warehouse.code})
                    </option>
                  ))}
                </select>
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
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Discount</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.discount}
                  onChange={(event) => setForm((current) => ({ ...current, discount: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Order date</span>
                <input
                  type="date"
                  value={form.order_date}
                  onChange={(event) => setForm((current) => ({ ...current, order_date: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Expected date</span>
                <input
                  type="date"
                  value={form.expected_date}
                  onChange={(event) => setForm((current) => ({ ...current, expected_date: event.target.value }))}
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
                placeholder="Lead time, delivery instructions, or internal notes"
              />
            </label>

            <div className="space-y-3 rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-950">Purchase items</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Select a product to auto-fill product name, SKU, and unit cost from the current cost price.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addItem}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                >
                  <Plus className="h-4 w-4" />
                  Add item
                </button>
              </div>

              <div className="space-y-3">
                {form.items.map((item, index) => (
                  <div key={item.row_id} className="rounded-3xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-950">Item {index + 1}</p>
                      <button
                        type="button"
                        onClick={() => removeItem(item.row_id)}
                        className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        Remove
                      </button>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <label className="block">
                        <span className="mb-2 block text-sm font-medium text-slate-700">Product</span>
                        <select
                          value={item.product_id}
                          onChange={(event) => handleProductSelect(item.row_id, event.target.value)}
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
                        <span className="mb-2 block text-sm font-medium text-slate-700">Product name</span>
                        <input
                          value={item.product_name}
                          onChange={(event) => updateItem(item.row_id, (current) => ({ ...current, product_name: event.target.value }))}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                          required
                        />
                      </label>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-4">
                      <label className="block">
                        <span className="mb-2 block text-sm font-medium text-slate-700">SKU</span>
                        <input
                          value={item.sku}
                          onChange={(event) => updateItem(item.row_id, (current) => ({ ...current, sku: event.target.value }))}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-sm font-medium text-slate-700">Quantity</span>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(event) => updateItem(item.row_id, (current) => ({ ...current, quantity: event.target.value }))}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                          required
                        />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-sm font-medium text-slate-700">Received qty</span>
                        <input
                          type="number"
                          min="0"
                          value={item.received_quantity}
                          onChange={(event) => updateItem(item.row_id, (current) => ({ ...current, received_quantity: event.target.value }))}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-sm font-medium text-slate-700">Unit cost</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_cost}
                          onChange={(event) => updateItem(item.row_id, (current) => ({ ...current, unit_cost: event.target.value }))}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                          required
                        />
                      </label>
                    </div>

                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                      Line total: <span className="font-semibold text-slate-950">{formatCurrency(item.total_cost)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Subtotal: <span className="font-semibold text-slate-950">{formatCurrency(subtotal)}</span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Discount: <span className="font-semibold text-slate-950">{formatCurrency(form.discount)}</span>
              </div>
              <div className="rounded-2xl border border-slate-950 bg-slate-950 px-4 py-3 text-sm text-white">
                Total: <span className="font-semibold">{formatCurrency(total)}</span>
              </div>
            </div>

            {error ? <ErrorAlert message={error} /> : null}
            {success ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}

            <div className="sticky bottom-0 z-10 flex flex-col-reverse gap-3 border-t border-slate-200 bg-white pt-4 sm:flex-row sm:justify-end">
            <ModalCancelButton disabled={isSubmitting} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 disabled:opacity-60">Cancel</ModalCancelButton>
            <button
              type="submit"
              disabled={isSubmitting || isLoading}
              className="flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Create Purchase Order
                </>
              )}
            </button>
            </div>
          </form>
        </FormCard>
      </ControlModal> : null}

        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
          <OpsPageHeader
            eyebrow="Saved Records"
            title="Recent purchase orders"
            description="Track draft and received purchase orders, then move into detail when it is time to mark stock as received."
          />

          <div className="mt-6">
            {isLoading ? (
              <LoadingState label="Loading purchase orders..." />
            ) : purchaseOrders.length === 0 ? (
              <EmptyState
                title="No purchase orders yet"
                description="Create the first purchase order to start a warehouse-linked replenishment flow."
              />
            ) : (
              <DataTable columns={["PO #", "Supplier / Warehouse", "Status / Stock", "Total", "Created", "Actions"]} columnTemplate="minmax(180px,1.1fr) minmax(230px,1.5fr) minmax(180px,1.1fr) minmax(130px,0.8fr) minmax(140px,0.8fr) minmax(100px,0.6fr)" minWidth="920px">
                {purchaseOrders.map((purchaseOrder) => (
                  <div key={purchaseOrder.id} className="grid items-center gap-4 px-5 py-4 text-sm text-slate-600" style={{ gridTemplateColumns: "minmax(180px,1.1fr) minmax(230px,1.5fr) minmax(180px,1.1fr) minmax(130px,0.8fr) minmax(140px,0.8fr) minmax(100px,0.6fr)" }}>
                    <span className="font-medium text-slate-950">
                      <Link
                        href={`/dashboard/purchase-orders/${purchaseOrder.id}`}
                        className="transition hover:text-slate-700 hover:underline"
                      >
                        {purchaseOrder.po_number}
                      </Link>
                    </span>
                    <div><p className="font-medium text-slate-950">{purchaseOrder.supplier?.name || "No supplier"}</p><p className="mt-1 text-xs text-slate-500">{purchaseOrder.warehouse?.name || "No warehouse"}</p></div>
                    <div className="space-y-2"><StatusBadge status={purchaseOrder.status} />
                      <StatusBadge
                        status={purchaseOrder.stock_received ? "received" : "pending"}
                        label={purchaseOrder.stock_received ? "Received" : "Pending"}
                      />
                    </div>
                    <span className="font-semibold text-slate-950">{formatCurrency(purchaseOrder.total)}</span>
                    <span>{formatDate(purchaseOrder.created_at)}</span>
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/dashboard/purchase-orders/${purchaseOrder.id}`}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                      >
                        View
                      </Link>
                    </div>
                  </div>
                ))}
              </DataTable>
            )}
          </div>
        </section>
    </div>
  );
}
