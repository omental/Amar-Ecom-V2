import type { Metadata } from "next";

import { CheckoutView } from "@/components/storefront/CheckoutView";
import {
  FALLBACK_STOREFRONT_SETTINGS,
} from "@/lib/online-store";
import { fetchPublicStorefrontSettingsServer } from "@/lib/storefront-public-server";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Complete your Amar-eCom storefront order with a fast cash on delivery checkout.",
};

export default async function CheckoutPage() {
  const settings = await fetchPublicStorefrontSettingsServer().catch(
    () => FALLBACK_STOREFRONT_SETTINGS,
  );

  return <CheckoutView settings={settings} />;
}
