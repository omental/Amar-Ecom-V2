import type { Metadata } from "next";

import { ProductDetailView } from "@/components/storefront/ProductDetailView";
import { MotionReveal } from "@/components/storefront/MotionReveal";

type ProductDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function generateMetadata({
  params,
}: ProductDetailPageProps): Promise<Metadata> {
  const { id } = await params;

  return {
    title: `Product ${id.slice(0, 8)}`,
    description:
      "Public Amar eCom product detail page with image gallery, pricing, stock messaging, and order-first actions.",
  };
}

export default async function ProductDetailPage({
  params,
}: ProductDetailPageProps) {
  const { id } = await params;

  return (
    <>
      <MotionReveal>
        <section className="store-surface p-6 sm:p-8">
          <p className="store-eyebrow">Product Detail</p>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
            A public-facing mobile-first product page with image emphasis, pricing clarity, stock messaging, and order-oriented actions.
          </p>
        </section>
      </MotionReveal>
      <ProductDetailView productId={id} />
    </>
  );
}
