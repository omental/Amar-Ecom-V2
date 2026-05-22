"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, ShoppingBag } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { useCart } from "@/components/storefront/CartProvider";
import {
  FALLBACK_STOREFRONT_HOME,
  buildStoreProductFromSectionProduct,
  getFallbackProductsBySource,
  type OnlineStoreSection,
  type PublicStorefrontResponse,
} from "@/lib/online-store";
import { formatStoreCurrency, ORDER_CTA_TEXT, type StoreProduct } from "@/lib/storefront";

function HomeSectionHeader({
  title,
  href,
  hrefLabel,
}: {
  title: string;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-4 sm:grid-cols-[1fr_auto_1fr]">
      <div className="hidden sm:block" />
      <h2 className="text-center text-[1.7rem] font-extrabold uppercase tracking-tight text-[#111111] sm:text-[1.95rem]">
        {title}
      </h2>
      {href && hrefLabel ? (
        <Link
          href={href}
          className="inline-flex shrink-0 justify-self-end items-center justify-center rounded-md border border-[#d1d5db] px-3 py-2 text-xs font-semibold text-black transition hover:border-[#db011c] hover:text-[#db011c] sm:px-4"
        >
          {hrefLabel}
        </Link>
      ) : null}
    </div>
  );
}

function HomeProductCard({ product }: { product: StoreProduct }) {
  const { addItem } = useCart();
  const [isAdding, setIsAdding] = useState(false);

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
    <article className="overflow-hidden rounded-xl border border-[#e5e7eb] bg-white shadow-[0_2px_10px_rgba(0,0,0,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(0,0,0,0.08)]">
      <Link href={`/products/${product.id}`} className="block">
        <div className="relative aspect-[4/4.8] overflow-hidden bg-[#f3f4f6]">
          {badge ? (
            <span className="absolute left-2 top-2 z-10 rounded bg-[#db011c] px-2 py-1 text-[10px] font-bold uppercase text-white">
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
        <Link href={`/products/${product.id}`} className="block">
          <h3 className="line-clamp-2 min-h-10 text-[13px] font-medium leading-5 text-black sm:text-sm">
            {product.name}
          </h3>
        </Link>

        <div className="flex items-center gap-2 text-sm">
          <span className="font-bold text-[#db011c]">{formatStoreCurrency(currentPrice)}</span>
          <span className="text-xs text-[#6b7280] line-through">{formatStoreCurrency(oldPrice)}</span>
        </div>

        <button
          type="button"
          onClick={handleAdd}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-[#db011c] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#b90118]"
        >
          <ShoppingBag className="h-3.5 w-3.5" />
          <span>{isAdding ? "Added" : ORDER_CTA_TEXT}</span>
        </button>
      </div>
    </article>
  );
}

function HeroSection({ section }: { section: OnlineStoreSection }) {
  const slides = Array.isArray(section.content?.slides)
    ? (section.content?.slides as Array<Record<string, string>>)
    : (FALLBACK_STOREFRONT_HOME.page.sections.find((item) => item.type === "hero_slider")?.content?.slides as Array<Record<string, string>>);
  const [activeSlide, setActiveSlide] = useState(0);
  const slide = slides[activeSlide] || slides[0];
  const discountText = slide?.discount || "UP TO 70% OFF";
  const [discountLead, discountValue] = discountText.startsWith("UP TO")
    ? ["UP TO", discountText.replace("UP TO ", "")]
    : [discountText, ""];

  return (
    <section className="relative overflow-hidden rounded-2xl border border-[#e5e7eb] bg-[#f7f7f7]">
      <div className="grid items-center gap-0 lg:min-h-[420px] lg:grid-cols-[0.95fr_1.05fr]">
        <div className="flex flex-col justify-center px-5 py-8 sm:px-8 sm:py-9 lg:px-12">
          <div className="max-w-[420px]">
            <p className="text-[2rem] font-black uppercase leading-[1.02] tracking-tight text-black sm:text-[2.9rem]">
              <span className="block">{slide?.title || "STYLE THAT FITS"}</span>
              <span className="mt-1 block">{slide?.subtitle || "YOUR EVERYDAY"}</span>
            </p>
            <div className="mt-5">
              <p className="text-[1.9rem] font-light uppercase leading-[0.95] tracking-tight text-black sm:text-[2.7rem]">
                <span className="block">{discountLead}</span>
                {discountValue ? <span className="mt-1 block font-black">{discountValue}</span> : null}
              </p>
            </div>
          </div>
          <div className="mt-6">
            <Link
              href={slide?.button_url || "/products"}
              className="inline-flex items-center justify-center rounded-md bg-black px-5 py-3 text-sm font-semibold text-white no-underline transition hover:bg-[#db011c] hover:text-white"
            >
              {slide?.button_text || "Shop Now"}
            </Link>
          </div>
          <div className="mt-7 flex items-center gap-2">
            {slides.map((item, index) => (
              <button
                key={`${item.title}-${index}`}
                type="button"
                aria-label={`Go to slide ${index + 1}`}
                onClick={() => setActiveSlide(index)}
                className={`h-2.5 rounded-full transition ${
                  activeSlide === index ? "w-6 bg-black" : "w-2.5 bg-[#c4c4c4]"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="relative min-h-[300px] bg-[#ececec] lg:min-h-[420px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={slide?.image_url || "/storefront/demo-products/jacket-monogram-3153.jpg"}
            alt={slide?.title || "Storefront hero"}
            className="h-full w-full object-cover object-top lg:object-center"
          />
        </div>
      </div>

      <button
        type="button"
        aria-label="Previous slide"
        onClick={() => setActiveSlide((current) => (current === 0 ? slides.length - 1 : current - 1))}
        className="absolute left-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-[#d1d5db] bg-white/95 text-black shadow-sm transition hover:border-[#db011c] hover:text-[#db011c] sm:inline-flex"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label="Next slide"
        onClick={() => setActiveSlide((current) => (current + 1) % slides.length)}
        className="absolute right-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-[#d1d5db] bg-white/95 text-black shadow-sm transition hover:border-[#db011c] hover:text-[#db011c] sm:inline-flex"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </section>
  );
}

function ProductSection({ section }: { section: OnlineStoreSection }) {
  const source = String(section.settings?.source || section.type);
  const limit = Number(section.settings?.limit || 4);
  const products =
    section.products && section.products.length > 0
      ? section.products.map(buildStoreProductFromSectionProduct)
      : getFallbackProductsBySource(source, limit);

  return (
    <section className="space-y-5">
      <HomeSectionHeader
        title={section.title || "Products"}
        href={String(section.settings?.shop_more_url || "/products")}
        hrefLabel={section.settings?.show_shop_more ? "Shop More" : undefined}
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {products.map((product) => (
          <HomeProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}

function CategoryGridSection({ section }: { section: OnlineStoreSection }) {
  const items = Array.isArray(section.content?.items)
    ? (section.content?.items as Array<{ label: string; image_url?: string }>)
    : [];

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-extrabold tracking-tight text-black sm:text-[2rem]">
          {section.title || "Categories"}
        </h2>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((category) => (
          <Link
            key={category.label}
            href={`/categories/${category.label.toLowerCase().replace(/\s+/g, "-")}`}
            className="grid min-h-[112px] grid-cols-[1fr_74px] items-center overflow-hidden rounded-xl border border-[#e5e7eb] bg-[#f3f4f6] px-4 transition hover:border-[#db011c]"
          >
            <span className="text-sm font-semibold text-black sm:text-base">
              {category.label}
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={category.image_url || "/storefront/demo-products/sneakers-flex-3374.png"}
              alt={category.label}
              className="h-[74px] w-[74px] justify-self-end object-contain"
            />
          </Link>
        ))}
      </div>
    </section>
  );
}

function TextBlockSection({ section }: { section: OnlineStoreSection }) {
  return (
    <section className="rounded-2xl border border-[#e5e7eb] bg-white px-5 py-6">
      <h2 className="text-2xl font-bold text-black">{section.title || "Storefront Content"}</h2>
      {section.subtitle ? <p className="mt-3 text-sm leading-7 text-[#4b5563]">{section.subtitle}</p> : null}
    </section>
  );
}

export function StorefrontSectionRenderer({ section }: { section: OnlineStoreSection }) {
  switch (section.type) {
    case "hero_slider":
      return <HeroSection section={section} />;
    case "product_grid":
    case "new_arrivals":
    case "featured_collection":
    case "best_selling":
    case "flash_sale":
      return <ProductSection section={section} />;
    case "category_grid":
      return <CategoryGridSection section={section} />;
    case "text_block":
    case "image_text":
    case "newsletter":
    case "single_banner":
    case "banner_grid":
    default:
      return <TextBlockSection section={section} />;
  }
}

export function StorefrontHome({
  storefront = FALLBACK_STOREFRONT_HOME,
}: {
  storefront?: PublicStorefrontResponse;
}) {
  const sections = useMemo(
    () => storefront.page.sections.filter((section) => section),
    [storefront.page.sections],
  );

  return (
    <div className="space-y-6 pb-8 sm:space-y-8">
      {sections.map((section, index) => (
        <div key={`${section.type}-${section.title || index}`}><StorefrontSectionRenderer section={section} /></div>
      ))}
    </div>
  );
}
