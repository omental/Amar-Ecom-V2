"use client";

import { useId, useRef, useState } from "react";
import { CheckCircle2, Loader2, UploadCloud, XCircle } from "lucide-react";

import { api, ApiError } from "@/lib/api";
import type { MediaAsset } from "@/lib/media";

type QueueItem = {
  id: string;
  file: File;
  state: "queued" | "uploading" | "success" | "failure";
  message?: string;
};

const supportedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxClientBytes = 10 * 1024 * 1024;

export function MediaUploadQueue({ onUploaded }: { onUploaded?: (asset: MediaAsset) => void }) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [dragging, setDragging] = useState(false);

  async function uploadItem(item: QueueItem) {
    setQueue((current) => current.map((entry) => entry.id === item.id ? { ...entry, state: "uploading", message: undefined } : entry));
    if (!supportedTypes.has(item.file.type)) {
      setQueue((current) => current.map((entry) => entry.id === item.id ? { ...entry, state: "failure", message: "Use a JPEG, PNG, or WebP image." } : entry));
      return;
    }
    if (item.file.size > maxClientBytes) {
      setQueue((current) => current.map((entry) => entry.id === item.id ? { ...entry, state: "failure", message: "Image exceeds the 10 MB limit." } : entry));
      return;
    }
    try {
      const data = new FormData();
      data.append("file", item.file);
      const asset = await api.post<MediaAsset>("/media/upload", data);
      setQueue((current) => current.map((entry) => entry.id === item.id ? { ...entry, state: "success", message: "Uploaded" } : entry));
      onUploaded?.(asset);
    } catch (error) {
      setQueue((current) => current.map((entry) => entry.id === item.id ? { ...entry, state: "failure", message: error instanceof ApiError ? error.message : "Upload failed." } : entry));
    }
  }

  function addFiles(files: FileList | File[]) {
    const items = Array.from(files).map((file) => ({ id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`, file, state: "queued" as const }));
    setQueue((current) => [...items, ...current]);
    for (const item of items) void uploadItem(item);
  }

  return (
    <div className="space-y-4">
      <div
        onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false); }}
        onDrop={(event) => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files); }}
        className={`rounded-[24px] border border-dashed p-6 text-center transition ${dragging ? "border-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-accent)_7%,white)]" : "border-[var(--color-brd)] bg-[var(--color-surf-hover)]"}`}
      >
        <UploadCloud className="mx-auto h-8 w-8 text-[var(--color-accent)]" aria-hidden="true" />
        <p className="mt-3 text-sm font-semibold text-[var(--color-txt-pri)]">Drop images here or browse your device</p>
        <p className="mt-1 text-xs text-[var(--color-txt-sec)]">JPEG, PNG, or WebP. Up to 10 MB each.</p>
        <label htmlFor={inputId} className="mt-4 inline-flex cursor-pointer rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white focus-within:outline-2 focus-within:outline-offset-2">
          Browse files
          <input ref={inputRef} id={inputId} type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => { if (event.target.files) addFiles(event.target.files); event.target.value = ""; }} />
        </label>
      </div>

      {queue.length ? (
        <div className="max-h-52 space-y-2 overflow-y-auto" aria-live="polite">
          {queue.map((item) => (
            <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-[var(--color-brd)] px-4 py-3">
              {item.state === "uploading" || item.state === "queued" ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-sky-600" /> : item.state === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> : <XCircle className="h-4 w-4 shrink-0 text-rose-600" />}
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{item.file.name}</p><p className={`mt-1 text-xs ${item.state === "failure" ? "text-rose-600" : "text-[var(--color-txt-mut)]"}`}>{item.message || (item.state === "uploading" ? "Uploading..." : "Queued")}</p></div>
              {item.state === "failure" ? <button type="button" onClick={() => void uploadItem(item)} className="rounded-lg border px-3 py-1.5 text-xs font-semibold">Retry</button> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
