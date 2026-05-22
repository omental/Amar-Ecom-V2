import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { MotionReveal } from "./MotionReveal";

const SIDE_BANNERS = [
  {
    eyebrow: "Flash Sale",
    title: "Trending sneakers from BDT 1,375",
    description: "Flexible soles, grip outsole, and quick-delivery ready picks.",
    href: "/flash-sale",
    image: "/storefront/demo-products/sneakers-leopard-3772.png",
    imageClassName: "object-contain p-5",
  },
  {
    eyebrow: "Outerwear",
    title: "Premium jackets for winter days",
    description: "Bomber and zipper styles ready to order.",
    href: "/categories/jacket",
    image: "/storefront/demo-products/jacket-italian-3154.jpg",
    imageClassName: "object-cover",
  },
];

export function StoreHero() {
  return (
    <section>
      <MotionReveal>
        <div className="grid gap-4 xl:grid-cols-12">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm xl:col-span-8">
            <div className="grid h-full gap-4 p-5 sm:p-6 lg:min-h-[440px] lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:p-7">
              <div className="flex flex-col justify-center">
                <p className="store-eyebrow">Winter Collection</p>
                <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-slate-950 sm:text-4xl lg:text-[2.6rem] lg:leading-[1.04]">
                  Winter fashion deals are live
                </h1>
                <p className="mt-4 max-w-xl text-sm leading-6 text-slate-600 sm:text-base">
                  Jackets, sneakers, panjabi and essentials ready for fast delivery
                  across Bangladesh.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link href="/products" className="store-primary-button">
                    Shop Now
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link href="/track-order" className="store-secondary-button">
                    Track Order
                  </Link>
                </div>
                <div className="mt-5 flex flex-wrap gap-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  <span className="rounded-full bg-rose-50 px-3 py-2 text-rose-600">
                    Up to 70% off
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-2 text-slate-700">
                    Cash on delivery
                  </span>
                </div>
              </div>

              <div className="relative flex h-full min-h-[260px] items-end justify-center overflow-hidden rounded-[28px] bg-[#f7f7fb] lg:min-h-[386px]">
                <div className="absolute inset-x-6 bottom-0 h-24 rounded-full bg-slate-200/70 blur-3xl" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/storefront/demo-products/jacket-monogram-3153.jpg"
                  alt="Winter jacket campaign"
                  className="relative z-10 h-full max-h-[386px] w-full object-cover object-center"
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 xl:col-span-4 xl:grid-rows-2">
            {SIDE_BANNERS.map((banner) => (
              <Link
                key={banner.title}
                href={banner.href}
                className="group overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="grid h-full min-h-[208px] grid-cols-[1.05fr_0.95fr] items-center gap-3 p-4 sm:p-5">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-600">
                      {banner.eyebrow}
                    </p>
                    <h2 className="mt-2 text-lg font-semibold leading-7 text-slate-950">
                      {banner.title}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {banner.description}
                    </p>
                    <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                      Shop Now
                      <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                    </span>
                  </div>
                  <div className="overflow-hidden rounded-2xl bg-[#f7f7fb]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={banner.image}
                      alt={banner.title}
                      className={`h-[168px] w-full ${banner.imageClassName}`}
                    />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </MotionReveal>
    </section>
  );
}
