"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Copy, Search, Trash2, Upload } from "lucide-react";

import { useAuthorization } from "@/components/dashboard/authorization-provider";
import { MediaGrid } from "@/components/media/media-grid";
import { MediaUploadQueue } from "@/components/media/media-upload-queue";
import { ControlModal } from "@/components/ui/control-modal";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorAlert } from "@/components/ui/error-alert";
import { FormActions } from "@/components/ui/form-actions";
import { FormField } from "@/components/ui/form-field";
import { LoadingState } from "@/components/ui/loading-state";
import { OpsPageHeader } from "@/components/ui/ops-page-header";
import { ResilientImage } from "@/components/ui/resilient-image";
import { api, ApiError } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { formatFileSize, type MediaAsset, type MediaPage } from "@/lib/media";

const fieldClass = "w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm outline-none focus:border-slate-400 disabled:opacity-60";

type MetadataForm = { title: string; alt_text: string; caption: string };
const toForm = (asset: MediaAsset): MetadataForm => ({ title: asset.title || "", alt_text: asset.alt_text || "", caption: asset.caption || "" });

export default function MediaLibraryPage() {
  const { can } = useAuthorization();
  const [items, setItems] = useState<MediaAsset[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [mimeType, setMimeType] = useState("");
  const [sort, setSort] = useState("newest");
  const [skip, setSkip] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selected, setSelected] = useState<MediaAsset | null>(null);
  const [form, setForm] = useState<MetadataForm>({ title: "", alt_text: "", caption: "" });
  const [baseline, setBaseline] = useState("");
  const [saving, setSaving] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [copied, setCopied] = useState(false);
  const limit = 24;

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ skip: String(skip), limit: String(limit), sort });
      if (search.trim()) params.set("search", search.trim());
      if (mimeType) params.set("mime_type", mimeType);
      const page = await api.get<MediaPage>(`/media?${params}`);
      setItems(page.items);
      setTotal(page.total);
    } catch (loadError) {
      setError(loadError instanceof ApiError ? loadError.message : "Failed to load the media library.");
    } finally {
      setLoading(false);
    }
  }, [mimeType, search, skip, sort]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 220);
    return () => window.clearTimeout(timer);
  }, [load]);

  function openDetails(asset: MediaAsset) {
    const next = toForm(asset);
    setSelected(asset); setForm(next); setBaseline(JSON.stringify(next)); setDetailError(""); setCopied(false);
  }

  async function saveMetadata(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setSaving(true); setDetailError("");
    try {
      const updated = await api.patch<MediaAsset>(`/media/${selected.id}`, form);
      setSelected(updated); setItems((current) => current.map((item) => item.id === updated.id ? updated : item));
      const next = toForm(updated); setForm(next); setBaseline(JSON.stringify(next)); setSuccess("Media metadata updated.");
    } catch (saveError) {
      setDetailError(saveError instanceof ApiError ? saveError.message : "Failed to update media metadata.");
    } finally { setSaving(false); }
  }

  async function deleteAsset() {
    if (!selected || !window.confirm(`Delete ${selected.original_filename}? This cannot be undone.`)) return;
    setDetailError("");
    try {
      await api.delete<void>(`/media/${selected.id}`);
      setSelected(null); setSuccess("Media asset deleted."); await load();
    } catch (deleteError) {
      setDetailError(deleteError instanceof ApiError ? deleteError.message : "Failed to delete media asset.");
    }
  }

  const range = useMemo(() => total ? `${skip + 1}–${Math.min(skip + limit, total)} of ${total}` : "0 images", [skip, total]);

  return (
    <div className="space-y-5">
      <section className="card-base p-6 sm:p-8">
        <OpsPageHeader eyebrow="Reusable Assets" title="Media Library" description="Manage uploaded images and reusable commerce assets." meta={<span className="text-sm font-semibold">{total} {total === 1 ? "image" : "images"}</span>} actions={can("media.create") ? <button type="button" onClick={() => setUploadOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white"><Upload className="h-4 w-4" />Upload Media</button> : null} />
      </section>

      {error ? <ErrorAlert message={error} onRetry={() => void load()} /> : null}
      {success ? <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}

      <section className="card-base min-w-0 p-5 sm:p-6">
        <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_180px_180px]">
          <label className="relative"><span className="sr-only">Search media</span><Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-txt-mut)]" /><input value={search} onChange={(event) => { setSearch(event.target.value); setSkip(0); }} placeholder="Search media..." className={`${fieldClass} pl-11`} /></label>
          <select value={mimeType} onChange={(event) => { setMimeType(event.target.value); setSkip(0); }} className={fieldClass} aria-label="Filter by image type"><option value="">All image types</option><option value="image/jpeg">JPEG</option><option value="image/png">PNG</option><option value="image/webp">WebP</option></select>
          <select value={sort} onChange={(event) => { setSort(event.target.value); setSkip(0); }} className={fieldClass} aria-label="Sort media"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="name">Filename</option></select>
        </div>

        <div className="mt-6">
          {loading ? <LoadingState label="Loading media assets..." variant="page" /> : !error && items.length === 0 ? <EmptyState title="No media found" description={search || mimeType ? "Adjust the search or type filter." : "Upload the first reusable image to begin building the library."} action={can("media.create") ? <button type="button" onClick={() => setUploadOpen(true)} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">Upload media</button> : undefined} /> : <MediaGrid items={items} onOpen={openDetails} />}
        </div>

        {!loading && total > 0 ? <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-brd)] pt-4"><p className="text-xs text-[var(--color-txt-sec)]">Showing {range}</p><div className="flex gap-2"><button type="button" onClick={() => setSkip((value) => Math.max(0, value - limit))} disabled={skip === 0} className="rounded-xl border px-3 py-2 text-sm font-semibold disabled:opacity-40">Previous</button><button type="button" onClick={() => setSkip((value) => value + limit)} disabled={skip + limit >= total} className="rounded-xl border px-3 py-2 text-sm font-semibold disabled:opacity-40">Next</button></div></div> : null}
      </section>

      {uploadOpen ? <ControlModal title="Upload Media" description="Upload one or more JPEG, PNG, or WebP images. Each file is processed independently." onClose={() => setUploadOpen(false)} size="lg" dirty={false}><MediaUploadQueue onUploaded={(asset) => { setSuccess(`${asset.original_filename} uploaded.`); setItems((current) => [asset, ...current.filter((item) => item.id !== asset.id)]); setTotal((value) => value + 1); }} /><div className="mt-5 flex justify-end"><button type="button" onClick={() => { setUploadOpen(false); void load(); }} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">Done</button></div></ControlModal> : null}

      {selected ? <ControlModal title={selected.title || selected.original_filename} description="Review image details, edit accessible metadata, or copy its public URL." onClose={() => setSelected(null)} size="xl" dirty={JSON.stringify(form) !== baseline}>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.8fr)]">
          <div className="overflow-hidden rounded-[24px] border border-[var(--color-brd)] bg-[var(--color-surf-hover)]"><ResilientImage src={selected.public_url} alt={selected.alt_text || selected.original_filename} containerClassName="min-h-[300px] max-h-[620px]" className="h-full max-h-[620px] w-full object-contain" emptyLabel="Preview unavailable" /></div>
          <form onSubmit={saveMetadata} className="space-y-4">
            <div className="rounded-2xl bg-[var(--color-surf-hover)] p-4 text-xs text-[var(--color-txt-sec)]"><p className="font-semibold text-[var(--color-txt-pri)]">{selected.original_filename}</p><p className="mt-2">{selected.mime_type} · {formatFileSize(selected.file_size)}</p><p className="mt-1">{selected.width} × {selected.height} pixels</p><p className="mt-1">Uploaded {formatDateTime(selected.created_at)}</p></div>
            <FormField label="Title"><input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} disabled={!can("media.update")} className={fieldClass} /></FormField>
            <FormField label="Alt text" description="Describe the image for customers who cannot see it."><input value={form.alt_text} onChange={(event) => setForm((current) => ({ ...current, alt_text: event.target.value }))} disabled={!can("media.update")} className={fieldClass} /></FormField>
            <FormField label="Caption"><textarea rows={4} value={form.caption} onChange={(event) => setForm((current) => ({ ...current, caption: event.target.value }))} disabled={!can("media.update")} className={fieldClass} /></FormField>
            <div><p className="mb-2 text-xs font-semibold text-[var(--color-txt-sec)]">Public URL</p><div className="flex gap-2"><input readOnly value={selected.public_url} className={`${fieldClass} min-w-0 flex-1`} /><button type="button" onClick={() => { void navigator.clipboard.writeText(selected.public_url); setCopied(true); }} className="inline-flex shrink-0 items-center gap-2 rounded-xl border px-3 text-xs font-semibold"><Copy className="h-3.5 w-3.5" />{copied ? "Copied" : "Copy"}</button></div></div>
            {detailError ? <ErrorAlert message={detailError} title={detailError.includes("currently used") ? "Image is in use" : undefined} /> : null}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-brd)] pt-4">{can("media.delete") ? <button type="button" onClick={() => void deleteAsset()} className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-700"><Trash2 className="h-4 w-4" />Delete</button> : <span />}{can("media.update") ? <FormActions pending={saving} onCancel={() => setSelected(null)} saveLabel="Save metadata" pendingLabel="Saving..." /> : null}</div>
          </form>
        </div>
      </ControlModal> : null}
    </div>
  );
}
