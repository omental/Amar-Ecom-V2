"use client";

import type { OnlineStoreSection, OnlineStoreSettings } from "@/lib/online-store";

import { SectionWrap } from "./shared";

export function FaqSection({
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
          {section.title || "Frequently Asked Questions"}
        </h2>
        {section.subtitle ? <p className="mt-3 text-sm leading-7 text-[#4b5563]">{section.subtitle}</p> : null}
      </div>
      <div className="space-y-3">
        {items.map((item, index) => (
          <details key={`${item.question || index}`} className="rounded-2xl border border-[#e5e7eb] bg-white px-5 py-4">
            <summary className="cursor-pointer list-none text-sm font-semibold text-black">{item.question || "Question"}</summary>
            <p className="mt-3 text-sm leading-7 text-[#4b5563]">{item.answer || "Answer"}</p>
          </details>
        ))}
      </div>
    </SectionWrap>
  );
}
