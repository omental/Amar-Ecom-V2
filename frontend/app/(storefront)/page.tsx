import type { Metadata } from "next";

import { StorefrontHome } from "@/components/storefront/StorefrontHome";
import { FALLBACK_STOREFRONT_HOME, fetchPublicStorefrontHome } from "@/lib/online-store";

export const metadata: Metadata = {
  title: "Amar eCom Fashion Store",
  description:
    "Offer-first Bangladeshi fashion storefront with compact product sections, category browsing, and conversion-focused shopping.",
};

export default async function StorefrontHomePage() {
  let storefront = FALLBACK_STOREFRONT_HOME;

  try {
    storefront = await fetchPublicStorefrontHome();
  } catch {
    storefront = FALLBACK_STOREFRONT_HOME;
  }

  return <StorefrontHome storefront={storefront} />;
}
