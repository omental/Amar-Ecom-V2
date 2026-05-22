"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { TrackOrderView } from "@/components/storefront/TrackOrderView";

export function OrderConfirmationView({ code }: { code: string }) {
  const searchParams = useSearchParams();
  const phone = searchParams.get("phone") || "";

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#db011c]">
          Order Confirmed
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-black sm:text-4xl">
          Thank you for your order
        </h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          Your tracking code is <span className="font-semibold text-black">{code}</span>.
          We will contact you soon for order confirmation.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/products" className="store-secondary-button">
            Continue Shopping
          </Link>
          <Link href={`/track-order?code=${encodeURIComponent(code)}&phone=${encodeURIComponent(phone)}`} className="store-primary-button">
            Track Order
          </Link>
        </div>
      </section>

      <TrackOrderView initialCode={code} initialPhone={phone} autoSubmit />
    </div>
  );
}
