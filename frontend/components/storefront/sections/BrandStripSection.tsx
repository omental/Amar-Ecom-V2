"use client";

import type { OnlineStoreSection, OnlineStoreSettings } from "@/lib/online-store";

import { SectionWrap } from "./shared";

export function BrandStripSection({
  section,
  settings,
}: {
  section: OnlineStoreSection;
  settings: OnlineStoreSettings;
}) {
  const items = Array.isArray(section.content?.items)
    ? (section.content?.items as Array<Record<string, string>>)
    : [];

  return (
    <SectionWrap settings={settings} className="space-y-5">
      {section.title ? (
        <h2 className="text-center text-2xl font-black uppercase tracking-tight text-black sm:text-3xl">
          {section.title}
        </h2>
      ) : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item, index) => (
          <div key={`${item.label || index}`} className="flex min-h-[84px] items-center justify-center rounded-2xl border border-[#e5e7eb] bg-white px-4 py-5 text-center text-sm font-semibold text-[#374151]">
            {item.label || "Brand"}
          </div>
        ))}
      </div>
    </SectionWrap>
  );
}
