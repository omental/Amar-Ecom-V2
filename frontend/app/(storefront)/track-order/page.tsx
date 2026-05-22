import type { Metadata } from "next";

import { TrackOrderPanel } from "@/components/storefront/TrackOrderPanel";

export const metadata: Metadata = {
  title: "Track Order",
  description:
    "Public Amar eCom order tracking surface designed for future courier integration and buyer reassurance.",
};

export default function TrackOrderPage() {
  return <TrackOrderPanel />;
}
