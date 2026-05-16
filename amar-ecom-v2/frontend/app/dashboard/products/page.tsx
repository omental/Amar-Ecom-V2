"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Boxes, Loader2, Pencil, Plus, Rows3, Search, RefreshCw, Tag } from "lucide-react";

import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorAlert } from "@/components/ui/error-alert";
import { FormCard } from "@/components/ui/form-card";
import { LoadingState } from "@/components/ui/loading-state";
import { OpsFilterBar } from "@/components/ui/ops-filter-bar";
import { OpsPageHeader } from "@/components/ui/ops-page-header";
import { OpsSummaryCard } from "@/components/ui/ops-summary-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { api, ApiError } from "@/lib/api";
import { formatCurrency } from "@/lib/format";

type OptionItem = {
  id: string;
  name: string;
};

type Product = {
  id: string;
  name: string;
  slug: string;
  sku: string;
  description: string | null;
  category_id: string | null;
  brand_id: string | null;
  price: string | number;
  cost_price: string | number;
  image_url: string | null;
  status: string;
  source?: string | null;
  external_id?: string | null;
  external_status?: string | null;
  external_synced_at?: string | null;
  external_stock_quantity?: number | null;
  category?: { id: string; name: string } | null;
  brand?: { id: string; name: string } | null;
  variants?: Array<{ id: string }>;
};

type ProductForm = {
  name: string;
  slug: string;
  sku: string;
  description: string;
  category_id: string;
  brand_id: string;
  price: string;
  cost_price: string;
  image_url: string;
  status: string;
};

const initialForm: ProductForm = {
  name: "",
  slug: "",
  sku: "",
  description: "",
  category_id: "",
  brand_id: "",
  price: "",
  cost_price: "",
  image_url: "",
  status: "active",
};

function productToForm(product: Product): ProductForm {
  return {
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    description: product.description || "",
    category_id: product.category_id || "",
    brand_id: product.brand_id || "",
    price: String(product.price),
    cost_price: String(product.cost_price),
    image_url: product.image_url || "",
    status: product.status,
  };
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<OptionItem[]>([]);
  const [brands, setBrands] = useState<OptionItem[]>([]);
  const [form, setForm] = useState<ProductForm>(initialForm);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState<ProductForm>(initialForm);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const filteredProducts = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    return products.filter((product) => {
      if (statusFilter && product.status !== statusFilter) {
        return false;
      }
      if (!search) {
        return true;
      }
      return [product.name, product.sku, product.category?.name, product.brand?.name, product.source]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search);
    });
  }, [products, searchTerm, statusFilter]);

  useEffect(() => {
    let isMounted = true;

    async function loadInitialData() {
      try {
        const [productsData, categoriesData, brandsData] = await Promise.all([
          api.get<Product[]>("/products?skip=0&limit=20"),
          api.get<OptionItem[]>("/categories?skip=0&limit=100"),
          api.get<OptionItem[]>("/brands?skip=0&limit=100"),
        ]);

        if (!isMounted) return;
        setProducts(productsData);
        setCategories(categoriesData);
        setBrands(brandsData);
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof ApiError ? err.message : "Failed to load product data");
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

  async function loadProducts() {
    setError("");
    const data = await api.get<Product[]>("/products?skip=0&limit=20");
    setProducts(data);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSubmitting(true);

    try {
      await api.post<Product>("/products", {
        name: form.name,
        slug: form.slug,
        sku: form.sku,
        description: form.description || null,
        category_id: form.category_id || null,
        brand_id: form.brand_id || null,
        price: Number(form.price),
        cost_price: Number(form.cost_price),
        image_url: form.image_url || null,
        status: form.status,
        variants: [],
      });
      setForm(initialForm);
      setSuccess("Product created successfully.");
      await loadProducts();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create product");
    } finally {
      setIsSubmitting(false);
    }
  }

  function startEditing(product: Product) {
    setEditingProduct(product);
    setEditForm(productToForm(product));
    setError("");
    setSuccess("");
  }

  function cancelEditing() {
    setEditingProduct(null);
    setEditForm(initialForm);
  }

  async function handleSaveProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingProduct) return;

    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
      await api.patch<Product>(`/products/${editingProduct.id}`, {
        name: editForm.name,
        slug: editForm.slug,
        sku: editForm.sku,
        description: editForm.description || null,
        category_id: editForm.category_id || null,
        brand_id: editForm.brand_id || null,
        price: Number(editForm.price),
        cost_price: Number(editForm.cost_price),
        image_url: editForm.image_url || null,
        status: editForm.status,
      });
      await loadProducts();
      setSuccess("Product updated successfully.");
      cancelEditing();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update product");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="card-base p-6 sm:p-8">
          <OpsPageHeader
            eyebrow="Catalog Core"
            title="Products"
            description="Manage the product catalog with denser v1-style admin framing, then jump into the dedicated product workspace for variants, inventory, and WooCommerce-linked metadata."
            meta={
              <div className="space-y-1">
                <p className="ops-micro-label !text-[10px]">Catalog Size</p>
                <p className="text-sm font-semibold text-[var(--color-txt-pri)]">{products.length} items</p>
              </div>
            }
          />
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <OpsSummaryCard eyebrow="Catalog" label="Total Products" value={products.length} icon={Boxes} />
            <OpsSummaryCard eyebrow="Status" label="Active Products" value={products.filter((product) => product.status === "active").length} icon={Tag} tone="success" />
            <OpsSummaryCard eyebrow="Channel" label="Woo Products" value={products.filter((product) => product.source === "woocommerce").length} icon={RefreshCw} tone="info" />
            <OpsSummaryCard eyebrow="Variants" label="Variant Rows" value={products.reduce((sum, product) => sum + (product.variants?.length || 0), 0)} icon={Rows3} />
          </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-4">
          <FormCard
            title="Create product"
            description="Add a product with pricing, SKU, status, and optional category or brand relationships."
            action={
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <Boxes className="h-5 w-5" />
              </div>
            }
          >
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
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
                    placeholder="Sample Product"
                    required
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    SKU
                  </span>
                  <input
                    value={form.sku}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, sku: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                    placeholder="SKU-1001"
                    required
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
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
                    placeholder="sample-product"
                    required
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    Status
                  </span>
                  <select
                    value={form.status}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        status: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
              </div>

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
                  placeholder="Product description"
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    Category
                  </span>
                  <select
                    value={form.category_id}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        category_id: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                  >
                    <option value="">No category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    Brand
                  </span>
                  <select
                    value={form.brand_id}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        brand_id: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                  >
                    <option value="">No brand</option>
                    {brands.map((brand) => (
                      <option key={brand.id} value={brand.id}>
                        {brand.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    Price
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.price}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, price: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                    placeholder="999.99"
                    required
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    Cost price
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.cost_price}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        cost_price: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                    placeholder="650.00"
                    required
                  />
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Image URL
                </span>
                <input
                  value={form.image_url}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      image_url: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                  placeholder="https://example.com/image.png"
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
                    Create Product
                  </>
                )}
              </button>
            </form>
          </FormCard>

          {editingProduct ? (
            <FormCard
              title="Edit product"
            description="Update core product details here, or open the full management page for variants and inventory context."
              action={
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  <Pencil className="h-5 w-5" />
                </div>
              }
            >
              <form onSubmit={handleSaveProduct} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">
                      Name
                    </span>
                    <input
                      value={editForm.name}
                      onChange={(event) =>
                        setEditForm((current) => ({ ...current, name: event.target.value }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                      required
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">
                      SKU
                    </span>
                    <input
                      value={editForm.sku}
                      onChange={(event) =>
                        setEditForm((current) => ({ ...current, sku: event.target.value }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                      required
                    />
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">
                      Slug
                    </span>
                    <input
                      value={editForm.slug}
                      onChange={(event) =>
                        setEditForm((current) => ({ ...current, slug: event.target.value }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                      required
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">
                      Status
                    </span>
                    <select
                      value={editForm.status}
                      onChange={(event) =>
                        setEditForm((current) => ({
                          ...current,
                          status: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </label>
                </div>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    Description
                  </span>
                  <textarea
                    rows={4}
                    value={editForm.description}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                  />
                </label>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">
                      Category
                    </span>
                    <select
                      value={editForm.category_id}
                      onChange={(event) =>
                        setEditForm((current) => ({
                          ...current,
                          category_id: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                    >
                      <option value="">No category</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">
                      Brand
                    </span>
                    <select
                      value={editForm.brand_id}
                      onChange={(event) =>
                        setEditForm((current) => ({
                          ...current,
                          brand_id: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                    >
                      <option value="">No brand</option>
                      {brands.map((brand) => (
                        <option key={brand.id} value={brand.id}>
                          {brand.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">
                      Price
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editForm.price}
                      onChange={(event) =>
                        setEditForm((current) => ({ ...current, price: event.target.value }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                      required
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">
                      Cost price
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editForm.cost_price}
                      onChange={(event) =>
                        setEditForm((current) => ({
                          ...current,
                          cost_price: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                      required
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    Image URL
                  </span>
                  <input
                    value={editForm.image_url}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        image_url: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                  />
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
                      "Save Product"
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

        <section className="card-base p-6">
          <OpsPageHeader
            eyebrow="Saved Records"
            title="Existing products"
            description="Review the catalog with denser row metadata, local filtering, Woo markers, and direct actions into product detail or variant management."
          />

          <div className="mt-6 space-y-4">
            <OpsFilterBar
              title="Catalog Filters"
              description="Filter the loaded product set by text or status without changing the underlying product API behavior."
            >
              <div className="relative min-w-[260px] flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-txt-mut)]" />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] py-3 pl-11 pr-4 text-sm text-[var(--color-txt-pri)] outline-none transition focus:border-slate-400 focus:bg-white"
                  placeholder="Search by name, SKU, category, brand, or source"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm text-[var(--color-txt-pri)] outline-none transition focus:border-slate-400 focus:bg-white"
              >
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </OpsFilterBar>
            {error ? <ErrorAlert message={error} /> : null}
            {isLoading ? (
              <LoadingState label="Loading products..." />
            ) : filteredProducts.length === 0 ? (
              <EmptyState
                title="No products match this view"
                description="Try another search or status filter, or create a new product from the left-side form."
              />
            ) : (
              <DataTable
                columns={[
                  "Name",
                  "SKU",
                  "Category",
                  "Brand",
                  "Price",
                  "Cost",
                  "Status",
                  "Actions",
                ]}
              >
                {filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    className="grid grid-cols-1 gap-4 px-5 py-5 text-sm text-[var(--color-txt-sec)] 2xl:grid-cols-8 2xl:gap-5"
                  >
                    <div>
                      <span className="font-medium text-[var(--color-txt-pri)]">{product.name}</span>
                      <p className="mt-1 text-xs text-[var(--color-txt-mut)]">
                        {product.variants?.length || 0} variants
                      </p>
                      {product.source === "woocommerce" ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                          <StatusBadge status="woocommerce" label="WooCommerce" />
                          {product.external_status ? <StatusBadge status={product.external_status} label={`Woo ${product.external_status}`} /> : null}
                        </div>
                      ) : null}
                      {product.external_synced_at ? (
                        <p className="mt-1 text-xs text-[var(--color-txt-mut)]">Synced {product.external_synced_at}</p>
                      ) : null}
                    </div>
                    <span className="font-medium text-[var(--color-txt-pri)]">{product.sku}</span>
                    <span>{product.category?.name || "Unassigned"}</span>
                    <span>{product.brand?.name || "Unassigned"}</span>
                    <span>{formatCurrency(product.price)}</span>
                    <span>{formatCurrency(product.cost_price)}</span>
                    <span>
                      <StatusBadge status={product.status} />
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => startEditing(product)}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <Link
                        href={`/dashboard/products/${product.id}`}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                      >
                        <Rows3 className="h-3.5 w-3.5" />
                        Manage Variants
                      </Link>
                      {product.source === "woocommerce" && product.external_id ? (
                        <Link
                          href={`/dashboard/products/${product.id}`}
                          className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-100"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          Refresh Woo
                        </Link>
                      ) : null}
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
