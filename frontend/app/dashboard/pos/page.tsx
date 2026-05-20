"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  PackageSearch,
  Receipt,
  RefreshCw,
  Search,
  ShoppingCart,
  Trash2,
  User,
} from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading-state";
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
  account_type?: string;
  accountType?: string;
  current_balance: number | string;
  balance?: number | string;
  is_active: boolean;
};

type PosProduct = {
  product_id: string | null;
  variant_id: string | null;
  name?: string;
  productName?: string;
  sku: string | null;
  barcode?: string | null;
  price: number | string;
  stock_quantity: number;
  stockLevel?: number;
  availableStock?: number;
  image_url?: string | null;
  imageUrl?: string | null;
  image?: string | null;
};

type CartItem = PosProduct & {
  quantity: number;
};

type PosSummary = {
  today_pos_orders?: number;
  todayPosOrders?: number;
  today_pos_sales?: number | string;
  todayPosSales?: number | string;
  today_paid_amount?: number | string;
  todayPaidAmount?: number | string;
  today_due_amount?: number | string;
  todayDueAmount?: number | string;
};

type CheckoutOrder = {
  id: string;
  order_number?: string;
  orderNumber?: string;
};

type PosCheckoutResponse = {
  order: CheckoutOrder;
  payment_status?: string;
  paymentStatus?: string;
  change_amount?: number | string;
  changeAmount?: number | string;
  due_amount?: number | string;
  dueAmount?: number | string;
  receipt_url?: string | null;
  receiptUrl?: string | null;
  order_id?: string;
  orderId?: string;
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

function getProductName(product: PosProduct) {
  return product.productName || product.name || "Unnamed product";
}

function getProductImage(product: PosProduct) {
  return product.imageUrl || product.image_url || product.image || null;
}

function getProductStock(product: PosProduct) {
  return product.availableStock ?? product.stockLevel ?? product.stock_quantity ?? 0;
}

function getSummaryOrders(summary: PosSummary | null) {
  return summary?.todayPosOrders ?? summary?.today_pos_orders ?? 0;
}

function getSummarySales(summary: PosSummary | null) {
  return summary?.todayPosSales ?? summary?.today_pos_sales ?? 0;
}

function getSummaryPaid(summary: PosSummary | null) {
  return summary?.todayPaidAmount ?? summary?.today_paid_amount ?? 0;
}

function getSummaryDue(summary: PosSummary | null) {
  return summary?.todayDueAmount ?? summary?.today_due_amount ?? 0;
}

function getCheckoutOrderNumber(response: PosCheckoutResponse | null) {
  return response?.order.orderNumber || response?.order.order_number || "";
}

function getCheckoutOrderId(response: PosCheckoutResponse | null) {
  return response?.orderId || response?.order_id || response?.order.id || "";
}

function getCheckoutPaymentStatus(response: PosCheckoutResponse | null) {
  return response?.paymentStatus || response?.payment_status || "pending";
}

function getCheckoutChangeAmount(response: PosCheckoutResponse | null) {
  return response?.changeAmount ?? response?.change_amount ?? 0;
}

function getCheckoutDueAmount(response: PosCheckoutResponse | null) {
  return response?.dueAmount ?? response?.due_amount ?? 0;
}

function getAccountBalance(account: Account | null) {
  if (!account) {
    return 0;
  }
  return account.balance ?? account.current_balance;
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
    const liveStock = getProductStock(product);
    if (liveStock <= 0) {
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
        itemKey(item) === key ? { ...item, quantity: Math.min(item.quantity + 1, getProductStock(item)) } : item,
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
            quantity: Math.max(1, Math.min(nextQuantity, getProductStock(item))),
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
          product_name: getProductName(item),
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
          ? `POS order ${getCheckoutOrderNumber(response)} created. Finance transaction recorded automatically for the paid amount.`
          : `POS order ${getCheckoutOrderNumber(response)} created successfully.`,
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
    <div className="min-w-0 space-y-5">
      <section className="rounded-[32px] border border-slate-200 bg-white px-6 py-7 shadow-[var(--shadow-soft)] sm:px-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-slate-500">Cash Counter</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">Point Of Sale</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-500">
              Run a warehouse-first counter sale with explicit payment capture, stock-safe checkout, and a direct handoff into order and invoice views.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void handleSummaryRefresh()}
              disabled={isRefreshingSummary}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-70"
            >
              {isRefreshingSummary ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[26px] border border-slate-200 bg-white px-5 py-5 shadow-[var(--shadow-soft)]">
          <p className="text-[10px] font-bold uppercase tracking-[0.26em] text-slate-500">Today POS Orders</p>
          <p className="mt-3 text-2xl font-black tracking-tight text-slate-950">{getSummaryOrders(summary)}</p>
          <p className="mt-2 text-xs font-medium text-slate-500">Counter orders today</p>
        </div>
        <div className="rounded-[26px] border border-slate-200 bg-white px-5 py-5 shadow-[var(--shadow-soft)]">
          <p className="text-[10px] font-bold uppercase tracking-[0.26em] text-slate-500">Today POS Sales</p>
          <p className="mt-3 text-2xl font-black tracking-tight text-slate-950">{formatCurrency(getSummarySales(summary))}</p>
          <p className="mt-2 text-xs font-medium text-slate-500">Gross counter sales</p>
        </div>
        <div className="rounded-[26px] border border-slate-200 bg-white px-5 py-5 shadow-[var(--shadow-soft)]">
          <p className="text-[10px] font-bold uppercase tracking-[0.26em] text-slate-500">Today Paid</p>
          <p className="mt-3 text-2xl font-black tracking-tight text-slate-950">{formatCurrency(getSummaryPaid(summary))}</p>
          <p className="mt-2 text-xs font-medium text-slate-500">Collected amount</p>
        </div>
        <div className="rounded-[26px] border border-slate-200 bg-white px-5 py-5 shadow-[var(--shadow-soft)]">
          <p className="text-[10px] font-bold uppercase tracking-[0.26em] text-slate-500">Today Due</p>
          <p className="mt-3 text-2xl font-black tracking-tight text-slate-950">{formatCurrency(getSummaryDue(summary))}</p>
          <p className="mt-2 text-xs font-medium text-slate-500">Outstanding amount</p>
        </div>
      </section>

      {error ? <ErrorAlert message={error} /> : null}
      {success ? (
        <div className="rounded-[28px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-700 shadow-[var(--shadow-soft)]">
          {success}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
        <section className="space-y-5">
          <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
            <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-slate-950">Product Search</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Choose the selling warehouse first, then search by product name, barcode, or SKU.
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <PackageSearch className="h-5 w-5" />
              </div>
            </div>

            <form onSubmit={handleSearchSubmit} className="mt-6 grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">Warehouse</span>
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
                  className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
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
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">Search</span>
                <div className="flex gap-2">
                  <div className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Product, barcode, or SKU"
                      className="w-full rounded-full border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-slate-400"
                      disabled={!selectedWarehouseId}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!selectedWarehouseId || isSearchingProducts}
                    className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                  >
                    {isSearchingProducts ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    Search
                  </button>
                </div>
              </label>
            </form>
          </section>

          <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
            <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-slate-950">Product Results</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Add sellable stock directly from the selected warehouse inventory.
                </p>
              </div>
              <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                {products.length} visible
              </div>
            </div>

            <div className="mt-6">
              {!selectedWarehouseId ? (
                <EmptyState
                  title="Select a warehouse first"
                  description="POS products will load once the selling warehouse is selected."
                />
              ) : products.length === 0 ? (
                <EmptyState
                  title={isSearchingProducts ? "Loading products..." : "No products found"}
                  description="Try another search term or check warehouse stock."
                />
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {products.map((product) => {
                    const liveStock = getProductStock(product);
                    const image = getProductImage(product);
                    return (
                      <article key={itemKey(product)} className="rounded-[26px] border border-slate-200 bg-slate-50 p-4">
                        <div className="flex gap-4">
                          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white">
                            {image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={image} alt={getProductName(product)} className="h-full w-full object-cover" />
                            ) : (
                              <PackageSearch className="h-5 w-5 text-slate-400" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <h3 className="truncate text-sm font-semibold text-slate-950">{getProductName(product)}</h3>
                                <p className="mt-1 text-xs text-slate-500">
                                  {product.sku || "No SKU"}
                                  {product.barcode ? ` · ${product.barcode}` : ""}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleAddToCart(product)}
                                disabled={liveStock <= 0}
                                className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Add
                              </button>
                            </div>
                            <div className="mt-4 grid gap-2 sm:grid-cols-2">
                              <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-600">
                                Price: <span className="font-semibold text-slate-950">{formatCurrency(product.price)}</span>
                              </div>
                              <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-600">
                                Stock: <span className="font-semibold text-slate-950">{liveStock}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </section>

        <section className="space-y-5">
          <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
            <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-lg font-bold tracking-tight text-slate-950">Cart</h2>
                <p className="mt-1 text-sm text-slate-500">Adjust quantities and watch totals update before checkout.</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <ShoppingCart className="h-5 w-5" />
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {cart.length === 0 ? (
                <EmptyState title="Cart is empty" description="Add products from the warehouse results to start a sale." />
              ) : (
                cart.map((item) => (
                  <article key={itemKey(item)} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-slate-950">{getProductName(item)}</h3>
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
                          max={getProductStock(item)}
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

            <div className="mt-5 grid gap-3 rounded-[26px] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
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
                <span>Paid Amount</span>
                <span className="font-semibold text-slate-950">{formatCurrency(paidAmount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Due Amount</span>
                <span className="font-semibold text-slate-950">{formatCurrency(dueAmount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Change Amount</span>
                <span className="font-semibold text-slate-950">{formatCurrency(changeAmount)}</span>
              </div>
            </div>
          </section>

          <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
            <div className="flex flex-col gap-3 border-b border-slate-200 pb-4">
              <h2 className="text-lg font-bold tracking-tight text-slate-950">Checkout</h2>
              <p className="text-sm text-slate-500">
                Keep checkout explicit: select customer context, payment method, and optional finance capture before finalizing the sale.
              </p>
            </div>

            <form onSubmit={handleCheckout} className="mt-6 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block md:col-span-2">
                  <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">Customer</span>
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
                    className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
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
                  <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">Walk-In Name</span>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={checkoutForm.customer_name}
                      onChange={(event) => setCheckoutForm((current) => ({ ...current, customer_name: event.target.value }))}
                      placeholder="Walk-in customer"
                      className="w-full rounded-full border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-slate-400"
                    />
                  </div>
                </label>
                <label className="block">
                  <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">Phone</span>
                  <input
                    value={checkoutForm.customer_phone}
                    onChange={(event) => setCheckoutForm((current) => ({ ...current, customer_phone: event.target.value }))}
                    placeholder="017XXXXXXXX"
                    className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                  />
                </label>
              </div>

              <div>
                <span className="mb-3 block text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">Payment Method</span>
                <div className="grid grid-cols-3 gap-2">
                  {["cash", "card", "mobile_banking", "bank_transfer", "due"].map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setCheckoutForm((current) => ({ ...current, payment_method: method }))}
                      className={`rounded-2xl border px-3 py-3 text-xs font-bold transition ${
                        checkoutForm.payment_method === method
                          ? "border-slate-950 bg-slate-950 text-white"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {formatLabel(method)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">Finance Account</span>
                  <select
                    value={checkoutForm.account_id}
                    onChange={(event) => setCheckoutForm((current) => ({ ...current, account_id: event.target.value }))}
                    className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
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
                  <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">Discount</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={checkoutForm.discount}
                    onChange={(event) => setCheckoutForm((current) => ({ ...current, discount: event.target.value }))}
                    className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">Paid Amount</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={checkoutForm.paid_amount}
                    onChange={(event) => setCheckoutForm((current) => ({ ...current, paid_amount: event.target.value }))}
                    className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                  />
                </label>
                <label className="block md:col-span-2">
                  <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">Notes</span>
                  <textarea
                    rows={3}
                    value={checkoutForm.notes}
                    onChange={(event) => setCheckoutForm((current) => ({ ...current, notes: event.target.value }))}
                    placeholder="Optional cashier note"
                    className="w-full rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                  />
                </label>
              </div>

              {selectedAccount ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  Selected account balance:{" "}
                  <span className="font-semibold text-slate-950">{formatCurrency(getAccountBalance(selectedAccount))}</span>
                </div>
              ) : null}

              <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-800">
                Checkout deducts stock immediately through the current POS backend flow. If a finance account is selected, the paid amount can also create a linked finance transaction.
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                Payment status preview:{" "}
                <span className="font-semibold text-slate-950">
                  {dueAmount <= 0 ? "Paid" : paidAmount > 0 ? "Partial" : "Unpaid"}
                </span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || cart.length === 0 || !selectedWarehouseId}
                className="flex w-full items-center justify-center gap-2 rounded-[22px] bg-slate-950 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
                Complete Checkout
              </button>
            </form>

            {lastCheckout ? (
              <div className="mt-5 rounded-[26px] border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                <p className="font-semibold text-emerald-950">Order {getCheckoutOrderNumber(lastCheckout)} created</p>
                <p className="mt-1">
                  Payment status {formatLabel(getCheckoutPaymentStatus(lastCheckout))}. Due{" "}
                  {formatCurrency(getCheckoutDueAmount(lastCheckout))}. Change{" "}
                  {formatCurrency(getCheckoutChangeAmount(lastCheckout))}.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={`/dashboard/orders/${getCheckoutOrderId(lastCheckout)}`}
                    className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
                  >
                    View Order
                  </Link>
                  <Link
                    href={`/dashboard/orders/${getCheckoutOrderId(lastCheckout)}/invoice`}
                    className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
                  >
                    Print Receipt/Invoice
                  </Link>
                </div>
              </div>
            ) : null}
          </section>
        </section>
      </div>
    </div>
  );
}
