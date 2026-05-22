"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import type { OnlineStoreSection, OnlineStoreSettings } from "@/lib/online-store";

import { SectionWrap } from "./shared";

export function HeroSection({
  section,
  settings,
  fallbackSlides,
}: {
  section: OnlineStoreSection;
  settings: OnlineStoreSettings;
  fallbackSlides: Array<Record<string, string>>;
}) {
  const slides = Array.isArray(section.content?.slides)
    ? (section.content?.slides as Array<Record<string, string>>)
    : fallbackSlides;
  const [activeSlide, setActiveSlide] = useState(0);
  const slide = slides[activeSlide] || slides[0];
  const discountText = slide?.discount || "UP TO 70% OFF";
  const [discountLead, discountValue] = discountText.startsWith("UP TO")
    ? ["UP TO", discountText.replace("UP TO ", "")]
    : [discountText, ""];

  return (
    <SectionWrap settings={settings} className="relative overflow-hidden rounded-2xl border border-[#e5e7eb] bg-[#f7f7f7]">
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
              className="inline-flex items-center justify-center rounded-md bg-black px-5 py-3 text-sm font-semibold text-white no-underline transition hover:text-white"
              style={{ backgroundColor: settings.button_style === "bold_block" ? settings.primary_color : undefined }}
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
        className="absolute left-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-[#d1d5db] bg-white/95 text-black shadow-sm transition hover:text-[var(--store-accent)] sm:inline-flex"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label="Next slide"
        onClick={() => setActiveSlide((current) => (current + 1) % slides.length)}
        className="absolute right-3 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-[#d1d5db] bg-white/95 text-black shadow-sm transition hover:text-[var(--store-accent)] sm:inline-flex"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </SectionWrap>
  );
}
