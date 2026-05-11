"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, Printer } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading-state";
import { api, ApiError } from "@/lib/api";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";

type BusinessSettings = {
  company_name: string;
  business_email: string | null;
  business_phone: string | null;
  business_address: string | null;
  website: string | null;
  invoice_prefix: string;
};

type Customer = {
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  city: string | null;
};

type OrderItem = {
  id: string;
  product_name: string;
  sku: string | null;
  quantity: number;
  unit_price: number | string;
  total_price: number | string;
};

type OrderDetail = {
  id: string;
  order_number: string;
  customer_phone: string | null;
  shipping_address: string | null;
  notes: string | null;
  subtotal: number | string;
  discount: number | string;
  delivery_charge: number | string;
  total: number | string;
  printed_count: number;
  last_printed_at: string | null;
  created_at: string;
  customer: Customer | null;
  items: OrderItem[];
};

export default function OrderInvoicePage() {
  const params = useParams<{ id: string }>();
  const orderId = params.id;
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPrinting, setIsPrinting] = useState(false);
  const [error, setError] = useState("");

  const customerPhone = useMemo(
    () => order?.customer_phone || order?.customer?.phone || "No phone",
    [order],
  );

  useEffect(() => {
    let isMounted = true;

    async function loadInvoiceData() {
      try {
        const [orderData, settingsData] = await Promise.all([
          api.get<OrderDetail>(`/orders/${orderId}`),
          api.get<BusinessSettings>("/settings/business").catch(() => null),
        ]);

        if (!isMounted) return;
        setOrder(orderData);
        setSettings(settingsData);
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof ApiError ? err.message : "Failed to load invoice");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadInvoiceData();
    return () => {
      isMounted = false;
    };
  }, [orderId]);

  async function handlePrint() {
    if (!order) {
      return;
    }

    setIsPrinting(true);
    try {
      const updated = await api.post<OrderDetail>(`/orders/${order.id}/mark-printed`);
      setOrder(updated);
      window.print();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to track invoice print");
    } finally {
      setIsPrinting(false);
    }
  }

  if (isLoading) {
    return <LoadingState label="Loading invoice..." />;
  }

  if (error) {
    return <ErrorAlert message={error} />;
  }

  if (!order) {
    return (
      <EmptyState
        title="Invoice not available"
        description="The requested order could not be loaded for printing."
      />
    );
  }

  return (
    <div className="space-y-4 print:space-y-0">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={`/dashboard/orders/${order.id}`}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to order
        </Link>
        <button
          type="button"
          onClick={handlePrint}
          disabled={isPrinting}
          className="inline-flex items-center gap-2 rounded-full border border-slate-950 bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPrinting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Preparing print...
            </>
          ) : (
            <>
              <Printer className="h-4 w-4" />
              Print invoice
            </>
          )}
        </button>
      </div>

      <section className="mx-auto max-w-5xl rounded-[28px] border border-slate-200 bg-white p-8 shadow-[var(--shadow-soft)] print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <div className="flex flex-col gap-8 border-b border-slate-200 pb-8 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
              Invoice
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-950">
              {settings?.company_name || "Amar eCom"}
            </h1>
            <div className="mt-4 space-y-1 text-sm text-slate-600">
              <p>{settings?.business_address || "Business address not set"}</p>
              <p>{settings?.business_phone || "Business phone not set"}</p>
              <p>{settings?.business_email || "Business email not set"}</p>
              <p>{settings?.website || "Business website not set"}</p>
            </div>
          </div>

          <div className="grid gap-3 text-sm text-slate-600 md:min-w-[260px]">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              Invoice #: <span className="font-semibold text-slate-950">{order.order_number}</span>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              Order date: <span className="font-semibold text-slate-950">{formatDate(order.created_at)}</span>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              Last printed: <span className="font-semibold text-slate-950">{order.last_printed_at ? formatDateTime(order.last_printed_at) : "First print"}</span>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              Customer
            </p>
            <div className="mt-3 space-y-2 text-sm text-slate-700">
              <p className="font-semibold text-slate-950">{order.customer?.name || "Guest customer"}</p>
              <p>{customerPhone}</p>
              <p>{order.customer?.email || "No email"}</p>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              Shipping
            </p>
            <div className="mt-3 space-y-2 text-sm text-slate-700">
              <p>{order.shipping_address || order.customer?.address || "No shipping address"}</p>
              <p>{order.customer?.city || "No city"}</p>
              <p>{order.notes || "No delivery notes"}</p>
            </div>
          </div>
        </div>

        <div className="mt-8 overflow-hidden rounded-3xl border border-slate-200">
          <div className="grid grid-cols-[2.2fr_1fr_0.8fr_1fr] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
            <span>Item</span>
            <span>SKU</span>
            <span>Qty</span>
            <span className="text-right">Total</span>
          </div>
          <div className="divide-y divide-slate-200">
            {order.items.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-[2.2fr_1fr_0.8fr_1fr] gap-4 px-5 py-4 text-sm text-slate-700"
              >
                <div>
                  <p className="font-semibold text-slate-950">{item.product_name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Unit price {formatCurrency(item.unit_price)}
                  </p>
                </div>
                <span>{item.sku || "No SKU"}</span>
                <span>{item.quantity}</span>
                <span className="text-right font-semibold text-slate-950">
                  {formatCurrency(item.total_price)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 flex justify-end">
          <div className="w-full max-w-md space-y-3 text-sm text-slate-700">
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <span>Subtotal</span>
              <span className="font-semibold text-slate-950">{formatCurrency(order.subtotal)}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <span>Discount</span>
              <span className="font-semibold text-slate-950">{formatCurrency(order.discount)}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <span>Delivery charge</span>
              <span className="font-semibold text-slate-950">{formatCurrency(order.delivery_charge)}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-slate-950 px-4 py-4 text-white">
              <span className="font-semibold">Total</span>
              <span className="text-lg font-semibold">{formatCurrency(order.total)}</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
