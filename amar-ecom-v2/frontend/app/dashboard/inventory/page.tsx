"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Package2, Plus } from "lucide-react";

import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorAlert } from "@/components/ui/error-alert";
import { FormCard } from "@/components/ui/form-card";
import { LoadingState } from "@/components/ui/loading-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { api, ApiError } from "@/lib/api";

type InventoryItem = {
  id: string;
  product_id: string | null;
  variant_id: string | null;
  warehouse_id: string;
  quantity: number;
  low_stock_threshold: number;
};

type ProductOption = {
  id: string;
  name: string;
  sku: string;
};

type WarehouseOption = {
  id: string;
  name: string;
  code: string;
};

type InventoryForm = {
  product_id: string;
  variant_id: string;
  warehouse_id: string;
  quantity: string;
  low_stock_threshold: string;
};

const initialForm: InventoryForm = {
  product_id: "",
  variant_id: "",
  warehouse_id: "",
  quantity: "0",
  low_stock_threshold: "5",
};

function getStockStatus(quantity: number, threshold: number) {
  if (quantity <= 0) {
    return "out of stock";
  }

  if (quantity <= threshold) {
    return "low stock";
  }

  return "in stock";
}

export default function InventoryPage() {
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [form, setForm] = useState<InventoryForm>(initialForm);
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

  useEffect(() => {
    let isMounted = true;

    async function loadInitialData() {
      try {
        const [inventoryData, productsData, warehousesData] = await Promise.all([
          api.get<InventoryItem[]>("/inventory?skip=0&limit=20"),
          api.get<ProductOption[]>("/products?skip=0&limit=100"),
          api.get<WarehouseOption[]>("/warehouses?skip=0&limit=100"),
        ]);

        if (!isMounted) return;
        setInventoryItems(inventoryData);
        setProducts(productsData);
        setWarehouses(warehousesData);
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof ApiError ? err.message : "Failed to load inventory data");
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

  async function loadInventory() {
    setError("");

    try {
      const data = await api.get<InventoryItem[]>("/inventory?skip=0&limit=20");
      setInventoryItems(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load inventory");
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSubmitting(true);

    try {
      await api.post<InventoryItem>("/inventory", {
        product_id: form.product_id || null,
        variant_id: form.variant_id || null,
        warehouse_id: form.warehouse_id,
        quantity: Number(form.quantity),
        low_stock_threshold: Number(form.low_stock_threshold),
      });
      setForm(initialForm);
      setSuccess("Inventory item created successfully.");
      await loadInventory();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create inventory item");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)] sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <PageHeader
            eyebrow="Stock Control"
            title="Inventory"
            description="Track warehouse stock levels by product, watch low-stock thresholds, and prepare inventory for order operations."
            meta={`${inventoryItems.length} items`}
          />
          <Link
            href="/dashboard/stock-movements"
            className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
          >
            View Stock Movements
          </Link>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <FormCard
          title="Create inventory item"
          description="Assign a product to a warehouse with an opening quantity and low-stock threshold."
          action={
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <Package2 className="h-5 w-5" />
            </div>
          }
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                Product
              </span>
              <select
                value={form.product_id}
                onChange={(event) =>
                  setForm((current) => ({ ...current, product_id: event.target.value }))
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
                Warehouse
              </span>
              <select
                value={form.warehouse_id}
                onChange={(event) =>
                  setForm((current) => ({ ...current, warehouse_id: event.target.value }))
                }
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                required
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
              <span className="mb-2 block text-sm font-medium text-slate-700">
                Variant ID
              </span>
              <input
                value={form.variant_id}
                onChange={(event) =>
                  setForm((current) => ({ ...current, variant_id: event.target.value }))
                }
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                placeholder="Optional variant UUID"
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Quantity
                </span>
                <input
                  type="number"
                  value={form.quantity}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, quantity: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Low stock threshold
                </span>
                <input
                  type="number"
                  min="0"
                  value={form.low_stock_threshold}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      low_stock_threshold: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                  required
                />
              </label>
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
                  Create Inventory Item
                </>
              )}
            </button>
          </form>
        </FormCard>

        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
          <PageHeader
            eyebrow="Saved Records"
            title="Inventory levels"
            description="Review inventory quantities across products and warehouse locations."
          />

          <div className="mt-6">
            {isLoading ? (
              <LoadingState label="Loading inventory..." />
            ) : inventoryItems.length === 0 ? (
              <EmptyState
                title="No inventory yet"
                description="Create the first inventory item after selecting a product and warehouse."
              />
            ) : (
              <DataTable columns={["Product", "Warehouse", "Quantity", "Threshold", "Status"]}>
                {inventoryItems.map((item) => {
                  const stockStatus = getStockStatus(item.quantity, item.low_stock_threshold);

                  return (
                    <div
                      key={item.id}
                      className={`grid grid-cols-1 gap-3 px-5 py-4 text-sm lg:grid-cols-5 lg:gap-4 ${
                        stockStatus === "out of stock"
                          ? "bg-rose-50/70 text-rose-700"
                          : stockStatus === "low stock"
                            ? "bg-amber-50/70 text-amber-800"
                            : "text-slate-600"
                      }`}
                    >
                      <span className="font-medium text-slate-950">
                        {item.product_id
                          ? productMap.get(item.product_id)?.name || "Unknown product"
                          : "No product"}
                      </span>
                      <span>
                        {warehouseMap.get(item.warehouse_id)?.name || "Unknown warehouse"}
                      </span>
                      <span className="font-semibold">{item.quantity}</span>
                      <span>{item.low_stock_threshold}</span>
                      <span>
                        <StatusBadge status={stockStatus} />
                      </span>
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
