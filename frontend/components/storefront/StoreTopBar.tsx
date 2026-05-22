"use client";

import Link from "next/link";
import { Headphones, ShoppingBag } from "lucide-react";

import { useCart } from "@/components/storefront/CartProvider";
import type { OnlineStoreSettings } from "@/lib/online-store";

export function StoreTopBar({ settings }: { settings: OnlineStoreSettings }) {
  const { cartCount } = useCart();

  if (!settings.show_topbar) {
    return null;
  }

  return (
    <div className="border-b border-[#e5e7eb] bg-white text-[#111111]">
      <div className="mx-auto flex min-h-9 max-w-[1200px] items-center justify-between gap-3 px-4 py-2 text-[11px] sm:px-5 sm:text-xs">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex items-center gap-1.5">
            <Headphones className="h-3 w-3" />
            <span>{settings.phone || "+880 1711-000000"}</span>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/cart" className="inline-flex items-center gap-1.5 transition hover:text-[#db011c]">
            <ShoppingBag className="h-3 w-3" />
            <span>Cart</span>
            <span className="font-semibold text-[#db011c]">({cartCount})</span>
          </Link>
          {settings.show_track_order ? (
            <Link
              href="/track-order"
              className="font-medium transition hover:text-[#db011c]"
            >
              Track Order
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
