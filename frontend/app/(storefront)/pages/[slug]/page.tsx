import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { StorefrontSectionRenderer } from "@/components/storefront/StorefrontHome";
import {
  FALLBACK_STOREFRONT_HOME,
  fetchPublicStorefrontPage,
  type PublicStorefrontResponse,
} from "@/lib/online-store";

type StorefrontContentPageProps = {
  params: Promise<{ slug: string }>;
};

async function getStorefrontPage(slug: string): Promise<PublicStorefrontResponse | null> {
  try {
    return await fetchPublicStorefrontPage(slug);
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

  return (
    <div className="space-y-6 pb-8 sm:space-y-8">
      <section className="rounded-2xl border border-[#e5e7eb] bg-white px-5 py-8 sm:px-8">
        <h1 className="text-3xl font-bold tracking-tight text-black">
          {page.title}
        </h1>
        {page.content ? (
          <p className="mt-4 whitespace-pre-line text-sm leading-7 text-[#4b5563]">
            {page.content}
          </p>
        ) : null}
      </section>

      {page.sections.map((section, index) => (
        <div key={`${section.type}-${section.title || index}`}>
          <StorefrontSectionRenderer section={section} />
        </div>
      ))}
    </div>
  );
}
