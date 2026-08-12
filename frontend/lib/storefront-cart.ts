import type { StoreProduct } from "@/lib/storefront";

export const STOREFRONT_CART_STORAGE_KEY = "amar_storefront_cart";

export type CartItem = {
  id: string;
  productId: string;
  slug: string;
  name: string;
  image: string | null;
  categoryName: string | null;
  price: number;
  regularPrice: number;
  quantity: number;
  stockStatus: StoreProduct["stock_status"];
  selectedSize?: string;
  selectedColor?: string;
  selectedVariantId?: string;
  selectedVariantSku?: string;
};

export function createCartItemFromProduct(
  product: StoreProduct,
  options?: {
    quantity?: number;
    selectedSize?: string;
    selectedColor?: string;
    selectedVariantId?: string;
    selectedVariantSku?: string;
    price?: number;
  },
): CartItem {
  return {
    id: [
      product.id,
      options?.selectedVariantId || "base-variant",
      options?.selectedColor || "default-color",
      options?.selectedSize || "default-size",
    ].join("::"),
    productId: product.id,
    slug: product.slug,
    name: product.name,
    image: product.image || product.thumbnail || product.gallery[0] || null,
    categoryName: product.category?.name || null,
    price: Number(options?.price ?? product.sale_price),
    regularPrice: Number(product.price),
    quantity: Math.max(1, options?.quantity || 1),
    stockStatus: product.stock_status,
    selectedSize: options?.selectedSize,
    selectedColor: options?.selectedColor,
    selectedVariantId: options?.selectedVariantId,
    selectedVariantSku: options?.selectedVariantSku,
  };
}

export function calculateCartCount(items: CartItem[]) {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

export function calculateCartSubtotal(items: CartItem[]) {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}
