import type { StoreProduct } from "@/lib/storefront";

const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000/api/v1";

function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL;
}

export type OnlineStoreSettings = {
  id?: string;
  brand_name: string;
  logo_url?: string | null;
  favicon_url?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  active_template_key?: "live_shopping_classic" | "minimal_fashion" | "electronics_deals";
  typography_preset?:
    | "default_sans"
    | "modern_commerce"
    | "elegant_fashion"
    | "bold_deal_store"
    | "premium_editorial";
  color_preset?:
    | "live_red"
    | "premium_black"
    | "fashion_rose"
    | "electronics_blue"
    | "organic_green"
    | "luxury_gold";
  animation_preset?:
    | "none"
    | "subtle_fade"
    | "slide_up"
    | "scale_in"
    | "premium_smooth"
    | "deal_pop";
  product_card_style?: "compact_deal" | "image_first" | "premium_card" | "minimal_grid";
  button_style?: "sharp" | "rounded" | "pill" | "bold_block";
  header_layout?: "search_heavy" | "minimal" | "centered_logo" | "category_first";
  footer_layout?: "simple" | "multi_column" | "brand_story";
  spacing_density?: "compact" | "balanced" | "airy";
  corner_radius?: "sharp" | "soft" | "rounded";
  shadow_style?: "none" | "soft" | "premium";
  primary_color: string;
  accent_color?: string | null;
  secondary_color?: string | null;
  currency: string;
  show_topbar: boolean;
  show_search: boolean;
  show_cart: boolean;
  show_track_order: boolean;
  inside_dhaka_delivery_charge?: number;
  outside_dhaka_delivery_charge?: number;
  free_delivery_minimum?: number | null;
  footer_description?: string | null;
  footer_copyright_text?: string | null;
  social_share_image_url?: string | null;
  social_links?: Record<string, string> | null;
  seo_title?: string | null;
  seo_description?: string | null;
  is_active?: boolean;
};

export type OnlineStoreSectionProduct = {
  id: string;
  slug: string;
  name: string;
  image_url?: string | null;
  price: number;
  old_price?: number | null;
  category?: string | null;
  badge?: string | null;
  stock_status: "in_stock" | "low_stock" | "out_of_stock";
};

export type OnlineStoreMenuItem = {
  id?: string;
  label: string;
  url: string;
  target?: string;
  sort_order?: number;
  parent_id?: string | null;
  is_active?: boolean;
  children?: OnlineStoreMenuItem[];
};

export type OnlineStoreMenu = {
  id: string;
  name: string;
  location: string;
  is_active: boolean;
  items: OnlineStoreMenuItem[];
};

export type OnlineStoreSection = {
  id?: string;
  page_id?: string;
  type: string;
  title?: string | null;
  subtitle?: string | null;
  sort_order?: number;
  is_enabled?: boolean;
  settings?: Record<string, unknown> | null;
  content?: Record<string, unknown> | null;
  products?: OnlineStoreSectionProduct[];
};

export type OnlineStorePage = {
  id?: string;
  title: string;
  slug: string;
  page_type?: string;
  content?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  status?: string;
  is_system?: boolean;
  last_published_at?: string | null;
  sections: OnlineStoreSection[];
};

export type OnlineStoreBanner = {
  id?: string;
  title: string;
  subtitle?: string | null;
  image_url: string;
  mobile_image_url?: string | null;
  button_text?: string | null;
  button_url?: string | null;
  location?: string | null;
  sort_order?: number;
  is_active?: boolean;
};

export type OnlineStoreMedia = {
  id: string;
  file_name: string;
  original_name: string;
  mime_type: string;
  file_size: number;
  url: string;
  storage_path: string;
  media_type: string;
  alt_text?: string | null;
};

export type OnlineStoreCoupon = {
  id?: string;
  code: string;
  type: "fixed" | "percentage";
  value: number;
  min_order_amount: number;
  max_discount_amount?: number | null;
  active: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  usage_limit?: number | null;
  usage_count?: number;
  created_at?: string;
  updated_at?: string;
};

export type OnlineStoreTemplatePreset = {
  key: "live_shopping_classic" | "minimal_fashion" | "electronics_deals";
  name: string;
  description: string;
  best_for: string;
  recommended_typography_preset: NonNullable<OnlineStoreSettings["typography_preset"]>;
  recommended_color_preset: NonNullable<OnlineStoreSettings["color_preset"]>;
  recommended_animation_preset: NonNullable<OnlineStoreSettings["animation_preset"]>;
  header_layout: NonNullable<OnlineStoreSettings["header_layout"]>;
  footer_layout: NonNullable<OnlineStoreSettings["footer_layout"]>;
  product_card_style: NonNullable<OnlineStoreSettings["product_card_style"]>;
  button_style: NonNullable<OnlineStoreSettings["button_style"]>;
  spacing_density: NonNullable<OnlineStoreSettings["spacing_density"]>;
  corner_radius: NonNullable<OnlineStoreSettings["corner_radius"]>;
  shadow_style: NonNullable<OnlineStoreSettings["shadow_style"]>;
  default_homepage_sections: Array<{
    type: string;
    title?: string | null;
    subtitle?: string | null;
    settings?: Record<string, unknown> | null;
    content?: Record<string, unknown> | null;
  }>;
};

export type OnlineStoreRevision = {
  id: string;
  page_id?: string | null;
  revision_type: "page" | "template_apply" | "publish" | "theme_settings";
  title: string;
  snapshot: Record<string, unknown>;
  created_by_id?: string | null;
  created_by_name?: string | null;
  created_at: string;
};

export type OnlineStoreTemplateApplyResponse = {
  applied_template_key: NonNullable<OnlineStoreSettings["active_template_key"]>;
  revision_id: string;
  message: string;
  page: OnlineStorePage;
};

export type OnlineStorePublishResponse = {
  id: string;
  status: string;
  last_published_at?: string | null;
  revision_id?: string | null;
  message?: string | null;
};

export type PublicStorefrontResponse = {
  settings: OnlineStoreSettings;
  menus: Record<string, OnlineStoreMenuItem[]>;
  page: OnlineStorePage;
};

export type StorefrontOverview = {
  storefront_status: "active" | "inactive";
  homepage_sections_count: number;
  menus_count: number;
  published_pages_count: number;
  banners_count: number;
};

export type StorefrontProductPickerItem = {
  id: string;
  slug: string;
  name: string;
  image?: string | null;
  price: number;
  compare_price?: number | null;
  category_name?: string | null;
  stock_status: "in_stock" | "low_stock" | "out_of_stock";
};

export type StorefrontProductPickerResponse = {
  items: StorefrontProductPickerItem[];
  page: number;
  limit: number;
  total: number;
};

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

async function fetchAdminJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token =
    typeof window !== "undefined" ? window.localStorage.getItem("amar_token") : null;
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (!(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function fetchPublicStorefrontHome() {
  return fetchJson<PublicStorefrontResponse>("/public/storefront/pages/home");
}

export async function fetchPublicStorefrontPage(slug: string) {
  return fetchJson<PublicStorefrontResponse>(`/public/storefront/pages/${slug}`);
}

export async function fetchPublicStorefrontSettings() {
  return fetchJson<OnlineStoreSettings>("/public/storefront/settings");
}

export async function fetchPublicStorefrontMenus() {
  return fetchJson<Record<string, OnlineStoreMenuItem[]>>("/public/storefront/menus");
}

export async function fetchAdminStorefrontCoupons(params?: {
  q?: string;
  active?: boolean | null;
}) {
  const search = new URLSearchParams();
  if (params?.q) search.set("q", params.q);
  if (typeof params?.active === "boolean") search.set("active", String(params.active));
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return fetchAdminJson<OnlineStoreCoupon[]>(`/admin/storefront/coupons${suffix}`);
}

export async function createAdminStorefrontCoupon(input: OnlineStoreCoupon) {
  return fetchAdminJson<OnlineStoreCoupon>("/admin/storefront/coupons", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateAdminStorefrontCoupon(couponId: string, input: OnlineStoreCoupon) {
  return fetchAdminJson<OnlineStoreCoupon>(`/admin/storefront/coupons/${couponId}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function deleteAdminStorefrontCoupon(couponId: string) {
  return fetchAdminJson<void>(`/admin/storefront/coupons/${couponId}`, {
    method: "DELETE",
  });
}

export async function fetchAdminStorefrontTemplates() {
  return fetchAdminJson<OnlineStoreTemplatePreset[]>("/admin/storefront/templates");
}

export async function applyAdminStorefrontTemplate(templateKey: string, replaceHomepage = true) {
  return fetchAdminJson<OnlineStoreTemplateApplyResponse>(`/admin/storefront/templates/${templateKey}/apply`, {
    method: "POST",
    body: JSON.stringify({ replace_homepage: replaceHomepage }),
  });
}

export async function fetchAdminStorefrontRevisions() {
  return fetchAdminJson<OnlineStoreRevision[]>("/admin/storefront/revisions");
}

export async function restoreAdminStorefrontRevision(revisionId: string) {
  return fetchAdminJson<{ revision_id: string; restored_page_id?: string | null; message: string }>(
    `/admin/storefront/revisions/${revisionId}/restore`,
    {
      method: "POST",
    },
  );
}

export async function previewAdminStorefrontPage(pageId: string) {
  return fetchAdminJson<PublicStorefrontResponse>(`/admin/storefront/pages/${pageId}/preview`);
}

export const FALLBACK_STOREFRONT_SETTINGS: OnlineStoreSettings = {
  brand_name: "Amar-eCom",
  phone: "+880 1711-000000",
  email: "email@amar-ecom.com",
  address: "Dhaka, Bangladesh",
  active_template_key: "live_shopping_classic",
  typography_preset: "modern_commerce",
  color_preset: "live_red",
  animation_preset: "subtle_fade",
  product_card_style: "compact_deal",
  button_style: "rounded",
  header_layout: "search_heavy",
  footer_layout: "multi_column",
  spacing_density: "compact",
  corner_radius: "soft",
  shadow_style: "soft",
  primary_color: "#db011c",
  accent_color: "#111111",
  currency: "BDT",
  show_topbar: true,
  show_search: true,
  show_cart: true,
  show_track_order: true,
  inside_dhaka_delivery_charge: 70,
  outside_dhaka_delivery_charge: 120,
  free_delivery_minimum: null,
  footer_description:
    "Amar-eCom brings compact, offer-heavy Bangladesh fashion shopping with fast product discovery and order-first browsing.",
  footer_copyright_text: "Powered by Amar-eCom",
  social_links: {
    facebook: "#",
    youtube: "#",
    instagram: "#",
  },
};

export const FALLBACK_STOREFRONT_MENUS: Record<string, OnlineStoreMenuItem[]> = {
  main_nav: [
    { label: "Home", url: "/" },
    { label: "Shop Product", url: "/products" },
    { label: "Best Selling", url: "/best-selling" },
    { label: "Flash Sale", url: "/flash-sale" },
  ],
  category_nav: [
    "Accessories",
    "Watch",
    "Wallet",
    "Sunglass",
    "Tie",
    "Shirt",
    "Pant",
    "Panjabi",
    "Polo",
    "T-Shirt",
    "Blazer",
    "Waistcoat",
    "Shoe",
    "Belt",
    "Jacket",
    "Hoodie",
  ].map((label) => ({
    label,
    url: `/categories/${label.toLowerCase().replace(/\s+/g, "-")}`,
  })),
  footer_services: [
    { label: "Refund and Returns Policy", url: "/pages/refund-and-returns-policy" },
    { label: "Terms & Conditions", url: "/pages/terms-and-conditions" },
    { label: "Privacy Policy", url: "/pages/privacy-policy" },
    { label: "About Us", url: "/pages/about-us" },
    { label: "Contact Us", url: "/pages/contact-us" },
  ],
  footer_join_us: [
    { label: "Join Us", url: "/pages/join-us" },
    { label: "Contact Us", url: "/pages/contact-us" },
    { label: "FAQs", url: "/pages/faqs" },
  ],
  footer_social: [
    { label: "Facebook", url: "#" },
    { label: "YouTube", url: "#" },
    { label: "Instagram", url: "#" },
  ],
  footer_quick_links: [
    { label: "Track Order", url: "/track-order" },
    { label: "Shop Product", url: "/products" },
  ],
};

const fallbackProducts: StoreProduct[] = [
  {
    id: "shirt-classic-white",
    name: "Classic White Formal Shirt",
    slug: "classic-white-formal-shirt",
    price: "1860",
    sale_price: "1590",
    image: "/storefront/demo-products/jacket-monogram-3153.jpg",
    thumbnail: "/storefront/demo-products/jacket-monogram-3153.jpg",
    gallery: ["/storefront/demo-products/jacket-monogram-3153.jpg"],
    category: { id: "shirt-category", name: "Shirt", slug: "shirt", description: null },
    brand: null,
    stock_status: "in_stock",
    short_description: "Shirt collection item",
    description: null,
    colors: [],
    sizes: [],
    support_notes: [],
    is_demo_reference: true,
    demo_notice: "Fallback storefront data",
    is_active: true,
    is_public: true,
  },
  {
    id: "pant-slim-black",
    name: "Slim Fit Black Pant",
    slug: "slim-fit-black-pant",
    price: "1860",
    sale_price: "1590",
    image: "/storefront/demo-products/jacket-italian-3154.jpg",
    thumbnail: "/storefront/demo-products/jacket-italian-3154.jpg",
    gallery: ["/storefront/demo-products/jacket-italian-3154.jpg"],
    category: { id: "pant-category", name: "Pant", slug: "pant", description: null },
    brand: null,
    stock_status: "in_stock",
    short_description: "Pant collection item",
    description: null,
    colors: [],
    sizes: [],
    support_notes: [],
    is_demo_reference: true,
    demo_notice: "Fallback storefront data",
    is_active: true,
    is_public: true,
  },
  {
    id: "winter-knit-grey",
    name: "Winter Knit Grey Jacket",
    slug: "winter-knit-grey-jacket",
    price: "2860",
    sale_price: "2250",
    image: "/storefront/demo-products/jacket-puffer-3159.jpg",
    thumbnail: "/storefront/demo-products/jacket-puffer-3159.jpg",
    gallery: ["/storefront/demo-products/jacket-puffer-3159.jpg"],
    category: { id: "jacket-category", name: "Jacket", slug: "jacket", description: null },
    brand: null,
    stock_status: "in_stock",
    short_description: "Winter collection item",
    description: null,
    colors: [],
    sizes: [],
    support_notes: [],
    is_demo_reference: true,
    demo_notice: "Fallback storefront data",
    is_active: true,
    is_public: true,
  },
  {
    id: "polo-circle-black",
    name: "Circle Black Polo",
    slug: "circle-black-polo",
    price: "1850",
    sale_price: "1580",
    image: "/storefront/demo-products/jacket-italian-3154.jpg",
    thumbnail: "/storefront/demo-products/jacket-italian-3154.jpg",
    gallery: ["/storefront/demo-products/jacket-italian-3154.jpg"],
    category: { id: "polo-category", name: "Polo", slug: "polo", description: null },
    brand: null,
    stock_status: "in_stock",
    short_description: "Polo collection item",
    description: null,
    colors: [],
    sizes: [],
    support_notes: [],
    is_demo_reference: true,
    demo_notice: "Fallback storefront data",
    is_active: true,
    is_public: true,
  },
];

export const FALLBACK_STOREFRONT_HOME: PublicStorefrontResponse = {
  settings: FALLBACK_STOREFRONT_SETTINGS,
  menus: FALLBACK_STOREFRONT_MENUS,
  page: {
    title: "Home",
    slug: "home",
    seo_title: "Amar-eCom",
    seo_description: "Fallback dynamic storefront home",
    sections: [
      {
        type: "hero_slider",
        title: "Hero Slider",
        settings: { show_dots: true, show_arrows: true },
        content: {
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
        type: "new_arrivals",
        title: "NEW ARRIVALS",
        settings: { source: "new_arrivals", limit: 4, columns_desktop: 4, columns_mobile: 2, show_shop_more: true },
        content: {},
        products: [],
      },
      {
        type: "category_grid",
        title: "Categories",
        settings: { columns_desktop: 4, columns_mobile: 2 },
        content: {
          items: [
            { label: "Accessories", image_url: "/storefront/demo-products/sneakers-flex-3374.png" },
            { label: "Watch", image_url: "/storefront/demo-products/jacket-italian-3154.jpg" },
            { label: "Sunglass", image_url: "/storefront/demo-products/sneakers-leopard-3772.png" },
            { label: "Tie", image_url: "/storefront/demo-products/jacket-monogram-3153.jpg" },
          ],
        },
      },
      {
        type: "featured_collection",
        title: "WINTER COLLECTION",
        settings: { source: "featured_collection", limit: 4, columns_desktop: 4, columns_mobile: 2 },
        content: {},
        products: [],
      },
    ],
  },
};

export function getFallbackProductsBySource(source?: string, limit = 4) {
  if (source === "featured_collection") {
    return [fallbackProducts[2], fallbackProducts[3], fallbackProducts[0], fallbackProducts[1]].slice(0, limit);
  }
  return fallbackProducts.slice(0, limit);
}

export function buildStoreProductFromSectionProduct(product: OnlineStoreSectionProduct): StoreProduct {
  const categoryName = product.category || "Product";
  const oldPrice = product.old_price ?? product.price;
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    price: String(oldPrice),
    sale_price: String(product.price),
    image: product.image_url,
    thumbnail: product.image_url,
    gallery: product.image_url ? [product.image_url] : [],
    category: {
      id: `${categoryName.toLowerCase().replace(/\s+/g, "-")}-category`,
      name: categoryName,
      slug: categoryName.toLowerCase().replace(/\s+/g, "-"),
      description: null,
    },
    brand: null,
    stock_status: product.stock_status,
    short_description: `${categoryName} storefront product`,
    description: null,
    colors: [],
    sizes: [],
    support_notes: [],
    is_demo_reference: false,
    demo_notice: null,
    is_active: true,
    is_public: true,
  };
}
