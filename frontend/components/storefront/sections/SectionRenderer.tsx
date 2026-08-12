"use client";

import type { ComponentProps, ReactNode } from "react";

import {
  FALLBACK_STOREFRONT_HOME,
  type OnlineStoreSection,
  type OnlineStoreSettings,
  type OnlineStoreTheme,
} from "@/lib/online-store";
import type { BuilderDevice } from "@/lib/storefront-builder";
import { BUILDER_BREAKPOINTS } from "@/lib/storefront-builder-breakpoints";
import { resolveStructuredStyles, styleObjectToCss } from "@/lib/storefront-builder-style";
import type { StorefrontRenderContext } from "@/lib/storefront-render-context";

import { BannerGridSection } from "./BannerGridSection";
import { BrandStripSection } from "./BrandStripSection";
import { CategoryGridSection } from "./CategoryGridSection";
import { FaqSection } from "./FaqSection";
import { FlexibleGridSection } from "./FlexibleGridSection";
import { HeroSection } from "./HeroSection";
import { ImageTextSection } from "./ImageTextSection";
import { NewsletterSection } from "./NewsletterSection";
import { ProductSection } from "./ProductSection";
import { SingleBannerSection } from "./SingleBannerSection";
import { TestimonialsSection } from "./TestimonialsSection";
import { TextBlockSection } from "./TextBlockSection";

export function StorefrontSectionStyle({ section, device = "desktop", children }: { section: OnlineStoreSection; device?: BuilderDevice; children: ReactNode }) {
  const settings = (section.settings || {}) as Record<string, unknown>;
  const style = settings.builder_style;
  const responsive = settings.builder_responsive;
  const scopedClass = `amar-section-${String(section.id || `${section.type}-${section.sort_order}`).replace(/[^a-z0-9-]/gi, "")}`;
  const normal = resolveStructuredStyles(style, responsive, device, "base");
  const hover = resolveStructuredStyles(style, responsive, device, "hover");
  const tablet = resolveStructuredStyles(style, responsive, "tablet", "base");
  const tabletHover = resolveStructuredStyles(style, responsive, "tablet", "hover");
  const mobile = resolveStructuredStyles(style, responsive, "mobile", "base");
  const mobileHover = resolveStructuredStyles(style, responsive, "mobile", "hover");
  return <div className={scopedClass} style={normal}><style>{`.${scopedClass}:hover{${styleObjectToCss(hover)}}@media(max-width:${BUILDER_BREAKPOINTS.tablet.maxWidth}px){.${scopedClass}{${styleObjectToCss(tablet)}}.${scopedClass}:hover{${styleObjectToCss(tabletHover)}}}@media(max-width:${BUILDER_BREAKPOINTS.mobile.maxWidth}px){.${scopedClass}{${styleObjectToCss(mobile)}}.${scopedClass}:hover{${styleObjectToCss(mobileHover)}}}`}</style>{children}</div>;
}

function SectionRendererContent({
  section,
  settings,
  builderMode = false,
  selectedNodeId,
  onSelectNode,
  onUpdateText,
  onDuplicateNode,
  onDeleteNode,
  onRequestInsert,
  onMoveNode,
  device = "desktop",
  themeDefinition,
  renderContext,
}: {
  section: OnlineStoreSection;
  settings: OnlineStoreSettings;
  builderMode?: boolean;
  selectedNodeId?: string | null;
  onSelectNode?: (id: string) => void;
  onUpdateText?: (id: string, text: string) => void;
  onDuplicateNode?: (id: string) => void;
  onDeleteNode?: (id: string) => void;
  onRequestInsert?: (id: string) => void;
  onMoveNode?: (nodeId: string, target: import("@/lib/storefront-builder-tree").BuilderDropTarget) => void;
  device?: BuilderDevice;
  themeDefinition?: OnlineStoreTheme | null;
  renderContext?: StorefrontRenderContext;
}) {
  switch (section.type) {
    case "hero_slider":
      return (
        <HeroSection
          section={section}
          settings={settings}
          fallbackSlides={
            (FALLBACK_STOREFRONT_HOME.page.sections.find((item) => item.type === "hero_slider")
              ?.content?.slides as Array<Record<string, string>>) || []
          }
        />
      );
    case "product_grid":
    case "new_arrivals":
    case "featured_collection":
    case "best_selling":
    case "flash_sale":
      return <ProductSection section={section} settings={settings} />;
    case "category_grid":
      return <CategoryGridSection section={section} settings={settings} />;
    case "text_block":
      return <TextBlockSection section={section} settings={settings} />;
    case "image_text":
      return <ImageTextSection section={section} settings={settings} />;
    case "newsletter":
      return <NewsletterSection section={section} settings={settings} />;
    case "single_banner":
      return <SingleBannerSection section={section} settings={settings} />;
    case "banner_grid":
      return <BannerGridSection section={section} settings={settings} />;
    case "faq":
      return <FaqSection section={section} settings={settings} />;
    case "testimonials":
      return <TestimonialsSection section={section} settings={settings} />;
    case "brand_strip":
      return <BrandStripSection section={section} settings={settings} />;
    case "flexible_grid":
      return <FlexibleGridSection section={section} settings={settings} themeDefinition={themeDefinition} renderContext={renderContext} builderMode={builderMode} selectedNodeId={selectedNodeId} onSelectNode={onSelectNode} onUpdateText={onUpdateText} onDuplicateNode={onDuplicateNode} onDeleteNode={onDeleteNode} onRequestInsert={onRequestInsert} onMoveNode={onMoveNode} device={device} />;
    default:
      return <TextBlockSection section={section} settings={settings} />;
  }
}

export function SectionRenderer(props: ComponentProps<typeof SectionRendererContent>) {
  return <StorefrontSectionStyle section={props.section} device={props.device}><SectionRendererContent {...props} /></StorefrontSectionStyle>;
}
