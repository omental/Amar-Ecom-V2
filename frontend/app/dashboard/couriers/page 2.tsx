"use client";

import { useEffect, useState } from "react";
import { Loader2, PackageCheck, Pencil, Plus, Truck } from "lucide-react";

import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorAlert } from "@/components/ui/error-alert";
import { FormCard } from "@/components/ui/form-card";
import { LoadingState } from "@/components/ui/loading-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { api, ApiError } from "@/lib/api";

type CourierItem = {
  id: string;
  name: string;
  code: string;
  contact_phone: string | null;
  website: string | null;
  is_active: boolean;
};

type CourierForm = {
  name: string;
  code: string;
  contact_phone: string;
  website: string;
  is_active: boolean;
};

const initialForm: CourierForm = {
  name: "",
  code: "",
  contact_phone: "",
  website: "",
  is_active: true,
};

export default function CouriersPage() {
  const [couriers, setCouriers] = useState<CourierItem[]>([]);
  const [form, setForm] = useState<CourierForm>(initialForm);
  const [editingCourier, setEditingCourier] = useState<CourierItem | null>(null);
  const [editForm, setEditForm] = useState<CourierForm>(initialForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadCouriers() {
      try {
        const data = await api.get<CourierItem[]>("/couriers?skip=0&limit=100");
        if (!isMounted) return;
        setCouriers(data);
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof ApiError ? err.message : "Failed to load couriers");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadCouriers();
    return () => {
      isMounted = false;
    };
  }, []);

  async function refreshCouriers() {
    const data = await api.get<CourierItem[]>("/couriers?skip=0&limit=100");
    setCouriers(data);
  }

  function startEditing(courier: CourierItem) {
    setEditingCourier(courier);
    setEditForm({
      name: courier.name,
      code: courier.code,
      contact_phone: courier.contact_phone || "",
      website: courier.website || "",
      is_active: courier.is_active,
    });
    setError("");
    setSuccess("");
  }

  function cancelEditing() {
    setEditingCourier(null);
    setEditForm(initialForm);
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSubmitting(true);

    try {
      await api.post<CourierItem>("/couriers", {
        name: form.name,
        code: form.code,
        contact_phone: form.contact_phone || null,
        website: form.website || null,
        is_active: form.is_active,
      });
      setForm(initialForm);
      await refreshCouriers();
      setSuccess("Courier created successfully.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create courier");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingCourier) return;

    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
      await api.patch<CourierItem>(`/couriers/${editingCourier.id}`, {
        name: editForm.name,
        code: editForm.code,
        contact_phone: editForm.contact_phone || null,
        website: editForm.website || null,
        is_active: editForm.is_active,
      });
      await refreshCouriers();
      setSuccess("Courier updated successfully.");
      cancelEditing();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update courier");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggle(courier: CourierItem) {
    setError("");
    setSuccess("");

    try {
      if (courier.is_active) {
        await api.delete(`/couriers/${courier.id}`);
        setSuccess(`${courier.name} deactivated successfully.`);
      } else {
        await api.patch<CourierItem>(`/couriers/${courier.id}`, { is_active: true });
        setSuccess(`${courier.name} activated successfully.`);
      }
      await refreshCouriers();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update courier");
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)] sm:p-8">
        <PageHeader
          eyebrow="Logistics Directory"
          title="Couriers"
          description="Maintain the internal courier list used by shipment records, dispatch workflows, and delivery status tracking."
          meta={`${couriers.length} couriers`}
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-4">
          <FormCard
            title="Create courier"
            description="Add a courier record with an internal code, contact number, and website reference."
            action={
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <Truck className="h-5 w-5" />
              </div>
            }
          >
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Name</span>
                  <input
                    value={form.name}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                    placeholder="Steadfast"
                    required
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Code</span>
                  <input
                    value={form.code}
                    onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                    placeholder="STDF"
                    required
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Contact phone</span>
                  <input
                    value={form.contact_phone}
                    onChange={(event) => setForm((current) => ({ ...current, contact_phone: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                    placeholder="017XXXXXXXX"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Website</span>
                  <input
                    value={form.website}
                    onChange={(event) => setForm((current) => ({ ...current, website: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                    placeholder="https://courier.example.com"
                  />
                </label>
              </div>

              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <span className="text-sm font-medium text-slate-700">Courier is active</span>
              </label>

              {error ? <ErrorAlert message={error} /> : null}
              {success ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}

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
                    Create Courier
                  </>
                )}
              </button>
            </form>
          </FormCard>

          {editingCourier ? (
            <FormCard
              title="Edit courier"
              description="Update core courier details or toggle active state without removing shipment history."
              action={
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  <Pencil className="h-5 w-5" />
                </div>
              }
            >
              <form onSubmit={handleSave} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Name</span>
                    <input
                      value={editForm.name}
                      onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Code</span>
                    <input
                      value={editForm.code}
                      onChange={(event) => setEditForm((current) => ({ ...current, code: event.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                      required
                    />
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Contact phone</span>
                    <input
                      value={editForm.contact_phone}
                      onChange={(event) => setEditForm((current) => ({ ...current, contact_phone: event.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Website</span>
                    <input
                      value={editForm.website}
                      onChange={(event) => setEditForm((current) => ({ ...current, website: event.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                    />
                  </label>
                </div>

                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={editForm.is_active}
                    onChange={(event) => setEditForm((current) => ({ ...current, is_active: event.target.checked }))}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <span className="text-sm font-medium text-slate-700">Courier is active</span>
                </label>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Courier"
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={cancelEditing}
                    className="rounded-2xl border border-slate-200 px-4 py-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </FormCard>
          ) : null}
        </div>

        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
          <PageHeader
            eyebrow="Courier List"
            title="Available couriers"
            description="Review couriers available for shipment records and dispatch tracking."
          />

          <div className="mt-6">
            {isLoading ? (
              <LoadingState label="Loading couriers..." />
            ) : couriers.length === 0 ? (
              <EmptyState
                title="No couriers yet"
                description="Create the first courier from the form to begin tracking shipments internally."
              />
            ) : (
              <DataTable columns={["Name", "Code", "Phone", "Website", "Status", "Actions"]}>
                {couriers.map((courier) => (
                  <div key={courier.id} className="grid grid-cols-1 gap-3 px-5 py-4 text-sm text-slate-600 2xl:grid-cols-6 2xl:gap-4">
                    <span className="font-medium text-slate-950">{courier.name}</span>
                    <span>{courier.code}</span>
                    <span>{courier.contact_phone || "No phone"}</span>
                    <span className="truncate">{courier.website || "No website"}</span>
                    <span>
                      <StatusBadge status={courier.is_active ? "active" : "inactive"} />
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => startEditing(courier)}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleToggle(courier)}
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                          courier.is_active
                            ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        }`}
                      >
                        <PackageCheck className="h-3.5 w-3.5" />
                        {courier.is_active ? "Deactivate" : "Activate"}
                      </button>
                    </div>
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
