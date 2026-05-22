"use client";

import { useCallback, useEffect, useState } from "react";

import { api, ApiError } from "@/lib/api";
import type { OnlineStoreMedia } from "@/lib/online-store";

type MediaType = "logo" | "favicon" | "banner" | "category" | "product" | "section" | "general";

export function MediaPicker({
  label,
  mediaType,
  value,
  onChange,
  helperText,
}: {
  label: string;
  mediaType: MediaType;
  value?: string | null;
  onChange: (value: string) => void;
  helperText?: string;
}) {
  const [items, setItems] = useState<OnlineStoreMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const loadMedia = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get<OnlineStoreMedia[]>(`/admin/storefront/media?media_type=${mediaType}`);
      setItems(response);
      setError("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load media.");
    } finally {
      setLoading(false);
    }
  }, [mediaType]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadMedia();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadMedia]);

  async function handleUpload(file: File) {
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("media_type", mediaType);
      const uploaded = await api.post<OnlineStoreMedia>("/admin/storefront/media/upload", formData);
      onChange(uploaded.url);
      await loadMedia();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="rounded-[20px] border border-[var(--color-brd)] bg-[var(--color-surf-hover)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--color-txt-pri)]">{label}</p>
          {helperText ? <p className="mt-1 text-xs text-[var(--color-txt-sec)]">{helperText}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex cursor-pointer rounded-full border border-[var(--color-brd)] bg-white px-3 py-2 text-xs font-semibold text-[var(--color-txt-pri)]">
            {uploading ? "Uploading..." : "Upload"}
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void handleUpload(file);
                }
                event.target.value = "";
              }}
            />
          </label>
          <button
            type="button"
            onClick={() => void loadMedia()}
            className="rounded-full border border-[var(--color-brd)] bg-white px-3 py-2 text-xs font-semibold text-[var(--color-txt-pri)]"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => onChange("")}
            className="rounded-full border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-600"
          >
            Remove
          </button>
          <button
            type="button"
            onClick={() => {
              if (value && typeof navigator !== "undefined" && navigator.clipboard) {
                void navigator.clipboard.writeText(value);
              }
            }}
            className="rounded-full border border-[var(--color-brd)] bg-white px-3 py-2 text-xs font-semibold text-[var(--color-txt-pri)]"
          >
            Copy URL
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[140px_1fr]">
        <div className="space-y-3">
          <div className="flex h-32 w-full items-center justify-center overflow-hidden rounded-2xl border border-[var(--color-brd)] bg-white">
            {value ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={value} alt={label} className="h-full w-full object-contain" />
            ) : (
              <span className="px-3 text-center text-xs text-[var(--color-txt-mut)]">No media selected</span>
            )}
          </div>
          <input
            value={value || ""}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Paste image URL or select from media"
            className="w-full rounded-2xl border border-[var(--color-brd)] bg-white px-3 py-2 text-xs text-[var(--color-txt-sec)] outline-none"
          />
        </div>

        <div className="rounded-2xl border border-[var(--color-brd)] bg-white p-3">
          {error ? <p className="mb-3 text-xs font-medium text-rose-600">{error}</p> : null}
          {loading ? <p className="text-sm text-[var(--color-txt-sec)]">Loading media...</p> : null}
          {!loading && items.length === 0 ? (
            <p className="text-sm text-[var(--color-txt-sec)]">No uploaded media found for this type yet.</p>
          ) : null}
          {!loading && items.length > 0 ? (
            <div className="grid max-h-64 grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">
              {items.map((item) => {
                const selected = value === item.url;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onChange(item.url)}
                    className={`overflow-hidden rounded-2xl border text-left transition ${
                      selected
                        ? "border-[var(--color-accent)] ring-2 ring-[color-mix(in_srgb,var(--color-accent)_15%,transparent)]"
                        : "border-[var(--color-brd)] hover:border-[var(--color-accent)]"
                    }`}
                  >
                    <div className="aspect-square bg-[var(--color-surf-hover)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.url} alt={item.original_name} className="h-full w-full object-cover" />
                    </div>
                    <div className="p-2">
                      <p className="line-clamp-1 text-xs font-medium text-[var(--color-txt-pri)]">{item.original_name}</p>
                      <p className="mt-1 text-[11px] text-[var(--color-txt-sec)]">Use URL</p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
