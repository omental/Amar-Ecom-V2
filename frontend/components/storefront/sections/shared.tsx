"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { useCart } from "@/components/storefront/CartProvider";
import type { OnlineStoreSection, OnlineStoreSettings } from "@/lib/online-store";
import { getStorefrontTheme } from "@/lib/storefront-theme";
import { formatStoreCurrency, ORDER_CTA_TEXT, type StoreProduct } from "@/lib/storefront";

export function SectionWrap({
  settings,
  children,
  className = "",
}: {
  settings: OnlineStoreSettings;
  children: ReactNode;
  className?: string;
}) {
  const theme = getStorefrontTheme(settings);
  return <section className={`${theme.animationClass} ${className}`.trim()}>{children}</section>;
}

export function HomeSectionHeader({
  title,
  href,
  hrefLabel,
  settings,
}: {
  title: string;
  href?: string;
  hrefLabel?: string;
  settings: OnlineStoreSettings;
}) {
  const theme = getStorefrontTheme(settings);
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-4 sm:grid-cols-[1fr_auto_1fr]">
      <div className="hidden sm:block" />
      <h2 className="text-center text-[1.7rem] font-extrabold uppercase tracking-tight text-[#111111] sm:text-[1.95rem]">
        {title}
      </h2>
      {href && hrefLabel ? (
        <Link
          href={href}
          className={`inline-flex shrink-0 justify-self-end items-center justify-center border border-[#d1d5db] px-3 py-2 text-xs font-semibold text-black transition hover:text-[var(--store-accent)] sm:px-4 ${theme.buttonRadiusClass}`}
        >
          {hrefLabel}
        </Link>
      ) : null}
    </div>
  );
}

export function HomeProductCard({
  product,
  settings,
}: {
  product: StoreProduct;
  settings: OnlineStoreSettings;
}) {
  const { addItem } = useCart();
  const [isAdding, setIsAdding] = useState(false);
  const theme = getStorefrontTheme(settings);

  const currentPrice = Number(product.sale_price);
  const oldPrice = Number(product.price);
  const badge =
    oldPrice > currentPrice ? `${Math.round(((oldPrice - currentPrice) / oldPrice) * 100)}% OFF` : "";

  const handleAdd = () => {
    addItem(product, { quantity: 1 });
    setIsAdding(true);
    toast.success("Product added to cart");
    window.setTimeout(() => setIsAdding(false), 1000);
  };

  return (
    <article className={`overflow-hidden ${theme.radiusClass} ${theme.productCardClass} transition hover:-translate-y-0.5`}>
      <Link href={`/products/${product.slug}`} className="block">
        <div className="relative aspect-[4/4.8] overflow-hidden bg-[#f3f4f6]">
          {badge ? (
            <span className="absolute left-2 top-2 z-10 rounded bg-[var(--store-accent)] px-2 py-1 text-[10px] font-bold uppercase text-white">
              {badge}
            </span>
          ) : null}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={product.image || product.thumbnail || "/storefront/demo-products/jacket-italian-3154.jpg"}
            alt={product.name}
            className="h-full w-full object-cover object-top transition duration-300 hover:scale-[1.02]"
          />
        </div>
      </Link>

      <div className="space-y-3 p-3">
        <Link href={`/products/${product.slug}`} className="block">
          <h3 className="line-clamp-2 min-h-10 text-[13px] font-medium leading-5 text-black sm:text-sm">
            {product.name}
          </h3>
        </Link>

        <div className="flex items-center gap-2 text-sm">
          <span className="font-bold text-[var(--store-accent)]">{formatStoreCurrency(currentPrice)}</span>
          <span className="text-xs text-[#6b7280] line-through">{formatStoreCurrency(oldPrice)}</span>
        </div>

        <button
          type="button"
          onClick={handleAdd}
          className={`flex w-full items-center justify-center gap-2 px-3 py-2 text-xs font-bold text-white transition ${theme.buttonRadiusClass}`}
          style={{ backgroundColor: theme.primaryColor }}
        >
          <ShoppingBag className="h-3.5 w-3.5" />
          <span>{isAdding ? "Added" : ORDER_CTA_TEXT}</span>
        </button>
      </div>
    </article>
  );
}

export function getSectionText(section: OnlineStoreSection, key: string) {
  const content = (section.content || {}) as Record<string, unknown>;
  return String(content[key] || "");
}
