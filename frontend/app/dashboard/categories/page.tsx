"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";

import { useAuthorization } from "@/components/dashboard/authorization-provider";
import { ControlModal } from "@/components/ui/control-modal";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorAlert } from "@/components/ui/error-alert";
import { FormActions } from "@/components/ui/form-actions";
import { FormField } from "@/components/ui/form-field";
import { LoadingState } from "@/components/ui/loading-state";
import { OpsPageHeader } from "@/components/ui/ops-page-header";
import { api, ApiError } from "@/lib/api";
import { formatCount } from "@/lib/format";

type Category = { id: string; name: string; slug: string; description: string | null };
type CategoryForm = { name: string; slug: string; description: string };
const emptyForm: CategoryForm = { name: "", slug: "", description: "" };
const inputClass = "w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm outline-none focus:border-slate-400 focus:bg-white";

export default function CategoriesPage() {
  const { can } = useAuthorization();
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<CategoryForm>(emptyForm);
  const [baseline, setBaseline] = useState(JSON.stringify(emptyForm));
  const [editing, setEditing] = useState<Category | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [modalError, setModalError] = useState("");
  const [success, setSuccess] = useState("");
  const filtered = useMemo(() => categories.filter((item) => [item.name, item.slug, item.description].filter(Boolean).join(" ").toLowerCase().includes(search.trim().toLowerCase())), [categories, search]);

  async function load() { setCategories(await api.get<Category[]>("/categories?skip=0&limit=100")); }
  useEffect(() => { let mounted = true; api.get<Category[]>("/categories?skip=0&limit=100").then((data) => { if (mounted) setCategories(data); }).catch((reason) => { if (mounted) setError(reason instanceof ApiError ? reason.message : "Failed to load categories"); }).finally(() => { if (mounted) setLoading(false); }); return () => { mounted = false; }; }, []);
  function openCreate() { const next = { ...emptyForm }; setEditing(null); setForm(next); setBaseline(JSON.stringify(next)); setModalError(""); setModalOpen(true); }
  function openEdit(item: Category) { const next = { name: item.name, slug: item.slug, description: item.description || "" }; setEditing(item); setForm(next); setBaseline(JSON.stringify(next)); setModalError(""); setModalOpen(true); }
  async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); setPending(true); setModalError(""); try { const payload = { ...form, description: form.description || null }; if (editing) await api.patch(`/categories/${editing.id}`, payload); else await api.post("/categories", payload); await load(); setModalOpen(false); setSuccess(editing ? "Category updated successfully." : "Category created successfully."); } catch (reason) { setModalError(reason instanceof ApiError ? reason.message : "Failed to save category"); } finally { setPending(false); } }
  async function remove(item: Category) { if (!window.confirm(`Delete ${item.name}? Products using this category will prevent deletion.`)) return; setError(""); try { await api.delete(`/categories/${item.id}`); await load(); setSuccess("Category deleted successfully."); } catch (reason) { setError(reason instanceof ApiError ? reason.message : "Failed to delete category"); } }

  return <div className="space-y-4">
    <section className="card-base p-6 sm:p-8"><OpsPageHeader eyebrow="Catalog Structure" title="Categories" description="Organize reusable category groups without narrowing the record list." meta={<span className="text-sm font-semibold">{formatCount(categories.length, "item")}</span>} actions={can("categories.create") ? <button type="button" onClick={openCreate} className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white"><Plus className="h-4 w-4" />Add Category</button> : null} /></section>
    {error ? <ErrorAlert message={error} onRetry={() => void load()} /> : null}{success ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}
    <section className="card-base p-6"><div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="ops-micro-label">Saved Records</p><h2 className="mt-2 text-xl font-semibold">Existing categories</h2></div><label className="relative w-full sm:max-w-sm"><span className="sr-only">Search categories</span><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-txt-mut)]" /><input value={search} onChange={(event) => setSearch(event.target.value)} className={`${inputClass} pl-11`} placeholder="Search categories" /></label></div>
      {loading ? <LoadingState label="Loading categories..." /> : filtered.length === 0 ? <EmptyState title="No categories found" description="Adjust the search or add the first category." /> : <DataTable columns={["Name", "Slug", "Description", "Actions"]} columnTemplate="minmax(180px,1fr) minmax(170px,1fr) minmax(260px,2fr) minmax(160px,0.8fr)" minWidth="780px">{filtered.map((item) => <div key={item.id} className="grid items-center gap-4 px-5 py-4 text-sm text-[var(--color-txt-sec)]" style={{ gridTemplateColumns: "minmax(180px,1fr) minmax(170px,1fr) minmax(260px,2fr) minmax(160px,0.8fr)" }}><span className="font-semibold text-[var(--color-txt-pri)]">{item.name}</span><span>{item.slug}</span><span>{item.description || "No description"}</span><div className="flex gap-2">{can("categories.update") ? <button type="button" onClick={() => openEdit(item)} className="inline-flex items-center gap-1 rounded-full border px-3 py-2 text-xs font-semibold"><Pencil className="h-3.5 w-3.5" />Edit</button> : null}{can("categories.delete") ? <button type="button" onClick={() => void remove(item)} className="inline-flex items-center gap-1 rounded-full border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700"><Trash2 className="h-3.5 w-3.5" />Delete</button> : null}</div></div>)}</DataTable>}
    </section>
    {modalOpen ? <ControlModal title={editing ? "Edit Category" : "Add Category"} description="Use a clear name, unique slug, and optional internal description." onClose={() => setModalOpen(false)} size="sm" dirty={JSON.stringify(form) !== baseline}><form onSubmit={submit} className="space-y-4"><FormField label="Name" required><input name="name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className={inputClass} /></FormField><FormField label="Slug" description="Must be unique." required><input name="slug" value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))} className={inputClass} /></FormField><FormField label="Description"><textarea name="description" rows={4} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className={inputClass} /></FormField>{modalError ? <ErrorAlert message={modalError} persistent /> : null}<FormActions pending={pending} onCancel={() => setModalOpen(false)} saveLabel={editing ? "Save Category" : "Create Category"} pendingLabel="Saving..." sticky /></form></ControlModal> : null}
  </div>;
}
