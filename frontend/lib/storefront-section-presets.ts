import type { OnlineStoreSection } from "@/lib/online-store";

export type StorefrontSectionPreset = {
  type: string;
  label: string;
  description: string;
  category: "hero" | "products" | "promotional" | "content" | "trust";
  defaultTitle: string;
  defaultSubtitle?: string;
  needsProductPicker?: boolean;
  needsMediaPicker?: boolean;
  defaultSettings: Record<string, unknown>;
  defaultContent: Record<string, unknown>;
};

const SECTION_PRESETS: StorefrontSectionPreset[] = [
  {
    type: "hero_slider",
    label: "Hero",
    description: "Primary promotional banner with headline, CTA, and optional slide content.",
    category: "hero",
    defaultTitle: "Hero Slider",
    needsMediaPicker: true,
    defaultSettings: { autoplay: true, show_dots: true, show_arrows: true },
    defaultContent: {
      slides: [
        {
          title: "STYLE THAT FITS",
          subtitle: "YOUR EVERYDAY",
          discount: "UP TO 70% OFF",
          button_text: "Shop Now",
          button_url: "/products",
          image_url: "/storefront/demo-products/jacket-monogram-3153.jpg",
        },
      ],
    },
  },
  {
    type: "product_grid",
    label: "Product Grid",
    description: "Manual or source-driven product collection grid.",
    category: "products",
    defaultTitle: "FEATURED PRODUCTS",
    needsProductPicker: true,
    defaultSettings: { source: "manual", limit: 8, columns_desktop: 4, columns_mobile: 2, show_shop_more: true, shop_more_url: "/products", product_ids: [] },
    defaultContent: {},
  },
  {
    type: "featured_collection",
    label: "Featured Collection",
    description: "Highlighted collection section with collection-style product grid.",
    category: "products",
    defaultTitle: "FEATURED COLLECTION",
    needsProductPicker: true,
    defaultSettings: { source: "featured_collection", limit: 8, columns_desktop: 4, columns_mobile: 2, show_shop_more: true, shop_more_url: "/products" },
    defaultContent: {},
  },
  {
    type: "flash_sale",
    label: "Flash Sale",
    description: "Urgent deal-driven product block for discount-first campaigns.",
    category: "products",
    defaultTitle: "FLASH SALE",
    needsProductPicker: true,
    defaultSettings: { source: "flash_sale", limit: 8, columns_desktop: 4, columns_mobile: 2, show_shop_more: true, shop_more_url: "/flash-sale" },
    defaultContent: {},
  },
  {
    type: "new_arrivals",
    label: "New Arrivals",
    description: "Fresh product arrivals with a strong merchandising grid.",
    category: "products",
    defaultTitle: "NEW ARRIVALS",
    defaultSettings: { source: "new_arrivals", limit: 8, columns_desktop: 4, columns_mobile: 2, show_shop_more: true, shop_more_url: "/products" },
    defaultContent: {},
  },
  {
    type: "best_selling",
    label: "Best Selling",
    description: "Best-selling product grid from the public-safe catalog source.",
    category: "products",
    defaultTitle: "BEST SELLING",
    defaultSettings: { source: "best_selling", limit: 8, columns_desktop: 4, columns_mobile: 2, show_shop_more: true, shop_more_url: "/best-selling" },
    defaultContent: {},
  },
  {
    type: "category_grid",
    label: "Category Grid",
    description: "Compact tile grid for category-first browsing.",
    category: "products",
    defaultTitle: "Categories",
    needsMediaPicker: true,
    defaultSettings: { limit: 8, menu_source: "category_nav", tile_style: "classic" },
    defaultContent: { items: [] },
  },
  {
    type: "single_banner",
    label: "Single Banner",
    description: "Large single promotional banner block.",
    category: "promotional",
    defaultTitle: "Special Offer",
    needsMediaPicker: true,
    defaultSettings: {},
    defaultContent: { image_url: "", button_text: "Shop Now", button_url: "/products" },
  },
  {
    type: "banner_grid",
    label: "Banner Grid",
    description: "Two or three promotional cards with links and CTA copy.",
    category: "promotional",
    defaultTitle: "Promo Blocks",
    needsMediaPicker: true,
    defaultSettings: {},
    defaultContent: { items: [] },
  },
  {
    type: "image_text",
    label: "Image + Text",
    description: "Storytelling content section with supporting image and CTA.",
    category: "content",
    defaultTitle: "Featured Story",
    defaultSettings: { image_position: "right" },
    defaultContent: { body: "", image_url: "", button_text: "Shop Now", button_url: "/products" },
    needsMediaPicker: true,
  },
  {
    type: "newsletter",
    label: "Newsletter",
    description: "Email capture teaser with static confirmation behavior.",
    category: "content",
    defaultTitle: "Stay Updated",
    defaultSettings: {},
    defaultContent: { button_text: "Subscribe" },
  },
  {
    type: "text_block",
    label: "Text Block",
    description: "Simple title and content section for editorial storefront content.",
    category: "content",
    defaultTitle: "Storefront Content",
    defaultSettings: { alignment: "left" },
    defaultContent: { text: "" },
  },
  {
    type: "faq",
    label: "FAQ",
    description: "Frequently asked questions section for delivery, sizing, or support answers.",
    category: "trust",
    defaultTitle: "Frequently Asked Questions",
    defaultSettings: {},
    defaultContent: { items: [{ question: "How long does delivery take?", answer: "Most COD orders are confirmed by phone and delivered in a few days." }] },
  },
  {
    type: "testimonials",
    label: "Testimonials",
    description: "Customer voice section with short social proof style reviews.",
    category: "trust",
    defaultTitle: "What Customers Say",
    defaultSettings: {},
    defaultContent: { items: [{ quote: "Fast confirmation and a smooth COD experience.", author: "Happy Customer" }] },
  },
  {
    type: "brand_strip",
    label: "Brand Strip",
    description: "Compact logo or brand-name strip to reinforce trust and assortment.",
    category: "trust",
    defaultTitle: "Top Brands",
    defaultSettings: {},
    defaultContent: { items: [{ label: "Brand One" }, { label: "Brand Two" }, { label: "Brand Three" }] },
  },
  {
    type: "flexible_grid",
    label: "Flexible Grid",
    description: "Build custom landing-page sections with columns and content blocks.",
    category: "content",
    defaultTitle: "Flexible Grid",
    needsMediaPicker: true,
    defaultSettings: {
      layout: "two_column",
      style: {
        background_preset: "white",
        padding_y: "md",
        max_width: "default",
        alignment: "left",
        animation_preset: "inherit",
      },
    },
    defaultContent: {
      blocks: [
        { type: "heading", text: "Flexible page builder", level: "h2", align: "left", column: 1 },
        { type: "paragraph", text: "Use controlled blocks for landing-page storytelling without breaking the storefront design system.", align: "left", column: 1 },
        { type: "button", label: "Shop Now", href: "/products", style: "primary", align: "left", column: 1 },
      ],
    },
  },
];

export const storefrontSectionPresets = SECTION_PRESETS;

export function getSectionPreset(type: string): StorefrontSectionPreset | undefined {
  return SECTION_PRESETS.find((preset) => preset.type === type);
}

export function buildSectionFromPreset(type: string): Pick<OnlineStoreSection, "type" | "title" | "subtitle" | "is_enabled" | "settings" | "content"> {
  const preset = getSectionPreset(type);
  if (!preset) {
    return {
      type,
      title: type.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
      subtitle: "",
      is_enabled: true,
      settings: {},
      content: {},
    };
  }

  return {
    type: preset.type,
    title: preset.defaultTitle,
    subtitle: preset.defaultSubtitle || "",
    is_enabled: true,
    settings: JSON.parse(JSON.stringify(preset.defaultSettings)),
    content: JSON.parse(JSON.stringify(preset.defaultContent)),
  };
}
