import type { Metadata } from "next";

import { CheckoutView } from "@/components/storefront/CheckoutView";
import {
  FALLBACK_STOREFRONT_SETTINGS,
  fetchPublicStorefrontSettings,
} from "@/lib/online-store";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Complete your Amar-eCom storefront order with a fast cash on delivery checkout.",
};

export default async function CheckoutPage() {
  const settings = await fetchPublicStorefrontSettings().catch(
    () => FALLBACK_STOREFRONT_SETTINGS,
  );

  return <CheckoutView settings={settings} />;
}
