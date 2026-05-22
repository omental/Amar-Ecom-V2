import type { Metadata } from "next";
import { Suspense } from "react";

import { OrderConfirmationView } from "@/components/storefront/OrderConfirmationView";

export const metadata: Metadata = {
  title: "Order Confirmation",
  description: "Review your storefront order confirmation and tracking details.",
};

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  return (
    <Suspense fallback={null}>
      <OrderConfirmationView code={code} />
    </Suspense>
  );
}
