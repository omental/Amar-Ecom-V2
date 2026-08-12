import Link from "next/link";
import type { Metadata } from "next";

import { ProductGrid } from "@/components/storefront/ProductGrid";
import type { StoreCategory } from "@/lib/storefront";
import { fetchPublicCategoriesServer } from "@/lib/storefront-public-server";

export const metadata: Metadata = {
  title: "Shop Product",
  description: "Browse public Amar-eCom products in a LiveShopping-style storefront listing.",
};

type ProductsPageProps = {
  searchParams: Promise<{
    search?: string;
    category?: string;
  }>;
};

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const params = await searchParams;
  let categories: StoreCategory[] = [];

  try {
    categories = await fetchPublicCategoriesServer();
  } catch {
    categories = [];
  }

  return (
    <section className="space-y-5">
      <div className="rounded-2xl border border-[#e5e7eb] bg-white px-5 py-6 sm:px-7">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#db011c]">Shop Product</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-black sm:text-4xl">
          Browse LiveShopping Deals
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[#4b5563]">
          Compact, conversion-focused public catalog with category shortcuts, search, price-first cards, and fast order actions.
        </p>
        <form action="/products" className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
          <input
            type="search"
            name="search"
            defaultValue={params.search || ""}
            placeholder="Search products..."
            className="h-12 rounded-md border border-[#d1d5db] bg-white px-4 text-sm outline-none"
          />
          <button type="submit" className="rounded-md bg-[#db011c] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#b90118]">
            Search
          </button>
        </form>
        {categories.length > 0 ? (
          <div className="no-scrollbar mt-4 overflow-x-auto">
            <div className="flex min-w-max gap-2">
              <Link href="/products" className={`rounded-full border px-4 py-2 text-sm font-semibold ${!params.category ? "border-[#db011c] bg-[#fff1f3] text-[#db011c]" : "border-[#e5e7eb] text-black"}`}>
                All
              </Link>
              {categories.map((category) => (
                <Link
                  key={category.id}
                  href={`/products?category=${category.slug}`}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                    params.category === category.slug ? "border-[#db011c] bg-[#fff1f3] text-[#db011c]" : "border-[#e5e7eb] text-black"
                  }`}
                >
                  {category.name}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <ProductGrid
        eyebrow="Catalog"
        title={params.search ? `Results for "${params.search}"` : "All Products"}
        description="Only public, storefront-safe products are listed here."
        query={{ search: params.search, category_slug: params.category }}
        collection={params.category ? "seasonal" : "latest"}
        maxItems={24}
      />
    </section>
  );
}
