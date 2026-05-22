"use client";

import { useEffect, useState } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading-state";
import {
  buildStoreProductsPath,
  fetchStorefrontJson,
  getProductDiscountPercent,
  type StoreProduct,
  type StoreProductListResponse,
} from "@/lib/storefront";

import { MotionReveal } from "./MotionReveal";
import { ProductCard } from "./ProductCard";
import { SectionHeader } from "./SectionHeader";

type ProductGridProps = {
  eyebrow: string;
  title: string;
  description: string;
  query?: {
    search?: string;
    category_slug?: string;
    brand_slug?: string;
  };
  collection?: "latest" | "best-selling" | "flash-sale" | "seasonal";
  maxItems?: number;
  href?: string;
  hrefLabel?: string;
};

function sortProducts(collection: ProductGridProps["collection"], products: StoreProduct[]) {
  const items = [...products];

  if (collection === "flash-sale") {
    return items.sort(
      (left, right) =>
        getProductDiscountPercent(right) - getProductDiscountPercent(left),
    );
  }

  if (collection === "best-selling") {
    return items.sort((left, right) => {
      if (left.stock_status !== right.stock_status) {
        return left.stock_status === "in_stock" ? -1 : 1;
      }
      return right.name.localeCompare(left.name);
    });
  }

  if (collection === "seasonal") {
    return items.sort((left, right) => {
      const seasonalTerms = ["jacket", "hoodie", "high-neck", "panjabi", "blazer"];
      const leftMatch = seasonalTerms.some((term) =>
        `${left.name} ${left.category?.slug || ""}`.toLowerCase().includes(term),
      );
      const rightMatch = seasonalTerms.some((term) =>
        `${right.name} ${right.category?.slug || ""}`.toLowerCase().includes(term),
      );

      if (leftMatch !== rightMatch) {
        return leftMatch ? -1 : 1;
      }

      return left.name.localeCompare(right.name);
    });
  }

  return items;
}

export function ProductGrid({
  eyebrow,
  title,
  description,
  query,
  collection = "latest",
  maxItems = 8,
  href,
  hrefLabel,
}: ProductGridProps) {
  const [state, setState] = useState<{
    loading: boolean;
    error: string | null;
    products: StoreProduct[];
  }>({
    loading: true,
    error: null,
    products: [],
  });
  const queryKey = JSON.stringify(query || {});

  useEffect(() => {
    let cancelled = false;

    async function loadProducts() {
      setState((current) => ({ ...current, loading: true, error: null }));

      try {
        const parsedQuery = JSON.parse(queryKey) as NonNullable<ProductGridProps["query"]>;
        const response = await fetchStorefrontJson<StoreProductListResponse>(
          buildStoreProductsPath({ limit: 60, ...parsedQuery }),
        );
        if (cancelled) {
          return;
        }

        const selectedProducts = sortProducts(collection, response.items).slice(0, maxItems);
        setState({
          loading: false,
          error: null,
          products: selectedProducts,
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        setState({
          loading: false,
          error:
            error instanceof Error
              ? error.message
              : "Unable to load storefront products right now.",
          products: [],
        });
      }
    }

    void loadProducts();

    return () => {
      cancelled = true;
    };
  }, [collection, maxItems, queryKey]);

  return (
    <section className="space-y-5">
      <SectionHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        href={href}
        hrefLabel={hrefLabel}
      />

      {state.loading ? <LoadingState label={`Loading ${title.toLowerCase()}...`} /> : null}
      {!state.loading && state.error ? <ErrorAlert message={state.error} /> : null}
      {!state.loading && !state.error && state.products.length === 0 ? (
        <EmptyState
          title="No products available yet"
          description="This collection is ready for live product data as soon as active items are published."
        />
      ) : null}

      {!state.loading && !state.error && state.products.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {state.products.map((product, index) => (
            <MotionReveal key={product.id} delay={index * 0.04}>
              <ProductCard product={product} />
            </MotionReveal>
          ))}
        </div>
      ) : null}
    </section>
  );
}
