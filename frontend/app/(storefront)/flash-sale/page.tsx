import type { Metadata } from "next";

import { MotionReveal } from "@/components/storefront/MotionReveal";
import { ProductGrid } from "@/components/storefront/ProductGrid";

export const metadata: Metadata = {
  title: "Flash Sale",
  description:
    "Flash sale storefront collection for public Amar eCom products with promotional pricing.",
};

export default function FlashSalePage() {
  return (
    <>
      <MotionReveal>
        <section className="store-surface p-6 sm:p-8">
          <p className="store-eyebrow">Flash Sale</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-slate-950 sm:text-4xl">
            Promotional browsing with restrained motion and fast scanning.
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
            Products with the strongest public discount signal are surfaced first while keeping the experience lightweight and mobile polished.
          </p>
        </section>
      </MotionReveal>

      <ProductGrid
        eyebrow="Flash Sale Picks"
        title="Discount-led cards ready for quick conversion"
        description="This route leans into promotional storefront presentation without compromising stock visibility or detail-page continuity."
        collection="flash-sale"
        maxItems={24}
      />
    </>
  );
}
