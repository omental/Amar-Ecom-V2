import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { Toaster } from "sonner";

import { CartProvider } from "@/components/storefront/CartProvider";
import { StoreCategoryNav } from "@/components/storefront/StoreCategoryNav";
import { StoreFooter } from "@/components/storefront/StoreFooter";
import { StoreHeader } from "@/components/storefront/StoreHeader";
import { StoreTopBar } from "@/components/storefront/StoreTopBar";
import { StorefrontSectionGroupRenderer } from "@/components/storefront/StorefrontSectionGroupRenderer";
import {
  FALLBACK_STOREFRONT_MENUS,
  FALLBACK_STOREFRONT_SETTINGS,
} from "@/lib/online-store";
import { fetchPublicResolvedTemplateServer, fetchPublicStoreDomainContextServer, fetchPublicStorefrontMenusServer, fetchPublicStorefrontSettingsServer, getServerCanonicalStorefrontUrl } from "@/lib/storefront-public-server";
import { getStorefrontTheme } from "@/lib/storefront-theme";
import { getServerStorefrontOrigin } from "@/lib/storefront-domain-server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const requestOrigin = await getServerStorefrontOrigin();
  const origin = await getServerCanonicalStorefrontUrl().catch(() => requestOrigin);
  const settings = await fetchPublicStorefrontSettingsServer().catch(() => FALLBACK_STOREFRONT_SETTINGS);
  const title = settings.seo_title || settings.brand_name || "Storefront";
  const description = settings.seo_description || settings.footer_description || "Shop our online storefront.";
  return {
    metadataBase: new URL(origin),
    title,
    description,
    alternates: { canonical: origin },
    openGraph: { title, description, url: origin, images: settings.social_share_image_url ? [settings.social_share_image_url] : undefined },
  };
}

export default async function StorefrontLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  try {
    await fetchPublicStoreDomainContextServer();
  } catch {
    notFound();
  }
  const shellDataPromise = Promise.allSettled([
    fetchPublicStorefrontSettingsServer(),
    fetchPublicStorefrontMenusServer(),
    fetchPublicResolvedTemplateServer("home"),
  ]);

  return (
    <CartProvider>
      <div className="storefront-shell min-h-screen">
        <StorefrontShell shellDataPromise={shellDataPromise}>{children}</StorefrontShell>
      </div>
      <Toaster position="top-right" richColors />
    </CartProvider>
  );
}

async function StorefrontShell({
  children,
  shellDataPromise,
}: {
  children: ReactNode;
  shellDataPromise: Promise<
    [
      PromiseSettledResult<Awaited<ReturnType<typeof fetchPublicStorefrontSettingsServer>>>,
      PromiseSettledResult<Awaited<ReturnType<typeof fetchPublicStorefrontMenusServer>>>,
      PromiseSettledResult<Awaited<ReturnType<typeof fetchPublicResolvedTemplateServer>>>,
    ]
  >;
}) {
  const [settingsResult, menusResult, themeResult] = await shellDataPromise;
  const settings =
    settingsResult.status === "fulfilled"
      ? settingsResult.value
      : FALLBACK_STOREFRONT_SETTINGS;
  const menus =
    menusResult.status === "fulfilled"
      ? menusResult.value
      : FALLBACK_STOREFRONT_MENUS;

  const theme = getStorefrontTheme(settings);
  const resolved = themeResult.status === "fulfilled" ? themeResult.value : null;

  return (
    <>
      {resolved?.header_group ? <StorefrontSectionGroupRenderer group={resolved.header_group} settings={settings} menus={menus} /> : <><StoreTopBar settings={settings} /><StoreHeader settings={settings} navigation={menus.main_nav || FALLBACK_STOREFRONT_MENUS.main_nav} /><StoreCategoryNav settings={settings} items={menus.category_nav || FALLBACK_STOREFRONT_MENUS.category_nav} /></>}
      <main
        className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-6 px-4 py-4 sm:px-5 sm:py-5"
        style={theme.cssVars}
      >
        {children}
      </main>
      {resolved?.footer_group ? <StorefrontSectionGroupRenderer group={resolved.footer_group} settings={settings} menus={menus} /> : <StoreFooter
        settings={settings}
        footerServices={menus.footer_services || FALLBACK_STOREFRONT_MENUS.footer_services}
        footerJoinUs={menus.footer_join_us || FALLBACK_STOREFRONT_MENUS.footer_join_us}
        footerSocial={menus.footer_social || FALLBACK_STOREFRONT_MENUS.footer_social}
      />}
    </>
  );
}
