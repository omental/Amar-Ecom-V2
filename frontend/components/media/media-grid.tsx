"use client";

import { Check } from "lucide-react";

import { ResilientImage } from "@/components/ui/resilient-image";
import { formatFileSize, type MediaAsset } from "@/lib/media";

export function MediaGrid({
  items,
  selectedUrls = [],
  onOpen,
}: {
  items: MediaAsset[];
  selectedUrls?: string[];
  onOpen: (asset: MediaAsset) => void;
}) {
  const selected = new Set(selectedUrls);
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
      {items.map((asset) => {
        const isSelected = selected.has(asset.public_url);
        return (
          <button
            key={asset.id}
            type="button"
            onClick={() => onOpen(asset)}
            aria-pressed={isSelected}
            aria-label={`${isSelected ? "Deselect" : "Select"} ${asset.alt_text || asset.title || asset.original_filename}`}
            className={`group overflow-hidden rounded-[20px] border bg-[var(--color-surf)] text-left shadow-[var(--shadow-subtle)] outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 ${isSelected ? "border-[var(--color-accent)] ring-2 ring-[color-mix(in_srgb,var(--color-accent)_18%,transparent)]" : "border-[var(--color-brd)] hover:border-slate-400"}`}
          >
            <div className="relative">
              <ResilientImage src={asset.public_url} alt={asset.alt_text || asset.original_filename} containerClassName="aspect-square" />
              {isSelected ? <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-accent)] text-white shadow" aria-hidden="true"><Check className="h-4 w-4" /></span> : null}
            </div>
            <div className="p-3">
              <p className="truncate text-xs font-semibold text-[var(--color-txt-pri)]">{asset.title || asset.original_filename}</p>
              <p className="mt-1 truncate text-[10px] text-[var(--color-txt-mut)]">{asset.width}×{asset.height} · {formatFileSize(asset.file_size)}</p>
              {isSelected ? <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-[var(--color-accent)]">Selected</p> : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}
