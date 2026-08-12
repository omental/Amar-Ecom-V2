import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { StorefrontSectionRenderer } from "@/components/storefront/StorefrontHome";
import { StorefrontTemplateRenderer } from "@/components/storefront/StorefrontTemplateRenderer";
import {
  FALLBACK_STOREFRONT_HOME,
  type PublicStorefrontResponse,
} from "@/lib/online-store";
import { fetchPublicResolvedTemplateServer, fetchPublicStorefrontPageServer, getServerCanonicalStorefrontUrl } from "@/lib/storefront-public-server";
import { getServerStorefrontOrigin } from "@/lib/storefront-domain-server";

type StorefrontContentPageProps = {
  params: Promise<{ slug: string }>;
};

async function getStorefrontPage(slug: string): Promise<PublicStorefrontResponse | null> {
  try {
    return await fetchPublicStorefrontPageServer(slug);
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: StorefrontContentPageProps): Promise<Metadata> {
  const { slug } = await params;
  const storefront = await getStorefrontPage(slug);
  const page = storefront?.page;

  return {
    title: page?.seo_title || page?.title || slug.replace(/-/g, " "),
    description:
      page?.seo_description ||
      `${FALLBACK_STOREFRONT_HOME.settings.brand_name} storefront page`,
    alternates: { canonical: await getServerCanonicalStorefrontUrl(`pages/${slug}`).catch(() => getServerStorefrontOrigin(`pages/${slug}`)) },
    openGraph: { url: await getServerCanonicalStorefrontUrl(`pages/${slug}`).catch(() => getServerStorefrontOrigin(`pages/${slug}`)) },
  };
}

export default async function StorefrontContentPage({
  params,
}: StorefrontContentPageProps) {
  const { slug } = await params;
  const storefront = await getStorefrontPage(slug);

  if (!storefront) {
    notFound();
  }

  const page = storefront.page;

  const resolved = await fetchPublicResolvedTemplateServer("page", slug).catch(() => null);
  if (resolved) return <StorefrontTemplateRenderer sections={resolved.template.sections} settings={storefront.settings} context={{ resourceType: "page", resource: page, resourceSlug: slug, theme: resolved.theme, template: resolved.template, builderMode: false }} />;
  return <div className="space-y-6 pb-8 sm:space-y-8"><section className="rounded-2xl border border-[#e5e7eb] bg-white px-5 py-8 sm:px-8"><h1 className="text-3xl font-bold tracking-tight text-black">{page.title}</h1>{page.content ? <div className="prose mt-4 max-w-none text-sm leading-7 text-[#4b5563]" dangerouslySetInnerHTML={{ __html: page.content }} /> : null}</section>{page.sections.map((section) => <StorefrontSectionRenderer key={section.id} section={section} settings={storefront.settings} />)}</div>;
}
