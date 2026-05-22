"use client";

import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";

import { useCart } from "@/components/storefront/CartProvider";
import { formatStoreCurrency } from "@/lib/storefront";

export function CartPageView() {
  const { items, subtotal, updateQuantity, removeItem } = useCart();

  if (items.length === 0) {
    return (
      <section className="rounded-[28px] border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
        <ShoppingBag className="mx-auto h-10 w-10 text-slate-400" />
        <h1 className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
          Your cart is empty
        </h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          Add a few products and they will appear here.
        </p>
        <Link href="/products" className="store-primary-button mt-6">
          Continue Shopping
        </Link>
      </section>
    );
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
      <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            Cart
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-950">
            Review your selected items
          </h1>
        </div>

        <div className="space-y-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="grid gap-4 rounded-[24px] border border-slate-200 bg-white p-4 sm:grid-cols-[140px_1fr_auto]"
            >
              <div className="overflow-hidden rounded-[18px] bg-slate-100">
                {item.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.image}
                    alt={item.name}
                    className="h-[160px] w-full object-cover sm:h-[140px]"
                  />
                ) : null}
              </div>

              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {item.categoryName || "Product"}
                </p>
                <Link
                  href={`/products/${item.productId}`}
                  className="mt-1 block text-lg font-semibold leading-7 text-slate-900"
                >
                  {item.name}
                </Link>
                <p className="mt-2 text-base font-semibold text-slate-950">
                  {formatStoreCurrency(item.price)}
                </p>
                {item.regularPrice > item.price ? (
                  <p className="mt-1 text-sm text-slate-400 line-through">
                    {formatStoreCurrency(item.regularPrice)}
                  </p>
                ) : null}
                {item.selectedColor || item.selectedSize ? (
                  <p className="mt-2 text-sm text-slate-500">
                    {[item.selectedColor, item.selectedSize]
                      .filter(Boolean)
                      .join(" / ")}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col justify-between gap-4">
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="inline-flex items-center justify-center self-end rounded-full border border-slate-200 p-2.5 text-slate-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>

                <div className="inline-flex items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-2 py-2">
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-700"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="min-w-7 text-center text-sm font-semibold text-slate-900">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-950 text-white"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>

                <p className="text-right text-sm font-semibold text-slate-950">
                  {formatStoreCurrency(item.price * item.quantity)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <aside className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <p className="text-sm font-semibold text-slate-900">Order Summary</p>
        <div className="mt-5 space-y-3 text-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span>Subtotal</span>
            <span className="font-semibold text-slate-950">
              {formatStoreCurrency(subtotal)}
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-500">
            <span>Shipping</span>
            <span className="text-slate-950">Calculated next</span>
          </div>
        </div>
        <div className="mt-5 border-t border-slate-200 pt-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">Total</span>
            <span className="text-xl font-semibold text-slate-950">
              {formatStoreCurrency(subtotal)}
            </span>
          </div>
        </div>
        <button
          type="button"
          className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white"
        >
          Checkout coming next
        </button>
      </aside>
    </section>
  );
}
