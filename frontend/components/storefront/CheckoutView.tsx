"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, ShoppingBag } from "lucide-react";
import { useMemo, useState, type FormEvent, type HTMLInputTypeAttribute } from "react";

import { useCart } from "@/components/storefront/CartProvider";
import { ApiError } from "@/lib/api";
import { createStorefrontOrder } from "@/lib/storefront-orders";
import { formatStoreCurrency } from "@/lib/storefront";

type CheckoutFormState = {
  customer_name: string;
  phone: string;
  alternative_phone: string;
  email: string;
  district: string;
  address: string;
  delivery_note: string;
};

const INITIAL_FORM: CheckoutFormState = {
  customer_name: "",
  phone: "",
  alternative_phone: "",
  email: "",
  district: "",
  address: "",
  delivery_note: "",
};

export function CheckoutView() {
  const router = useRouter();
  const { items, subtotal, clearCart } = useCart();
  const [form, setForm] = useState<CheckoutFormState>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEmpty = items.length === 0;
  const totalQuantity = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items],
  );

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
        `/order-confirmation/${order.tracking_code}?phone=${encodeURIComponent(form.phone.trim())}`,
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
        <p className="mt-3 text-sm leading-7 text-slate-600">
          আগে কিছু পণ্য কার্টে যোগ করুন, তারপর অর্ডার সম্পন্ন করুন।
        </p>
        <Link href="/products" className="store-primary-button mt-6">
          Shop Products
        </Link>
      </section>
    );
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
      <form
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
            placeholder="আপনার নাম"
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
            onChange={(value) => setForm((current) => ({ ...current, alternative_phone: value }))}
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
            placeholder="বাসা/রোড/এলাকা সহ সম্পূর্ণ ঠিকানা"
            required
          />
        </div>

        <div className="mt-4">
          <TextAreaField
            label="Delivery note"
            value={form.delivery_note}
            onChange={(value) => setForm((current) => ({ ...current, delivery_note: value }))}
            placeholder="ডেলিভারি সংক্রান্ত নির্দেশনা থাকলে লিখুন"
          />
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
          disabled={submitting}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#db011c] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#b10017] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          <span>{submitting ? "Placing order..." : "Place Order"}</span>
        </button>
      </form>

      <aside className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
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
                  {item.selectedColor ? ` • ${item.selectedColor}` : ""}
                  {item.selectedSize ? ` • ${item.selectedSize}` : ""}
                </p>
              </div>
              <p className="text-sm font-semibold text-slate-950">
                {formatStoreCurrency(item.price * item.quantity)}
              </p>
            </div>
          ))}
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
            <span>Delivery charge</span>
            <span className="font-semibold text-slate-950">{formatStoreCurrency(0)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-slate-200 pt-3">
            <span className="font-semibold text-slate-950">Total</span>
            <span className="text-lg font-black text-black">
              {formatStoreCurrency(subtotal)}
            </span>
          </div>
        </div>
      </aside>
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
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-900">
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
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-900">
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
