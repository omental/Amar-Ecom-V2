"use client";

import Link from "next/link";

import type { OnlineStoreSection, OnlineStoreSettings } from "@/lib/online-store";
import { getStorefrontTheme } from "@/lib/storefront-theme";

import { SectionWrap } from "./shared";

function getSafeUrl(value: unknown) {
  const url = String(value || "").trim();
  if (!url) return "";
  if (url.startsWith("/")) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return "";
}

function getColumnsClass(layout: string) {
  switch (layout) {
    case "one_column":
      return "grid-cols-1";
    case "three_column":
      return "grid-cols-1 md:grid-cols-3";
    case "left_wide":
      return "grid-cols-1 md:grid-cols-[1.35fr_0.65fr]";
    case "right_wide":
      return "grid-cols-1 md:grid-cols-[0.65fr_1.35fr]";
    case "two_column":
    default:
      return "grid-cols-1 md:grid-cols-2";
  }
}

function getColumnCount(layout: string) {
  switch (layout) {
    case "one_column":
      return 1;
    case "three_column":
      return 3;
    case "left_wide":
    case "right_wide":
    case "two_column":
    default:
      return 2;
  }
}

export function FlexibleGridSection({
  section,
  settings,
}: {
  section: OnlineStoreSection;
  settings: OnlineStoreSettings;
}) {
  const sectionSettings = (section.settings || {}) as Record<string, unknown>;
  const style = (sectionSettings.style || {}) as Record<string, unknown>;
  const blocks = Array.isArray(section.content?.blocks) ? (section.content?.blocks as Array<Record<string, unknown>>) : [];
  const layout = String(sectionSettings.layout || "two_column");
  const theme = getStorefrontTheme(settings);
  const columnCount = getColumnCount(layout);
  const columns = Array.from({ length: columnCount }, (_, index) => index + 1);

  const backgroundClass =
    style.background_preset === "soft"
      ? "bg-[var(--store-accent-soft)]"
      : style.background_preset === "dark"
        ? "bg-[#111111] text-white"
        : "bg-white";
  const paddingClass =
    style.padding_y === "lg" ? "py-10 sm:py-14" : style.padding_y === "sm" ? "py-4 sm:py-5" : "py-6 sm:py-8";
  const wrapperClass = style.max_width === "wide" ? "max-w-[1200px]" : style.max_width === "narrow" ? "max-w-[860px]" : "max-w-[1040px]";

  return (
    <SectionWrap settings={settings} className={`${theme.radiusClass} border border-[#e5e7eb] ${backgroundClass} ${paddingClass} px-5 sm:px-6`}>
      <div className={`mx-auto ${wrapperClass}`}>
        {(section.title || section.subtitle) ? (
          <div className={`mb-6 ${String(style.alignment || "left") === "center" ? "text-center" : ""}`}>
            {section.title ? <h2 className="text-2xl font-black tracking-tight text-current sm:text-3xl">{section.title}</h2> : null}
            {section.subtitle ? <p className="mt-3 text-sm leading-7 text-inherit/80">{section.subtitle}</p> : null}
          </div>
        ) : null}
        <div className={`grid gap-5 ${getColumnsClass(layout)}`}>
          {columns.map((columnNumber) => (
            <div key={columnNumber} className="space-y-4">
              {blocks
                .filter((block) => Number(block.column || 1) === columnNumber)
                .map((block, index) => (
                  <FlexibleBlock key={`${block.type}-${index}`} block={block} theme={theme} />
                ))}
            </div>
          ))}
        </div>
      </div>
    </SectionWrap>
  );
}

function FlexibleBlock({
  block,
  theme,
}: {
  block: Record<string, unknown>;
  theme: ReturnType<typeof getStorefrontTheme>;
}) {
  const type = String(block.type || "");
  const alignClass = block.align === "center" ? "text-center items-center" : block.align === "right" ? "text-right items-end" : "text-left items-start";

  if (type === "heading") {
    const HeadingTag = (["h1", "h2", "h3"].includes(String(block.level)) ? String(block.level) : "h2") as "h1" | "h2" | "h3";
    return <HeadingTag className={`${alignClass.split(" ")[0]} font-black tracking-tight text-black ${HeadingTag === "h1" ? "text-3xl sm:text-4xl" : HeadingTag === "h3" ? "text-xl sm:text-2xl" : "text-2xl sm:text-3xl"}`}>{String(block.text || "")}</HeadingTag>;
  }

  if (type === "paragraph") {
    return <p className={`${alignClass.split(" ")[0]} text-sm leading-7 text-[#4b5563]`}>{String(block.text || "")}</p>;
  }

  if (type === "image") {
    const src = getSafeUrl(block.image_url);
    if (!src) return null;
    const image = (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={String(block.alt || "Flexible content image")}
        className={`h-auto w-full object-cover ${block.radius_preset === "rounded" ? "rounded-[28px]" : block.radius_preset === "sharp" ? "rounded-none" : "rounded-[20px]"}`}
      />
    );
    const href = getSafeUrl(block.link_url);
    return href ? <Link href={href}>{image}</Link> : image;
  }

  if (type === "button") {
    const href = getSafeUrl(block.href);
    if (!href) return null;
    const styleClass = block.style === "secondary" ? "border border-[#d1d5db] bg-white text-black" : "text-white";
    return (
      <div className={`flex ${alignClass}`}>
        <Link
          href={href}
          className={`inline-flex px-5 py-3 text-sm font-semibold transition ${theme.buttonRadiusClass} ${styleClass}`}
          style={block.style === "secondary" ? undefined : { backgroundColor: theme.primaryColor }}
        >
          {String(block.label || "Learn More")}
        </Link>
      </div>
    );
  }

  if (type === "spacer") {
    const sizeClass = block.size === "lg" ? "h-12" : block.size === "sm" ? "h-4" : "h-8";
    return <div className={sizeClass} aria-hidden="true" />;
  }

  if (type === "divider") {
    const dividerClass = block.style === "dashed" ? "border-dashed" : block.style === "solid" ? "border-solid" : "border-solid opacity-60";
    return <hr className={`border-[#d1d5db] ${dividerClass}`} />;
  }

  return null;
}
