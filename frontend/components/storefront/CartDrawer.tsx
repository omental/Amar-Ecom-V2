"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";

import { useCart } from "@/components/storefront/CartProvider";
import { formatStoreCurrency } from "@/lib/storefront";

type CartDrawerProps = {
  open: boolean;
  onClose: () => void;
};

export function CartDrawer({ open, onClose }: CartDrawerProps) {
  const { items, subtotal, updateQuantity, removeItem } = useCart();

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[80] bg-slate-950/45 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.aside
            className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.24, ease: "easeOut" }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">Shopping Cart</p>
                <p className="text-xs text-slate-500">
                  {items.length} item{items.length === 1 ? "" : "s"}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              {items.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-6 text-center">
                  <ShoppingBag className="h-8 w-8 text-slate-400" />
                  <p className="mt-4 text-base font-semibold text-slate-900">
                    Your cart is empty
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Add a product to see it here.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-[22px] border border-slate-200 bg-white p-3 shadow-sm"
                    >
                      <div className="flex gap-3">
                        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-[18px] bg-slate-100">
                          {item.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.image}
                              alt={item.name}
                              className="h-full w-full object-cover"
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                            {item.categoryName || "Product"}
                          </p>
                          <Link
                            href={`/products/${item.productId}`}
                            onClick={onClose}
                            className="mt-1 block text-sm font-semibold leading-6 text-slate-900"
                          >
                            {item.name}
                          </Link>
                          <p className="mt-2 text-sm font-semibold text-slate-950">
                            {formatStoreCurrency(item.price)}
                          </p>
                          {item.selectedColor || item.selectedSize ? (
                            <p className="mt-1 text-xs text-slate-500">
                              {[item.selectedColor, item.selectedSize]
                                .filter(Boolean)
                                .join(" / ")}
                            </p>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <div className="inline-flex items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-2 py-2">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-700"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="min-w-6 text-center text-sm font-semibold text-slate-900">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-950 text-white"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <p className="text-sm font-semibold text-slate-950">
                          {formatStoreCurrency(item.price * item.quantity)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 px-5 py-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Subtotal</span>
                <span className="font-semibold text-slate-950">
                  {formatStoreCurrency(subtotal)}
                </span>
              </div>
              <Link
                href="/cart"
                onClick={onClose}
                className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white"
              >
                View Cart
              </Link>
            </div>
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
