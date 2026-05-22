"use client";

import { useCallback, useEffect, useState } from "react";

import { api, ApiError } from "@/lib/api";
import type {
  StorefrontProductPickerItem,
  StorefrontProductPickerResponse,
} from "@/lib/online-store";
import { formatStoreCurrency } from "@/lib/storefront";

function stockLabel(value: StorefrontProductPickerItem["stock_status"]) {
  if (value === "out_of_stock") return "Out of stock";
  if (value === "low_stock") return "Low stock";
  return "In stock";
}

export function ProductPicker({
  value,
  onChange,
  maxSelection = 8,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  maxSelection?: number;
}) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [items, setItems] = useState<StorefrontProductPickerItem[]>([]);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) {
        params.set("q", query.trim());
      }
      params.set("limit", "12");
      const response = await api.get<StorefrontProductPickerResponse>(`/admin/storefront/products/picker?${params.toString()}`);
      setItems(response.items);
      setError("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load products.");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadProducts();
    }, 200);
    return () => window.clearTimeout(timer);
  }, [loadProducts]);

  const selectedProducts = items.filter((item) => value.includes(item.id));

  return (
    <div className="rounded-[20px] border border-[var(--color-brd)] bg-[var(--color-surf-hover)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--color-txt-pri)]">Manual product picker</p>
          <p className="mt-1 text-xs text-[var(--color-txt-sec)]">Select up to {maxSelection} products without typing UUIDs manually.</p>
        </div>
        <div className="text-xs font-medium text-[var(--color-txt-sec)]">
          {value.length}/{maxSelection} selected
        </div>
      </div>

      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search products..."
        className="mt-4 w-full rounded-2xl border border-[var(--color-brd)] bg-white px-4 py-3 text-sm outline-none"
      />

      {value.length > 0 ? (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-txt-sec)]">Selected products</p>
          <div className="grid gap-2">
            {value.map((selectedId) => {
              const selected = selectedProducts.find((item) => item.id === selectedId);
              return (
                <div key={selectedId} className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--color-brd)] bg-white px-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--color-txt-pri)]">{selected?.name || selectedId}</p>
                    {selected ? (
                      <p className="text-xs text-[var(--color-txt-sec)]">
                        {formatStoreCurrency(selected.price)} {selected.category_name ? `· ${selected.category_name}` : ""}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => onChange(value.filter((item) => item !== selectedId))}
                    className="rounded-full border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600"
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="mt-4 rounded-2xl border border-[var(--color-brd)] bg-white p-3">
        {loading ? <p className="text-sm text-[var(--color-txt-sec)]">Loading products...</p> : null}
        {!loading && error ? <p className="text-sm font-medium text-rose-600">{error}</p> : null}
        {!loading && !error && items.length === 0 ? (
          <p className="text-sm text-[var(--color-txt-sec)]">No matching products found.</p>
        ) : null}
        {!loading && !error && items.length > 0 ? (
          <div className="grid gap-3">
            {items.map((item) => {
              const selected = value.includes(item.id);
              const disabled = !selected && value.length >= maxSelection;
              return (
                <div key={item.id} className="grid grid-cols-[56px_1fr_auto] items-center gap-3 rounded-2xl border border-[var(--color-brd)] px-3 py-3">
                  <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-[var(--color-surf-hover)]">
                    {item.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-[11px] text-[var(--color-txt-mut)]">No image</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--color-txt-pri)]">{item.name}</p>
                    <p className="text-xs text-[var(--color-txt-sec)]">
                      {formatStoreCurrency(item.price)}
                      {item.compare_price ? ` · ${formatStoreCurrency(item.compare_price)}` : ""}
                      {item.category_name ? ` · ${item.category_name}` : ""}
                    </p>
                    <p className="mt-1 text-[11px] font-medium text-[#db011c]">{stockLabel(item.stock_status)}</p>
                  </div>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      if (selected) {
                        onChange(value.filter((id) => id !== item.id));
                        return;
                      }
                      onChange([...value, item.id]);
                    }}
                    className={`rounded-full px-3 py-2 text-xs font-semibold ${
                      selected
                        ? "bg-[#db011c] text-white"
                        : disabled
                          ? "cursor-not-allowed bg-slate-200 text-slate-500"
                          : "border border-[var(--color-brd)] text-[var(--color-txt-pri)]"
                    }`}
                  >
                    {selected ? "Selected" : "Select"}
                  </button>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
