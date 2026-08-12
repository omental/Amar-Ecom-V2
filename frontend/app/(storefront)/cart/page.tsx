import type { Metadata } from "next";

import { StorefrontTemplateRenderer } from "@/components/storefront/StorefrontTemplateRenderer";
import { FALLBACK_STOREFRONT_SETTINGS } from "@/lib/online-store";
import { fetchPublicResolvedTemplateServer, fetchPublicStorefrontSettingsServer } from "@/lib/storefront-public-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cart",
  description: "Review selected storefront items, adjust quantity, and prepare for checkout.",
};

export default async function CartPage() {
  const [resolved, settings] = await Promise.all([fetchPublicResolvedTemplateServer("cart"), fetchPublicStorefrontSettingsServer().catch(() => FALLBACK_STOREFRONT_SETTINGS)]);
  return <StorefrontTemplateRenderer sections={resolved.template.sections} settings={settings} context={{ resourceType: "cart", resource: null, theme: resolved.theme, template: resolved.template, builderMode: false }} />;
}
