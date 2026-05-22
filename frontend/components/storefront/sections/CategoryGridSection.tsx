"use client";

import Link from "next/link";

import type { OnlineStoreSection, OnlineStoreSettings } from "@/lib/online-store";

import { SectionWrap } from "./shared";

export function CategoryGridSection({
  section,
  settings,
}: {
  section: OnlineStoreSection;
  settings: OnlineStoreSettings;
}) {
  const items = Array.isArray(section.content?.items)
    ? (section.content?.items as Array<{ label: string; image_url?: string }>)
    : [];

  return (
    <SectionWrap settings={settings} className="space-y-5">
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
            className="grid min-h-[112px] grid-cols-[1fr_74px] items-center overflow-hidden rounded-xl border border-[#e5e7eb] bg-[#f3f4f6] px-4 transition hover:border-[var(--store-accent)]"
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
    </SectionWrap>
  );
}
