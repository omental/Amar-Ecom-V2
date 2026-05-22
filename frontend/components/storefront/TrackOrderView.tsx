"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, PackageSearch } from "lucide-react";

import { ApiError } from "@/lib/api";
import { trackStorefrontOrder, type StorefrontTrackedOrder } from "@/lib/storefront-orders";
import { formatStoreCurrency } from "@/lib/storefront";

export function TrackOrderView({
  initialCode = "",
  initialPhone = "",
  autoSubmit = false,
}: {
  initialCode?: string;
  initialPhone?: string;
  autoSubmit?: boolean;
}) {
  const searchParams = useSearchParams();
  const seededCode = initialCode || searchParams.get("code") || "";
  const seededPhone = initialPhone || searchParams.get("phone") || "";
  const [code, setCode] = useState(seededCode);
  const [phone, setPhone] = useState(seededPhone);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<StorefrontTrackedOrder | null>(null);

  async function handleLookup(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!code.trim() || !phone.trim()) {
      setError("Tracking code and phone number are required.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await trackStorefrontOrder(code.trim(), phone.trim());
      setOrder(response);
    } catch (lookupError) {
      setOrder(null);
      setError(
        lookupError instanceof ApiError
          ? lookupError.message
          : "Could not find an order with that code and phone number.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (autoSubmit && seededCode && seededPhone) {
      const timer = window.setTimeout(() => {
        void handleLookup();
      }, 0);
      return () => window.clearTimeout(timer);
    }
    // We only want the initial auto-submit behavior for confirmation redirects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSubmit, seededCode, seededPhone]);

  return (
    <section className="mx-auto grid w-full max-w-4xl gap-5">
      <div className="rounded-[26px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#db011c]">
          Track Order
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-black sm:text-4xl">
          Check your order status
        </h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          আপনার ট্র্যাকিং কোড এবং ফোন নম্বর দিয়ে অর্ডারের বর্তমান অবস্থা দেখুন।
        </p>

        <form onSubmit={handleLookup} className="mt-6 grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-900">Tracking code</span>
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="WEB-2026..."
              className="w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-[#db011c]"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-900">Phone number</span>
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="01XXXXXXXXX"
              className="w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-[#db011c]"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="mt-7 inline-flex h-[50px] items-center justify-center gap-2 rounded-full bg-[#db011c] px-5 text-sm font-semibold text-white transition hover:bg-[#b10017] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PackageSearch className="h-4 w-4" />
            )}
            <span>অর্ডার খুঁজুন</span>
          </button>
        </form>

        {error ? (
          <div className="mt-5 rounded-[18px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
      </div>

      {order ? (
        <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Tracking Code
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-black">
                {order.tracking_code}
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                {order.customer_name || "Customer"} •{" "}
                {order.customer_phone_masked || "Phone verified"}
              </p>
            </div>
            <span className="inline-flex rounded-full bg-[#fff1f3] px-4 py-2 text-sm font-semibold text-[#db011c]">
              {order.status.replace(/_/g, " ")}
            </span>
          </div>

          <div className="mt-6 grid gap-3">
            {order.items.map((item, index) => (
              <div
                key={`${item.product_name}-${index}`}
                className="flex items-start justify-between gap-4 rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-950">{item.product_name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Qty {item.quantity} • {formatStoreCurrency(item.price)} each
                  </p>
                </div>
                <p className="text-sm font-semibold text-slate-950">
                  {formatStoreCurrency(item.total)}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-6 space-y-3 border-t border-slate-200 pt-4 text-sm">
            <div className="flex items-center justify-between text-slate-600">
              <span>Subtotal</span>
              <span className="font-semibold text-slate-950">
                {formatStoreCurrency(order.subtotal)}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span>Delivery charge</span>
              <span className="font-semibold text-slate-950">
                {formatStoreCurrency(order.delivery_charge)}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 pt-3">
              <span className="font-semibold text-slate-950">Total</span>
              <span className="text-lg font-black text-black">
                {formatStoreCurrency(order.total)}
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
