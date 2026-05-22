"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading-state";
import {
  fetchStorefrontJson,
  STORE_CATEGORY_IMAGE_MAP,
  type StoreCategory,
} from "@/lib/storefront";

import { MotionReveal } from "./MotionReveal";
import { SectionHeader } from "./SectionHeader";

const PRIORITY_CATEGORIES = [
  "Shoe",
  "Jacket",
  "Panjabi",
  "Watch",
  "Shirt",
  "Accessories",
];

export function CategoryTiles() {
  const [state, setState] = useState<{
    loading: boolean;
    error: string | null;
    categories: StoreCategory[];
  }>({
    loading: true,
    error: null,
    categories: [],
  });

  useEffect(() => {
    let cancelled = false;

    async function loadCategories() {
      try {
        const categories = await fetchStorefrontJson<StoreCategory[]>("/public/categories");
        if (cancelled) {
          return;
        }

        setState({ loading: false, error: null, categories });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setState({
          loading: false,
          error:
            error instanceof Error
              ? error.message
              : "Unable to load storefront categories.",
          categories: [],
        });
      }
    }

    void loadCategories();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="mt-4 space-y-4 sm:mt-5">
      <SectionHeader
        eyebrow="Categories"
        title="Shop by popular categories"
        description="Lead with practical category entry points so customers can jump straight into products instead of scrolling through abstract content."
      />

      {state.loading ? <LoadingState label="Loading categories..." /> : null}
      {!state.loading && state.error ? <ErrorAlert message={state.error} /> : null}
      {!state.loading && !state.error && state.categories.length === 0 ? (
        <EmptyState
          title="No public categories yet"
          description="Publish active products with category assignments to populate this section."
        />
      ) : null}

      {!state.loading && !state.error && state.categories.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {PRIORITY_CATEGORIES.map((name, index) => {
            const category = state.categories.find((item) => item.name === name);
            if (!category) {
              return null;
            }

            const previewImage =
              STORE_CATEGORY_IMAGE_MAP[category.name] ||
              "/storefront/demo-products/sneakers-flex-3374.png";

            return (
              <MotionReveal key={category.id} delay={index * 0.03}>
                <Link
                  href={`/categories/${category.slug}`}
                  className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="aspect-[1.08] overflow-hidden bg-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewImage}
                      alt={category.name}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                    />
                  </div>
                  <div className="p-3.5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Category
                    </p>
                    <h3 className="mt-1 text-sm font-semibold text-slate-900">
                      {category.name}
                    </h3>
                  </div>
                </Link>
              </MotionReveal>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
