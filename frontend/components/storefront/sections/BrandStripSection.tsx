"use client";

import Link from "next/link";

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
        <div className="text-center">
          <h2 className="text-2xl font-black uppercase tracking-tight text-black sm:text-3xl">
            {section.title}
          </h2>
          {section.subtitle ? <p className="mt-3 text-sm leading-7 text-[#4b5563]">{section.subtitle}</p> : null}
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item, index) => (
          <BrandTile key={`${item.name || item.label || index}`} item={item} />
        ))}
      </div>
    </SectionWrap>
  );
}

function BrandTile({ item }: { item: Record<string, string> }) {
  const content = (
    <div className="flex min-h-[84px] flex-col items-center justify-center rounded-2xl border border-[#e5e7eb] bg-white px-4 py-5 text-center">
      {item.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.logo_url}
          alt={item.name || item.label || "Brand logo"}
          className="mb-3 h-10 w-auto object-contain"
        />
      ) : null}
      <span className="text-sm font-semibold text-[#374151]">{item.name || item.label || "Brand"}</span>
    </div>
  );

  if (item.link_url?.startsWith("/")) {
    return <Link href={item.link_url}>{content}</Link>;
  }

  if (item.link_url?.startsWith("http://") || item.link_url?.startsWith("https://")) {
    return <a href={item.link_url} target="_blank" rel="noreferrer">{content}</a>;
  }

  return content;
}
