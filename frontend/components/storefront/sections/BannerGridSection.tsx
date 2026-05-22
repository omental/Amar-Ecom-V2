"use client";

import Link from "next/link";

import type { OnlineStoreSection, OnlineStoreSettings } from "@/lib/online-store";

import { HomeSectionHeader, SectionWrap } from "./shared";
import { TextBlockSection } from "./TextBlockSection";

export function BannerGridSection({
  section,
  settings,
}: {
  section: OnlineStoreSection;
  settings: OnlineStoreSettings;
}) {
  const items = Array.isArray(section.content?.items) ? (section.content?.items as Array<Record<string, string>>) : [];
  if (items.length === 0) {
    return <TextBlockSection section={section} settings={settings} />;
  }
  return (
    <SectionWrap settings={settings} className="space-y-5">
      {section.title ? <HomeSectionHeader title={section.title} settings={settings} /> : null}
      <div className={`grid gap-4 ${items.length >= 3 ? "lg:grid-cols-3" : "md:grid-cols-2"}`}>
        {items.map((item, index) => (
          <Link
            key={`${item.title || item.image_url || index}`}
            href={item.button_url || item.link_url || "/products"}
            className="group relative overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white"
          >
            <div className="relative min-h-[220px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.image_url || "/storefront/demo-products/jacket-italian-3154.jpg"}
                alt={item.title || "Promo banner"}
                className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                <h3 className="text-lg font-bold uppercase tracking-tight">{item.title || "Offer Banner"}</h3>
                {item.subtitle ? <p className="mt-2 text-sm text-white/85">{item.subtitle}</p> : null}
                {item.button_text ? <span className="mt-3 inline-flex text-sm font-semibold text-white underline underline-offset-4">{item.button_text}</span> : null}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </SectionWrap>
  );
}
