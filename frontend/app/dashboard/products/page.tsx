"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Boxes, Pencil, Plus, RefreshCw, Rows3, Search, Tag, Trash2 } from "lucide-react";

import { useAuthorization } from "@/components/dashboard/authorization-provider";
import { MediaPicker } from "@/components/media/media-picker";
import { ControlModal } from "@/components/ui/control-modal";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorAlert } from "@/components/ui/error-alert";
import { FormActions } from "@/components/ui/form-actions";
import { FormField } from "@/components/ui/form-field";
import { LoadingState } from "@/components/ui/loading-state";
import { OpsFilterBar } from "@/components/ui/ops-filter-bar";
import { OpsPageHeader } from "@/components/ui/ops-page-header";
import { OpsSummaryCard } from "@/components/ui/ops-summary-card";
import { ResilientImage } from "@/components/ui/resilient-image";
import { StatusBadge } from "@/components/ui/status-badge";
import { api, ApiError } from "@/lib/api";
import { formatCount, formatCurrency } from "@/lib/format";
import { moveMediaUrl, uniqueMediaUrls } from "@/lib/media";

type OptionItem = { id: string; name: string };

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
  gallery_image_urls: string[];
  size_guide_image_url: string | null;
  status: string;
  source?: string | null;
  external_id?: string | null;
  external_status?: string | null;
  external_synced_at?: string | null;
  category?: OptionItem | null;
  brand?: OptionItem | null;
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
  gallery_image_urls: string[];
  size_guide_image_url: string;
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
  gallery_image_urls: [],
  size_guide_image_url: "",
  status: "active",
};

const inputClass = "w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm text-[var(--color-txt-pri)] outline-none transition focus:border-slate-400 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60";

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
    gallery_image_urls: product.gallery_image_urls || [],
    size_guide_image_url: product.size_guide_image_url || "",
    status: product.status,
  };
}

function ProductFields({ form, setForm, categories, brands, canUseLibrary, onPick }: { form: ProductForm; setForm: React.Dispatch<React.SetStateAction<ProductForm>>; categories: OptionItem[]; brands: OptionItem[]; canUseLibrary: boolean; onPick: (target: "featured" | "gallery" | "size") => void }) {
  return (
    <div className="space-y-6">
      <fieldset className="space-y-4 rounded-[22px] border border-[var(--color-brd)] p-4 sm:p-5">
        <legend className="px-2 text-sm font-bold text-[var(--color-txt-pri)]">Basic Information</legend>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Name" required><input name="name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className={inputClass} placeholder="Sample Product" /></FormField>
          <FormField label="SKU" required><input name="sku" value={form.sku} onChange={(event) => setForm((current) => ({ ...current, sku: event.target.value }))} className={inputClass} placeholder="SKU-1001" /></FormField>
          <FormField label="Slug" description="Used in product URLs and integrations." required><input name="slug" value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))} className={inputClass} placeholder="sample-product" /></FormField>
          <FormField label="Status" required><select name="status" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} className={inputClass}><option value="active">Active</option><option value="inactive">Inactive</option></select></FormField>
        </div>
        <FormField label="Description"><textarea name="description" rows={4} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className={inputClass} /></FormField>
      </fieldset>

      <div className="grid gap-6 lg:grid-cols-2">
        <fieldset className="space-y-4 rounded-[22px] border border-[var(--color-brd)] p-4 sm:p-5">
          <legend className="px-2 text-sm font-bold text-[var(--color-txt-pri)]">Classification</legend>
          <FormField label="Category"><select name="category_id" value={form.category_id} onChange={(event) => setForm((current) => ({ ...current, category_id: event.target.value }))} className={inputClass}><option value="">No category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></FormField>
          <FormField label="Brand"><select name="brand_id" value={form.brand_id} onChange={(event) => setForm((current) => ({ ...current, brand_id: event.target.value }))} className={inputClass}><option value="">No brand</option>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></FormField>
        </fieldset>
        <fieldset className="space-y-4 rounded-[22px] border border-[var(--color-brd)] p-4 sm:p-5">
          <legend className="px-2 text-sm font-bold text-[var(--color-txt-pri)]">Pricing</legend>
          <FormField label="Price" required><input name="price" type="number" min="0" step="0.01" value={form.price} onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))} className={inputClass} /></FormField>
          <FormField label="Cost price" required><input name="cost_price" type="number" min="0" step="0.01" value={form.cost_price} onChange={(event) => setForm((current) => ({ ...current, cost_price: event.target.value }))} className={inputClass} /></FormField>
        </fieldset>
      </div>

      <fieldset className="space-y-5 rounded-[22px] border border-[var(--color-brd)] p-4 sm:p-5">
        <legend className="px-2 text-sm font-bold text-[var(--color-txt-pri)]">Media</legend>
        <div className="space-y-3">
          <div><p className="text-sm font-semibold text-[var(--color-txt-pri)]">Featured image</p><p className="mt-1 text-xs text-[var(--color-txt-mut)]">The primary catalog and storefront image.</p></div>
          <div className="grid gap-4 rounded-[20px] border border-[var(--color-brd)] bg-[var(--color-surf-hover)] p-4 md:grid-cols-[220px_minmax(0,1fr)] md:items-center">
            <div className="overflow-hidden rounded-2xl border border-[var(--color-brd)] bg-white"><ResilientImage src={form.image_url} alt="Featured product image preview" containerClassName="aspect-square" emptyLabel="No featured image" /></div>
            <div className="space-y-3"><div className="flex flex-wrap gap-2">{canUseLibrary ? <button type="button" onClick={() => onPick("featured")} className="rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-semibold text-white">{form.image_url ? "Change from Media" : "Select from Media"}</button> : null}{form.image_url ? <button type="button" onClick={() => setForm((current) => ({ ...current, image_url: "" }))} className="rounded-xl border border-rose-200 px-4 py-2.5 text-xs font-semibold text-rose-700">Remove</button> : null}</div><details className="rounded-xl border border-[var(--color-brd)] bg-white p-3"><summary className="cursor-pointer text-xs font-semibold text-[var(--color-txt-sec)]">Use external image URL</summary><label className="mt-3 block"><span className="sr-only">External featured image URL</span><input name="image_url" type="text" inputMode="url" value={form.image_url} onChange={(event) => setForm((current) => ({ ...current, image_url: event.target.value }))} className={inputClass} placeholder="https://example.com/product.jpg or /legacy/image.jpg" /></label></details></div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="text-sm font-semibold text-[var(--color-txt-pri)]">Gallery</p><p className="mt-1 text-xs text-[var(--color-txt-mut)]">Images are saved and displayed in this order.</p></div>
            <div className="flex flex-wrap gap-2">{canUseLibrary ? <button type="button" onClick={() => onPick("gallery")} className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-brd)] px-3 py-2 text-xs font-semibold"><Plus className="h-3.5 w-3.5" />Add from Media</button> : null}<button type="button" onClick={() => setForm((current) => ({ ...current, gallery_image_urls: [...current.gallery_image_urls, ""] }))} className="rounded-xl border border-[var(--color-brd)] px-3 py-2 text-xs font-semibold">Add external URL</button></div>
          </div>
          {form.gallery_image_urls.length === 0 ? <p className="rounded-2xl border border-dashed border-[var(--color-brd)] px-4 py-5 text-center text-xs text-[var(--color-txt-mut)]">No gallery images added.</p> : null}
          {form.gallery_image_urls.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{form.gallery_image_urls.map((url, index) => <div key={`${url}-${index}`} className="overflow-hidden rounded-2xl border border-[var(--color-brd)]"><ResilientImage src={url} alt={`Gallery image ${index + 1}`} containerClassName="aspect-square" emptyLabel="URL required" /><div className="flex items-center justify-between gap-1 border-t p-2"><span className="pl-1 text-[10px] font-semibold text-[var(--color-txt-mut)]">{index + 1}</span><div className="flex"><button type="button" disabled={index === 0} onClick={() => setForm((current) => ({ ...current, gallery_image_urls: moveMediaUrl(current.gallery_image_urls, index, -1) }))} className="rounded-lg p-2 disabled:opacity-30" aria-label={`Move gallery image ${index + 1} left`}><ArrowLeft className="h-3.5 w-3.5" /></button><button type="button" disabled={index === form.gallery_image_urls.length - 1} onClick={() => setForm((current) => ({ ...current, gallery_image_urls: moveMediaUrl(current.gallery_image_urls, index, 1) }))} className="rounded-lg p-2 disabled:opacity-30" aria-label={`Move gallery image ${index + 1} right`}><ArrowRight className="h-3.5 w-3.5" /></button><button type="button" onClick={() => setForm((current) => ({ ...current, gallery_image_urls: current.gallery_image_urls.filter((_, itemIndex) => itemIndex !== index) }))} className="rounded-lg p-2 text-rose-600" aria-label={`Remove gallery image ${index + 1}`}><Trash2 className="h-3.5 w-3.5" /></button></div></div></div>)}</div> : null}
          {form.gallery_image_urls.length ? <details className="rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] p-4"><summary className="cursor-pointer text-xs font-semibold text-[var(--color-txt-sec)]">External and legacy gallery URLs</summary><div className="mt-3 space-y-3">{form.gallery_image_urls.map((url, index) => <label key={index} className="block"><span className="mb-1 block text-xs text-[var(--color-txt-mut)]">Gallery image {index + 1}</span><input name={`gallery_image_${index}`} type="text" inputMode="url" value={url} onChange={(event) => setForm((current) => ({ ...current, gallery_image_urls: current.gallery_image_urls.map((item, itemIndex) => itemIndex === index ? event.target.value : item) }))} className={inputClass} placeholder="https://example.com/gallery.jpg or /legacy/image.jpg" /></label>)}</div></details> : null}
        </div>

        <div className="space-y-3"><div><p className="text-sm font-semibold text-[var(--color-txt-pri)]">Size guide <span className="font-normal text-[var(--color-txt-mut)]">(optional)</span></p><p className="mt-1 text-xs text-[var(--color-txt-mut)]">A customer-facing sizing reference image.</p></div><div className="grid gap-4 rounded-[20px] border border-[var(--color-brd)] bg-[var(--color-surf-hover)] p-4 md:grid-cols-[180px_minmax(0,1fr)] md:items-center"><div className="overflow-hidden rounded-2xl border bg-white"><ResilientImage src={form.size_guide_image_url} alt="Size guide preview" containerClassName="aspect-square" emptyLabel="No size guide" /></div><div className="space-y-3"><div className="flex flex-wrap gap-2">{canUseLibrary ? <button type="button" onClick={() => onPick("size")} className="rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-semibold text-white">{form.size_guide_image_url ? "Change" : "Select size guide"}</button> : null}{form.size_guide_image_url ? <button type="button" onClick={() => setForm((current) => ({ ...current, size_guide_image_url: "" }))} className="rounded-xl border border-rose-200 px-4 py-2.5 text-xs font-semibold text-rose-700">Remove</button> : null}</div><details className="rounded-xl border bg-white p-3"><summary className="cursor-pointer text-xs font-semibold text-[var(--color-txt-sec)]">Use external image URL</summary><input name="size_guide_image_url" type="text" inputMode="url" value={form.size_guide_image_url} onChange={(event) => setForm((current) => ({ ...current, size_guide_image_url: event.target.value }))} className={`${inputClass} mt-3`} placeholder="https://example.com/size-guide.jpg or /legacy/size-guide.jpg" /></details></div></div>
        </div>
      </fieldset>
    </div>
  );
}

export default function ProductsPage() {
  const { can } = useAuthorization();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<OptionItem[]>([]);
  const [brands, setBrands] = useState<OptionItem[]>([]);
  const [form, setForm] = useState<ProductForm>(initialForm);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalBaseline, setModalBaseline] = useState(JSON.stringify(initialForm));
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pageError, setPageError] = useState("");
  const [modalError, setModalError] = useState("");
  const [success, setSuccess] = useState("");
  const [pickerTarget, setPickerTarget] = useState<"featured" | "gallery" | "size" | null>(null);

  const filteredProducts = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    return products.filter((product) => (!statusFilter || product.status === statusFilter) && (!search || [product.name, product.sku, product.category?.name, product.brand?.name, product.source].filter(Boolean).join(" ").toLowerCase().includes(search)));
  }, [products, searchTerm, statusFilter]);

  async function loadProducts() {
    const data = await api.get<Product[]>("/products?skip=0&limit=100");
    setProducts(data);
  }

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const [productData, categoryData, brandData] = await Promise.all([
          api.get<Product[]>("/products?skip=0&limit=100"),
          api.get<OptionItem[]>("/categories?skip=0&limit=100"),
          api.get<OptionItem[]>("/brands?skip=0&limit=100"),
        ]);
        if (!mounted) return;
        setProducts(productData); setCategories(categoryData); setBrands(brandData);
      } catch (error) {
        if (mounted) setPageError(error instanceof ApiError ? error.message : "Failed to load product data");
      } finally { if (mounted) setIsLoading(false); }
    }
    void load();
    return () => { mounted = false; };
  }, []);

  function openCreate() {
    const next = { ...initialForm, gallery_image_urls: [] };
    setEditingProduct(null); setForm(next); setModalBaseline(JSON.stringify(next)); setModalError(""); setPickerTarget(null); setModalOpen(true);
  }

  function openEdit(product: Product) {
    const next = productToForm(product);
    setEditingProduct(product); setForm(next); setModalBaseline(JSON.stringify(next)); setModalError(""); setPickerTarget(null); setModalOpen(true);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setModalError(""); setSuccess(""); setIsSubmitting(true);
    const payload = {
      name: form.name, slug: form.slug, sku: form.sku, description: form.description || null,
      category_id: form.category_id || null, brand_id: form.brand_id || null,
      price: Number(form.price), cost_price: Number(form.cost_price), image_url: form.image_url || null,
      gallery_image_urls: uniqueMediaUrls(form.gallery_image_urls),
      size_guide_image_url: form.size_guide_image_url || null, status: form.status,
    };
    try {
      if (editingProduct) await api.patch<Product>(`/products/${editingProduct.id}`, payload);
      else await api.post<Product>("/products", { ...payload, variants: [] });
      await loadProducts();
      setModalOpen(false); setEditingProduct(null); setForm(initialForm);
      setSuccess(editingProduct ? "Product updated successfully." : "Product created successfully.");
    } catch (error) {
      setModalError(error instanceof ApiError ? error.message : `Failed to ${editingProduct ? "update" : "create"} product`);
    } finally { setIsSubmitting(false); }
  }

  return (
    <div className="space-y-4">
      <section className="card-base p-6 sm:p-8">
        <OpsPageHeader eyebrow="Catalog Core" title="Products" description="Manage the product catalog, pricing, commerce media, and status, then open a product workspace for variants and inventory." meta={<span className="text-sm font-semibold text-[var(--color-txt-pri)]">{formatCount(products.length, "item")}</span>} actions={can("products.create") ? <button type="button" onClick={openCreate} className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"><Plus className="h-4 w-4" />Add Product</button> : null} />
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <OpsSummaryCard eyebrow="Catalog" label="Total Products" value={products.length} icon={Boxes} />
          <OpsSummaryCard eyebrow="Status" label="Active Products" value={products.filter((product) => product.status === "active").length} icon={Tag} tone="success" />
          <OpsSummaryCard eyebrow="Channel" label="WooCommerce Products" value={products.filter((product) => product.source === "woocommerce").length} icon={RefreshCw} tone="info" />
          <OpsSummaryCard eyebrow="Variants" label="Variant Rows" value={products.reduce((sum, product) => sum + (product.variants?.length || 0), 0)} icon={Rows3} />
        </div>
      </section>

      {pageError ? <ErrorAlert message={pageError} onRetry={() => void loadProducts()} /> : null}
      {success ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}

      <section className="card-base min-w-0 p-6">
        <OpsPageHeader eyebrow="Saved Records" title="Product catalog" description="Search the full-width catalog and open focused actions without compressing product identity or pricing." />
        <div className="mt-6 space-y-4">
          <OpsFilterBar title="Catalog Filters" description="Filter the loaded product set by text or status.">
            <div className="relative min-w-[220px] flex-1"><Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-txt-mut)]" /><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} className={`${inputClass} pl-11`} placeholder="Search name, SKU, category, or brand" aria-label="Search products" /></div>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={inputClass} aria-label="Filter products by status"><option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
          </OpsFilterBar>
          {isLoading ? <LoadingState label="Loading products..." /> : filteredProducts.length === 0 ? <EmptyState title="No products match this view" description="Try another search or status filter, or add a new product." /> : (
            <DataTable columns={["Product", "Category / Brand", "Price / Cost", "Status", "Actions"]} columnTemplate="minmax(260px,2fr) minmax(180px,1.25fr) minmax(150px,0.9fr) minmax(120px,0.7fr) minmax(250px,1.4fr)" minWidth="980px">
              {filteredProducts.map((product) => (
                <div key={product.id} className="grid items-center gap-4 px-5 py-4 text-sm text-[var(--color-txt-sec)]" style={{ gridTemplateColumns: "minmax(260px,2fr) minmax(180px,1.25fr) minmax(150px,0.9fr) minmax(120px,0.7fr) minmax(250px,1.4fr)" }}>
                  <div className="flex min-w-0 items-center gap-3"><div className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl border border-[var(--color-brd)]"><ResilientImage src={product.image_url} alt={`${product.name} featured image`} containerClassName="h-12 w-12" emptyLabel="No image" /></div><div className="min-w-0"><p className="truncate font-semibold text-[var(--color-txt-pri)]">{product.name}</p><p className="mt-1 truncate text-xs text-[var(--color-txt-mut)]">SKU {product.sku} · {formatCount(product.variants?.length || 0, "variant")}</p>{product.source === "woocommerce" ? <StatusBadge status="woocommerce" label="WooCommerce" /> : null}</div></div>
                  <div><p className="font-medium text-[var(--color-txt-pri)]">{product.category?.name || "Unassigned"}</p><p className="mt-1 text-xs text-[var(--color-txt-mut)]">{product.brand?.name || "No brand"}</p></div>
                  <div><p className="font-semibold text-[var(--color-txt-pri)]">{formatCurrency(product.price)}</p><p className="mt-1 text-xs text-[var(--color-txt-mut)]">Cost {formatCurrency(product.cost_price)}</p></div>
                  <span><StatusBadge status={product.status} /></span>
                  <div className="flex flex-wrap items-center gap-2">{can("products.update") ? <button type="button" onClick={() => openEdit(product)} className="inline-flex items-center gap-2 rounded-full border border-[var(--color-brd)] px-3 py-2 text-xs font-semibold hover:bg-[var(--color-surf-hover)]"><Pencil className="h-3.5 w-3.5" />Edit</button> : null}<Link href={`/dashboard/products/${product.id}`} className="inline-flex items-center gap-2 rounded-full border border-[var(--color-brd)] px-3 py-2 text-xs font-semibold hover:bg-[var(--color-surf-hover)]"><Rows3 className="h-3.5 w-3.5" />Manage Variants</Link></div>
                </div>
              ))}
            </DataTable>
          )}
        </div>
      </section>

      {modalOpen ? (
        <ControlModal title={editingProduct ? "Edit Product" : "Add Product"} description={editingProduct ? "Update catalog details and reusable commerce media." : "Create a catalog product with pricing, classification, and reusable media."} onClose={() => setModalOpen(false)} size="xl" dirty={JSON.stringify(form) !== modalBaseline}>
          <form onSubmit={handleSubmit} className="space-y-5">
            <ProductFields form={form} setForm={setForm} categories={categories} brands={brands} canUseLibrary={can("media.view")} onPick={setPickerTarget} />
            {modalError ? <ErrorAlert message={modalError} persistent /> : null}
            <FormActions pending={isSubmitting} onCancel={() => setModalOpen(false)} saveLabel={editingProduct ? "Save Product" : "Create Product"} pendingLabel={editingProduct ? "Saving..." : "Creating..."} sticky />
          </form>
        </ControlModal>
      ) : null}

      <MediaPicker
        open={pickerTarget !== null}
        mode={pickerTarget === "gallery" ? "multiple" : "single"}
        selected={pickerTarget === "featured" ? [form.image_url].filter(Boolean) : pickerTarget === "size" ? [form.size_guide_image_url].filter(Boolean) : form.gallery_image_urls}
        title={pickerTarget === "featured" ? "Select featured image" : pickerTarget === "size" ? "Select size guide" : "Add gallery images"}
        onClose={() => setPickerTarget(null)}
        onSelect={(urls) => {
          if (pickerTarget === "featured") setForm((current) => ({ ...current, image_url: urls[0] || "" }));
          if (pickerTarget === "size") setForm((current) => ({ ...current, size_guide_image_url: urls[0] || "" }));
          if (pickerTarget === "gallery") setForm((current) => ({ ...current, gallery_image_urls: uniqueMediaUrls(urls) }));
        }}
      />
    </div>
  );
}
