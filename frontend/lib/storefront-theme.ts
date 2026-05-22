import type { CSSProperties } from "react";

import type { OnlineStoreSettings } from "@/lib/online-store";

const COLOR_PRESET_MAP: Record<string, { primary: string; accent: string; soft: string }> = {
  live_red: { primary: "#db011c", accent: "#111111", soft: "rgba(219,1,28,0.10)" },
  premium_black: { primary: "#111111", accent: "#9f1239", soft: "rgba(17,17,17,0.10)" },
  fashion_rose: { primary: "#d9465f", accent: "#111111", soft: "rgba(217,70,95,0.12)" },
  electronics_blue: { primary: "#0f5bd8", accent: "#111111", soft: "rgba(15,91,216,0.12)" },
  organic_green: { primary: "#15803d", accent: "#14532d", soft: "rgba(21,128,61,0.12)" },
  luxury_gold: { primary: "#a16207", accent: "#111111", soft: "rgba(161,98,7,0.12)" },
};

const TYPOGRAPHY_MAP: Record<string, string> = {
  default_sans: '"Plus Jakarta Sans", system-ui, sans-serif',
  modern_commerce: '"Plus Jakarta Sans", "Outfit", system-ui, sans-serif',
  elegant_fashion: '"Outfit", "Plus Jakarta Sans", system-ui, sans-serif',
  bold_deal_store: '"Outfit", system-ui, sans-serif',
  premium_editorial: '"Outfit", Georgia, serif',
};

export function getStorefrontTheme(settings: OnlineStoreSettings) {
  const colorPreset = COLOR_PRESET_MAP[settings.color_preset || "live_red"] || COLOR_PRESET_MAP.live_red;
  const primaryColor = settings.primary_color || colorPreset.primary;
  const accentColor = settings.accent_color || colorPreset.accent;
  const fontFamily = TYPOGRAPHY_MAP[settings.typography_preset || "modern_commerce"] || TYPOGRAPHY_MAP.modern_commerce;
  const spacingDensity = settings.spacing_density || "compact";
  const cornerRadius = settings.corner_radius || "soft";
  const shadowStyle = settings.shadow_style || "soft";

  const radiusClass =
    cornerRadius === "sharp" ? "rounded-none" : cornerRadius === "rounded" ? "rounded-[28px]" : "rounded-[20px]";
  const buttonRadiusClass =
    settings.button_style === "sharp" ? "rounded-md" : settings.button_style === "pill" ? "rounded-full" : "rounded-[14px]";
  const shadowClass =
    shadowStyle === "none" ? "shadow-none" : shadowStyle === "premium" ? "shadow-[0_14px_36px_rgba(15,23,42,0.12)]" : "shadow-[0_8px_24px_rgba(15,23,42,0.06)]";
  const spacingClass =
    spacingDensity === "airy" ? "space-y-10 sm:space-y-12" : spacingDensity === "balanced" ? "space-y-8 sm:space-y-10" : "space-y-6 sm:space-y-8";
  const animationClass =
    settings.animation_preset === "none"
      ? ""
      : settings.animation_preset === "slide_up"
        ? "store-animate-slide-up"
        : settings.animation_preset === "scale_in"
          ? "store-animate-scale-in"
          : settings.animation_preset === "deal_pop"
            ? "store-animate-deal-pop"
            : "store-animate-fade";

  return {
    primaryColor,
    accentColor,
    fontFamily,
    radiusClass,
    buttonRadiusClass,
    shadowClass,
    spacingClass,
    animationClass,
    productCardClass:
      settings.product_card_style === "premium_card"
        ? "bg-white border border-[#e5e7eb] shadow-[0_12px_30px_rgba(15,23,42,0.08)]"
        : settings.product_card_style === "minimal_grid"
          ? "bg-white border border-[#edf2f7] shadow-none"
          : settings.product_card_style === "image_first"
            ? "bg-white border border-[#e5e7eb] shadow-[0_6px_18px_rgba(15,23,42,0.05)]"
            : "bg-white border border-[#e5e7eb] shadow-[0_2px_10px_rgba(0,0,0,0.04)]",
    cssVars: {
      "--store-accent": primaryColor,
      "--store-accent-soft": colorPreset.soft,
      "--store-text-accent": accentColor,
      "--store-font-family": fontFamily,
    } as CSSProperties,
  };
}
