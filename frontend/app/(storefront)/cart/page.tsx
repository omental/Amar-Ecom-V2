import type { Metadata } from "next";

import { CartPageView } from "@/components/storefront/CartPageView";

export const metadata: Metadata = {
  title: "Cart",
  description: "Review selected storefront items, adjust quantity, and prepare for checkout.",
};

export default function CartPage() {
  return <CartPageView />;
}
