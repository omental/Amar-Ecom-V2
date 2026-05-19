"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Boxes,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";

import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorAlert } from "@/components/ui/error-alert";
import { FormCard } from "@/components/ui/form-card";
import { LoadingState } from "@/components/ui/loading-state";
import { OpsPageHeader } from "@/components/ui/ops-page-header";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { api, ApiError } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";

type OptionItem = {
  id: string;
  name: string;
};

type Warehouse = {
  id: string;
  name: string;
  code: string;
};

type ProductVariant = {
  id: string;
  product_id: string;
  name: string;
  sku: string;
  price: string | number;
  stock_quantity: number;
  created_at: string;
  updated_at: string;
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
  created_at: string;
  updated_at: string;
  category?: { id: string; name: string } | null;
  brand?: { id: string; name: string } | null;
  variants?: ProductVariant[];
};

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

type VariantForm = {
  name: string;
  sku: string;
  price: string;
  stock_quantity: string;
};

const initialProductForm: ProductForm = {
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

const initialVariantForm: VariantForm = {
  name: "",
  sku: "",
  price: "",
  stock_quantity: "0",
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

function variantToForm(variant: ProductVariant): VariantForm {
  return {
    name: variant.name,
    sku: variant.sku,
    price: String(variant.price),
    stock_quantity: String(variant.stock_quantity),
  };
}

function getStockStatus(quantity: number, threshold: number) {
  if (quantity <= 0) {
    return "out of stock";
  }

  if (quantity <= threshold) {
    return "low stock";
  }

  return "in stock";
}

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const productId = params.id;

  const [product, setProduct] = useState<Product | null>(null);
  const [categories, setCategories] = useState<OptionItem[]>([]);
  const [brands, setBrands] = useState<OptionItem[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [productForm, setProductForm] = useState<ProductForm>(initialProductForm);
  const [variantForm, setVariantForm] = useState<VariantForm>(initialVariantForm);
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [variantEditForm, setVariantEditForm] = useState<VariantForm>(initialVariantForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [isRefreshingWooProduct, setIsRefreshingWooProduct] = useState(false);
  const [isSavingVariant, setIsSavingVariant] = useState(false);
  const [deletingVariantId, setDeletingVariantId] = useState<string | null>(null);
  const [pageError, setPageError] = useState("");
  const [productError, setProductError] = useState("");
  const [variantError, setVariantError] = useState("");
  const [productSuccess, setProductSuccess] = useState("");
  const [variantSuccess, setVariantSuccess] = useState("");

  const warehouseMap = useMemo(
    () => new Map(warehouses.map((warehouse) => [warehouse.id, warehouse])),
    [warehouses],
  );

  useEffect(() => {
    let isMounted = true;

    async function loadInitialData() {
      try {
        const [
          productData,
          variantsData,
          categoriesData,
          brandsData,
          inventoryData,
          warehousesData,
        ] = await Promise.all([
          api.get<Product>(`/products/${productId}`),
          api.get<ProductVariant[]>(`/products/${productId}/variants`),
          api.get<OptionItem[]>("/categories?skip=0&limit=100"),
          api.get<OptionItem[]>("/brands?skip=0&limit=100"),
          api.get<InventoryItem[]>("/inventory?skip=0&limit=100"),
          api.get<Warehouse[]>("/warehouses?skip=0&limit=100"),
        ]);

        if (!isMounted) {
          return;
        }

        setProduct(productData);
        setProductForm(productToForm(productData));
        setVariants(variantsData);
        setCategories(categoriesData);
        setBrands(brandsData);
        setInventoryItems(
          inventoryData.filter((item) => item.product_id === productData.id),
        );
        setWarehouses(warehousesData);
      } catch (err) {
        if (!isMounted) {
          return;
        }
        setPageError(err instanceof ApiError ? err.message : "Failed to load product detail");
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
  }, [productId]);

  async function refreshProductContext() {
    const [productData, variantsData, inventoryData] = await Promise.all([
      api.get<Product>(`/products/${productId}`),
      api.get<ProductVariant[]>(`/products/${productId}/variants`),
      api.get<InventoryItem[]>("/inventory?skip=0&limit=100"),
    ]);

    setProduct(productData);
    setProductForm(productToForm(productData));
    setVariants(variantsData);
    setInventoryItems(inventoryData.filter((item) => item.product_id === productData.id));
  }

  function startEditingVariant(variant: ProductVariant) {
    setEditingVariantId(variant.id);
    setVariantEditForm(variantToForm(variant));
    setVariantError("");
    setVariantSuccess("");
  }

  function cancelEditingVariant() {
    setEditingVariantId(null);
    setVariantEditForm(initialVariantForm);
  }

  async function handleProductSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProductError("");
    setProductSuccess("");
    setIsSavingProduct(true);

    try {
      await api.patch<Product>(`/products/${productId}`, {
        name: productForm.name,
        slug: productForm.slug,
        sku: productForm.sku,
        description: productForm.description || null,
        category_id: productForm.category_id || null,
        brand_id: productForm.brand_id || null,
        price: Number(productForm.price),
        cost_price: Number(productForm.cost_price),
        image_url: productForm.image_url || null,
        status: productForm.status,
      });
      await refreshProductContext();
      setProductSuccess("Product updated successfully.");
    } catch (err) {
      setProductError(err instanceof ApiError ? err.message : "Failed to update product");
    } finally {
      setIsSavingProduct(false);
    }
  }

  async function handleVariantCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setVariantError("");
    setVariantSuccess("");
    setIsSavingVariant(true);

    try {
      await api.post<ProductVariant>(`/products/${productId}/variants`, {
        name: variantForm.name,
        sku: variantForm.sku,
        price: Number(variantForm.price),
        stock_quantity: Number(variantForm.stock_quantity),
      });
      setVariantForm(initialVariantForm);
      await refreshProductContext();
      setVariantSuccess("Variant created successfully.");
    } catch (err) {
      setVariantError(err instanceof ApiError ? err.message : "Failed to create variant");
    } finally {
      setIsSavingVariant(false);
    }
  }

  async function handleVariantUpdate(
    event: React.FormEvent<HTMLFormElement>,
    variantId: string,
  ) {
    event.preventDefault();
    setVariantError("");
    setVariantSuccess("");
    setIsSavingVariant(true);

    try {
      await api.patch<ProductVariant>(`/products/${productId}/variants/${variantId}`, {
        name: variantEditForm.name,
        sku: variantEditForm.sku,
        price: Number(variantEditForm.price),
        stock_quantity: Number(variantEditForm.stock_quantity),
      });
      await refreshProductContext();
      setVariantSuccess("Variant updated successfully.");
      cancelEditingVariant();
    } catch (err) {
      setVariantError(err instanceof ApiError ? err.message : "Failed to update variant");
    } finally {
      setIsSavingVariant(false);
    }
  }

  async function handleVariantDelete(variantId: string) {
    setVariantError("");
    setVariantSuccess("");
    setDeletingVariantId(variantId);

    try {
      await api.delete(`/products/${productId}/variants/${variantId}`);
      await refreshProductContext();
      if (editingVariantId === variantId) {
        cancelEditingVariant();
      }
      setVariantSuccess("Variant deleted successfully.");
    } catch (err) {
      setVariantError(err instanceof ApiError ? err.message : "Failed to delete variant");
    } finally {
      setDeletingVariantId(null);
    }
  }

  async function handleWooProductRefresh() {
    setProductError("");
    setProductSuccess("");
    setIsRefreshingWooProduct(true);
    try {
      await api.post(`/woocommerce/products/${productId}/refresh`, {});
      await refreshProductContext();
      setProductSuccess("WooCommerce product refreshed safely. Local inventory was not changed.");
    } catch (err) {
      setProductError(err instanceof ApiError ? err.message : "Failed to refresh product from WooCommerce");
    } finally {
      setIsRefreshingWooProduct(false);
    }
  }

  if (isLoading) {
    return <LoadingState label="Loading product detail..." />;
  }

  if (pageError) {
    return <ErrorAlert message={pageError} />;
  }

  if (!product) {
    return (
      <EmptyState
        title="Product not found"
        description="The requested product could not be loaded from the backend API."
      />
    );
  }

  return (
    <div className="space-y-4">
      <section className="card-base p-6 sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-4">
            <Link
              href="/dashboard/products"
              className="inline-flex items-center gap-2 rounded-full border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-3 py-2 text-sm font-medium text-[var(--color-txt-sec)] transition hover:bg-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to products
            </Link>
            <OpsPageHeader
              eyebrow="Product Workspace"
              title={product.name}
              description="Update the base product record, manage variants, review warehouse stock, and safely inspect WooCommerce-linked metadata from one denser admin workspace."
              meta={
                <div className="space-y-1">
                  <p className="ops-micro-label !text-[10px]">Variant Count</p>
                  <p className="text-sm font-semibold text-[var(--color-txt-pri)]">{variants.length} variants</p>
                </div>
              }
            />
            {product.source === "woocommerce" ? (
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status="woocommerce" label="WooCommerce" />
                {product.external_status ? <StatusBadge status={product.external_status} label={`WooCommerce ${product.external_status}`} /> : null}
                {product.external_synced_at ? (
                  <span className="text-sm text-slate-500">Last synced {formatDate(product.external_synced_at)}</span>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-3">
            {product.source === "woocommerce" && product.external_id ? (
              <button
                type="button"
                onClick={() => void handleWooProductRefresh()}
                disabled={isRefreshingWooProduct}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-sky-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-800 disabled:opacity-60"
              >
                {isRefreshingWooProduct ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Refresh from WooCommerce
              </button>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-[24px] border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-4">
              <p className="ops-micro-label">SKU</p>
              <p className="mt-3 text-sm font-semibold text-[var(--color-txt-pri)]">{product.sku}</p>
            </div>
            <div className="rounded-[24px] border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-4">
              <p className="ops-micro-label">Price</p>
              <p className="mt-3 text-sm font-semibold text-[var(--color-txt-pri)]">
                {formatCurrency(product.price)}
              </p>
            </div>
            <div className="rounded-[24px] border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-4">
              <p className="ops-micro-label">Status</p>
              <div className="mt-3">
                <StatusBadge status={product.status} />
              </div>
            </div>
            <div className="rounded-[24px] border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-4">
              <p className="ops-micro-label">WooCommerce Stock</p>
              <p className="mt-3 text-sm font-semibold text-[var(--color-txt-pri)]">{product.external_stock_quantity ?? "-"}</p>
            </div>
            </div>
          </div>
        </div>
      </section>

      {product.source === "woocommerce" ? (
        <div className="rounded-[28px] border border-sky-200 bg-sky-50 px-5 py-4 text-sm leading-6 text-sky-800 shadow-[var(--shadow-soft)]">
          Refresh updates WooCommerce metadata safely and does not overwrite local inventory.
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-4">
          <FormCard
            title="Edit product"
            description="Keep the base product record aligned before managing variant-level detail."
            action={
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <Pencil className="h-5 w-5" />
              </div>
            }
          >
            <form onSubmit={handleProductSave} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    Name
                  </span>
                  <input
                    value={productForm.name}
                    onChange={(event) =>
                      setProductForm((current) => ({ ...current, name: event.target.value }))
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
                    value={productForm.sku}
                    onChange={(event) =>
                      setProductForm((current) => ({ ...current, sku: event.target.value }))
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
                    value={productForm.slug}
                    onChange={(event) =>
                      setProductForm((current) => ({ ...current, slug: event.target.value }))
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
                    value={productForm.status}
                    onChange={(event) =>
                      setProductForm((current) => ({
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
                  value={productForm.description}
                  onChange={(event) =>
                    setProductForm((current) => ({
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
                    value={productForm.category_id}
                    onChange={(event) =>
                      setProductForm((current) => ({
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
                    value={productForm.brand_id}
                    onChange={(event) =>
                      setProductForm((current) => ({
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
                    value={productForm.price}
                    onChange={(event) =>
                      setProductForm((current) => ({ ...current, price: event.target.value }))
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
                    value={productForm.cost_price}
                    onChange={(event) =>
                      setProductForm((current) => ({
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
                  value={productForm.image_url}
                  onChange={(event) =>
                    setProductForm((current) => ({
                      ...current,
                      image_url: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                  placeholder="https://example.com/product-image.png"
                />
              </label>

              {productError ? <ErrorAlert message={productError} /> : null}
              {productSuccess ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {productSuccess}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isSavingProduct}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingProduct ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Product"
                )}
              </button>
            </form>
          </FormCard>

          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
            <PageHeader
              eyebrow="Variant Layer"
              title="Variants"
              description="Manage variant-specific SKU and pricing without leaving the product workspace."
              meta={`${variants.length} variants`}
            />

            <div className="mt-6 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
              <FormCard
                title="Create variant"
                description="Add a sellable variant with its own SKU, price, and baseline stock number."
                action={
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                    <Boxes className="h-5 w-5" />
                  </div>
                }
              >
                <form onSubmit={handleVariantCreate} className="space-y-4">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">
                      Variant name
                    </span>
                    <input
                      value={variantForm.name}
                      onChange={(event) =>
                        setVariantForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                      placeholder="Blue / Large"
                      required
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">
                      SKU
                    </span>
                    <input
                      value={variantForm.sku}
                      onChange={(event) =>
                        setVariantForm((current) => ({
                          ...current,
                          sku: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                      placeholder="SKU-1001-BL-L"
                      required
                    />
                  </label>

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">
                        Price
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={variantForm.price}
                        onChange={(event) =>
                          setVariantForm((current) => ({
                            ...current,
                            price: event.target.value,
                          }))
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                        required
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">
                        Stock quantity
                      </span>
                      <input
                        type="number"
                        min="0"
                        value={variantForm.stock_quantity}
                        onChange={(event) =>
                          setVariantForm((current) => ({
                            ...current,
                            stock_quantity: event.target.value,
                          }))
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                        required
                      />
                    </label>
                  </div>

                  {variantError ? <ErrorAlert message={variantError} /> : null}
                  {variantSuccess ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                      {variantSuccess}
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={isSavingVariant}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSavingVariant ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" />
                        Create Variant
                      </>
                    )}
                  </button>
                </form>
              </FormCard>

              {variants.length === 0 ? (
                <EmptyState
                  title="No variants yet"
                  description="Create the first variant when this product needs size, color, or other sellable options."
                />
              ) : (
                <DataTable columns={["Name", "SKU", "Price", "Stock", "Updated", "Actions"]}>
                  {variants.map((variant) => (
                    <div
                      key={variant.id}
                      className="grid grid-cols-1 gap-3 px-5 py-4 text-sm text-slate-600 2xl:grid-cols-6 2xl:gap-4"
                    >
                      <div>
                        <span className="font-medium text-slate-950">{variant.name}</span>
                      </div>
                      <span>{variant.sku}</span>
                      <span>{formatCurrency(variant.price)}</span>
                      <span className="font-semibold text-slate-950">{variant.stock_quantity}</span>
                      <span>{formatDate(variant.updated_at)}</span>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => startEditingVariant(variant)}
                          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleVariantDelete(variant.id)}
                          disabled={deletingVariantId === variant.id}
                          className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {deletingVariantId === variant.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </DataTable>
              )}
            </div>
          </section>

          {editingVariantId ? (
            <FormCard
              title="Edit variant"
              description="Update the selected variant without affecting the parent product record."
              action={
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  <Pencil className="h-5 w-5" />
                </div>
              }
            >
              <form
                onSubmit={(event) => void handleVariantUpdate(event, editingVariantId)}
                className="space-y-4"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">
                      Variant name
                    </span>
                    <input
                      value={variantEditForm.name}
                      onChange={(event) =>
                        setVariantEditForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
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
                      value={variantEditForm.sku}
                      onChange={(event) =>
                        setVariantEditForm((current) => ({
                          ...current,
                          sku: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                      required
                    />
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
                      value={variantEditForm.price}
                      onChange={(event) =>
                        setVariantEditForm((current) => ({
                          ...current,
                          price: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                      required
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">
                      Stock quantity
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={variantEditForm.stock_quantity}
                      onChange={(event) =>
                        setVariantEditForm((current) => ({
                          ...current,
                          stock_quantity: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                      required
                    />
                  </label>
                </div>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={isSavingVariant}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSavingVariant ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Variant"
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={cancelEditingVariant}
                    className="rounded-2xl border border-slate-200 px-4 py-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </FormCard>
          ) : null}
        </div>

        <div className="space-y-4">
          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
            <PageHeader
              eyebrow="Product Summary"
              title="At a glance"
              description="Use this view to confirm the main product record before working deeper at the variant or warehouse level."
            />

            <div className="mt-6 grid gap-3 text-sm text-slate-600">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                Category: <span className="font-semibold text-slate-950">{product.category?.name || "Unassigned"}</span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                Brand: <span className="font-semibold text-slate-950">{product.brand?.name || "Unassigned"}</span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                Cost price: <span className="font-semibold text-slate-950">{formatCurrency(product.cost_price)}</span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                Created: <span className="font-semibold text-slate-950">{formatDate(product.created_at)}</span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                Updated: <span className="font-semibold text-slate-950">{formatDate(product.updated_at)}</span>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                Description: <span className="font-semibold text-slate-950">{product.description || "No description"}</span>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
            <PageHeader
              eyebrow="Inventory Summary"
              title="Warehouse stock"
              description="This is a read-only product inventory snapshot pulled from the existing inventory API."
              meta={`${inventoryItems.length} rows`}
            />

            <div className="mt-6">
              {inventoryItems.length === 0 ? (
                <EmptyState
                  title="No inventory linked yet"
                  description="This product does not currently have any inventory rows assigned across warehouses."
                />
              ) : (
                <DataTable columns={["Warehouse", "Quantity", "Threshold", "Status", "Updated"]}>
                  {inventoryItems.map((item) => {
                    const stockStatus = getStockStatus(item.quantity, item.low_stock_threshold);
                    const warehouse = warehouseMap.get(item.warehouse_id);

                    return (
                      <div
                        key={item.id}
                        className="grid grid-cols-1 gap-3 px-5 py-4 text-sm text-slate-600 xl:grid-cols-5 xl:gap-4"
                      >
                        <div>
                          <span className="font-medium text-slate-950">
                            {warehouse?.name || "Unknown warehouse"}
                          </span>
                          <p className="mt-1 text-xs text-slate-500">
                            {warehouse?.code || item.warehouse_id}
                          </p>
                        </div>
                        <span className="font-semibold text-slate-950">{item.quantity}</span>
                        <span>{item.low_stock_threshold}</span>
                        <span>
                          <StatusBadge status={stockStatus} />
                        </span>
                        <span>{formatDate(item.updated_at)}</span>
                      </div>
                    );
                  })}
                </DataTable>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
