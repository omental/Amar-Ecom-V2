"use client";

import Link from "next/link";

import type { OnlineStoreSection, OnlineStoreSettings } from "@/lib/online-store";

import { SectionWrap } from "./shared";

export function ImageTextSection({
  section,
  settings,
}: {
  section: OnlineStoreSection;
  settings: OnlineStoreSettings;
}) {
  const content = (section.content || {}) as Record<string, string>;
  const reverse = String(section.settings?.image_position || "right") === "left";
  return (
    <SectionWrap settings={settings} className="rounded-2xl border border-[#e5e7eb] bg-white p-5 sm:p-7">
      <div className={`grid items-center gap-6 lg:grid-cols-2 ${reverse ? "lg:[&>*:first-child]:order-2 lg:[&>*:last-child]:order-1" : ""}`}>
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tight text-black sm:text-3xl">{section.title || "Featured Story"}</h2>
          {section.subtitle ? <p className="mt-3 text-sm leading-7 text-[#4b5563]">{section.subtitle}</p> : null}
          {content.body ? <p className="mt-3 text-sm leading-7 text-[#4b5563]">{content.body}</p> : null}
          {content.button_text ? (
            <div className="mt-5">
              <Link href={content.button_url || "/products"} className="inline-flex rounded-md px-4 py-3 text-sm font-semibold text-white transition" style={{ backgroundColor: settings.primary_color || "#db011c" }}>
                {content.button_text}
              </Link>
            </div>
          ) : null}
        </div>
        <div className="overflow-hidden rounded-2xl bg-[#f3f4f6]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={content.image_url || "/storefront/demo-products/jacket-puffer-3159.jpg"}
            alt={section.title || "Store section image"}
            className="h-full min-h-[260px] w-full object-cover"
          />
        </div>
      </div>
    </SectionWrap>
  );
}
