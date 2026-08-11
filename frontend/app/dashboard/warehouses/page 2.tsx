"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Warehouse } from "lucide-react";

import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorAlert } from "@/components/ui/error-alert";
import { FormCard } from "@/components/ui/form-card";
import { LoadingState } from "@/components/ui/loading-state";
import { OpsPageHeader } from "@/components/ui/ops-page-header";
import { PageHeader } from "@/components/ui/page-header";
import { api, ApiError } from "@/lib/api";

type WarehouseItem = {
  id: string;
  name: string;
  code: string;
  address: string | null;
  is_active: boolean;
};

type WarehouseForm = {
  name: string;
  code: string;
  address: string;
  is_active: boolean;
};

const initialForm: WarehouseForm = {
  name: "",
  code: "",
  address: "",
  is_active: true,
};

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
  const [form, setForm] = useState<WarehouseForm>(initialForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadInitialWarehouses() {
      try {
        const data = await api.get<WarehouseItem[]>("/warehouses?skip=0&limit=20");
        if (!isMounted) return;
        setWarehouses(data);
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof ApiError ? err.message : "Failed to load warehouses");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadInitialWarehouses();
    return () => {
      isMounted = false;
    };
  }, []);

  async function loadWarehouses() {
    setError("");

    try {
      const data = await api.get<WarehouseItem[]>("/warehouses?skip=0&limit=20");
      setWarehouses(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load warehouses");
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSubmitting(true);

    try {
      await api.post<WarehouseItem>("/warehouses", {
        name: form.name,
        code: form.code,
        address: form.address || null,
        is_active: form.is_active,
      });
      setForm(initialForm);
      setSuccess("Warehouse created successfully.");
      await loadWarehouses();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create warehouse");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="card-base p-6 sm:p-8">
        <OpsPageHeader
          eyebrow="Storage Network"
          title="Warehouses"
          description="Create warehouse records used for stock allocation, inventory visibility, and future transfer workflows."
          meta={<span className="text-sm font-semibold text-[var(--color-txt-pri)]">{warehouses.length} items</span>}
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <FormCard
          title="Create warehouse"
          description="Register a storage location with a unique code, address, and active status."
          action={
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <Warehouse className="h-5 w-5" />
            </div>
          }
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                Name
              </span>
              <input
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                placeholder="Main Warehouse"
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                Code
              </span>
              <input
                value={form.code}
                onChange={(event) =>
                  setForm((current) => ({ ...current, code: event.target.value }))
                }
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                placeholder="MAIN-WH"
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                Address
              </span>
              <textarea
                rows={4}
                value={form.address}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    address: event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                placeholder="Dhaka"
              />
            </label>

            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    is_active: event.target.checked,
                  }))
                }
                className="h-4 w-4 rounded border-slate-300 text-slate-950 focus:ring-slate-400"
              />
              <span className="text-sm font-medium text-slate-700">
                Warehouse is active
              </span>
            </label>

            {error ? <ErrorAlert message={error} /> : null}
            {success ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {success}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
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
                  Create Warehouse
                </>
              )}
            </button>
          </form>
        </FormCard>

        <section className="card-base p-6">
          <PageHeader
            eyebrow="Saved Records"
            title="Existing warehouses"
            description="Monitor the list of storage locations currently available to inventory operations."
          />

          <div className="mt-6">
            {isLoading ? (
              <LoadingState label="Loading warehouses..." />
            ) : warehouses.length === 0 ? (
              <EmptyState
                title="No warehouses yet"
                description="Create the first warehouse from the form to prepare inventory allocation."
              />
            ) : (
              <DataTable columns={["Name", "Code", "Address", "Status"]}>
                {warehouses.map((warehouse) => (
                  <div
                    key={warehouse.id}
                    className="grid grid-cols-1 gap-3 px-5 py-4 text-sm text-slate-600 md:grid-cols-4 md:gap-4"
                  >
                    <span className="font-medium text-slate-950">
                      {warehouse.name}
                    </span>
                    <span>{warehouse.code}</span>
                    <span>{warehouse.address || "No address"}</span>
                    <span
                      className={
                        warehouse.is_active
                          ? "font-medium text-emerald-700"
                          : "font-medium text-slate-400"
                      }
                    >
                      {warehouse.is_active ? "Active" : "Inactive"}
                    </span>
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
