"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  calculateCartCount,
  calculateCartSubtotal,
  createCartItemFromProduct,
  STOREFRONT_CART_STORAGE_KEY,
  type CartItem,
} from "@/lib/storefront-cart";
import type { StoreProduct } from "@/lib/storefront";
import { getStorefrontCartNamespace } from "@/lib/storefront-domain";

type CartContextValue = {
  items: CartItem[];
  cartCount: number;
  subtotal: number;
  addItem: (
    product: StoreProduct,
    options?: {
      quantity?: number;
      selectedSize?: string;
      selectedColor?: string;
      selectedVariantId?: string;
      selectedVariantSku?: string;
      price?: number;
    },
  ) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function cartStorageKey() {
  if (typeof window === "undefined") return STOREFRONT_CART_STORAGE_KEY;
  return getStorefrontCartNamespace(window.location.host);
}

function readStoredCartItems(): CartItem[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(cartStorageKey());
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as CartItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => readStoredCartItems());

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      cartStorageKey(),
      JSON.stringify(items),
    );
  }, [items]);

  const value = useMemo<CartContextValue>(() => {
    return {
      items,
      cartCount: calculateCartCount(items),
      subtotal: calculateCartSubtotal(items),
      addItem(product, options) {
        const nextItem = createCartItemFromProduct(product, options);

        setItems((current) => {
          const existing = current.find((item) => item.id === nextItem.id);
          if (!existing) {
            return [...current, nextItem];
          }

          return current.map((item) =>
            item.id === nextItem.id
              ? { ...item, quantity: item.quantity + nextItem.quantity }
              : item,
          );
        });
      },
      removeItem(itemId) {
        setItems((current) => current.filter((item) => item.id !== itemId));
      },
      updateQuantity(itemId, quantity) {
        setItems((current) =>
          current.map((item) =>
            item.id === itemId ? { ...item, quantity: Math.max(1, quantity) } : item,
          ),
        );
      },
      clearCart() {
        setItems([]);
      },
    };
  }, [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error("useCart must be used within CartProvider");
  }

  return context;
}
