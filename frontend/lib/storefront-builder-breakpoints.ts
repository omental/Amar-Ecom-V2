import type { BuilderDevice } from "@/lib/storefront-builder";

export type BuilderBreakpoint = { key: BuilderDevice; label: string; previewWidth: number; maxWidth?: number };

export const BUILDER_BREAKPOINTS: Record<BuilderDevice, BuilderBreakpoint> = {
  desktop: { key: "desktop", label: "Desktop", previewWidth: 1280 },
  tablet: { key: "tablet", label: "Tablet", previewWidth: 768, maxWidth: 1024 },
  mobile: { key: "mobile", label: "Mobile", previewWidth: 390, maxWidth: 640 },
};
