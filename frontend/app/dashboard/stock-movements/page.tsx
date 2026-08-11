"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRightLeft } from "lucide-react";
import Link from "next/link";

import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { api, ApiError } from "@/lib/api";
import { formatCount, formatDate } from "@/lib/format";

type StockMovement = {
  id: string;
  product_id: string | null;
  variant_id: string | null;
  warehouse_id: string;
  order_id: string | null;
  order_number: string | null;
  movement_type: string;
  quantity: number;
  previous_quantity: number;
  new_quantity: number;
  note: string | null;
  created_at: string;
};

type ProductOption = {
  id: string;
  name: string;
};

type WarehouseOption = {
  id: string;
  name: string;
};

export default function StockMovementsPage() {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const productMap = useMemo(
    () => new Map(products.map((product) => [product.id, product.name])),
    [products],
  );
  const warehouseMap = useMemo(
    () => new Map(warehouses.map((warehouse) => [warehouse.id, warehouse.name])),
    [warehouses],
  );

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const [movementData, productData, warehouseData] = await Promise.all([
          api.get<StockMovement[]>("/stock-movements?skip=0&limit=50"),
          api.get<ProductOption[]>("/products?skip=0&limit=100"),
          api.get<WarehouseOption[]>("/warehouses?skip=0&limit=100"),
        ]);

        if (!isMounted) return;
        setMovements(movementData);
        setProducts(productData);
        setWarehouses(warehouseData);
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof ApiError ? err.message : "Failed to load stock movements");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)] sm:p-8">
        <PageHeader
          eyebrow="Audit Trail"
          title="Stock Movements"
          description="Review stock-in, adjustments, and order-driven deductions across products and warehouses."
          meta={formatCount(movements.length, "record")}
        />
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
            <ArrowRightLeft className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Movement history</h2>
            <p className="mt-1 text-sm text-slate-500">
              Every stock change is recorded here for traceability.
            </p>
          </div>
        </div>

        <div className="mt-6">
          {error ? <ErrorAlert message={error} /> : null}
          {isLoading ? (
            <LoadingState label="Loading stock movements..." />
          ) : movements.length === 0 ? (
            <EmptyState
              title="No stock movements yet"
              description="Create inventory and fulfill an order to build the first movement records."
            />
          ) : (
            <DataTable
              columns={["Date", "Product / Warehouse", "Movement", "Quantity Change", "Related Order", "Note"]}
              columnTemplate="minmax(140px,0.8fr) minmax(250px,1.5fr) minmax(170px,1fr) minmax(180px,1fr) minmax(160px,0.9fr) minmax(240px,1.4fr)"
              minWidth="1040px"
            >
              {movements.map((movement) => (
                <div
                  key={movement.id}
                  className="grid items-center gap-4 px-5 py-4 text-sm text-slate-600"
                  style={{ gridTemplateColumns: "minmax(140px,0.8fr) minmax(250px,1.5fr) minmax(170px,1fr) minmax(180px,1fr) minmax(160px,0.9fr) minmax(240px,1.4fr)" }}
                >
                  <span>{formatDate(movement.created_at)}</span>
                  <div><span className="font-medium text-slate-950">
                    {movement.product_id
                      ? productMap.get(movement.product_id) || "Unknown product"
                      : "No product"}
                  </span><p className="mt-1 text-xs text-slate-500">{warehouseMap.get(movement.warehouse_id) || "Unknown warehouse"}</p></div>
                  <span>
                    <StatusBadge status={movement.movement_type} />
                  </span>
                  <div><p className="font-semibold text-slate-950">{movement.new_quantity - movement.previous_quantity > 0 ? "+" : ""}{movement.new_quantity - movement.previous_quantity}</p><p className="mt-1 text-xs text-slate-500">{movement.previous_quantity} → {movement.new_quantity}</p></div>
                  <span>{movement.order_id && movement.order_number ? <Link href={`/dashboard/orders/${movement.order_id}`} className="font-semibold text-sky-700 hover:underline">{movement.order_number}</Link> : "No related order"}</span>
                  <span>{movement.note || "No note"}</span>
                </div>
              ))}
            </DataTable>
          )}
        </div>
      </section>
    </div>
  );
}
