"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { OnlineStoreTabs } from "@/components/dashboard/online-store/OnlineStoreTabs";
import { ErrorAlert } from "@/components/ui/error-alert";
import { FormCard } from "@/components/ui/form-card";
import { LoadingState } from "@/components/ui/loading-state";
import { OpsPageHeader } from "@/components/ui/ops-page-header";
import { api, ApiError } from "@/lib/api";
import type { OnlineStoreCoupon } from "@/lib/online-store";
import { formatStoreCurrency } from "@/lib/storefront";

const initialCoupon: OnlineStoreCoupon = {
  code: "",
  type: "fixed",
  value: 0,
  min_order_amount: 0,
  max_discount_amount: null,
  active: true,
  starts_at: null,
  ends_at: null,
  usage_limit: null,
};

function toDateTimeLocalValue(value?: string | null) {
  if (!value) return "";
  return value.slice(0, 16);
}

function normalizeCouponPayload(coupon: OnlineStoreCoupon) {
  return {
    code: coupon.code.trim().toUpperCase(),
    type: coupon.type,
    value: Number(coupon.value || 0),
    min_order_amount: Number(coupon.min_order_amount || 0),
    max_discount_amount:
      coupon.max_discount_amount === null || coupon.max_discount_amount === undefined || coupon.max_discount_amount === 0
        ? null
        : Number(coupon.max_discount_amount),
    active: coupon.active,
    starts_at: coupon.starts_at || null,
    ends_at: coupon.ends_at || null,
    usage_limit:
      coupon.usage_limit === null || coupon.usage_limit === undefined || coupon.usage_limit === 0
        ? null
        : Number(coupon.usage_limit),
  };
}

export default function OnlineStoreCouponsPage() {
  const [coupons, setCoupons] = useState<OnlineStoreCoupon[]>([]);
  const [draftCoupon, setDraftCoupon] = useState<OnlineStoreCoupon>(initialCoupon);
  const [selectedCouponId, setSelectedCouponId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadCoupons() {
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    if (statusFilter !== "all") params.set("active", String(statusFilter === "active"));
    const query = params.toString();
    const payload = await api.get<OnlineStoreCoupon[]>(
      `/admin/storefront/coupons${query ? `?${query}` : ""}`,
    );
    setCoupons(payload);
    setSelectedCouponId((current) => current || payload[0]?.id || null);
  }

  useEffect(() => {
    let mounted = true;
    async function run() {
      try {
        if (!mounted) return;
        await loadCoupons();
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof ApiError ? err.message : "Failed to load storefront coupons.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void run();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedCoupon = useMemo(
    () => coupons.find((coupon) => coupon.id === selectedCouponId) || null,
    [coupons, selectedCouponId],
  );

  async function refreshCoupons() {
    setError("");
    await loadCoupons();
  }

  async function handleCreateCoupon(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await api.post<OnlineStoreCoupon>(
        "/admin/storefront/coupons",
        normalizeCouponPayload(draftCoupon),
      );
      setDraftCoupon(initialCoupon);
      await refreshCoupons();
      setSuccess("Coupon created.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create coupon.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveCoupon(coupon: OnlineStoreCoupon) {
    if (!coupon.id) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await api.put<OnlineStoreCoupon>(
        `/admin/storefront/coupons/${coupon.id}`,
        normalizeCouponPayload(coupon),
      );
      await refreshCoupons();
      setSuccess("Coupon updated.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update coupon.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteCoupon(couponId: string) {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await api.delete(`/admin/storefront/coupons/${couponId}`);
      if (selectedCouponId === couponId) {
        setSelectedCouponId(null);
      }
      await refreshCoupons();
      setSuccess("Coupon deleted.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete coupon.");
    } finally {
      setSaving(false);
    }
  }

  async function handleFilterSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      await refreshCoupons();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to filter coupons.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <OpsPageHeader
        eyebrow="Online Store"
        title="Coupons"
        description="Create COD-friendly storefront coupon rules and keep discount validation controlled from the dashboard."
      />
      <OnlineStoreTabs />
      {loading ? <LoadingState label="Loading storefront coupons..." /> : null}
      {!loading && error ? <ErrorAlert message={error} /> : null}
      {success ? (
        <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-700">
          {success}
        </div>
      ) : null}

      {!loading ? (
        <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
          <FormCard
            title="Create Coupon"
            description="Add a fixed or percentage coupon. Codes are normalized to uppercase and revalidated server-side during checkout."
          >
            <form onSubmit={handleCreateCoupon} className="grid gap-4">
              <CouponFields coupon={draftCoupon} onChange={setDraftCoupon} />
              <button
                type="submit"
                disabled={saving}
                className="rounded-full bg-[var(--color-accent)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving ? "Saving..." : "Create Coupon"}
              </button>
            </form>
          </FormCard>

          <FormCard
            title="Coupon Library"
            description="Filter by code or status, then edit the selected coupon without leaving the Online Store dashboard."
          >
            <form onSubmit={handleFilterSubmit} className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search coupon code"
                className="rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm outline-none"
              />
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as "all" | "active" | "inactive")
                }
                className="rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm outline-none"
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <button
                type="submit"
                className="rounded-full border border-[var(--color-brd)] px-4 py-3 text-sm font-semibold text-[var(--color-txt-pri)]"
              >
                Filter
              </button>
            </form>

            <div className="mt-5 grid gap-6 lg:grid-cols-[270px_1fr]">
              <div className="space-y-3">
                {coupons.length === 0 ? (
                  <div className="rounded-[20px] border border-dashed border-[var(--color-brd)] px-4 py-8 text-center text-sm text-[var(--color-txt-sec)]">
                    No coupons found yet.
                  </div>
                ) : (
                  coupons.map((coupon) => (
                    <button
                      key={coupon.id}
                      type="button"
                      onClick={() => setSelectedCouponId(coupon.id || null)}
                      className={`w-full rounded-[20px] border px-4 py-4 text-left ${
                        selectedCouponId === coupon.id
                          ? "border-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-accent)_8%,white)]"
                          : "border-[var(--color-brd)] bg-[var(--color-surf-hover)]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-[var(--color-txt-pri)]">
                          {coupon.code}
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${
                            coupon.active
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {coupon.active ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-rose-700">
                          {coupon.type}
                        </span>
                        <span className="text-xs text-[var(--color-txt-sec)]">
                          Value{" "}
                          {coupon.type === "percentage"
                            ? `${coupon.value}%`
                            : formatStoreCurrency(coupon.value)}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>

              {selectedCoupon ? (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <MetricCard label="Type" value={selectedCoupon.type === "percentage" ? "Percentage" : "Fixed"} />
                    <MetricCard
                      label="Min order"
                      value={formatStoreCurrency(selectedCoupon.min_order_amount)}
                    />
                    <MetricCard label="Usage" value={`${selectedCoupon.usage_count ?? 0}${selectedCoupon.usage_limit ? ` / ${selectedCoupon.usage_limit}` : ""}`} />
                  </div>
                  <CouponFields
                    coupon={selectedCoupon}
                    onChange={(nextCoupon) =>
                      setCoupons((current) =>
                        current.map((item) => (item.id === nextCoupon.id ? nextCoupon : item)),
                      )
                    }
                  />
                  <div className="rounded-[18px] border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm text-[var(--color-txt-sec)]">
                    {selectedCoupon.starts_at || selectedCoupon.ends_at ? (
                      <span>
                        Active window: {selectedCoupon.starts_at ? new Date(selectedCoupon.starts_at).toLocaleString("en-BD") : "Now"} to{" "}
                        {selectedCoupon.ends_at ? new Date(selectedCoupon.ends_at).toLocaleString("en-BD") : "No end date"}
                      </span>
                    ) : (
                      <span>No date range set. This coupon is controlled by active status and usage rules.</span>
                    )}
                  </div>
                  <div className="flex flex-wrap justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => void handleDeleteCoupon(selectedCoupon.id!)}
                      disabled={saving}
                      className="rounded-full border border-rose-200 px-4 py-3 text-sm font-semibold text-rose-600 disabled:opacity-60"
                    >
                      Delete Coupon
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSaveCoupon(selectedCoupon)}
                      disabled={saving}
                      className="rounded-full bg-[var(--color-accent)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      Save Coupon
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-[20px] border border-dashed border-[var(--color-brd)] px-4 py-8 text-center text-sm text-[var(--color-txt-sec)]">
                  Select a coupon to edit its rules.
                </div>
              )}
            </div>
          </FormCard>
        </div>
      ) : null}
    </div>
  );
}

function CouponFields({
  coupon,
  onChange,
}: {
  coupon: OnlineStoreCoupon;
  onChange: (coupon: OnlineStoreCoupon) => void;
}) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-2 block font-medium text-[var(--color-txt-sec)]">Coupon code</span>
          <input
            value={coupon.code}
            onChange={(event) =>
              onChange({ ...coupon, code: event.target.value.toUpperCase() })
            }
            placeholder="SAVE200"
            className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 outline-none"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-2 block font-medium text-[var(--color-txt-sec)]">Type</span>
          <select
            value={coupon.type}
            onChange={(event) =>
              onChange({
                ...coupon,
                type: event.target.value as "fixed" | "percentage",
              })
            }
            className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 outline-none"
          >
            <option value="fixed">Fixed</option>
            <option value="percentage">Percentage</option>
          </select>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="block text-sm">
          <span className="mb-2 block font-medium text-[var(--color-txt-sec)]">Value</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={coupon.value}
            onChange={(event) => onChange({ ...coupon, value: Number(event.target.value || 0) })}
            className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 outline-none"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-2 block font-medium text-[var(--color-txt-sec)]">Min order amount</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={coupon.min_order_amount}
            onChange={(event) =>
              onChange({ ...coupon, min_order_amount: Number(event.target.value || 0) })
            }
            className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 outline-none"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-2 block font-medium text-[var(--color-txt-sec)]">Max discount amount</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={coupon.max_discount_amount ?? ""}
            onChange={(event) =>
              onChange({
                ...coupon,
                max_discount_amount: event.target.value ? Number(event.target.value) : null,
              })
            }
            placeholder="Optional"
            className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 outline-none"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-2 block font-medium text-[var(--color-txt-sec)]">Usage limit</span>
          <input
            type="number"
            min="1"
            step="1"
            value={coupon.usage_limit ?? ""}
            onChange={(event) =>
              onChange({
                ...coupon,
                usage_limit: event.target.value ? Number(event.target.value) : null,
              })
            }
            placeholder="Optional"
            className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 outline-none"
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-2 block font-medium text-[var(--color-txt-sec)]">Starts at</span>
          <input
            type="datetime-local"
            value={toDateTimeLocalValue(coupon.starts_at)}
            onChange={(event) =>
              onChange({
                ...coupon,
                starts_at: event.target.value ? new Date(event.target.value).toISOString() : null,
              })
            }
            className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 outline-none"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-2 block font-medium text-[var(--color-txt-sec)]">Ends at</span>
          <input
            type="datetime-local"
            value={toDateTimeLocalValue(coupon.ends_at)}
            onChange={(event) =>
              onChange({
                ...coupon,
                ends_at: event.target.value ? new Date(event.target.value).toISOString() : null,
              })
            }
            className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 outline-none"
          />
        </label>
      </div>

      <label className="flex items-center gap-3 rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm font-medium text-[var(--color-txt-sec)]">
        <input
          type="checkbox"
          checked={coupon.active}
          onChange={(event) => onChange({ ...coupon, active: event.target.checked })}
        />
        Active coupon
      </label>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3">
      <div className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--color-txt-mut)]">
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-[var(--color-txt-pri)]">{value}</div>
    </div>
  );
}
