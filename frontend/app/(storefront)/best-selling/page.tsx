import type { Metadata } from "next";

import { MotionReveal } from "@/components/storefront/MotionReveal";
import { ProductGrid } from "@/components/storefront/ProductGrid";

export const metadata: Metadata = {
  title: "Best Selling",
  description:
    "Best-selling style storefront presentation for active public Amar eCom products.",
};

export default function BestSellingPage() {
  return (
    <>
      <MotionReveal>
        <section className="store-surface p-6 sm:p-8">
          <p className="store-eyebrow">Best Selling</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-slate-950 sm:text-4xl">
            Best-selling energy with a premium browsing rhythm.
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
            This route emphasizes high-intent shopping presentation while keeping the data source public-safe and stock-aware.
          </p>
        </section>
      </MotionReveal>

      <ProductGrid
        eyebrow="Best Selling Collection"
        title="Active products prioritized for premium storefront momentum"
        description="The storefront sorts this view for a stronger browse-first experience and keeps CTA placement consistent across cards."
        collection="best-selling"
        maxItems={24}
      />
    </>
  );
}
