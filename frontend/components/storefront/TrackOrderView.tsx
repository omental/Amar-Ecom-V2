"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, PackageSearch } from "lucide-react";

import { ApiError } from "@/lib/api";
import {
  trackStorefrontOrder,
  type StorefrontTrackedOrder,
} from "@/lib/storefront-orders";
import { formatStoreCurrency } from "@/lib/storefront";

const BN_TRACK_HELP =
  "\u0986\u09AA\u09A8\u09BE\u09B0 \u099F\u09CD\u09B0\u09CD\u09AF\u09BE\u0995\u09BF\u0982 \u0995\u09CB\u09A1 \u098F\u09AC\u0982 \u09AB\u09CB\u09A8 \u09A8\u09AE\u09CD\u09AC\u09B0 \u09A6\u09BF\u09DF\u09C7 \u0985\u09B0\u09CD\u09A1\u09BE\u09B0\u09C7\u09B0 \u09AC\u09B0\u09CD\u09A4\u09AE\u09BE\u09A8 \u0985\u09AC\u09B8\u09CD\u09A5\u09BE \u09A6\u09C7\u0996\u09C1\u09A8\u0964";
const BN_TRACK_BUTTON = "\u0985\u09B0\u09CD\u09A1\u09BE\u09B0 \u0996\u09C1\u0981\u099C\u09C1\u09A8";

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

  const handleLookup = useCallback(async (event?: FormEvent<HTMLFormElement>) => {
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
  }, [code, phone]);

  useEffect(() => {
    if (autoSubmit && seededCode && seededPhone) {
      const timer = window.setTimeout(() => {
        void handleLookup();
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [autoSubmit, handleLookup, seededCode, seededPhone]);

  return (
    <section className="mx-auto grid w-full max-w-4xl gap-5">
      <div className="rounded-[26px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#db011c]">
          Track Order
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-black sm:text-4xl">
          Check your order status
        </h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">{BN_TRACK_HELP}</p>

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
            <span>{BN_TRACK_BUTTON}</span>
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
                {order.customer_name || "Customer"} /{" "}
                {order.customer_phone_masked || "Phone verified"}
              </p>
            </div>
            <span className="inline-flex rounded-full bg-[#fff1f3] px-4 py-2 text-sm font-semibold text-[#db011c]">
              {order.status.replace(/_/g, " ")}
            </span>
          </div>

          <div className="mt-6 rounded-[22px] border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">Order timeline</p>
            <div className="mt-4 grid gap-4">
              {order.timeline.map((step, index) => (
                <div key={`${step.status}-${index}`} className="flex items-start gap-3">
                  <div className="mt-1 flex flex-col items-center">
                    <span
                      className={`h-3.5 w-3.5 rounded-full ${
                        step.completed ? "bg-[#db011c]" : "bg-slate-300"
                      }`}
                    />
                    {index < order.timeline.length - 1 ? (
                      <span className="mt-1 h-8 w-px bg-slate-300" />
                    ) : null}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-950">{step.label}</p>
                    <p className="text-xs text-slate-500">
                      {step.timestamp
                        ? new Date(step.timestamp).toLocaleString("en-BD")
                        : step.completed
                          ? "Completed"
                          : "Pending"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
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
                    Qty {item.quantity} / {formatStoreCurrency(item.price)} each
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
              <span>Discount</span>
              <span className="font-semibold text-emerald-700">
                -{formatStoreCurrency(order.discount_total)}
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
