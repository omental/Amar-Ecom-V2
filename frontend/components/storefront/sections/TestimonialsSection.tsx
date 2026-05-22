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
  const layoutStyle = String(section.settings?.layout_style || "grid");

  return (
    <SectionWrap settings={settings} className="space-y-5">
      <div className="text-center">
        <h2 className="text-2xl font-black uppercase tracking-tight text-black sm:text-3xl">
          {section.title || "What Customers Say"}
        </h2>
        {section.subtitle ? <p className="mt-3 text-sm leading-7 text-[#4b5563]">{section.subtitle}</p> : null}
      </div>
      <div className={`grid gap-4 ${layoutStyle === "carousel_static" ? "md:grid-cols-2 lg:grid-cols-2" : "md:grid-cols-2 lg:grid-cols-3"}`}>
        {items.map((item, index) => (
          <div key={`${item.customer_name || item.author || index}`} className="rounded-2xl border border-[#e5e7eb] bg-white p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-black">{item.customer_name || item.author || "Customer"}</p>
                {item.location ? <p className="text-xs text-[#6b7280]">{item.location}</p> : null}
              </div>
              <div className="text-sm font-semibold tracking-[0.18em] text-amber-500">
                {"★".repeat(Math.max(1, Math.min(5, Number(item.rating || 5))))}
              </div>
            </div>
            <p className="text-sm leading-7 text-[#4b5563]">&ldquo;{item.quote || "Great storefront experience."}&rdquo;</p>
          </div>
        ))}
      </div>
    </SectionWrap>
  );
}
