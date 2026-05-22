import type { Metadata } from "next";

import { CheckoutView } from "@/components/storefront/CheckoutView";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Complete your Amar-eCom storefront order with a fast cash on delivery checkout.",
};

export default function CheckoutPage() {
  return <CheckoutView />;
}
