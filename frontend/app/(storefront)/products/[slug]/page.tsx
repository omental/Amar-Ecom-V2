import type { Metadata } from "next";

import { ProductDetailView } from "@/components/storefront/ProductDetailView";

type ProductDetailPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateMetadata({
  params,
}: ProductDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: slug.replace(/-/g, " "),
    description: "LiveShopping-style public product detail page.",
  };
}

export default async function ProductDetailPage({
  params,
}: ProductDetailPageProps) {
  const { slug } = await params;

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-[#e5e7eb] bg-white px-5 py-6 sm:px-7">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#db011c]">Product Detail</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-black sm:text-4xl">
          Product Details
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[#4b5563]">
          Product-first detail view with pricing clarity, delivery notes, stock messaging, and fast order actions.
        </p>
      </div>
      <ProductDetailView productSlug={slug} />
    </section>
  );
}
