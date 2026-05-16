"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRightLeft,
  Boxes,
  Loader2,
  PackageMinus,
  PencilLine,
  Plus,
} from "lucide-react";

import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorAlert } from "@/components/ui/error-alert";
import { FormCard } from "@/components/ui/form-card";
import { LoadingState } from "@/components/ui/loading-state";
import { OpsFilterBar } from "@/components/ui/ops-filter-bar";
import { OpsPageHeader } from "@/components/ui/ops-page-header";
import { OpsSummaryCard } from "@/components/ui/ops-summary-card";
import { OpsTabs } from "@/components/ui/ops-tabs";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { api, ApiError } from "@/lib/api";
import { formatDate, formatLabel } from "@/lib/format";

type InventoryItem = {
  id: string;
  product_id: string | null;
  variant_id: string | null;
  warehouse_id: string;
  quantity: number;
  low_stock_threshold: number;
  created_at: string;
  updated_at: string;
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

type StockMovement = {
  id: string;
  product_id: string | null;
  variant_id: string | null;
  warehouse_id: string;
  order_id: string | null;
  movement_type: string;
  quantity: number;
  previous_quantity: number;
  new_quantity: number;
  note: string | null;
  created_at: string;
};

type StockTransferItem = {
  id: string;
  product_id: string | null;
  variant_id: string | null;
  product_name: string;
  sku: string | null;
  quantity: number;
  created_at: string;
};

type StockTransfer = {
  id: string;
  transfer_number: string;
  from_warehouse_id: string;
  to_warehouse_id: string;
  status: string;
  notes: string | null;
  stock_moved: boolean;
  created_at: string;
  updated_at: string;
  items: StockTransferItem[];
};

type WastageLog = {
  id: string;
  wastage_number: string;
  product_id: string | null;
  variant_id: string | null;
  warehouse_id: string;
  quantity: number;
  reason: string | null;
  note: string | null;
  stock_deducted: boolean;
  created_at: string;
  updated_at: string;
};

type InventoryCreateForm = {
  product_id: string;
  warehouse_id: string;
  variant_id: string;
  quantity: string;
  low_stock_threshold: string;
};

type AdjustmentForm = {
  inventory_item_id: string;
  mode: "new_quantity" | "quantity_delta";
  new_quantity: string;
  quantity_delta: string;
  note: string;
};

type TransferItemForm = {
  row_id: string;
  product_id: string;
  product_name: string;
  sku: string;
  quantity: string;
};

type TransferForm = {
  transfer_number: string;
  from_warehouse_id: string;
  to_warehouse_id: string;
  status: string;
  notes: string;
  items: TransferItemForm[];
};

type WastageForm = {
  wastage_number: string;
  product_id: string;
  warehouse_id: string;
  quantity: string;
  reason: string;
  note: string;
};

type LedgerFilters = {
  product_id: string;
  warehouse_id: string;
  movement_type: string;
};

const tabs = [
  { id: "overview", label: "Stock Overview" },
  { id: "adjustments", label: "Adjustments" },
  { id: "transfers", label: "Transfers" },
  { id: "wastage", label: "Wastage" },
  { id: "ledger", label: "Movement Ledger" },
] as const;

const transferStatuses = ["draft", "pending", "completed", "cancelled"];

const initialInventoryForm: InventoryCreateForm = {
  product_id: "",
  warehouse_id: "",
  variant_id: "",
  quantity: "0",
  low_stock_threshold: "5",
};

const initialAdjustmentForm: AdjustmentForm = {
  inventory_item_id: "",
  mode: "new_quantity",
  new_quantity: "0",
  quantity_delta: "0",
  note: "",
};

const initialWastageForm: WastageForm = {
  wastage_number: "",
  product_id: "",
  warehouse_id: "",
  quantity: "1",
  reason: "",
  note: "",
};

const initialLedgerFilters: LedgerFilters = {
  product_id: "",
  warehouse_id: "",
  movement_type: "",
};

function createTransferItemRow(): TransferItemForm {
  return {
    row_id: crypto.randomUUID(),
    product_id: "",
    product_name: "",
    sku: "",
    quantity: "1",
  };
}

const initialTransferForm: TransferForm = {
  transfer_number: "",
  from_warehouse_id: "",
  to_warehouse_id: "",
  status: "pending",
  notes: "",
  items: [createTransferItemRow()],
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

function toNumber(value: string | number | null | undefined) {
  const numericValue = Number(value ?? 0);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function buildMovementQuery(filters: LedgerFilters) {
  const params = new URLSearchParams({
    skip: "0",
    limit: "100",
  });

  if (filters.product_id) {
    params.set("product_id", filters.product_id);
  }
  if (filters.warehouse_id) {
    params.set("warehouse_id", filters.warehouse_id);
  }
  if (filters.movement_type) {
    params.set("movement_type", filters.movement_type);
  }

  return `/stock-movements?${params.toString()}`;
}

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]["id"]>("overview");
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [wastageLogs, setWastageLogs] = useState<WastageLog[]>([]);
  const [inventoryForm, setInventoryForm] = useState<InventoryCreateForm>(initialInventoryForm);
  const [adjustmentForm, setAdjustmentForm] = useState<AdjustmentForm>(initialAdjustmentForm);
  const [transferForm, setTransferForm] = useState<TransferForm>(initialTransferForm);
  const [wastageForm, setWastageForm] = useState<WastageForm>(initialWastageForm);
  const [ledgerFilters, setLedgerFilters] = useState<LedgerFilters>(initialLedgerFilters);
  const [isLoading, setIsLoading] = useState(true);
  const [isInventorySubmitting, setIsInventorySubmitting] = useState(false);
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [isTransferSubmitting, setIsTransferSubmitting] = useState(false);
  const [isWastageSubmitting, setIsWastageSubmitting] = useState(false);
  const [transferUpdatingId, setTransferUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const warehouseMap = useMemo(
    () => new Map(warehouses.map((warehouse) => [warehouse.id, warehouse])),
    [warehouses],
  );

  const lowStockCount = inventoryItems.filter(
    (item) => item.quantity > 0 && item.quantity <= item.low_stock_threshold,
  ).length;
  const outOfStockCount = inventoryItems.filter((item) => item.quantity <= 0).length;

  useEffect(() => {
    let isMounted = true;

    async function loadInitialData() {
      try {
        const [inventoryData, productsData, warehousesData, movementData, transferData, wastageData] =
          await Promise.all([
            api.get<InventoryItem[]>("/inventory?skip=0&limit=100"),
            api.get<ProductOption[]>("/products?skip=0&limit=100"),
            api.get<WarehouseOption[]>("/warehouses?skip=0&limit=100"),
            api.get<StockMovement[]>(buildMovementQuery(initialLedgerFilters)),
            api.get<StockTransfer[]>("/stock-transfers?skip=0&limit=100"),
            api.get<WastageLog[]>("/wastage-logs?skip=0&limit=100"),
          ]);

        if (!isMounted) {
          return;
        }

        setInventoryItems(inventoryData);
        setProducts(productsData);
        setWarehouses(warehousesData);
        setMovements(movementData);
        setTransfers(transferData);
        setWastageLogs(wastageData);
      } catch (err) {
        if (!isMounted) {
          return;
        }
        setError(err instanceof ApiError ? err.message : "Failed to load inventory hub data");
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

  useEffect(() => {
    if (isLoading) {
      return;
    }

    async function refreshLedger() {
      try {
        const movementData = await api.get<StockMovement[]>(buildMovementQuery(ledgerFilters));
        setMovements(movementData);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Failed to load stock movements");
      }
    }

    void refreshLedger();
  }, [isLoading, ledgerFilters]);

  async function refreshOperationalData() {
    const [inventoryData, movementData, transferData, wastageData] = await Promise.all([
      api.get<InventoryItem[]>("/inventory?skip=0&limit=100"),
      api.get<StockMovement[]>(buildMovementQuery(ledgerFilters)),
      api.get<StockTransfer[]>("/stock-transfers?skip=0&limit=100"),
      api.get<WastageLog[]>("/wastage-logs?skip=0&limit=100"),
    ]);
    setInventoryItems(inventoryData);
    setMovements(movementData);
    setTransfers(transferData);
    setWastageLogs(wastageData);
  }

  async function handleCreateInventoryItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsInventorySubmitting(true);

    try {
      await api.post<InventoryItem>("/inventory", {
        product_id: inventoryForm.product_id || null,
        variant_id: inventoryForm.variant_id || null,
        warehouse_id: inventoryForm.warehouse_id,
        quantity: toNumber(inventoryForm.quantity),
        low_stock_threshold: toNumber(inventoryForm.low_stock_threshold),
      });
      setInventoryForm(initialInventoryForm);
      await refreshOperationalData();
      setSuccess("Inventory item created successfully.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create inventory item");
    } finally {
      setIsInventorySubmitting(false);
    }
  }

  async function handleAdjustStock(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsAdjusting(true);

    try {
      await api.post<InventoryItem>(`/inventory/${adjustmentForm.inventory_item_id}/adjust`, {
        new_quantity:
          adjustmentForm.mode === "new_quantity" ? toNumber(adjustmentForm.new_quantity) : null,
        quantity_delta:
          adjustmentForm.mode === "quantity_delta" ? toNumber(adjustmentForm.quantity_delta) : null,
        note: adjustmentForm.note || null,
      });
      await refreshOperationalData();
      setSuccess("Stock adjusted successfully.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to adjust stock");
    } finally {
      setIsAdjusting(false);
    }
  }

  function updateTransferItem(rowId: string, updater: (item: TransferItemForm) => TransferItemForm) {
    setTransferForm((current) => ({
      ...current,
      items: current.items.map((item) => (item.row_id === rowId ? updater(item) : item)),
    }));
  }

  function handleTransferProductSelect(rowId: string, productId: string) {
    const selectedProduct = productMap.get(productId);
    updateTransferItem(rowId, (item) => ({
      ...item,
      product_id: productId,
      product_name: selectedProduct?.name || "",
      sku: selectedProduct?.sku || "",
    }));
  }

  function addTransferItem() {
    setTransferForm((current) => ({
      ...current,
      items: [...current.items, createTransferItemRow()],
    }));
  }

  function removeTransferItem(rowId: string) {
    setTransferForm((current) => ({
      ...current,
      items:
        current.items.length === 1
          ? [createTransferItemRow()]
          : current.items.filter((item) => item.row_id !== rowId),
    }));
  }

  async function handleCreateTransfer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsTransferSubmitting(true);

    try {
      await api.post<StockTransfer>("/stock-transfers", {
        transfer_number: transferForm.transfer_number,
        from_warehouse_id: transferForm.from_warehouse_id,
        to_warehouse_id: transferForm.to_warehouse_id,
        status: transferForm.status,
        notes: transferForm.notes || null,
        items: transferForm.items
          .filter((item) => item.product_id && toNumber(item.quantity) > 0)
          .map((item) => ({
            product_id: item.product_id || null,
            variant_id: null,
            product_name: item.product_name,
            sku: item.sku || null,
            quantity: toNumber(item.quantity),
          })),
      });
      setTransferForm(initialTransferForm);
      await refreshOperationalData();
      setSuccess("Stock transfer created successfully.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create stock transfer");
    } finally {
      setIsTransferSubmitting(false);
    }
  }

  async function handleCompleteTransfer(transferId: string) {
    setError("");
    setSuccess("");
    setTransferUpdatingId(transferId);

    try {
      await api.patch<StockTransfer>(`/stock-transfers/${transferId}`, {
        status: "completed",
      });
      await refreshOperationalData();
      setSuccess("Stock transfer completed successfully.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to complete stock transfer");
    } finally {
      setTransferUpdatingId(null);
    }
  }

  async function handleCreateWastage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsWastageSubmitting(true);

    try {
      await api.post<WastageLog>("/wastage-logs", {
        wastage_number: wastageForm.wastage_number,
        product_id: wastageForm.product_id || null,
        variant_id: null,
        warehouse_id: wastageForm.warehouse_id,
        quantity: toNumber(wastageForm.quantity),
        reason: wastageForm.reason || null,
        note: wastageForm.note || null,
      });
      setWastageForm(initialWastageForm);
      await refreshOperationalData();
      setSuccess("Wastage logged and stock deducted successfully.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create wastage log");
    } finally {
      setIsWastageSubmitting(false);
    }
  }

  function startAdjustment(inventoryItem: InventoryItem) {
    setActiveTab("adjustments");
    setAdjustmentForm({
      inventory_item_id: inventoryItem.id,
      mode: "new_quantity",
      new_quantity: String(inventoryItem.quantity),
      quantity_delta: "0",
      note: "",
    });
  }

  return (
    <div className="space-y-4">
      <section className="card-base p-6 sm:p-8">
        <OpsPageHeader
          eyebrow="Inventory Operations"
          title="Inventory Hub"
          description="Work stock overview, adjustments, transfers, wastage, and movement review from one denser inventory workspace that feels closer to the original v1 operations hub."
          meta={
            <div className="space-y-1">
              <p className="ops-micro-label !text-[10px]">Inventory Rows</p>
              <p className="text-sm font-semibold text-[var(--color-txt-pri)]">{inventoryItems.length} rows</p>
            </div>
          }
        />
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <OpsSummaryCard eyebrow="Stock" label="Inventory Items" value={inventoryItems.length} icon={Boxes} />
          <OpsSummaryCard eyebrow="Attention" label="Low Stock" value={lowStockCount} icon={AlertTriangle} tone="warning" />
          <OpsSummaryCard eyebrow="Urgent" label="Out of Stock" value={outOfStockCount} icon={PackageMinus} tone="danger" />
          <OpsSummaryCard eyebrow="Ledger" label="Recent Movements" value={movements.length} icon={PencilLine} tone="info" />
          <OpsSummaryCard eyebrow="Routing" label="Transfers" value={transfers.length} icon={ArrowRightLeft} />
          <OpsSummaryCard eyebrow="Losses" label="Wastage" value={wastageLogs.length} icon={PackageMinus} tone="warning" />
        </div>
      </section>

      <section className="card-base p-4 sm:p-6">
        <div className="space-y-3">
          <div>
            <p className="ops-micro-label">Inventory Views</p>
            <p className="mt-2 text-sm text-[var(--color-txt-sec)]">
              Switch between the stock floor, adjustments, transfers, wastage, and movement ledger without leaving the hub.
            </p>
          </div>
          <OpsTabs
            tabs={tabs.map((tab) => ({ id: tab.id, label: tab.label }))}
            activeTab={activeTab}
            onChange={(value) => setActiveTab(value as (typeof tabs)[number]["id"])}
          />
        </div>
      </section>

      {error ? <ErrorAlert message={error} /> : null}
      {success ? (
        <div className="rounded-[28px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-700 shadow-[var(--shadow-soft)]">
          {success}
        </div>
      ) : null}

      {isLoading ? (
        <LoadingState label="Loading inventory hub..." />
      ) : null}

      {!isLoading && activeTab === "overview" ? (
        <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <FormCard
            title="Create inventory item"
            description="Assign a product to a warehouse with its opening quantity and threshold."
            action={
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <Boxes className="h-5 w-5" />
              </div>
            }
          >
            <form onSubmit={handleCreateInventoryItem} className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Product</span>
                <select
                  value={inventoryForm.product_id}
                  onChange={(event) =>
                    setInventoryForm((current) => ({ ...current, product_id: event.target.value }))
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
                <span className="mb-2 block text-sm font-medium text-slate-700">Warehouse</span>
                <select
                  value={inventoryForm.warehouse_id}
                  onChange={(event) =>
                    setInventoryForm((current) => ({ ...current, warehouse_id: event.target.value }))
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
                <span className="mb-2 block text-sm font-medium text-slate-700">Variant ID</span>
                <input
                  value={inventoryForm.variant_id}
                  onChange={(event) =>
                    setInventoryForm((current) => ({ ...current, variant_id: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                  placeholder="Optional variant UUID"
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Quantity</span>
                  <input
                    type="number"
                    min="0"
                    value={inventoryForm.quantity}
                    onChange={(event) =>
                      setInventoryForm((current) => ({ ...current, quantity: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                    required
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Low stock threshold</span>
                  <input
                    type="number"
                    min="0"
                    value={inventoryForm.low_stock_threshold}
                    onChange={(event) =>
                      setInventoryForm((current) => ({
                        ...current,
                        low_stock_threshold: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                    required
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={isInventorySubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isInventorySubmitting ? (
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

          <section className="card-base p-6">
            <OpsPageHeader
              eyebrow="Stock Overview"
              title="Inventory levels"
              description="Review stock by product and warehouse, then jump directly into an adjustment workflow from the same dense overview table."
            />

            <div className="mt-6 space-y-4">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setLedgerFilters((current) => ({ ...current, movement_type: "adjustment" }))}
                  className="ops-filter-chip border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100"
                >
                  Recent adjustments
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("ledger")}
                  className="ops-filter-chip border-slate-200 bg-slate-100 text-slate-700 hover:bg-white"
                >
                  Open movement ledger
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("transfers")}
                  className="ops-filter-chip border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                >
                  Review transfers
                </button>
              </div>
              {inventoryItems.length === 0 ? (
                <EmptyState
                  title="No inventory yet"
                  description="Create the first inventory item to begin using the operations hub."
                />
              ) : (
                <DataTable columns={["Product", "Warehouse", "Quantity", "Threshold", "Status", "Action"]}>
                  {inventoryItems.map((item) => {
                    const stockStatus = getStockStatus(item.quantity, item.low_stock_threshold);
                    return (
                      <div
                        key={item.id}
                        className="grid grid-cols-1 gap-4 px-5 py-5 text-sm text-[var(--color-txt-sec)] xl:grid-cols-6 xl:gap-5"
                      >
                        <div className="space-y-1">
                          <span className="font-medium text-[var(--color-txt-pri)]">
                            {item.product_id ? productMap.get(item.product_id)?.name || "Unknown product" : "No product"}
                          </span>
                          <p className="text-xs text-[var(--color-txt-mut)]">
                            SKU {item.product_id ? productMap.get(item.product_id)?.sku || "No SKU" : "None"}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <span>{warehouseMap.get(item.warehouse_id)?.name || "Unknown warehouse"}</span>
                          <p className="text-xs text-[var(--color-txt-mut)]">{warehouseMap.get(item.warehouse_id)?.code || item.warehouse_id}</p>
                        </div>
                        <span className="font-semibold text-slate-950">{item.quantity}</span>
                        <span>{item.low_stock_threshold}</span>
                        <span>
                          <StatusBadge status={stockStatus} />
                        </span>
                        <button
                          type="button"
                          onClick={() => startAdjustment(item)}
                          className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                        >
                          <PencilLine className="h-3.5 w-3.5" />
                          Adjust Stock
                        </button>
                      </div>
                    );
                  })}
                </DataTable>
              )}
            </div>
          </section>
        </div>
      ) : null}

      {!isLoading && activeTab === "adjustments" ? (
        <div className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
          <FormCard
            title="Adjust stock"
            description="Apply a corrected quantity or a positive or negative delta, then record a note for the movement ledger."
            action={
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <PencilLine className="h-5 w-5" />
              </div>
            }
          >
            <form onSubmit={handleAdjustStock} className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Inventory item</span>
                <select
                  value={adjustmentForm.inventory_item_id}
                  onChange={(event) =>
                    setAdjustmentForm((current) => ({ ...current, inventory_item_id: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                  required
                >
                  <option value="">Select inventory row</option>
                  {inventoryItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {(item.product_id ? productMap.get(item.product_id)?.name : "Unknown product") || "Unknown product"} /{" "}
                      {(warehouseMap.get(item.warehouse_id)?.name || "Unknown warehouse")} / Qty {item.quantity}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Adjustment mode</span>
                  <select
                    value={adjustmentForm.mode}
                    onChange={(event) =>
                      setAdjustmentForm((current) => ({
                        ...current,
                        mode: event.target.value as AdjustmentForm["mode"],
                      }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                  >
                    <option value="new_quantity">Set new quantity</option>
                    <option value="quantity_delta">Apply quantity delta</option>
                  </select>
                </label>

                {adjustmentForm.mode === "new_quantity" ? (
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">New quantity</span>
                    <input
                      type="number"
                      min="0"
                      value={adjustmentForm.new_quantity}
                      onChange={(event) =>
                        setAdjustmentForm((current) => ({ ...current, new_quantity: event.target.value }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                    />
                  </label>
                ) : (
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Quantity delta</span>
                    <input
                      type="number"
                      value={adjustmentForm.quantity_delta}
                      onChange={(event) =>
                        setAdjustmentForm((current) => ({ ...current, quantity_delta: event.target.value }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                    />
                  </label>
                )}
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Note</span>
                <textarea
                  rows={3}
                  value={adjustmentForm.note}
                  onChange={(event) =>
                    setAdjustmentForm((current) => ({ ...current, note: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                  placeholder="Cycle count correction, damaged stock recount, manual reconciliation..."
                />
              </label>

              <button
                type="submit"
                disabled={isAdjusting}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isAdjusting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Adjusting...
                  </>
                ) : (
                  <>
                    <PencilLine className="h-4 w-4" />
                    Adjust Stock
                  </>
                )}
              </button>
            </form>
          </FormCard>

          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
            <PageHeader
              eyebrow="Recent Adjustments"
              title="Adjustment trail"
              description="Review stock corrections alongside the previous and new quantities."
            />

            <div className="mt-6">
              {movements.filter((movement) => movement.movement_type === "adjustment").length === 0 ? (
                <EmptyState
                  title="No adjustments yet"
                  description="Use the stock adjustment form to create the first inventory correction."
                />
              ) : (
                <DataTable columns={["Date", "Product", "Warehouse", "Movement", "Previous", "New", "Note"]}>
                  {movements
                    .filter((movement) => movement.movement_type === "adjustment")
                    .map((movement) => (
                      <div
                        key={movement.id}
                        className="grid grid-cols-1 gap-3 px-5 py-4 text-sm text-slate-600 xl:grid-cols-7 xl:gap-4"
                      >
                        <span>{formatDate(movement.created_at)}</span>
                        <span className="font-medium text-slate-950">
                          {movement.product_id ? productMap.get(movement.product_id)?.name || "Unknown product" : "No product"}
                        </span>
                        <span>{warehouseMap.get(movement.warehouse_id)?.name || "Unknown warehouse"}</span>
                        <span>
                          <StatusBadge status={movement.movement_type} />
                        </span>
                        <span>{movement.previous_quantity}</span>
                        <span>{movement.new_quantity}</span>
                        <span>{movement.note || "No note"}</span>
                      </div>
                    ))}
                </DataTable>
              )}
            </div>
          </section>
        </div>
      ) : null}

      {!isLoading && activeTab === "transfers" ? (
        <div className="grid gap-4 xl:grid-cols-[0.94fr_1.06fr]">
          <FormCard
            title="Create stock transfer"
            description="Prepare a move between warehouses. Completing the transfer will move stock and create transfer movements."
            action={
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <ArrowRightLeft className="h-5 w-5" />
              </div>
            }
          >
            <form onSubmit={handleCreateTransfer} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Transfer number</span>
                  <input
                    value={transferForm.transfer_number}
                    onChange={(event) =>
                      setTransferForm((current) => ({ ...current, transfer_number: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                    placeholder="TRF-20260511-001"
                    required
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Status</span>
                  <select
                    value={transferForm.status}
                    onChange={(event) =>
                      setTransferForm((current) => ({ ...current, status: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                  >
                    {transferStatuses.map((status) => (
                      <option key={status} value={status}>
                        {formatLabel(status)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">From warehouse</span>
                  <select
                    value={transferForm.from_warehouse_id}
                    onChange={(event) =>
                      setTransferForm((current) => ({ ...current, from_warehouse_id: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                    required
                  >
                    <option value="">Select source warehouse</option>
                    {warehouses.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.name} ({warehouse.code})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">To warehouse</span>
                  <select
                    value={transferForm.to_warehouse_id}
                    onChange={(event) =>
                      setTransferForm((current) => ({ ...current, to_warehouse_id: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                    required
                  >
                    <option value="">Select destination warehouse</option>
                    {warehouses.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.name} ({warehouse.code})
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Notes</span>
                <textarea
                  rows={3}
                  value={transferForm.notes}
                  onChange={(event) =>
                    setTransferForm((current) => ({ ...current, notes: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                  placeholder="Reason for transfer, receiving instructions..."
                />
              </label>

              <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-950">Transfer items</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Completing the transfer will move stock out of the source warehouse and into the destination.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addTransferItem}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                  >
                    <Plus className="h-4 w-4" />
                    Add item
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  {transferForm.items.map((item, index) => (
                    <div key={item.row_id} className="rounded-3xl border border-slate-200 bg-white p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-950">Item {index + 1}</p>
                        <button
                          type="button"
                          onClick={() => removeTransferItem(item.row_id)}
                          className="rounded-2xl px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
                        >
                          Remove
                        </button>
                      </div>

                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <label className="block">
                          <span className="mb-2 block text-sm font-medium text-slate-700">Product</span>
                          <select
                            value={item.product_id}
                            onChange={(event) => handleTransferProductSelect(item.row_id, event.target.value)}
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
                          <span className="mb-2 block text-sm font-medium text-slate-700">Quantity</span>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(event) =>
                              updateTransferItem(item.row_id, (current) => ({
                                ...current,
                                quantity: event.target.value,
                              }))
                            }
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                            required
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={isTransferSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isTransferSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <ArrowRightLeft className="h-4 w-4" />
                    Create Transfer
                  </>
                )}
              </button>
            </form>
          </FormCard>

          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
            <PageHeader
              eyebrow="Transfer Queue"
              title="Stock transfers"
              description="Monitor draft or pending transfer plans and complete them when stock should move."
            />

            <div className="mt-6">
              {transfers.length === 0 ? (
                <EmptyState
                  title="No transfers yet"
                  description="Create the first stock transfer to begin moving stock between warehouses."
                />
              ) : (
                <DataTable columns={["Transfer #", "Route", "Status", "Items", "Moved", "Created", "Actions"]}>
                  {transfers.map((transfer) => (
                    <div
                      key={transfer.id}
                      className="grid grid-cols-1 gap-3 px-5 py-4 text-sm text-slate-600 xl:grid-cols-7 xl:gap-4"
                    >
                      <div>
                        <p className="font-medium text-slate-950">{transfer.transfer_number}</p>
                        <p className="mt-1 text-xs text-slate-500">{transfer.notes || "No notes"}</p>
                      </div>
                      <span>
                        {warehouseMap.get(transfer.from_warehouse_id)?.name || "Unknown"} to{" "}
                        {warehouseMap.get(transfer.to_warehouse_id)?.name || "Unknown"}
                      </span>
                      <span>
                        <StatusBadge status={transfer.status} />
                      </span>
                      <span>{transfer.items.length}</span>
                      <span>
                        <StatusBadge
                          status={transfer.stock_moved ? "completed" : "pending"}
                          label={transfer.stock_moved ? "Moved" : "Not moved"}
                        />
                      </span>
                      <span>{formatDate(transfer.created_at)}</span>
                      <div className="flex flex-wrap gap-2">
                        {!transfer.stock_moved && transfer.status !== "completed" ? (
                          <button
                            type="button"
                            onClick={() => void handleCompleteTransfer(transfer.id)}
                            disabled={transferUpdatingId === transfer.id}
                            className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {transferUpdatingId === transfer.id ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Completing...
                              </>
                            ) : (
                              <>
                                <AlertTriangle className="h-3.5 w-3.5" />
                                Complete Transfer
                              </>
                            )}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-500">Already processed</span>
                        )}
                      </div>
                    </div>
                  ))}
                </DataTable>
              )}
            </div>
          </section>
        </div>
      ) : null}

      {!isLoading && activeTab === "wastage" ? (
        <div className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
          <FormCard
            title="Log wastage"
            description="Record damaged, expired, or unusable stock. Saving this form deducts stock immediately from the selected warehouse."
            action={
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <PackageMinus className="h-5 w-5" />
              </div>
            }
          >
            <form onSubmit={handleCreateWastage} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Wastage number</span>
                  <input
                    value={wastageForm.wastage_number}
                    onChange={(event) =>
                      setWastageForm((current) => ({ ...current, wastage_number: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                    placeholder="WST-20260511-001"
                    required
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Quantity</span>
                  <input
                    type="number"
                    min="1"
                    value={wastageForm.quantity}
                    onChange={(event) =>
                      setWastageForm((current) => ({ ...current, quantity: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                    required
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Product</span>
                <select
                  value={wastageForm.product_id}
                  onChange={(event) =>
                    setWastageForm((current) => ({ ...current, product_id: event.target.value }))
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
                <span className="mb-2 block text-sm font-medium text-slate-700">Warehouse</span>
                <select
                  value={wastageForm.warehouse_id}
                  onChange={(event) =>
                    setWastageForm((current) => ({ ...current, warehouse_id: event.target.value }))
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
                <span className="mb-2 block text-sm font-medium text-slate-700">Reason</span>
                <input
                  value={wastageForm.reason}
                  onChange={(event) =>
                    setWastageForm((current) => ({ ...current, reason: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                  placeholder="Damaged packaging, expiry, broken seal..."
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Note</span>
                <textarea
                  rows={3}
                  value={wastageForm.note}
                  onChange={(event) =>
                    setWastageForm((current) => ({ ...current, note: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                  placeholder="Any investigation or disposal details..."
                />
              </label>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                Saving a wastage log deducts stock immediately and creates a `wastage` movement record.
              </div>

              <button
                type="submit"
                disabled={isWastageSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isWastageSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Logging...
                  </>
                ) : (
                  <>
                    <PackageMinus className="h-4 w-4" />
                    Create Wastage Log
                  </>
                )}
              </button>
            </form>
          </FormCard>

          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
            <PageHeader
              eyebrow="Wastage Trail"
              title="Wastage logs"
              description="Review stock deducted for damaged or unusable goods."
            />

            <div className="mt-6">
              {wastageLogs.length === 0 ? (
                <EmptyState
                  title="No wastage logs yet"
                  description="Create the first wastage log to track stock losses with movement history."
                />
              ) : (
                <DataTable columns={["Wastage #", "Product", "Warehouse", "Quantity", "Status", "Created", "Reason"]}>
                  {wastageLogs.map((log) => (
                    <div
                      key={log.id}
                      className="grid grid-cols-1 gap-3 px-5 py-4 text-sm text-slate-600 xl:grid-cols-7 xl:gap-4"
                    >
                      <span className="font-medium text-slate-950">{log.wastage_number}</span>
                      <span>{log.product_id ? productMap.get(log.product_id)?.name || "Unknown product" : "No product"}</span>
                      <span>{warehouseMap.get(log.warehouse_id)?.name || "Unknown warehouse"}</span>
                      <span>{log.quantity}</span>
                      <span>
                        <StatusBadge
                          status={log.stock_deducted ? "completed" : "pending"}
                          label={log.stock_deducted ? "Deducted" : "Pending"}
                        />
                      </span>
                      <span>{formatDate(log.created_at)}</span>
                      <span>{log.reason || "No reason"}</span>
                    </div>
                  ))}
                </DataTable>
              )}
            </div>
          </section>
        </div>
      ) : null}

      {!isLoading && activeTab === "ledger" ? (
        <section className="card-base p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <PageHeader
              eyebrow="Movement Ledger"
              title="Stock movements"
              description="Filter by product, warehouse, or movement type without leaving the inventory hub."
              meta={`${movements.length} records`}
            />
            <Link
              href="/dashboard/stock-movements"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
            >
              Open full ledger page
            </Link>
          </div>

          <div className="mt-6">
            <OpsFilterBar
              title="Ledger Filters"
              description="Narrow movement records by product, warehouse, or movement type without leaving the inventory hub."
            >
              <select
                value={ledgerFilters.product_id}
                onChange={(event) =>
                  setLedgerFilters((current) => ({ ...current, product_id: event.target.value }))
                }
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white md:max-w-[240px]"
              >
                <option value="">All products</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>

              <select
                value={ledgerFilters.warehouse_id}
                onChange={(event) =>
                  setLedgerFilters((current) => ({ ...current, warehouse_id: event.target.value }))
                }
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white md:max-w-[240px]"
              >
                <option value="">All warehouses</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </option>
                ))}
              </select>

              <select
                value={ledgerFilters.movement_type}
                onChange={(event) =>
                  setLedgerFilters((current) => ({ ...current, movement_type: event.target.value }))
                }
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white md:max-w-[260px]"
              >
                <option value="">All movement types</option>
                {["stock_in", "adjustment", "order_fulfilled", "transfer_out", "transfer_in", "wastage", "return_restocked", "purchase_received"].map((movementType) => (
                  <option key={movementType} value={movementType}>
                    {formatLabel(movementType)}
                  </option>
                ))}
              </select>
            </OpsFilterBar>
          </div>

          <div className="mt-6">
            {movements.length === 0 ? (
              <EmptyState
                title="No movement records match the filters"
                description="Try another filter set or complete an inventory operation to create movement records."
              />
            ) : (
              <DataTable columns={["Date", "Product", "Warehouse", "Movement", "Quantity", "Previous", "New", "Note"]}>
                {movements.map((movement) => (
                  <div
                    key={movement.id}
                    className="grid grid-cols-1 gap-3 px-5 py-4 text-sm text-slate-600 xl:grid-cols-8 xl:gap-4"
                  >
                    <span>{formatDate(movement.created_at)}</span>
                    <span className="font-medium text-slate-950">
                      {movement.product_id ? productMap.get(movement.product_id)?.name || "Unknown product" : "No product"}
                    </span>
                    <span>{warehouseMap.get(movement.warehouse_id)?.name || "Unknown warehouse"}</span>
                    <span>
                      <StatusBadge status={movement.movement_type} />
                    </span>
                    <span>{movement.quantity}</span>
                    <span>{movement.previous_quantity}</span>
                    <span>{movement.new_quantity}</span>
                    <span>{movement.note || "No note"}</span>
                  </div>
                ))}
              </DataTable>
            )}
          </div>
        </section>
      ) : null}

      {!isLoading && activeTab === "transfers" && transfers.length > 0 ? null : null}
    </div>
  );
}
