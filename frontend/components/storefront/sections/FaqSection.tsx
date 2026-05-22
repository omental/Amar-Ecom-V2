"use client";

import { useState } from "react";

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
  const [openIndex, setOpenIndex] = useState<number>(0);

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
          <div key={`${item.question || index}`} className="rounded-2xl border border-[#e5e7eb] bg-white">
            <button
              type="button"
              onClick={() => setOpenIndex((current) => current === index ? -1 : index)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
              aria-expanded={openIndex === index}
            >
              <span className="text-sm font-semibold text-black">{item.question || "Question"}</span>
              <span className="text-lg font-semibold text-[var(--store-accent)]">{openIndex === index ? "−" : "+"}</span>
            </button>
            {openIndex === index ? (
              <p className="border-t border-[#f1f5f9] px-5 py-4 text-sm leading-7 text-[#4b5563]">{item.answer || "Answer"}</p>
            ) : null}
          </div>
        ))}
      </div>
    </SectionWrap>
  );
}
