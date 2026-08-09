import { request } from "@/lib/api";

export type StorefrontDeliveryZone = "inside_dhaka" | "outside_dhaka";

export type StorefrontOrderCreateItem = {
  product_id: string;
  quantity: number;
  selected_size?: string;
  selected_color?: string;
};

export type StorefrontOrderCreateInput = {
  customer_name: string;
  phone: string;
  alternative_phone?: string;
  email?: string;
  district: string;
  address: string;
  delivery_note?: string;
  delivery_zone: StorefrontDeliveryZone;
  coupon_code?: string;
  payment_method: "cash_on_delivery";
  items: StorefrontOrderCreateItem[];
};

export type StorefrontOrderCreateResponse = {
  public_order_code: string;
  tracking_code: string;
  status: string;
  discount_total: number;
  subtotal: number;
  delivery_charge: number;
  total: number;
  delivery_zone: StorefrontDeliveryZone;
  coupon_code?: string | null;
  created_at: string;
};

export type StorefrontTrackedOrderItem = {
  product_name: string;
  quantity: number;
  price: number;
  total: number;
};

export type StorefrontOrderTimelineItem = {
  label: string;
  status: string;
  completed: boolean;
  timestamp?: string | null;
};

export type StorefrontTrackedOrder = {
  tracking_code: string;
  status: string;
  created_at: string;
  customer_name?: string | null;
  customer_phone_masked?: string | null;
  items: StorefrontTrackedOrderItem[];
  discount_total: number;
  subtotal: number;
  delivery_charge: number;
  total: number;
  delivery_zone: StorefrontDeliveryZone;
  coupon_code?: string | null;
  timeline: StorefrontOrderTimelineItem[];
};

export type StorefrontCouponValidationResponse = {
  code: string;
  discount_type: "fixed" | "percentage";
  discount_total: number;
  subtotal: number;
  delivery_charge: number;
  total: number;
  message?: string | null;
};

async function storefrontRequest<T>(path: string, init: RequestInit = {}) {
  return request<T>(path, init, false);
}

export function createStorefrontOrder(payload: StorefrontOrderCreateInput) {
  return storefrontRequest<StorefrontOrderCreateResponse>("/public/storefront/orders", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function trackStorefrontOrder(code: string, phone: string) {
  const params = new URLSearchParams({
    code,
    phone,
  });

  return storefrontRequest<StorefrontTrackedOrder>(
    `/public/storefront/orders/track?${params.toString()}`,
    { method: "GET" },
  );
}

export function validateStorefrontCoupon(input: {
  code: string;
  delivery_zone: StorefrontDeliveryZone;
  items: Array<{ product_id: string; quantity: number }>;
}) {
  return storefrontRequest<StorefrontCouponValidationResponse>(
    "/public/storefront/coupons/validate",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}
