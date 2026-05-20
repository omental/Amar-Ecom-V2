"use client";

import { useEffect, useState } from "react";
import { BadgePlus, Loader2, Plus } from "lucide-react";

import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorAlert } from "@/components/ui/error-alert";
import { FormCard } from "@/components/ui/form-card";
import { LoadingState } from "@/components/ui/loading-state";
import { OpsPageHeader } from "@/components/ui/ops-page-header";
import { PageHeader } from "@/components/ui/page-header";
import { api, ApiError } from "@/lib/api";

type Brand = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
};

type BrandForm = {
  name: string;
  slug: string;
  description: string;
};

const initialForm: BrandForm = {
  name: "",
  slug: "",
  description: "",
};

export default function BrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [form, setForm] = useState<BrandForm>(initialForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadInitialBrands() {
      try {
        const data = await api.get<Brand[]>("/brands?skip=0&limit=20");
        if (!isMounted) return;
        setBrands(data);
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof ApiError ? err.message : "Failed to load brands");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadInitialBrands();
    return () => {
      isMounted = false;
    };
  }, []);

  async function loadBrands() {
    setError("");

    try {
      const data = await api.get<Brand[]>("/brands?skip=0&limit=20");
      setBrands(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load brands");
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSubmitting(true);

    try {
      await api.post<Brand>("/brands", {
        name: form.name,
        slug: form.slug,
        description: form.description || null,
      });
      setForm(initialForm);
      setSuccess("Brand created successfully.");
      await loadBrands();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create brand");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="card-base p-6 sm:p-8">
        <OpsPageHeader
          eyebrow="Catalog Identity"
          title="Brands"
          description="Manage brand records used by your product catalog and customer-facing merchandising."
          meta={<span className="text-sm font-semibold text-[var(--color-txt-pri)]">{brands.length} items</span>}
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <FormCard
          title="Create brand"
          description="Add a brand with a clean slug and optional internal description."
          action={
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <BadgePlus className="h-5 w-5" />
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
                placeholder="Acme"
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                Slug
              </span>
              <input
                value={form.slug}
                onChange={(event) =>
                  setForm((current) => ({ ...current, slug: event.target.value }))
                }
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                placeholder="acme"
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                Description
              </span>
              <textarea
                rows={4}
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                placeholder="Optional notes about the brand"
              />
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
                  Create Brand
                </>
              )}
            </button>
          </form>
        </FormCard>

        <section className="card-base p-6">
          <PageHeader
            eyebrow="Saved Records"
            title="Existing brands"
            description="Review and verify the brand records available to the catalog."
          />

          <div className="mt-6">
            {isLoading ? (
              <LoadingState label="Loading brands..." />
            ) : brands.length === 0 ? (
              <EmptyState
                title="No brands yet"
                description="Create the first brand from the form to begin organizing product ownership."
              />
            ) : (
              <DataTable columns={["Name", "Slug", "Description"]}>
                {brands.map((brand) => (
                  <div
                    key={brand.id}
                    className="grid grid-cols-1 gap-3 px-5 py-4 text-sm text-slate-600 md:grid-cols-3 md:gap-4"
                  >
                    <span className="font-medium text-slate-950">
                      {brand.name}
                    </span>
                    <span>{brand.slug}</span>
                    <span>{brand.description || "No description"}</span>
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
