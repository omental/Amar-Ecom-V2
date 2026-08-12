import type { Metadata } from "next";

import { StorefrontTemplateRenderer } from "@/components/storefront/StorefrontTemplateRenderer";
import { FALLBACK_STOREFRONT_SETTINGS } from "@/lib/online-store";
import { fetchPublicResolvedTemplateServer, fetchPublicStorefrontSettingsServer } from "@/lib/storefront-public-server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Search", description: "Search the Amar-eCom storefront." };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const [resolved, settings] = await Promise.all([fetchPublicResolvedTemplateServer("search"), fetchPublicStorefrontSettingsServer().catch(() => FALLBACK_STOREFRONT_SETTINGS)]);
  return <StorefrontTemplateRenderer sections={resolved.template.sections} settings={settings} context={{ resourceType: "search", resource: null, searchQuery: q, theme: resolved.theme, template: resolved.template, builderMode: false }} />;
}
