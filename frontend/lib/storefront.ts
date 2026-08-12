export type StoreCategory = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  image?: string | null;
  custom_fields?: Record<string, unknown>;
};

export type StoreProductVariant = { id: string; name: string; sku: string; price: string; stock_quantity: number; image?: string | null };

export type StoreBrand = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
};

export type StoreProduct = {
  id: string;
  name: string;
  slug: string;
  sku?: string | null;
  price: string;
  sale_price: string;
  image?: string | null;
  thumbnail?: string | null;
  gallery: string[];
  category?: StoreCategory | null;
  brand?: StoreBrand | null;
  stock_status: "in_stock" | "low_stock" | "out_of_stock";
  short_description?: string | null;
  description?: string | null;
  colors: string[];
  sizes: string[];
  support_notes: string[];
  is_demo_reference: boolean;
  demo_notice?: string | null;
  is_active: boolean;
  is_public: boolean;
  variants?: StoreProductVariant[];
  custom_fields?: Record<string, unknown>;
};

export type StoreProductListResponse = {
  items: StoreProduct[];
  total: number;
  skip: number;
  limit: number;
  generated_at: string;
};

type StoreProductQuery = {
  skip?: number;
  limit?: number;
  search?: string;
  category_slug?: string;
  brand_slug?: string;
};

export const STORE_NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/products", label: "Shop Product" },
  { href: "/best-selling", label: "Best Selling" },
  { href: "/flash-sale", label: "Flash Sale" },
  { href: "/track-order", label: "Track Order" },
];

export const STORE_FOOTER_LINKS = [
  ...STORE_NAV_LINKS,
  { href: "/cart", label: "Cart" },
];

export const STORE_CATEGORY_STRIP = [
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
];

export const ORDER_CTA_TEXT = "\u0985\u09B0\u09CD\u09A1\u09BE\u09B0 \u0995\u09B0\u09C1\u09A8";

export const STORE_DEMO_NOTICE =
  "Temporary demo/reference products for storefront review. Replace catalog content before production.";

export const STORE_CATEGORY_IMAGE_MAP: Record<string, string> = {
  Accessories: "/storefront/demo-products/sneakers-flex-3374.png",
  Watch: "/storefront/demo-products/jacket-italian-3154.jpg",
  Shirt: "/storefront/demo-products/jacket-monogram-3153.jpg",
  Panjabi: "/storefront/demo-products/jacket-puffer-3159.jpg",
  Shoe: "/storefront/demo-products/sneakers-flex-3374.png",
  Jacket: "/storefront/demo-products/jacket-monogram-3153.jpg",
  Hoodie: "/storefront/demo-products/jacket-puffer-3159.jpg",
  Blazer: "/storefront/demo-products/jacket-italian-3154.jpg",
};

export function buildStoreApiUrl(path: string) {
  return buildApiUrl(path);
}

export function buildStoreProductsPath(query: StoreProductQuery = {}) {
  const params = new URLSearchParams();

  if (query.skip !== undefined) {
    params.set("skip", String(query.skip));
  }
  if (query.limit !== undefined) {
    params.set("limit", String(query.limit));
  }
  if (query.search) {
    params.set("search", query.search);
  }
  if (query.category_slug) {
    params.set("category_slug", query.category_slug);
  }
  if (query.brand_slug) {
    params.set("brand_slug", query.brand_slug);
  }

  const qs = params.toString();
  return `/public/products${qs ? `?${qs}` : ""}`;
}

export async function fetchStorefrontJson<T>(path: string): Promise<T> {
  return publicApi.get<T>(path);
}

export function fetchStoreProductBySlug(slug: string) {
  return fetchStorefrontJson<StoreProduct>(`/public/products/slug/${slug}`);
}

export function formatStoreCurrency(value: string | number) {
  const numericValue = typeof value === "string" ? Number(value) : value;
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(numericValue) ? numericValue : 0);
}

export function getProductOriginalPrice(product: StoreProduct) {
  return Number(product.price);
}

export function getProductSalePrice(product: StoreProduct) {
  return Number(product.sale_price);
}

export function getProductDiscountPercent(product: StoreProduct) {
  const original = getProductOriginalPrice(product);
  const sale = getProductSalePrice(product);

  if (!original || sale >= original) {
    return 0;
  }

  return Math.round(((original - sale) / original) * 100);
}

export function getProductStockLabel(product: StoreProduct) {
  if (product.stock_status === "out_of_stock") {
    return "Out of stock";
  }
  if (product.stock_status === "low_stock") {
    return "Limited stock";
  }
  return "Ready to ship";
}

export function getProductPrimaryImage(product: StoreProduct) {
  return product.image || product.thumbnail || product.gallery[0] || null;
}
import { buildApiUrl } from "@/lib/api-config";
import { publicApi } from "@/lib/api";
