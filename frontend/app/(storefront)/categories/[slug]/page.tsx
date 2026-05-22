import type { Metadata } from "next";

import { ProductGrid } from "@/components/storefront/ProductGrid";

type CategoryPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const readable = slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  return {
    title: `${readable} Category`,
    description: `Browse public Amar-eCom products in the ${readable} category.`,
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const readable = slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-[#e5e7eb] bg-white px-5 py-6 sm:px-7">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#db011c]">Category</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-black sm:text-4xl">
          {readable}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[#4b5563]">
          Category-first public browsing for active storefront products, kept separate from protected dashboard data.
        </p>
      </div>

      <ProductGrid
        eyebrow="Category Products"
        title={`${readable} products`}
        description="Offer-heavy category browsing with storefront-safe product details."
        query={{ category_slug: slug }}
        collection="seasonal"
        maxItems={24}
      />
    </section>
  );
}
