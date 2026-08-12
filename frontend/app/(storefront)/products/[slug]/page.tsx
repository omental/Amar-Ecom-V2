import type { Metadata } from "next";

import { StorefrontTemplateRenderer } from "@/components/storefront/StorefrontTemplateRenderer";
import { FALLBACK_STOREFRONT_SETTINGS } from "@/lib/online-store";
import { fetchPublicResolvedTemplateServer, fetchPublicStorefrontSettingsServer, getServerCanonicalStorefrontUrl } from "@/lib/storefront-public-server";
import { getServerStorefrontOrigin } from "@/lib/storefront-domain-server";

type ProductDetailPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateMetadata({
  params,
}: ProductDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const canonical = await getServerCanonicalStorefrontUrl(`products/${slug}`).catch(() => getServerStorefrontOrigin(`products/${slug}`));
  return {
    title: slug.replace(/-/g, " "),
    description: "LiveShopping-style public product detail page.",
    alternates: { canonical },
    openGraph: { url: canonical },
  };
}

export default async function ProductDetailPage({
  params,
}: ProductDetailPageProps) {
  const { slug } = await params;
  const [resolved, settings] = await Promise.all([fetchPublicResolvedTemplateServer("product", slug), fetchPublicStorefrontSettingsServer().catch(() => FALLBACK_STOREFRONT_SETTINGS)]);
  return <StorefrontTemplateRenderer sections={resolved.template.sections} settings={settings} context={{ resourceType: "product", resource: null, resourceSlug: slug, theme: resolved.theme, template: resolved.template, builderMode: false }} />;
}
