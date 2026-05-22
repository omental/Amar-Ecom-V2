"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ShoppingBag } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useCart } from "@/components/storefront/CartProvider";
import {
  formatStoreCurrency,
  getProductDiscountPercent,
  getProductOriginalPrice,
  getProductPrimaryImage,
  getProductSalePrice,
  getProductStockLabel,
  ORDER_CTA_TEXT,
  type StoreProduct,
} from "@/lib/storefront";

type ProductCardProps = {
  product: StoreProduct;
};

export function ProductCard({ product }: ProductCardProps) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  const salePrice = getProductSalePrice(product);
  const originalPrice = getProductOriginalPrice(product);
  const discount = getProductDiscountPercent(product);
  const unavailable = product.stock_status === "out_of_stock";
  const image = getProductPrimaryImage(product);

  const handleAddToCart = () => {
    if (unavailable) {
      return;
    }

    addItem(product, { quantity: 1 });
    setAdded(true);
    toast.success("Added to cart");
    window.setTimeout(() => setAdded(false), 1000);
  };

  return (
    <motion.article
      whileHover={{ y: -3 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="group overflow-hidden rounded-[20px] border border-slate-200 bg-white opacity-100 shadow-sm transition-shadow hover:shadow-md"
    >
      <Link href={`/products/${product.slug}`} className="block">
        <div className="relative h-[220px] overflow-hidden bg-slate-100 sm:h-[240px] xl:h-[260px]">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt={product.name}
              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-slate-100 p-5">
              <div className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                Product preview
              </div>
            </div>
          )}

          <div className="absolute left-3 top-3 flex flex-wrap gap-2">
            {discount > 0 ? (
              <span className="rounded-full bg-rose-500 px-2.5 py-1 text-[11px] font-semibold text-white">
                -{discount}%
              </span>
            ) : null}
            {unavailable ? (
              <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white">
                Unavailable
              </span>
            ) : null}
          </div>
        </div>
      </Link>

      <div className="space-y-3 p-4">
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            {product.category?.name || "Featured"}
          </p>
          <Link href={`/products/${product.slug}`} className="block">
            <h3 className="line-clamp-2 text-[15px] font-medium leading-6 text-slate-900 transition group-hover:text-slate-700">
              {product.name}
            </h3>
          </Link>

          <div className="flex items-center gap-2 text-sm">
            <p className="text-lg font-semibold text-slate-950">
              {formatStoreCurrency(salePrice)}
            </p>
            {originalPrice > salePrice ? (
              <span className="text-sm text-slate-400 line-through">
                {formatStoreCurrency(originalPrice)}
              </span>
            ) : null}
          </div>

          <p className="line-clamp-2 text-[13px] leading-5 text-slate-500">
            {product.short_description || "Temporary demo/reference product."}
          </p>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
            {getProductStockLabel(product)}
          </span>
          <button
            type="button"
            onClick={handleAddToCart}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-semibold transition ${
              unavailable
                ? "cursor-not-allowed bg-slate-200 text-slate-500"
                : "bg-slate-950 text-white hover:bg-[var(--store-accent)]"
            }`}
            disabled={unavailable}
          >
            <ShoppingBag className="h-3.5 w-3.5" />
            <span>{added ? "Added" : ORDER_CTA_TEXT}</span>
          </button>
        </div>
      </div>
    </motion.article>
  );
}
