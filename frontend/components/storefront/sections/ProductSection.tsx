"use client";

import { buildStoreProductFromSectionProduct, getFallbackProductsBySource, type OnlineStoreSection, type OnlineStoreSettings } from "@/lib/online-store";

import { HomeProductCard, HomeSectionHeader, SectionWrap } from "./shared";

export function ProductSection({
  section,
  settings,
}: {
  section: OnlineStoreSection;
  settings: OnlineStoreSettings;
}) {
  const source = String(section.settings?.source || section.type);
  const limit = Number(section.settings?.limit || 4);
  const products =
    section.products && section.products.length > 0
      ? section.products.map(buildStoreProductFromSectionProduct)
      : getFallbackProductsBySource(source, limit);

  return (
    <SectionWrap settings={settings} className="space-y-5">
      <HomeSectionHeader
        title={section.title || "Products"}
        href={String(section.settings?.shop_more_url || "/products")}
        hrefLabel={section.settings?.show_shop_more ? "Shop More" : undefined}
        settings={settings}
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {products.map((product) => (
          <HomeProductCard key={product.id} product={product} settings={settings} />
        ))}
      </div>
    </SectionWrap>
  );
}
