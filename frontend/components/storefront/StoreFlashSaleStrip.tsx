"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading-state";
import {
  buildStoreProductsPath,
  fetchStorefrontJson,
  formatStoreCurrency,
  getProductDiscountPercent,
  getProductPrimaryImage,
  type StoreProduct,
  type StoreProductListResponse,
} from "@/lib/storefront";

import { MotionReveal } from "./MotionReveal";

export function StoreFlashSaleStrip() {
  const [state, setState] = useState<{
    loading: boolean;
    error: string | null;
    products: StoreProduct[];
  }>({
    loading: true,
    error: null,
    products: [],
  });

  useEffect(() => {
    let cancelled = false;

    async function loadProducts() {
      try {
        const response = await fetchStorefrontJson<StoreProductListResponse>(
          buildStoreProductsPath({ limit: 8 }),
        );

        if (cancelled) {
          return;
        }

        const products = [...response.items]
          .sort(
            (left, right) =>
              getProductDiscountPercent(right) - getProductDiscountPercent(left),
          )
          .slice(0, 4);

        setState({
          loading: false,
          error: null,
          products,
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
              : "Unable to load flash sale products.",
          products: [],
        });
      }
    }

    void loadProducts();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 rounded-3xl bg-slate-950 px-5 py-5 text-white sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-rose-300">
            Flash Sale
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em]">
            Best deals live now
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Limited demo catalog, highlighted in a tighter sale-first layout.
          </p>
        </div>
        <Link
          href="/flash-sale"
          className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-semibold text-slate-950"
        >
          View Flash Sale
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {state.loading ? <LoadingState label="Loading flash sale..." /> : null}
      {!state.loading && state.error ? <ErrorAlert message={state.error} /> : null}
      {!state.loading && !state.error && state.products.length === 0 ? (
        <EmptyState
          title="No flash sale products yet"
          description="Publish discounted active items to fill this section."
        />
      ) : null}

      {!state.loading && !state.error && state.products.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {state.products.map((product, index) => {
            const image = getProductPrimaryImage(product);
            const discount = getProductDiscountPercent(product);

            return (
              <MotionReveal key={product.id} delay={index * 0.04}>
                <Link
                  href={`/products/${product.slug}`}
                  className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:grid-cols-[120px_1fr] md:grid-cols-1"
                >
                  <div className="relative overflow-hidden rounded-[18px] bg-slate-100">
                    {discount > 0 ? (
                      <span className="absolute left-3 top-3 z-10 rounded-full bg-rose-500 px-2.5 py-1 text-[11px] font-semibold text-white">
                        -{discount}%
                      </span>
                    ) : null}
                    {image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={image}
                        alt={product.name}
                        className="h-[180px] w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-[180px] items-center justify-center text-sm font-semibold text-slate-500">
                        Product image
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      {product.category?.name || "Sale"}
                    </p>
                    <h3 className="mt-2 line-clamp-2 text-base font-semibold leading-6 text-slate-950">
                      {product.name}
                    </h3>
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-lg font-semibold text-slate-950">
                        {formatStoreCurrency(product.sale_price)}
                      </span>
                      <span className="text-sm text-slate-400 line-through">
                        {formatStoreCurrency(product.price)}
                      </span>
                    </div>
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
