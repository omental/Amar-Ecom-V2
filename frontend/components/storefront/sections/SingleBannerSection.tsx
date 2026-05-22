"use client";

import Link from "next/link";

import type { OnlineStoreSection, OnlineStoreSettings } from "@/lib/online-store";

import { SectionWrap } from "./shared";

export function SingleBannerSection({
  section,
  settings,
}: {
  section: OnlineStoreSection;
  settings: OnlineStoreSettings;
}) {
  const content = (section.content || {}) as Record<string, string>;
  const image = content.image_url || "/storefront/demo-products/jacket-monogram-3153.jpg";
  const href = content.button_url || content.link_url || "/products";
  return (
    <SectionWrap settings={settings} className="overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white">
      <div className="relative min-h-[260px] sm:min-h-[320px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt={section.title || "Store banner"} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/35 to-transparent" />
        <div className="relative z-10 flex min-h-[260px] max-w-[520px] flex-col justify-center px-6 py-8 text-white sm:min-h-[320px] sm:px-10">
          <h2 className="text-2xl font-black uppercase tracking-tight sm:text-4xl">{section.title || "Special Offer"}</h2>
          {section.subtitle ? <p className="mt-3 text-sm leading-6 text-white/85 sm:text-base">{section.subtitle}</p> : null}
          {content.button_text ? (
            <div className="mt-5">
              <Link href={href} className="inline-flex rounded-md px-4 py-3 text-sm font-semibold text-white transition" style={{ backgroundColor: settings.primary_color || "#db011c" }}>
                {content.button_text}
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </SectionWrap>
  );
}
