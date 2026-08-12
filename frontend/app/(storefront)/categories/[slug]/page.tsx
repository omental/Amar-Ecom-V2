import type { Metadata } from "next";

import { StorefrontTemplateRenderer } from "@/components/storefront/StorefrontTemplateRenderer";
import { FALLBACK_STOREFRONT_SETTINGS } from "@/lib/online-store";
import { fetchPublicResolvedTemplateServer, fetchPublicStorefrontSettingsServer, getServerCanonicalStorefrontUrl } from "@/lib/storefront-public-server";
import { getServerStorefrontOrigin } from "@/lib/storefront-domain-server";

type CategoryPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const readable = slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  return {
    title: `${readable} Category`,
    description: `Browse public Amar-eCom products in the ${readable} category.`,
    alternates: { canonical: await getServerCanonicalStorefrontUrl(`categories/${slug}`).catch(() => getServerStorefrontOrigin(`categories/${slug}`)) },
    openGraph: { url: await getServerCanonicalStorefrontUrl(`categories/${slug}`).catch(() => getServerStorefrontOrigin(`categories/${slug}`)) },
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const [resolved, settings] = await Promise.all([fetchPublicResolvedTemplateServer("collection", slug), fetchPublicStorefrontSettingsServer().catch(() => FALLBACK_STOREFRONT_SETTINGS)]);
  return <StorefrontTemplateRenderer sections={resolved.template.sections} settings={settings} context={{ resourceType: "collection", resource: null, resourceSlug: slug, theme: resolved.theme, template: resolved.template, builderMode: false }} />;
}
