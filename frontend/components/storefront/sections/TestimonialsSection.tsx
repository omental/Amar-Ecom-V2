"use client";

import type { OnlineStoreSection, OnlineStoreSettings } from "@/lib/online-store";

import { SectionWrap } from "./shared";

export function TestimonialsSection({
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
      <div className="text-center">
        <h2 className="text-2xl font-black uppercase tracking-tight text-black sm:text-3xl">
          {section.title || "What Customers Say"}
        </h2>
        {section.subtitle ? <p className="mt-3 text-sm leading-7 text-[#4b5563]">{section.subtitle}</p> : null}
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {items.map((item, index) => (
          <div key={`${item.author || index}`} className="rounded-2xl border border-[#e5e7eb] bg-white p-5">
            <p className="text-sm leading-7 text-[#4b5563]">&ldquo;{item.quote || "Great storefront experience."}&rdquo;</p>
            <p className="mt-4 text-sm font-semibold text-black">{item.author || "Customer"}</p>
          </div>
        ))}
      </div>
    </SectionWrap>
  );
}
