import type { Metadata } from "next";

import { MotionReveal } from "@/components/storefront/MotionReveal";
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
    description: `Browse active Amar eCom products in the ${readable} category.`,
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const readable = slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  return (
    <>
      <MotionReveal>
        <section className="store-surface p-6 sm:p-8">
          <p className="store-eyebrow">Category</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-slate-950 sm:text-4xl">
            {readable}
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 sm:text-base">
            Category-specific product browsing stays public, mobile-friendly, and separate from the protected dashboard.
          </p>
        </section>
      </MotionReveal>

      <ProductGrid
        eyebrow="Category Products"
        title={`${readable} products`}
        description="This page narrows the storefront to active public products matched to the selected category slug."
        query={{ category_slug: slug }}
        collection="latest"
        maxItems={24}
      />
    </>
  );
}
