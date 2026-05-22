import type { Metadata } from "next";

import { ProductGrid } from "@/components/storefront/ProductGrid";
import { MotionReveal } from "@/components/storefront/MotionReveal";

export const metadata: Metadata = {
  title: "Shop Product",
  description:
    "Browse public Amar eCom products through a mobile-first, category-aware storefront listing.",
};

type ProductsPageProps = {
  searchParams: Promise<{
    search?: string;
  }>;
};

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const params = await searchParams;

  return (
    <>
      <MotionReveal>
        <section className="store-surface p-6 sm:p-8">
          <p className="store-eyebrow">Shop Product</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-slate-950 sm:text-4xl">
            Public product browsing built for clean conversion.
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
            Explore active storefront inventory with a premium layout, subtle motion, and product cards tuned for quick decision-making on mobile or desktop.
          </p>
        </section>
      </MotionReveal>

      <ProductGrid
        eyebrow="Catalog"
        title={params.search ? `Results for "${params.search}"` : "All active products"}
        description="Only public and active products are shown here, with storefront-safe data and availability-aware messaging."
        query={{ search: params.search }}
        collection="latest"
        maxItems={24}
      />
    </>
  );
}
