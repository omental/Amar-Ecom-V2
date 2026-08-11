"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, Upload } from "lucide-react";

import { useAuthorization } from "@/components/dashboard/authorization-provider";
import { MediaGrid } from "@/components/media/media-grid";
import { MediaUploadQueue } from "@/components/media/media-upload-queue";
import { ControlModal, ModalCancelButton } from "@/components/ui/control-modal";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading-state";
import { api, ApiError } from "@/lib/api";
import { uniqueMediaUrls, type MediaAsset, type MediaPage } from "@/lib/media";

type MediaPickerProps = {
  open: boolean;
  mode: "single" | "multiple";
  selected: string[];
  onSelect: (urls: string[]) => void;
  onClose: () => void;
  title?: string;
};

export function MediaPicker(props: MediaPickerProps) {
  if (!props.open) return null;
  return <MediaPickerContent key={`${props.mode}:${props.selected.join("\u0000")}`} {...props} />;
}

function MediaPickerContent({
  open,
  mode,
  selected,
  onSelect,
  onClose,
  title = "Select media",
}: MediaPickerProps) {
  const { can } = useAuthorization();
  const [items, setItems] = useState<MediaAsset[]>([]);
  const [draft, setDraft] = useState<string[]>(() => uniqueMediaUrls(selected));
  const [search, setSearch] = useState("");
  const [skip, setSkip] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const limit = 20;

  const load = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ skip: String(skip), limit: String(limit), sort: "newest" });
      if (search.trim()) params.set("search", search.trim());
      const page = await api.get<MediaPage>(`/media?${params}`);
      setItems(page.items);
      setTotal(page.total);
    } catch (loadError) {
      setError(loadError instanceof ApiError ? loadError.message : "Failed to load media.");
    } finally {
      setLoading(false);
    }
  }, [open, search, skip]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 220);
    return () => window.clearTimeout(timer);
  }, [load]);

  const pageLabel = useMemo(() => total ? `${skip + 1}–${Math.min(skip + limit, total)} of ${total}` : "0 images", [skip, total]);

  function toggle(asset: MediaAsset) {
    if (mode === "single") {
      setDraft([asset.public_url]);
      return;
    }
    setDraft((current) => current.includes(asset.public_url) ? current.filter((url) => url !== asset.public_url) : [...current, asset.public_url]);
  }

  return (
    <ControlModal title={title} description={mode === "multiple" ? "Choose one or more reusable images. Existing selections and their order are preserved." : "Choose one reusable image or upload a new one."} onClose={onClose} size="xl" dirty={false}>
      <div className="space-y-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <label className="relative min-w-0 flex-1"><span className="sr-only">Search media</span><Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-txt-mut)]" /><input value={search} onChange={(event) => { setSearch(event.target.value); setSkip(0); }} placeholder="Search media..." className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] py-3 pl-11 pr-4 text-sm outline-none focus:border-slate-400" /></label>
          {can("media.create") ? <button type="button" onClick={() => setShowUpload((value) => !value)} aria-expanded={showUpload} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--color-brd)] px-4 py-3 text-sm font-semibold"><Upload className="h-4 w-4" />Upload new media</button> : null}
        </div>

        {showUpload && can("media.create") ? <MediaUploadQueue onUploaded={(asset) => { setItems((current) => [asset, ...current.filter((item) => item.id !== asset.id)]); setTotal((value) => value + 1); setDraft((current) => mode === "single" ? [asset.public_url] : uniqueMediaUrls([...current, asset.public_url])); }} /> : null}
        {error ? <ErrorAlert message={error} onRetry={() => void load()} /> : null}
        {loading ? <LoadingState label="Loading media library..." /> : null}
        {!loading && !error && items.length === 0 ? <EmptyState title="No media found" description={search ? "Try another search or upload a new image." : "Upload the first reusable image to begin."} /> : null}
        {!loading && items.length ? <MediaGrid items={items} selectedUrls={draft} onOpen={toggle} /> : null}

        <div className="flex flex-col gap-3 border-t border-[var(--color-brd)] pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 text-xs text-[var(--color-txt-sec)]"><span>{pageLabel}</span><span>·</span><span>{draft.length} selected</span></div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button type="button" onClick={() => setSkip((value) => Math.max(0, value - limit))} disabled={skip === 0} className="rounded-xl border px-3 py-2 text-sm font-semibold disabled:opacity-40">Previous</button>
            <button type="button" onClick={() => setSkip((value) => value + limit)} disabled={skip + limit >= total} className="rounded-xl border px-3 py-2 text-sm font-semibold disabled:opacity-40">Next</button>
            <ModalCancelButton className="rounded-xl border border-[var(--color-brd)] px-4 py-2.5 text-sm font-semibold">Cancel</ModalCancelButton>
            <button type="button" onClick={() => { onSelect(uniqueMediaUrls(draft)); onClose(); }} disabled={draft.length === 0} className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40">Use selected media</button>
          </div>
        </div>
      </div>
    </ControlModal>
  );
}
