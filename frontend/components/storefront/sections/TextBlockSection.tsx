"use client";

import type { OnlineStoreSection, OnlineStoreSettings } from "@/lib/online-store";

import { SectionWrap } from "./shared";

export function TextBlockSection({
  section,
  settings,
}: {
  section: OnlineStoreSection;
  settings: OnlineStoreSettings;
}) {
  const content = (section.content || {}) as Record<string, string>;
  return (
    <SectionWrap settings={settings} className="rounded-2xl border border-[#e5e7eb] bg-white px-5 py-6">
      <h2 className="text-2xl font-bold text-black">{section.title || "Storefront Content"}</h2>
      {section.subtitle ? <p className="mt-3 text-sm leading-7 text-[#4b5563]">{section.subtitle}</p> : null}
      {content.text ? <p className="mt-3 text-sm leading-7 text-[#4b5563]">{content.text}</p> : null}
    </SectionWrap>
  );
}
