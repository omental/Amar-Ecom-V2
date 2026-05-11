"use client";

import { useEffect, useState } from "react";
import { FolderTree, Loader2, Plus } from "lucide-react";

import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorAlert } from "@/components/ui/error-alert";
import { FormCard } from "@/components/ui/form-card";
import { LoadingState } from "@/components/ui/loading-state";
import { PageHeader } from "@/components/ui/page-header";
import { api, ApiError } from "@/lib/api";

type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

type CategoryForm = {
  name: string;
  slug: string;
  description: string;
};

const initialForm: CategoryForm = {
  name: "",
  slug: "",
  description: "",
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<CategoryForm>(initialForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadInitialCategories() {
      try {
        const data = await api.get<Category[]>("/categories?skip=0&limit=20");
        if (!isMounted) return;
        setCategories(data);
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof ApiError ? err.message : "Failed to load categories");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadInitialCategories();

    return () => {
      isMounted = false;
    };
  }, []);

  async function loadCategories() {
    setError("");

    try {
      const data = await api.get<Category[]>("/categories?skip=0&limit=20");
      setCategories(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load categories");
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSubmitting(true);

    try {
      await api.post<Category>("/categories", {
        name: form.name,
        slug: form.slug,
        description: form.description || null,
      });

      setForm(initialForm);
      setSuccess("Category created successfully.");
      await loadCategories();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create category");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)] sm:p-8">
        <PageHeader
          eyebrow="Catalog Structure"
          title="Categories"
          description="Organize your product catalog with clear category groups that can be reused across products and reporting."
          meta={`${categories.length} items`}
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <FormCard
          title="Create category"
          description="Add a category name, unique slug, and optional description for internal structure."
          action={
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <FolderTree className="h-5 w-5" />
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
                placeholder="Electronics"
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
                placeholder="electronics"
                required
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">
                Description
              </span>
              <textarea
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                rows={4}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                placeholder="Optional notes about this category"
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
                  Create Category
                </>
              )}
            </button>
          </form>
        </FormCard>

        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
          <PageHeader
            eyebrow="Saved Records"
            title="Existing categories"
            description="Review the categories currently available to the product catalog."
          />

          <div className="mt-6">
            {isLoading ? (
              <LoadingState label="Loading categories..." />
            ) : categories.length === 0 ? (
              <EmptyState
                title="No categories yet"
                description="Create the first category from the form to start structuring the catalog."
              />
            ) : (
              <DataTable columns={["Name", "Slug", "Description"]}>
                {categories.map((category) => (
                  <div
                    key={category.id}
                    className="grid grid-cols-1 gap-3 px-5 py-4 text-sm text-slate-600 md:grid-cols-3 md:gap-4"
                  >
                    <span className="font-medium text-slate-950">
                      {category.name}
                    </span>
                    <span>{category.slug}</span>
                    <span>{category.description || "No description"}</span>
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
