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
} from "@/lib/cart";
import type { StoreProduct } from "@/lib/storefront";

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
    },
  ) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function readStoredCartItems(): CartItem[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STOREFRONT_CART_STORAGE_KEY);
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
      STOREFRONT_CART_STORAGE_KEY,
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
        if (quantity <= 0) {
          setItems((current) => current.filter((item) => item.id !== itemId));
          return;
        }

        setItems((current) =>
          current.map((item) =>
            item.id === itemId ? { ...item, quantity } : item,
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
