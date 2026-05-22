"use client";

import {
  FALLBACK_STOREFRONT_HOME,
  type OnlineStoreSection,
  type OnlineStoreSettings,
} from "@/lib/online-store";

import { BannerGridSection } from "./BannerGridSection";
import { BrandStripSection } from "./BrandStripSection";
import { CategoryGridSection } from "./CategoryGridSection";
import { FaqSection } from "./FaqSection";
import { HeroSection } from "./HeroSection";
import { ImageTextSection } from "./ImageTextSection";
import { NewsletterSection } from "./NewsletterSection";
import { ProductSection } from "./ProductSection";
import { SingleBannerSection } from "./SingleBannerSection";
import { TestimonialsSection } from "./TestimonialsSection";
import { TextBlockSection } from "./TextBlockSection";

export function SectionRenderer({
  section,
  settings,
}: {
  section: OnlineStoreSection;
  settings: OnlineStoreSettings;
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
    default:
      return <TextBlockSection section={section} settings={settings} />;
  }
}
