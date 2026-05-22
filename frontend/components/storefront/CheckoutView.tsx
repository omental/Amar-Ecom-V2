"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, ShoppingBag, Tag } from "lucide-react";
import { useMemo, useState, type FormEvent, type HTMLInputTypeAttribute } from "react";

import { useCart } from "@/components/storefront/CartProvider";
import { ApiError } from "@/lib/api";
import type { OnlineStoreSettings } from "@/lib/online-store";
import {
  createStorefrontOrder,
  type StorefrontDeliveryZone,
  validateStorefrontCoupon,
} from "@/lib/storefront-orders";
import { formatStoreCurrency } from "@/lib/storefront";

type CheckoutFormState = {
  customer_name: string;
  phone: string;
  alternative_phone: string;
  email: string;
  district: string;
  address: string;
  delivery_note: string;
  delivery_zone: StorefrontDeliveryZone;
  coupon_code: string;
};

const INITIAL_FORM: CheckoutFormState = {
  customer_name: "",
  phone: "",
  alternative_phone: "",
  email: "",
  district: "",
  address: "",
  delivery_note: "",
  delivery_zone: "inside_dhaka",
  coupon_code: "",
};

const BENGALI_EMPTY = "\u0986\u0997\u09C7 \u0995\u09BF\u099B\u09C1 \u09AA\u09A3\u09CD\u09AF \u0995\u09BE\u09B0\u09CD\u099F\u09C7 \u09AF\u09CB\u0997 \u0995\u09B0\u09C1\u09A8, \u09A4\u09BE\u09B0\u09AA\u09B0 \u0985\u09B0\u09CD\u09A1\u09BE\u09B0 \u09B8\u09AE\u09CD\u09AA\u09A8\u09CD\u09A8 \u0995\u09B0\u09C1\u09A8\u0964";
const BENGALI_NAME = "\u0986\u09AA\u09A8\u09BE\u09B0 \u09A8\u09BE\u09AE";
const BENGALI_ADDRESS =
  "\u09AC\u09BE\u09B8\u09BE/\u09B0\u09CB\u09A1/\u098F\u09B2\u09BE\u0995\u09BE \u09B8\u09B9 \u09B8\u09AE\u09CD\u09AA\u09C2\u09B0\u09CD\u09A3 \u09A0\u09BF\u0995\u09BE\u09A8\u09BE";
const BENGALI_NOTE =
  "\u09A1\u09C7\u09B2\u09BF\u09AD\u09BE\u09B0\u09BF \u09B8\u0982\u0995\u09CD\u09B0\u09BE\u09A8\u09CD\u09A4 \u09A8\u09BF\u09B0\u09CD\u09A6\u09C7\u09B6\u09A8\u09BE \u09A5\u09BE\u0995\u09B2\u09C7 \u09B2\u09BF\u0996\u09C1\u09A8";

export function CheckoutView({ settings }: { settings: OnlineStoreSettings }) {
  const router = useRouter();
  const { items, subtotal, clearCart } = useCart();
  const [form, setForm] = useState<CheckoutFormState>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponMessage, setCouponMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discount_total: number;
  } | null>(null);

  const isEmpty = items.length === 0;
  const totalQuantity = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items],
  );

  const estimatedDeliveryCharge = useMemo(() => {
    const minimum = settings.free_delivery_minimum ?? null;
    if (minimum !== null && subtotal >= minimum) {
      return 0;
    }

    return form.delivery_zone === "outside_dhaka"
      ? settings.outside_dhaka_delivery_charge ?? 120
      : settings.inside_dhaka_delivery_charge ?? 70;
  }, [
    form.delivery_zone,
    settings.free_delivery_minimum,
    settings.inside_dhaka_delivery_charge,
    settings.outside_dhaka_delivery_charge,
    subtotal,
  ]);

  const estimatedDiscount = appliedCoupon?.discount_total ?? 0;
  const estimatedTotal = Math.max(0, subtotal - estimatedDiscount) + estimatedDeliveryCharge;

  async function handleApplyCoupon(overrides?: {
    couponCode?: string;
    deliveryZone?: StorefrontDeliveryZone;
  }) {
    const couponCode = (overrides?.couponCode ?? form.coupon_code).trim();
    const deliveryZone = overrides?.deliveryZone ?? form.delivery_zone;

    if (!couponCode) {
      setCouponMessage("Enter a coupon code first.");
      return;
    }

    setCouponLoading(true);
    setCouponMessage(null);
    setError(null);
    try {
      const validation = await validateStorefrontCoupon({
        code: couponCode,
        delivery_zone: deliveryZone,
        items: items.map((item) => ({
          product_id: item.productId,
          quantity: item.quantity,
        })),
      });
      setAppliedCoupon({
        code: validation.code,
        discount_total: validation.discount_total,
      });
      setCouponMessage(validation.message || "Coupon applied successfully.");
    } catch (couponError) {
      setAppliedCoupon(null);
      setCouponMessage(
        couponError instanceof ApiError ? couponError.message : "Could not apply this coupon.",
      );
    } finally {
      setCouponLoading(false);
    }
  }

  function handleRemoveCoupon() {
    setAppliedCoupon(null);
    setForm((current) => ({ ...current, coupon_code: "" }));
    setCouponMessage(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isEmpty) {
      setError("Your cart is empty. Add products before checkout.");
      return;
    }

    if (!form.customer_name.trim() || !form.phone.trim() || !form.address.trim()) {
      setError("Name, phone, and address are required.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const order = await createStorefrontOrder({
        customer_name: form.customer_name.trim(),
        phone: form.phone.trim(),
        alternative_phone: form.alternative_phone.trim() || undefined,
        email: form.email.trim() || undefined,
        district: form.district.trim() || "Dhaka",
        address: form.address.trim(),
        delivery_note: form.delivery_note.trim() || undefined,
        delivery_zone: form.delivery_zone,
        coupon_code: appliedCoupon?.code,
        payment_method: "cash_on_delivery",
        items: items.map((item) => ({
          product_id: item.productId,
          quantity: item.quantity,
          selected_size: item.selectedSize,
          selected_color: item.selectedColor,
        })),
      });

      clearCart();
      router.push(
        `/order-confirmation/${order.tracking_code}?phone=${encodeURIComponent(
          form.phone.trim(),
        )}`,
      );
    } catch (submissionError) {
      setError(
        submissionError instanceof ApiError
          ? submissionError.message
          : "Could not place your order right now.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (isEmpty) {
    return (
      <section className="rounded-[28px] border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
        <ShoppingBag className="mx-auto h-10 w-10 text-slate-400" />
        <h1 className="mt-4 text-2xl font-semibold text-slate-950">Your checkout is empty</h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">{BENGALI_EMPTY}</p>
        <Link href="/products" className="store-primary-button mt-6">
          Continue Shopping
        </Link>
      </section>
    );
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
      <form
        id="storefront-checkout-form"
        onSubmit={handleSubmit}
        className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#db011c]">
          Checkout
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-black">
          Complete your order
        </h1>
        <p className="mt-3 text-sm leading-7 text-slate-600">
          Cash on Delivery is enabled for this phase. We will confirm your order by phone.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field
            label="Customer name"
            value={form.customer_name}
            onChange={(value) => setForm((current) => ({ ...current, customer_name: value }))}
            placeholder={BENGALI_NAME}
            required
          />
          <Field
            label="Phone number"
            value={form.phone}
            onChange={(value) => setForm((current) => ({ ...current, phone: value }))}
            placeholder="01XXXXXXXXX"
            required
          />
          <Field
            label="Alternative phone"
            value={form.alternative_phone}
            onChange={(value) =>
              setForm((current) => ({ ...current, alternative_phone: value }))
            }
            placeholder="Optional"
          />
          <Field
            label="Email"
            type="email"
            value={form.email}
            onChange={(value) => setForm((current) => ({ ...current, email: value }))}
            placeholder="Optional"
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-[0.45fr_0.55fr]">
          <Field
            label="District / City"
            value={form.district}
            onChange={(value) => setForm((current) => ({ ...current, district: value }))}
            placeholder="Dhaka"
          />
          <TextAreaField
            label="Full address"
            value={form.address}
            onChange={(value) => setForm((current) => ({ ...current, address: value }))}
            placeholder={BENGALI_ADDRESS}
            required
          />
        </div>

        <div className="mt-4">
          <TextAreaField
            label="Delivery note"
            value={form.delivery_note}
            onChange={(value) => setForm((current) => ({ ...current, delivery_note: value }))}
            placeholder={BENGALI_NOTE}
          />
        </div>

        <div className="mt-5 rounded-[22px] border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-black">Delivery zone</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {[
              ["inside_dhaka", "Inside Dhaka"],
              ["outside_dhaka", "Outside Dhaka"],
            ].map(([value, label]) => (
              <label
                key={value}
                className={`flex cursor-pointer items-center gap-3 rounded-[18px] border px-4 py-3 text-sm font-medium ${
                  form.delivery_zone === value
                    ? "border-[#db011c] bg-white text-black"
                    : "border-slate-200 bg-white text-slate-600"
                }`}
              >
                <input
                  type="radio"
                  name="delivery_zone"
                  value={value}
                  checked={form.delivery_zone === value}
                  onChange={() => {
                    setForm((current) => ({
                      ...current,
                      delivery_zone: value as StorefrontDeliveryZone,
                    }));
                    if (appliedCoupon) {
                      void handleApplyCoupon({
                        couponCode: form.coupon_code,
                        deliveryZone: value as StorefrontDeliveryZone,
                      });
                    }
                  }}
                />
                {label}
              </label>
            ))}
          </div>
          {settings.free_delivery_minimum !== null &&
          settings.free_delivery_minimum !== undefined ? (
            <p className="mt-3 text-xs text-[#db011c]">
              Free delivery on orders from{" "}
              {formatStoreCurrency(settings.free_delivery_minimum)} and above.
            </p>
          ) : null}
        </div>

        <div className="mt-5 rounded-[22px] border border-[#fecdd3] bg-[#fff1f3] p-4">
          <p className="text-sm font-semibold text-black">Payment method</p>
          <p className="mt-1 text-sm text-slate-600">Cash on Delivery</p>
        </div>

        {error ? (
          <div className="mt-5 rounded-[18px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={submitting || isEmpty}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#db011c] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#b10017] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          <span>{submitting ? "Placing order..." : "Place Order"}</span>
        </button>
      </form>

      <aside className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:sticky lg:top-6 lg:self-start">
        <p className="text-sm font-semibold text-slate-900">Order Summary</p>
        <div className="mt-4 space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-start justify-between gap-4 rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-950">{item.name}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Qty {item.quantity}
                  {item.selectedColor ? ` / ${item.selectedColor}` : ""}
                  {item.selectedSize ? ` / ${item.selectedSize}` : ""}
                </p>
              </div>
              <p className="text-sm font-semibold text-slate-950">
                {formatStoreCurrency(item.price * item.quantity)}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-[20px] border border-slate-200 bg-slate-50 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Tag className="h-4 w-4 text-[#db011c]" />
            Coupon
          </p>
          <div className="mt-3 flex gap-2">
            <input
              value={form.coupon_code}
              onChange={(event) => {
                const nextCode = event.target.value.toUpperCase();
                setForm((current) => ({ ...current, coupon_code: nextCode }));
                if (appliedCoupon && nextCode.trim() !== appliedCoupon.code) {
                  setAppliedCoupon(null);
                  setCouponMessage(null);
                }
              }}
              placeholder="Enter code"
              className="w-full rounded-[16px] border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
            />
            {appliedCoupon ? (
              <button
                type="button"
                onClick={handleRemoveCoupon}
                className="rounded-[16px] border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700"
              >
                Remove
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleApplyCoupon()}
                disabled={couponLoading || !form.coupon_code.trim()}
                className="rounded-[16px] bg-black px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {couponLoading ? "Applying..." : "Apply"}
              </button>
            )}
          </div>
          {couponMessage ? (
            <p
              className={`mt-3 text-xs ${
                appliedCoupon ? "text-emerald-700" : "text-rose-700"
              }`}
            >
              {couponMessage}
            </p>
          ) : null}
        </div>

        <div className="mt-5 space-y-3 border-t border-slate-200 pt-4 text-sm">
          <div className="flex items-center justify-between text-slate-600">
            <span>Total items</span>
            <span className="font-semibold text-slate-950">{totalQuantity}</span>
          </div>
          <div className="flex items-center justify-between text-slate-600">
            <span>Subtotal</span>
            <span className="font-semibold text-slate-950">
              {formatStoreCurrency(subtotal)}
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-600">
            <span>Discount</span>
            <span className="font-semibold text-emerald-700">
              -{formatStoreCurrency(estimatedDiscount)}
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-600">
            <span>Delivery Charge</span>
            <span className="font-semibold text-slate-950">
              {formatStoreCurrency(estimatedDeliveryCharge)}
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-slate-200 pt-3">
            <span className="font-semibold text-slate-950">Total</span>
            <span className="text-lg font-black text-black">
              {formatStoreCurrency(estimatedTotal)}
            </span>
          </div>
        </div>
      </aside>

      <div className="sticky bottom-3 z-20 rounded-[22px] border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur sm:hidden">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs text-slate-500">Total</p>
            <p className="text-lg font-black text-black">
              {formatStoreCurrency(estimatedTotal)}
            </p>
          </div>
          <button
            type="submit"
            form="storefront-checkout-form"
            disabled={submitting || isEmpty}
            className="inline-flex items-center justify-center rounded-full bg-[#db011c] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? "Placing..." : "Place Order"}
          </button>
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: HTMLInputTypeAttribute;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-2 block font-medium text-slate-900">
        {label}
        {required ? <span className="text-[#db011c]"> *</span> : null}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-[#db011c]"
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-2 block font-medium text-slate-900">
        {label}
        {required ? <span className="text-[#db011c]"> *</span> : null}
      </span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={5}
        className="w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-[#db011c]"
      />
    </label>
  );
}
