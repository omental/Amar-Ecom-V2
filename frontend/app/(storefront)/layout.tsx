import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Toaster } from "sonner";

import { CartProvider } from "@/components/storefront/CartProvider";
import { StoreCategoryNav } from "@/components/storefront/StoreCategoryNav";
import { StoreFooter } from "@/components/storefront/StoreFooter";
import { StoreHeader } from "@/components/storefront/StoreHeader";
import { StoreTopBar } from "@/components/storefront/StoreTopBar";
import {
  FALLBACK_STOREFRONT_MENUS,
  FALLBACK_STOREFRONT_SETTINGS,
  fetchPublicStorefrontMenus,
  fetchPublicStorefrontSettings,
} from "@/lib/online-store";

export const metadata: Metadata = {
  title: "Storefront",
  description:
    "Public Amar eCom storefront with premium product discovery, category-first shopping, and conversion-focused motion.",
};

export default function StorefrontLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const shellDataPromise = Promise.allSettled([
    fetchPublicStorefrontSettings(),
    fetchPublicStorefrontMenus(),
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
      PromiseSettledResult<Awaited<ReturnType<typeof fetchPublicStorefrontSettings>>>,
      PromiseSettledResult<Awaited<ReturnType<typeof fetchPublicStorefrontMenus>>>,
    ]
  >;
}) {
  const [settingsResult, menusResult] = await shellDataPromise;
  const settings =
    settingsResult.status === "fulfilled"
      ? settingsResult.value
      : FALLBACK_STOREFRONT_SETTINGS;
  const menus =
    menusResult.status === "fulfilled"
      ? menusResult.value
      : FALLBACK_STOREFRONT_MENUS;

  return (
    <>
      <StoreTopBar settings={settings} />
      <StoreHeader settings={settings} navigation={menus.main_nav || FALLBACK_STOREFRONT_MENUS.main_nav} />
      <StoreCategoryNav items={menus.category_nav || FALLBACK_STOREFRONT_MENUS.category_nav} />
      <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-6 px-4 py-4 sm:px-5 sm:py-5">
        {children}
      </main>
      <StoreFooter
        settings={settings}
        footerServices={menus.footer_services || FALLBACK_STOREFRONT_MENUS.footer_services}
        footerJoinUs={menus.footer_join_us || FALLBACK_STOREFRONT_MENUS.footer_join_us}
        footerSocial={menus.footer_social || FALLBACK_STOREFRONT_MENUS.footer_social}
      />
    </>
  );
}
