"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Minus, Plus, RotateCcw, ShoppingBag, Truck } from "lucide-react";
import { toast } from "sonner";

import { useCart } from "@/components/storefront/CartProvider";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading-state";
import {
  fetchStorefrontJson,
  formatStoreCurrency,
  getProductDiscountPercent,
  getProductOriginalPrice,
  getProductPrimaryImage,
  getProductSalePrice,
  getProductStockLabel,
  ORDER_CTA_TEXT,
  type StoreProduct,
} from "@/lib/storefront";

import { MotionReveal } from "./MotionReveal";

type ProductDetailViewProps = {
  productId: string;
};

export function ProductDetailView({ productId }: ProductDetailViewProps) {
  const router = useRouter();
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [added, setAdded] = useState(false);
  const [state, setState] = useState<{
    loading: boolean;
    error: string | null;
    product: StoreProduct | null;
  }>({
    loading: true,
    error: null,
    product: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadProduct() {
      try {
        const product = await fetchStorefrontJson<StoreProduct>(`/public/products/${productId}`);
        if (cancelled) {
          return;
        }

        const images = product.gallery.length > 0 ? product.gallery : [];
        setState({ loading: false, error: null, product });
        setSelectedImage(images[0] || getProductPrimaryImage(product) || "");
        setSelectedColor(product.colors[0] || "");
        setSelectedSize(product.sizes[0] || "");
      } catch (error) {
        if (cancelled) {
          return;
        }

        setState({
          loading: false,
          error: error instanceof Error ? error.message : "Unable to load this product.",
          product: null,
        });
      }
    }

    void loadProduct();
    return () => {
      cancelled = true;
    };
  }, [productId]);

  const gallery = useMemo(() => {
    if (!state.product) {
      return [];
    }
    const images = state.product.gallery.length > 0 ? state.product.gallery : [];
    const primary = getProductPrimaryImage(state.product);
    const merged = primary ? [primary, ...images] : images;
    return Array.from(new Set(merged.filter(Boolean)));
  }, [state.product]);

  if (state.loading) {
    return <LoadingState label="Loading product details..." />;
  }

  if (state.error) {
    return <ErrorAlert message={state.error} />;
  }

  if (!state.product) {
    return (
      <EmptyState
        title="Product not found"
        description="This product is not publicly available right now."
      />
    );
  }

  const product = state.product;
  const originalPrice = getProductOriginalPrice(product);
  const salePrice = getProductSalePrice(product);
  const discount = getProductDiscountPercent(product);
  const unavailable = product.stock_status === "out_of_stock";

  const handleAddToCart = () => {
    if (unavailable) {
      return;
    }

    addItem(product, {
      quantity,
      selectedColor: selectedColor || undefined,
      selectedSize: selectedSize || undefined,
    });
    setAdded(true);
    toast.success("Added to cart");
    window.setTimeout(() => setAdded(false), 1000);
  };

  const handleOrderNow = () => {
    if (unavailable) {
      return;
    }

    addItem(product, {
      quantity,
      selectedColor: selectedColor || undefined,
      selectedSize: selectedSize || undefined,
    });
    router.push("/cart");
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[0.96fr_1.04fr]">
      <MotionReveal>
        <div className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="overflow-hidden rounded-[22px] bg-slate-100">
            {selectedImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={selectedImage}
                alt={product.name}
                className="h-full min-h-[360px] w-full object-cover"
              />
            ) : (
              <div className="flex min-h-[360px] items-center justify-center bg-slate-100">
                <div className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-700">
                  Product image
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 grid grid-cols-4 gap-3">
            {gallery.map((image, index) => (
              <button
                key={`${image}-${index}`}
                type="button"
                onClick={() => setSelectedImage(image)}
                className={`overflow-hidden rounded-[16px] border ${
                  selectedImage === image ? "border-slate-900" : "border-slate-200"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image}
                  alt={`${product.name} preview ${index + 1}`}
                  className="aspect-square w-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      </MotionReveal>

      <MotionReveal delay={0.08}>
        <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            {product.category?.name || "Product"}
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-3xl">
            {product.name}
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <p className="text-3xl font-semibold text-slate-950">
              {formatStoreCurrency(salePrice)}
            </p>
            {originalPrice > salePrice ? (
              <p className="text-lg text-slate-400 line-through">
                {formatStoreCurrency(originalPrice)}
              </p>
            ) : null}
            {discount > 0 ? (
              <span className="rounded-full bg-rose-500 px-2.5 py-1 text-xs font-semibold text-white">
                Save {discount}%
              </span>
            ) : null}
          </div>

          <p className="mt-4 text-sm leading-7 text-slate-600">
            {product.description || product.short_description || "Temporary demo/reference product."}
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
              {getProductStockLabel(product)}
            </span>
            {product.is_demo_reference ? (
              <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
                Demo Reference
              </span>
            ) : null}
          </div>

          {product.demo_notice ? (
            <div className="mt-4 rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
              {product.demo_notice}
            </div>
          ) : null}

          {product.colors.length > 0 ? (
            <div className="mt-6">
              <p className="text-sm font-semibold text-slate-900">Color</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {product.colors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSelectedColor(color)}
                    className={`rounded-full border px-4 py-2 text-sm font-medium ${
                      selectedColor === color
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    {color}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {product.sizes.length > 0 ? (
            <div className="mt-6">
              <p className="text-sm font-semibold text-slate-900">Size</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {product.sizes.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setSelectedSize(size)}
                    className={`rounded-full border px-4 py-2 text-sm font-medium ${
                      selectedSize === size
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="inline-flex w-fit items-center gap-4 rounded-full border border-slate-200 bg-slate-50 px-3 py-2">
              <button
                type="button"
                onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-700"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="min-w-8 text-center text-sm font-semibold text-slate-900">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity((current) => current + 1)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-950 text-white"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-1 flex-col gap-3 sm:flex-row">
              <motion.button
                type="button"
                whileTap={{ scale: 0.98 }}
                onClick={handleAddToCart}
                disabled={unavailable}
                className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition ${
                  unavailable
                    ? "cursor-not-allowed bg-slate-200 text-slate-500"
                    : "bg-slate-950 text-white hover:bg-[var(--store-accent)]"
                }`}
              >
                <ShoppingBag className="h-4 w-4" />
                <span>{added ? "Added" : "Add to Cart"}</span>
              </motion.button>
              <button
                type="button"
                onClick={handleOrderNow}
                className="store-secondary-button justify-center"
              >
                {ORDER_CTA_TEXT}
              </button>
            </div>
          </div>

          <div className="mt-7 grid gap-3">
            {product.support_notes.length > 0
              ? product.support_notes.map((note, index) => (
                  <div
                    key={`${note}-${index}`}
                    className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600"
                  >
                    {note}
                  </div>
                ))
              : null}
            <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-[var(--store-accent)]" />
                <span>Delivery support available across Bangladesh.</span>
              </div>
            </div>
            <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <RotateCcw className="h-4 w-4 text-[var(--store-accent)]" />
                <span>Return and exchange policy depends on item condition and stock availability.</span>
              </div>
            </div>
          </div>
        </div>
      </MotionReveal>
    </div>
  );
}
