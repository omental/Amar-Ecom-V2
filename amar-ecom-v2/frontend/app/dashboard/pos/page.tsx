"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CreditCard,
  Loader2,
  PackageSearch,
  Receipt,
  RefreshCw,
  Search,
  ShoppingCart,
  Trash2,
  Wallet,
} from "lucide-react";

import { ErrorAlert } from "@/components/ui/error-alert";
import { FormCard } from "@/components/ui/form-card";
import { LoadingState } from "@/components/ui/loading-state";
import { OpsActionButton } from "@/components/ui/ops-action-button";
import { OpsPageHeader } from "@/components/ui/ops-page-header";
import { OpsSummaryCard } from "@/components/ui/ops-summary-card";
import { api, ApiError } from "@/lib/api";
import { formatCurrency, formatLabel } from "@/lib/format";

type Warehouse = {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
};

type Customer = {
  id: string;
  name: string;
  phone: string;
};

type Account = {
  id: string;
  name: string;
  code: string;
  account_type: string;
  current_balance: number | string;
  is_active: boolean;
};

type PosProduct = {
  product_id: string | null;
  variant_id: string | null;
  name: string;
  sku: string | null;
  price: number | string;
  stock_quantity: number;
  image_url: string | null;
};

type CartItem = PosProduct & {
  quantity: number;
};

type PosSummary = {
  today_pos_orders: number;
  today_pos_sales: number | string;
  today_paid_amount: number | string;
  today_due_amount: number | string;
};

type CheckoutOrder = {
  id: string;
  order_number: string;
};

type PosCheckoutResponse = {
  order: CheckoutOrder;
  payment_status: string;
  change_amount: number | string;
  due_amount: number | string;
  receipt_url: string | null;
  order_id: string;
};

type CheckoutForm = {
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  payment_method: string;
  account_id: string;
  discount: string;
  paid_amount: string;
  notes: string;
};

const initialCheckoutForm: CheckoutForm = {
  customer_id: "",
  customer_name: "",
  customer_phone: "",
  payment_method: "cash",
  account_id: "",
  discount: "0",
  paid_amount: "0",
  notes: "",
};

function buildQuery(params: Record<string, string | number | null | undefined>) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      searchParams.set(key, String(value));
    }
  });
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function toNumber(value: string | number | null | undefined) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function itemKey(item: { product_id: string | null; variant_id: string | null; sku: string | null }) {
  return `${item.product_id || "product"}:${item.variant_id || "base"}:${item.sku || "sku"}`;
}

export default function PosPage() {
  const [summary, setSummary] = useState<PosSummary | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [products, setProducts] = useState<PosProduct[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [checkoutForm, setCheckoutForm] = useState<CheckoutForm>(initialCheckoutForm);
  const [lastCheckout, setLastCheckout] = useState<PosCheckoutResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSearchingProducts, setIsSearchingProducts] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshingSummary, setIsRefreshingSummary] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + toNumber(item.price) * item.quantity, 0),
    [cart],
  );
  const discount = useMemo(() => Math.max(0, toNumber(checkoutForm.discount)), [checkoutForm.discount]);
  const total = useMemo(() => Math.max(0, subtotal - discount), [discount, subtotal]);
  const paidAmount = useMemo(() => Math.max(0, toNumber(checkoutForm.paid_amount)), [checkoutForm.paid_amount]);
  const dueAmount = useMemo(() => Math.max(0, total - Math.min(paidAmount, total)), [paidAmount, total]);
  const changeAmount = useMemo(() => Math.max(0, paidAmount - total), [paidAmount, total]);
  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === checkoutForm.account_id) || null,
    [accounts, checkoutForm.account_id],
  );

  async function loadSummary() {
    const summaryData = await api.get<PosSummary>("/pos/summary");
    setSummary(summaryData);
  }

  async function loadReferenceData() {
    const [warehouseData, customerData, accountData] = await Promise.all([
      api.get<Warehouse[]>("/warehouses?skip=0&limit=100"),
      api.get<Customer[]>("/customers?skip=0&limit=100"),
      api.get<Account[]>("/accounts?skip=0&limit=100").catch(() => []),
    ]);
    setWarehouses(warehouseData.filter((warehouse) => warehouse.is_active));
    setCustomers(customerData);
    setAccounts(accountData.filter((account) => account.is_active));
  }

  async function searchProducts(nextSearchTerm = searchTerm, nextWarehouseId = selectedWarehouseId) {
    if (!nextWarehouseId) {
      setProducts([]);
      return;
    }
    setIsSearchingProducts(true);
    try {
      const productData = await api.get<PosProduct[]>(
        `/pos/products${buildQuery({
          warehouse_id: nextWarehouseId,
          search: nextSearchTerm,
          limit: 40,
        })}`,
      );
      setProducts(productData);
    } finally {
      setIsSearchingProducts(false);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      try {
        const [summaryData, warehouseData, customerData, accountData] = await Promise.all([
          api.get<PosSummary>("/pos/summary"),
          api.get<Warehouse[]>("/warehouses?skip=0&limit=100"),
          api.get<Customer[]>("/customers?skip=0&limit=100"),
          api.get<Account[]>("/accounts?skip=0&limit=100").catch(() => []),
        ]);
        if (!isMounted) return;
        setSummary(summaryData);
        setWarehouses(warehouseData.filter((warehouse) => warehouse.is_active));
        setCustomers(customerData);
        setAccounts(accountData.filter((account) => account.is_active));
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof ApiError ? err.message : "Failed to load POS workspace");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void bootstrap();
    return () => {
      isMounted = false;
    };
  }, []);

  function clearMessages() {
    setError("");
    setSuccess("");
  }

  function handleAddToCart(product: PosProduct) {
    clearMessages();
    if (product.stock_quantity <= 0) {
      setError("This item is out of stock in the selected warehouse.");
      return;
    }
    const key = itemKey(product);
    setCart((current) => {
      const existing = current.find((item) => itemKey(item) === key);
      if (!existing) {
        return [...current, { ...product, quantity: 1 }];
      }
      return current.map((item) =>
        itemKey(item) === key
          ? { ...item, quantity: Math.min(item.quantity + 1, item.stock_quantity) }
          : item,
      );
    });
  }

  function updateCartQuantity(key: string, nextQuantity: number) {
    setCart((current) =>
      current
        .map((item) => {
          if (itemKey(item) !== key) {
            return item;
          }
          return {
            ...item,
            quantity: Math.max(1, Math.min(nextQuantity, item.stock_quantity)),
          };
        })
        .filter((item) => item.quantity > 0),
    );
  }

  function removeFromCart(key: string) {
    setCart((current) => current.filter((item) => itemKey(item) !== key));
  }

  async function handleSummaryRefresh() {
    clearMessages();
    setIsRefreshingSummary(true);
    try {
      await loadSummary();
      setSuccess("POS summary refreshed.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to refresh POS summary");
    } finally {
      setIsRefreshingSummary(false);
    }
  }

  async function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearMessages();
    try {
      await searchProducts();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to search POS products");
    }
  }

  async function handleCheckout(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearMessages();
    if (!selectedWarehouseId) {
      setError("Select a warehouse before checkout.");
      return;
    }
    if (cart.length === 0) {
      setError("Add at least one product to the cart before checkout.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await api.post<PosCheckoutResponse>("/pos/checkout", {
        customer_id: checkoutForm.customer_id || null,
        customer_name: checkoutForm.customer_name || null,
        customer_phone: checkoutForm.customer_phone || null,
        warehouse_id: selectedWarehouseId,
        payment_method: checkoutForm.payment_method,
        account_id: checkoutForm.account_id || null,
        discount,
        paid_amount: paidAmount,
        notes: checkoutForm.notes || null,
        items: cart.map((item) => ({
          product_id: item.product_id,
          variant_id: item.variant_id,
          product_name: item.name,
          sku: item.sku,
          quantity: item.quantity,
          unit_price: toNumber(item.price),
          total_price: toNumber(item.price) * item.quantity,
        })),
      });
      setLastCheckout(response);
      setCart([]);
      setCheckoutForm((current) => ({
        ...initialCheckoutForm,
        customer_id: current.customer_id,
      }));
      await Promise.all([loadSummary(), loadReferenceData(), searchProducts()]);
      setSuccess(
        checkoutForm.account_id
          ? `POS order ${response.order.order_number} created. Finance transaction recorded automatically for the paid amount.`
          : `POS order ${response.order.order_number} created successfully.`,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to complete POS checkout");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return <LoadingState label="Loading POS workspace..." />;
  }

  return (
    <div className="space-y-5">
      <section className="card-base p-6 sm:p-8">
        <OpsPageHeader
          eyebrow="POS Console"
          title="Point of sale workspace"
          description="Run walk-in checkout with a denser warehouse-first selling layout, immediate stock deduction, optional finance capture, and a direct path into the existing invoice print flow."
          meta="Walk-in sales, payment capture, and receipt handoff"
          actions={
            <OpsActionButton
              type="button"
              variant="secondary"
              onClick={() => void handleSummaryRefresh()}
              disabled={isRefreshingSummary}
            >
              {isRefreshingSummary ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh summary
            </OpsActionButton>
          }
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <OpsSummaryCard label="Today Orders" value={summary?.today_pos_orders || 0} icon={ShoppingCart} eyebrow="Counter Flow" />
        <OpsSummaryCard label="Today Sales" value={formatCurrency(summary?.today_pos_sales)} icon={Receipt} eyebrow="Gross Sales" tone="success" />
        <OpsSummaryCard label="Today Paid" value={formatCurrency(summary?.today_paid_amount)} icon={Wallet} eyebrow="Collected" tone="info" />
        <OpsSummaryCard label="Today Due" value={formatCurrency(summary?.today_due_amount)} icon={CreditCard} eyebrow="Receivable" tone="warning" />
      </section>

      {error ? <ErrorAlert message={error} /> : null}
      {success ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <FormCard
            title="Product search"
            description="Choose the selling warehouse first, then search by name or SKU for a fast walk-in flow."
            action={
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <PackageSearch className="h-5 w-5" />
              </div>
            }
          >
            <form onSubmit={handleSearchSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Warehouse</span>
                  <select
                    value={selectedWarehouseId}
                    onChange={(event) => {
                      const nextWarehouseId = event.target.value;
                      setSelectedWarehouseId(nextWarehouseId);
                      setProducts([]);
                      if (nextWarehouseId) {
                        void searchProducts(searchTerm, nextWarehouseId);
                      }
                    }}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
                    required
                  >
                    <option value="">Select warehouse</option>
                    {warehouses.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.name} ({warehouse.code})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Search by product or SKU</span>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder="Scan-like SKU or type a product name"
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
                        disabled={!selectedWarehouseId}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={!selectedWarehouseId || isSearchingProducts}
                      className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                    >
                      {isSearchingProducts ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                      Search
                    </button>
                  </div>
                </label>
              </div>
            </form>
          </FormCard>

          <FormCard title="Available products" description="Add sellable stock directly from the selected warehouse inventory.">
            {!selectedWarehouseId ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-sm text-slate-500">
                Select a warehouse first to load POS products with live stock quantities.
              </div>
            ) : products.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-sm text-slate-500">
                {isSearchingProducts ? "Loading products..." : "No matching warehouse products found yet."}
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {products.map((product) => (
                  <article key={itemKey(product)} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold text-slate-950">{product.name}</h3>
                        <p className="mt-1 text-sm text-slate-500">{product.sku || "No SKU"}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddToCart(product)}
                        disabled={product.stock_quantity <= 0}
                        className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Add
                      </button>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-600">
                        Price: <span className="font-semibold text-slate-950">{formatCurrency(product.price)}</span>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-600">
                        Stock: <span className="font-semibold text-slate-950">{product.stock_quantity}</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </FormCard>
        </div>

        <div className="space-y-4">
          <FormCard
            title="Cart"
            description="Adjust quantities, confirm totals, and keep the checkout side ready for a fast cashier flow."
            action={
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <ShoppingCart className="h-5 w-5" />
              </div>
            }
          >
            <div className="space-y-3">
              {cart.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-sm text-slate-500">
                  Add products to start a POS sale.
                </div>
              ) : (
                cart.map((item) => (
                  <article key={itemKey(item)} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-950">{item.name}</h3>
                        <p className="mt-1 text-xs text-slate-500">{item.sku || "No SKU"}</p>
                        <p className="mt-2 text-sm text-slate-600">
                          Unit price <span className="font-semibold text-slate-950">{formatCurrency(item.price)}</span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFromCart(itemKey(item))}
                        className="rounded-full border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <div className="inline-flex items-center rounded-full border border-slate-200 bg-white">
                        <button
                          type="button"
                          onClick={() => updateCartQuantity(itemKey(item), item.quantity - 1)}
                          className="px-3 py-2 text-sm font-semibold text-slate-700"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="1"
                          max={item.stock_quantity}
                          value={item.quantity}
                          onChange={(event) => updateCartQuantity(itemKey(item), toNumber(event.target.value))}
                          className="w-16 border-x border-slate-200 bg-white px-2 py-2 text-center text-sm outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => updateCartQuantity(itemKey(item), item.quantity + 1)}
                          className="px-3 py-2 text-sm font-semibold text-slate-700"
                        >
                          +
                        </button>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500">Line total</p>
                        <p className="text-sm font-semibold text-slate-950">
                          {formatCurrency(toNumber(item.price) * item.quantity)}
                        </p>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>

            <div className="mt-4 grid gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <div className="flex items-center justify-between">
                <span>Subtotal</span>
                <span className="font-semibold text-slate-950">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Discount</span>
                <span className="font-semibold text-slate-950">{formatCurrency(discount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Total</span>
                <span className="font-semibold text-slate-950">{formatCurrency(total)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Paid amount</span>
                <span className="font-semibold text-slate-950">{formatCurrency(paidAmount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Due amount</span>
                <span className="font-semibold text-slate-950">{formatCurrency(dueAmount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Change amount</span>
                <span className="font-semibold text-slate-950">{formatCurrency(changeAmount)}</span>
              </div>
            </div>
          </FormCard>

          <FormCard title="Checkout" description="Capture customer, payment, and note details before finalizing the POS order.">
            <form onSubmit={handleCheckout} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block md:col-span-2">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Customer</span>
                  <select
                    value={checkoutForm.customer_id}
                    onChange={(event) => {
                      const nextCustomerId = event.target.value;
                      const selectedCustomer = customers.find((customer) => customer.id === nextCustomerId) || null;
                      setCheckoutForm((current) => ({
                        ...current,
                        customer_id: nextCustomerId,
                        customer_name: current.customer_name || selectedCustomer?.name || "",
                        customer_phone: current.customer_phone || selectedCustomer?.phone || "",
                      }));
                    }}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
                  >
                    <option value="">Walk-in / unlinked customer</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name} ({customer.phone})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Walk-in customer name</span>
                  <input
                    value={checkoutForm.customer_name}
                    onChange={(event) => setCheckoutForm((current) => ({ ...current, customer_name: event.target.value }))}
                    placeholder="Walk-in customer"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Phone</span>
                  <input
                    value={checkoutForm.customer_phone}
                    onChange={(event) => setCheckoutForm((current) => ({ ...current, customer_phone: event.target.value }))}
                    placeholder="017XXXXXXXX"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Payment method</span>
                  <select
                    value={checkoutForm.payment_method}
                    onChange={(event) => setCheckoutForm((current) => ({ ...current, payment_method: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
                  >
                    {["cash", "card", "mobile_banking", "bank_transfer", "due"].map((method) => (
                      <option key={method} value={method}>
                        {formatLabel(method)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Finance account</span>
                  <select
                    value={checkoutForm.account_id}
                    onChange={(event) => setCheckoutForm((current) => ({ ...current, account_id: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
                  >
                    <option value="">No finance account linked</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name} ({account.code})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Discount</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={checkoutForm.discount}
                    onChange={(event) => setCheckoutForm((current) => ({ ...current, discount: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Paid amount</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={checkoutForm.paid_amount}
                    onChange={(event) => setCheckoutForm((current) => ({ ...current, paid_amount: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
                  />
                </label>
                <label className="block md:col-span-2">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Notes</span>
                  <textarea
                    rows={3}
                    value={checkoutForm.notes}
                    onChange={(event) => setCheckoutForm((current) => ({ ...current, notes: event.target.value }))}
                    placeholder="Optional cashier or sale note"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"
                  />
                </label>
              </div>

              {selectedAccount ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  Selected account balance: <span className="font-semibold text-slate-950">{formatCurrency(selectedAccount.current_balance)}</span>
                </div>
              ) : null}

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                Payment status preview:{" "}
                <span className="font-semibold text-slate-950">
                  {dueAmount <= 0 ? "Paid" : paidAmount > 0 ? "Partial" : "Unpaid"}
                </span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || cart.length === 0 || !selectedWarehouseId}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
                Complete checkout
              </button>
            </form>

            {lastCheckout ? (
              <div className="mt-4 rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                <p className="font-semibold text-emerald-950">
                  Order {lastCheckout.order.order_number} created
                </p>
                <p className="mt-1">
                  Payment status {formatLabel(lastCheckout.payment_status)}. Due {formatCurrency(lastCheckout.due_amount)}. Change {formatCurrency(lastCheckout.change_amount)}.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={`/dashboard/orders/${lastCheckout.order_id}`}
                    className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
                  >
                    View Order
                  </Link>
                  <Link
                    href={`/dashboard/orders/${lastCheckout.order_id}/invoice`}
                    className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
                  >
                    Print Receipt/Invoice
                  </Link>
                </div>
              </div>
            ) : null}
          </FormCard>
        </div>
      </div>
    </div>
  );
}
