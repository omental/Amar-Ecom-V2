"use client";

import { StoreCategoryNav } from "@/components/storefront/StoreCategoryNav";
import { StoreFooter } from "@/components/storefront/StoreFooter";
import { StoreHeader } from "@/components/storefront/StoreHeader";
import { StoreTopBar } from "@/components/storefront/StoreTopBar";
import { SectionRenderer, StorefrontSectionStyle } from "@/components/storefront/sections/SectionRenderer";
import { FALLBACK_STOREFRONT_MENUS, type OnlineStoreMenuItem, type OnlineStoreSectionGroup, type OnlineStoreSettings } from "@/lib/online-store";

export function StorefrontSectionGroupRenderer({ group, settings, menus }: { group?: OnlineStoreSectionGroup | null; settings: OnlineStoreSettings; menus: Record<string, OnlineStoreMenuItem[]> }) {
  if (!group) return null;
  return <div data-storefront-section-group={group.group_type}>{group.sections.filter((section) => section.is_enabled !== false).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).map((section) => {
    if (section.type === "announcement_bar") return <StorefrontSectionStyle key={section.id} section={section}><StoreTopBar settings={{ ...settings, show_topbar: true }} /></StorefrontSectionStyle>;
    if (section.type === "header") return <StorefrontSectionStyle key={section.id} section={section}><StoreHeader settings={settings} navigation={menus.main_nav || FALLBACK_STOREFRONT_MENUS.main_nav} /><StoreCategoryNav settings={settings} items={menus.category_nav || FALLBACK_STOREFRONT_MENUS.category_nav} /></StorefrontSectionStyle>;
    if (section.type === "footer") return <StorefrontSectionStyle key={section.id} section={section}><StoreFooter settings={settings} footerServices={menus.footer_services || FALLBACK_STOREFRONT_MENUS.footer_services} footerJoinUs={menus.footer_join_us || FALLBACK_STOREFRONT_MENUS.footer_join_us} footerSocial={menus.footer_social || FALLBACK_STOREFRONT_MENUS.footer_social} /></StorefrontSectionStyle>;
    return <SectionRenderer key={section.id} section={section} settings={settings} />;
  })}</div>;
}
