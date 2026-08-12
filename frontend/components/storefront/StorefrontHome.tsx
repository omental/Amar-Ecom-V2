"use client";

import { useMemo } from "react";

import {
  FALLBACK_STOREFRONT_HOME,
  type OnlineStoreSection,
  type OnlineStoreSettings,
  type PublicStorefrontResponse,
} from "@/lib/online-store";
import { getStorefrontTheme } from "@/lib/storefront-theme";

import { SectionRenderer } from "./sections/SectionRenderer";

export function StorefrontSectionRenderer({
  section,
  settings = FALLBACK_STOREFRONT_HOME.settings,
  themeDefinition,
}: {
  section: OnlineStoreSection;
  settings?: OnlineStoreSettings;
  themeDefinition?: import("@/lib/online-store").OnlineStoreTheme | null;
}) {
  return <SectionRenderer section={section} settings={settings} themeDefinition={themeDefinition} />;
}

export function StorefrontHome({
  storefront = FALLBACK_STOREFRONT_HOME,
}: {
  storefront?: PublicStorefrontResponse;
}) {
  const sections = useMemo(
    () => storefront.page.sections.filter((section) => section),
    [storefront.page.sections],
  );
  const theme = getStorefrontTheme(storefront.settings);

  return (
    <div className={theme.spacingClass} style={theme.cssVars}>
      {sections.map((section) => (
        <div key={section.id || `${section.type}-${section.sort_order}`}>
          <StorefrontSectionRenderer section={section} settings={storefront.settings} themeDefinition={storefront.theme} />
        </div>
      ))}
    </div>
  );
}
