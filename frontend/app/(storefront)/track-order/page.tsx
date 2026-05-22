import type { Metadata } from "next";
import { Suspense } from "react";

import { TrackOrderView } from "@/components/storefront/TrackOrderView";

export const metadata: Metadata = {
  title: "Track Order",
  description:
    "Public Amar eCom order tracking surface designed for future courier integration and buyer reassurance.",
};

export default function TrackOrderPage() {
  return (
    <Suspense fallback={null}>
      <TrackOrderView />
    </Suspense>
  );
}
