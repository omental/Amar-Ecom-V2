"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, ShoppingBag, X } from "lucide-react";
import { useState } from "react";

import { STORE_FOOTER_LINKS } from "@/lib/storefront";

export function StoreMobileMenu() {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-label="Open storefront menu"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white/85 text-slate-900 shadow-sm backdrop-blur transition hover:-translate-y-0.5"
      >
        <Menu className="h-5 w-5" />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            className="fixed inset-0 z-[70] bg-slate-950/45 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              className="absolute right-0 top-0 flex h-full w-[82%] max-w-sm flex-col border-l border-white/20 bg-white/95 p-5 shadow-2xl"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="store-eyebrow">Amar eCom</p>
                  <p className="mt-2 text-lg font-semibold text-slate-950">
                    Premium Bangladesh storefront
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Close storefront menu"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <nav className="mt-8 flex flex-col gap-3">
                {STORE_FOOTER_LINKS.map((link, index) => (
                  <motion.div
                    key={link.href}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.04 * index }}
                  >
                    <Link
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm"
                    >
                      <span>{link.label}</span>
                      <span className="text-slate-400">0{index + 1}</span>
                    </Link>
                  </motion.div>
                ))}
              </nav>

              <Link
                href="/products"
                onClick={() => setOpen(false)}
                className="mt-auto inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white"
              >
                <ShoppingBag className="h-4 w-4" />
                <span>Shop Now</span>
              </Link>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
