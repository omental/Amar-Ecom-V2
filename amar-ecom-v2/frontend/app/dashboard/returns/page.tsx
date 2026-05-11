"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, RotateCcw, Trash2 } from "lucide-react";

import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorAlert } from "@/components/ui/error-alert";
import { FormCard } from "@/components/ui/form-card";
import { LoadingState } from "@/components/ui/loading-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { api, ApiError } from "@/lib/api";
import { formatCurrency, formatDate, formatLabel } from "@/lib/format";

type CustomerOption = {
  id: string;
  name: string;
  phone: string;
};

type WarehouseOption = {
  id: string;
  name: string;
  code: string;
};

type OrderOption = {
  id: string;
  order_number: string;
  customer_id: string | null;
  warehouse_id: string | null;
  customer?: CustomerOption | null;
  warehouse?: WarehouseOption | null;
};

type ProductOption = {
  id: string;
  name: string;
  sku: string;
};

type ReturnItem = {
  id: string;
  order_item_id: string | null;
  product_id: string | null;
  variant_id: string | null;
  product_name: string;
  sku: string | null;
  quantity: number;
  condition: string | null;
  restocked_quantity: number;
  created_at: string;
};

type ReturnRequest = {
  id: string;
  return_number: string;
  order_id: string;
  customer_id: string | null;
  warehouse_id: string | null;
  status: string;
  reason: string | null;
  resolution: string | null;
  refund_amount: number | string;
  restock_items: boolean;
  stock_restocked: boolean;
  created_at: string;
  updated_at: string;
  customer?: CustomerOption | null;
  warehouse?: WarehouseOption | null;
  order?: OrderOption | null;
  items: ReturnItem[];
};

type ReturnItemForm = {
  row_id: string;
  order_item_id: string;
  product_id: string;
  product_name: string;
  sku: string;
  quantity: string;
  condition: string;
};

type ReturnForm = {
  return_number: string;
  order_id: string;
  warehouse_id: string;
  reason: string;
  resolution: string;
  refund_amount: string;
  restock_items: boolean;
  items: ReturnItemForm[];
};

const resolutionOptions = ["refund", "replacement", "store_credit", "no_refund"];

function createReturnItemRow(): ReturnItemForm {
  return {
    row_id: crypto.randomUUID(),
    order_item_id: "",
    product_id: "",
    product_name: "",
    sku: "",
    quantity: "1",
    condition: "",
  };
}

const initialForm: ReturnForm = {
  return_number: "",
  order_id: "",
  warehouse_id: "",
  reason: "",
  resolution: "refund",
  refund_amount: "0",
  restock_items: false,
  items: [createReturnItemRow()],
};

function toNumber(value: string | number | null | undefined) {
  const numericValue = Number(value ?? 0);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

export default function ReturnsPage() {
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [form, setForm] = useState<ReturnForm>(initialForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const productMap = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );
  const warehouseMap = useMemo(
    () => new Map(warehouses.map((warehouse) => [warehouse.id, warehouse])),
    [warehouses],
  );
  const orderMap = useMemo(
    () => new Map(orders.map((order) => [order.id, order])),
    [orders],
  );

  useEffect(() => {
    let isMounted = true;

    async function loadInitialData() {
      try {
        const [returnsData, ordersData, productsData, warehousesData] = await Promise.all([
          api.get<ReturnRequest[]>("/returns?skip=0&limit=20"),
          api.get<OrderOption[]>("/orders?skip=0&limit=100"),
          api.get<ProductOption[]>("/products?skip=0&limit=100"),
          api.get<WarehouseOption[]>("/warehouses?skip=0&limit=100"),
        ]);

        if (!isMounted) return;
        setReturns(returnsData);
        setOrders(ordersData);
        setProducts(productsData);
        setWarehouses(warehousesData);
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof ApiError ? err.message : "Failed to load return data");
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

  async function loadReturns() {
    setError("");
    try {
      const data = await api.get<ReturnRequest[]>("/returns?skip=0&limit=20");
      setReturns(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load returns");
    }
  }

  function updateItem(rowId: string, updater: (item: ReturnItemForm) => ReturnItemForm) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item) => (item.row_id === rowId ? updater(item) : item)),
    }));
  }

  function handleProductSelect(rowId: string, productId: string) {
    const selectedProduct = productMap.get(productId);
    updateItem(rowId, (item) => ({
      ...item,
      product_id: productId,
      product_name: selectedProduct?.name || "",
      sku: selectedProduct?.sku || "",
    }));
  }

  function handleOrderSelect(orderId: string) {
    const selectedOrder = orderMap.get(orderId);
    setForm((current) => ({
      ...current,
      order_id: orderId,
      warehouse_id: current.warehouse_id || selectedOrder?.warehouse_id || "",
    }));
  }

  function addReturnItem() {
    setForm((current) => ({
      ...current,
      items: [...current.items, createReturnItemRow()],
    }));
  }

  function removeReturnItem(rowId: string) {
    setForm((current) => ({
      ...current,
      items:
        current.items.length === 1
          ? [createReturnItemRow()]
          : current.items.filter((item) => item.row_id !== rowId),
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSubmitting(true);

    try {
      if (!form.order_id) {
        throw new Error("Select an order before creating a return request.");
      }

      const validItems = form.items.filter((item) => item.product_id && toNumber(item.quantity) > 0);
      if (validItems.length === 0) {
        throw new Error("Add at least one return item before creating the return request.");
      }

      await api.post<ReturnRequest>("/returns", {
        return_number: form.return_number || null,
        order_id: form.order_id,
        warehouse_id: form.warehouse_id || null,
        reason: form.reason || null,
        resolution: form.resolution || null,
        refund_amount: toNumber(form.refund_amount),
        restock_items: form.restock_items,
        items: validItems.map((item) => ({
          order_item_id: item.order_item_id || null,
          product_id: item.product_id || null,
          variant_id: null,
          product_name: item.product_name,
          sku: item.sku || null,
          quantity: toNumber(item.quantity),
          condition: item.condition || null,
        })),
      });

      setForm({
        ...initialForm,
        items: [createReturnItemRow()],
      });
      setSuccess("Return request created successfully.");
      await loadReturns();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to create return request",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)] sm:p-8">
        <PageHeader
          eyebrow="Returns Workflow"
          title="Returns"
          description="Capture return requests, connect them to orders and warehouses, and prepare approved items for controlled restocking."
          meta={`${returns.length} items`}
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <FormCard
          title="Create return request"
          description="Create a return tied to an order, select how it should be resolved, and decide whether items should be restocked later."
          action={
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <RotateCcw className="h-5 w-5" />
            </div>
          }
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Return number
                </span>
                <input
                  value={form.return_number}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, return_number: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                  placeholder="RMA-20260511-001"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Order
                </span>
                <select
                  value={form.order_id}
                  onChange={(event) => handleOrderSelect(event.target.value)}
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
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Warehouse
                </span>
                <select
                  value={form.warehouse_id}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, warehouse_id: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                >
                  <option value="">Use order warehouse if available</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.name} ({warehouse.code})
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Resolution
                </span>
                <select
                  value={form.resolution}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, resolution: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                >
                  {resolutionOptions.map((resolution) => (
                    <option key={resolution} value={resolution}>
                      {formatLabel(resolution)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Refund amount
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.refund_amount}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, refund_amount: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                Reason
              </span>
              <textarea
                rows={3}
                value={form.reason}
                onChange={(event) =>
                  setForm((current) => ({ ...current, reason: event.target.value }))
                }
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                placeholder="Customer reason for the return"
              />
            </label>

            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.restock_items}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    restock_items: event.target.checked,
                  }))
                }
                className="h-4 w-4 rounded border-slate-300"
              />
              Mark this return as eligible for restocking when status reaches Restocked.
            </label>

            <div className="space-y-3 rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-950">Return items</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Select products manually for this first return workflow version.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={addReturnItem}
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
                        onClick={() => removeReturnItem(item.row_id)}
                        className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
                      >
                        <Trash2 className="h-4 w-4" />
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

                      <label className="block md:col-span-2">
                        <span className="mb-2 block text-sm font-medium text-slate-700">
                          Condition
                        </span>
                        <input
                          value={item.condition}
                          onChange={(event) =>
                            updateItem(item.row_id, (current) => ({
                              ...current,
                              condition: event.target.value,
                            }))
                          }
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                          placeholder="Opened, sealed, damaged, good"
                        />
                      </label>
                    </div>
                  </div>
                ))}
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
                  Create Return
                </>
              )}
            </button>
          </form>
        </FormCard>

        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
          <PageHeader
            eyebrow="Saved Records"
            title="Recent returns"
            description="Review recently created returns and move into detail when items are ready for inspection or restocking."
          />

          <div className="mt-6">
            {isLoading ? (
              <LoadingState label="Loading returns..." />
            ) : returns.length === 0 ? (
              <EmptyState
                title="No returns yet"
                description="Create the first return request after an order has been fulfilled."
              />
            ) : (
              <DataTable
                columns={[
                  "Return #",
                  "Order",
                  "Customer",
                  "Warehouse",
                  "Status",
                  "Resolution",
                  "Refund",
                  "Created",
                ]}
              >
                {returns.map((returnRequest) => (
                  <div
                    key={returnRequest.id}
                    className="grid grid-cols-1 gap-3 px-5 py-4 text-sm text-slate-600 2xl:grid-cols-8 2xl:gap-4"
                  >
                    <span className="font-medium text-slate-950">
                      <Link
                        href={`/dashboard/returns/${returnRequest.id}`}
                        className="transition hover:text-slate-700 hover:underline"
                      >
                        {returnRequest.return_number}
                      </Link>
                    </span>
                    <span>{returnRequest.order?.order_number || "Unknown order"}</span>
                    <span>
                      {returnRequest.customer?.name ||
                        returnRequest.order?.customer?.name ||
                        "Guest"}
                    </span>
                    <span>
                      {returnRequest.warehouse?.name ||
                        (returnRequest.warehouse_id
                          ? warehouseMap.get(returnRequest.warehouse_id)?.name || "Unknown warehouse"
                          : "Not assigned")}
                    </span>
                    <span>
                      <StatusBadge status={returnRequest.status} />
                    </span>
                    <span>{returnRequest.resolution ? formatLabel(returnRequest.resolution) : "Pending"}</span>
                    <span>{formatCurrency(returnRequest.refund_amount)}</span>
                    <span>{formatDate(returnRequest.created_at)}</span>
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
