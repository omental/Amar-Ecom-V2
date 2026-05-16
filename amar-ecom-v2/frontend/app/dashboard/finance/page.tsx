"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Building2,
  CreditCard,
  Download,
  Landmark,
  Loader2,
  ReceiptText,
  RefreshCw,
  Wallet,
} from "lucide-react";

import { ErrorAlert } from "@/components/ui/error-alert";
import { FormCard } from "@/components/ui/form-card";
import { LoadingState } from "@/components/ui/loading-state";
import { OpsActionButton } from "@/components/ui/ops-action-button";
import { OpsFilterBar } from "@/components/ui/ops-filter-bar";
import { OpsPageHeader } from "@/components/ui/ops-page-header";
import { OpsSummaryCard } from "@/components/ui/ops-summary-card";
import { OpsTabs } from "@/components/ui/ops-tabs";
import { api, ApiError } from "@/lib/api";
import { formatCurrency, formatDateTime, formatLabel } from "@/lib/format";

type Account = {
  id: string;
  name: string;
  code: string;
  account_type: string;
  opening_balance: number | string;
  current_balance: number | string;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type Transaction = {
  id: string;
  transaction_number: string;
  account_id: string;
  related_account_id: string | null;
  transaction_type: string;
  category: string | null;
  amount: number | string;
  direction: string;
  reference_type: string | null;
  reference_id: string | null;
  description: string | null;
  transaction_date: string;
  account: Account;
  related_account: Account | null;
};

type PettyCashEntry = {
  id: string;
  entry_number: string;
  account_id: string | null;
  transaction_id: string | null;
  transaction_created: boolean;
  entry_type: string;
  amount: number | string;
  purpose: string;
  spent_by: string | null;
  approved_by_id: string | null;
  status: string;
  entry_date: string;
  account: Account | null;
};

type Supplier = {
  id: string;
  name: string;
};

type SupplierPayment = {
  id: string;
  supplier_id: string | null;
  account_id: string;
  transaction_id: string | null;
  payment_number: string;
  amount: number | string;
  payment_method: string | null;
  reference: string | null;
  notes: string | null;
  payment_date: string;
  supplier: Supplier | null;
  account: Account;
  transaction: Transaction | null;
};

type FinanceSummary = {
  total_cash_bank_balance: number | string;
  total_income: number | string;
  total_expense: number | string;
  net_cash_flow: number | string;
  pending_petty_cash_count: number;
  supplier_payments_total: number | string;
  recent_transactions: Transaction[];
};

type AccountForm = {
  name: string;
  code: string;
  account_type: string;
  opening_balance: string;
  notes: string;
  is_active: boolean;
};

type TransactionForm = {
  transaction_number: string;
  account_id: string;
  related_account_id: string;
  transaction_type: string;
  category: string;
  amount: string;
  direction: string;
  description: string;
  transaction_date: string;
};

type PettyCashForm = {
  entry_number: string;
  account_id: string;
  entry_type: string;
  amount: string;
  purpose: string;
  spent_by: string;
  status: string;
  entry_date: string;
};

type SupplierPaymentForm = {
  supplier_id: string;
  account_id: string;
  payment_number: string;
  amount: string;
  payment_method: string;
  reference: string;
  notes: string;
  payment_date: string;
};

type SummaryFilters = {
  date_from: string;
  date_to: string;
};

type TransactionFilters = {
  account_id: string;
  transaction_type: string;
  direction: string;
  date_from: string;
  date_to: string;
  search: string;
};

const tabs = [
  { id: "overview", label: "Overview", icon: Wallet },
  { id: "accounts", label: "Accounts", icon: Landmark },
  { id: "transactions", label: "Transactions", icon: ReceiptText },
  { id: "petty-cash", label: "Petty Cash", icon: CreditCard },
  { id: "supplier-payments", label: "Supplier Payments", icon: Building2 },
] as const;

type TabId = (typeof tabs)[number]["id"];

const initialAccountForm: AccountForm = {
  name: "",
  code: "",
  account_type: "cash",
  opening_balance: "0",
  notes: "",
  is_active: true,
};

const initialTransactionForm: TransactionForm = {
  transaction_number: "",
  account_id: "",
  related_account_id: "",
  transaction_type: "income",
  category: "",
  amount: "",
  direction: "in",
  description: "",
  transaction_date: "",
};

const initialPettyCashForm: PettyCashForm = {
  entry_number: "",
  account_id: "",
  entry_type: "expense",
  amount: "",
  purpose: "",
  spent_by: "",
  status: "pending",
  entry_date: "",
};

const initialSupplierPaymentForm: SupplierPaymentForm = {
  supplier_id: "",
  account_id: "",
  payment_number: "",
  amount: "",
  payment_method: "",
  reference: "",
  notes: "",
  payment_date: "",
};

const initialSummaryFilters: SummaryFilters = {
  date_from: "",
  date_to: "",
};

const initialTransactionFilters: TransactionFilters = {
  account_id: "",
  transaction_type: "",
  direction: "",
  date_from: "",
  date_to: "",
  search: "",
};

function buildQuery(params: Record<string, string | number | undefined | null>) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      searchParams.set(key, String(value));
    }
  });
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number | null | undefined>>) {
  const escapeCell = (value: string | number | null | undefined) => {
    const text = String(value ?? "");
    if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
      return `"${text.replaceAll("\"", "\"\"")}"`;
    }
    return text;
  };

  const csv = [headers, ...rows].map((row) => row.map(escapeCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
}

function inputToApiDate(value: string) {
  return value ? new Date(value).toISOString() : undefined;
}

export default function FinancePage() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pettyCashEntries, setPettyCashEntries] = useState<PettyCashEntry[]>([]);
  const [supplierPayments, setSupplierPayments] = useState<SupplierPayment[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [accountForm, setAccountForm] = useState<AccountForm>(initialAccountForm);
  const [transactionForm, setTransactionForm] = useState<TransactionForm>(initialTransactionForm);
  const [pettyCashForm, setPettyCashForm] = useState<PettyCashForm>(initialPettyCashForm);
  const [supplierPaymentForm, setSupplierPaymentForm] = useState<SupplierPaymentForm>(initialSupplierPaymentForm);
  const [summaryFilters, setSummaryFilters] = useState<SummaryFilters>(initialSummaryFilters);
  const [transactionFilters, setTransactionFilters] = useState<TransactionFilters>(initialTransactionFilters);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshingOverview, setIsRefreshingOverview] = useState(false);
  const [isRefreshingTransactions, setIsRefreshingTransactions] = useState(false);
  const [isSavingAccount, setIsSavingAccount] = useState(false);
  const [isSavingTransaction, setIsSavingTransaction] = useState(false);
  const [isSavingPettyCash, setIsSavingPettyCash] = useState(false);
  const [isSavingSupplierPayment, setIsSavingSupplierPayment] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function refreshOverview(filters: SummaryFilters = summaryFilters) {
    const summaryData = await api.get<FinanceSummary>(
      `/finance/summary${buildQuery({
        date_from: inputToApiDate(filters.date_from),
        date_to: inputToApiDate(filters.date_to),
      })}`,
    );
    setSummary(summaryData);
  }

  async function refreshTransactions(filters: TransactionFilters = transactionFilters) {
    const transactionData = await api.get<Transaction[]>(
      `/transactions${buildQuery({
        skip: 0,
        limit: 100,
        account_id: filters.account_id,
        transaction_type: filters.transaction_type,
        direction: filters.direction,
        date_from: inputToApiDate(filters.date_from),
        date_to: inputToApiDate(filters.date_to),
        search: filters.search,
      })}`,
    );
    setTransactions(transactionData);
  }

  async function loadReferenceData() {
    const [accountData, pettyCashData, supplierPaymentData, supplierData] = await Promise.all([
      api.get<Account[]>("/accounts?skip=0&limit=100"),
      api.get<PettyCashEntry[]>("/petty-cash?skip=0&limit=100"),
      api.get<SupplierPayment[]>("/supplier-payments?skip=0&limit=100"),
      api.get<Supplier[]>("/suppliers?skip=0&limit=100").catch(() => []),
    ]);

    setAccounts(accountData);
    setPettyCashEntries(pettyCashData);
    setSupplierPayments(supplierPaymentData);
    setSuppliers(supplierData);
  }

  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      try {
        const [
          summaryData,
          transactionData,
          accountData,
          pettyCashData,
          supplierPaymentData,
          supplierData,
        ] = await Promise.all([
          api.get<FinanceSummary>("/finance/summary"),
          api.get<Transaction[]>("/transactions?skip=0&limit=100"),
          api.get<Account[]>("/accounts?skip=0&limit=100"),
          api.get<PettyCashEntry[]>("/petty-cash?skip=0&limit=100"),
          api.get<SupplierPayment[]>("/supplier-payments?skip=0&limit=100"),
          api.get<Supplier[]>("/suppliers?skip=0&limit=100").catch(() => []),
        ]);
        if (!isMounted) return;
        setSummary(summaryData);
        setTransactions(transactionData);
        setAccounts(accountData);
        setPettyCashEntries(pettyCashData);
        setSupplierPayments(supplierPaymentData);
        setSuppliers(supplierData);
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof ApiError ? err.message : "Failed to load finance workspace");
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

  function populateAccountForm(account: Account) {
    setEditingAccountId(account.id);
    setAccountForm({
      name: account.name,
      code: account.code,
      account_type: account.account_type,
      opening_balance: String(account.opening_balance),
      notes: account.notes || "",
      is_active: account.is_active,
    });
    setActiveTab("accounts");
  }

  function clearMessages() {
    setError("");
    setSuccess("");
  }

  async function handleOverviewRefresh() {
    clearMessages();
    setIsRefreshingOverview(true);
    try {
      await refreshOverview();
      setSuccess("Finance summary refreshed.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to refresh finance summary");
    } finally {
      setIsRefreshingOverview(false);
    }
  }

  async function handleTransactionRefresh(filters: TransactionFilters = transactionFilters) {
    clearMessages();
    setIsRefreshingTransactions(true);
    try {
      await refreshTransactions(filters);
      setSuccess("Transaction list refreshed.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to refresh transactions");
    } finally {
      setIsRefreshingTransactions(false);
    }
  }

  async function handleAccountSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearMessages();
    setIsSavingAccount(true);
    try {
      if (editingAccountId) {
        await api.patch<Account>(`/accounts/${editingAccountId}`, {
          name: accountForm.name,
          code: accountForm.code,
          account_type: accountForm.account_type,
          notes: accountForm.notes || null,
          is_active: accountForm.is_active,
        });
        setSuccess("Account updated.");
      } else {
        await api.post<Account>("/accounts", {
          name: accountForm.name,
          code: accountForm.code,
          account_type: accountForm.account_type,
          opening_balance: Number(accountForm.opening_balance || 0),
          notes: accountForm.notes || null,
          is_active: accountForm.is_active,
        });
        setSuccess("Account created.");
      }
      setAccountForm(initialAccountForm);
      setEditingAccountId(null);
      await loadReferenceData();
      await refreshOverview();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save account");
    } finally {
      setIsSavingAccount(false);
    }
  }

  async function handleDeactivateAccount(accountId: string) {
    setBusyId(accountId);
    clearMessages();
    try {
      await api.delete(`/accounts/${accountId}`);
      await loadReferenceData();
      await refreshOverview();
      setSuccess("Account deactivated.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to deactivate account");
    } finally {
      setBusyId(null);
    }
  }

  async function handleTransactionSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearMessages();
    setIsSavingTransaction(true);
    try {
      await api.post<Transaction>("/transactions", {
        transaction_number: transactionForm.transaction_number,
        account_id: transactionForm.account_id,
        related_account_id: transactionForm.related_account_id || null,
        transaction_type: transactionForm.transaction_type,
        category: transactionForm.category || null,
        amount: Number(transactionForm.amount),
        direction: transactionForm.direction,
        description: transactionForm.description || null,
        transaction_date: inputToApiDate(transactionForm.transaction_date) || null,
      });
      setTransactionForm(initialTransactionForm);
      await Promise.all([refreshTransactions(), refreshOverview(), loadReferenceData()]);
      setSuccess("Transaction created.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create transaction");
    } finally {
      setIsSavingTransaction(false);
    }
  }

  async function handlePettyCashSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearMessages();
    if (
      pettyCashForm.account_id &&
      ["approved", "settled"].includes(pettyCashForm.status) &&
      !window.confirm(
        "Approving/settling will create a petty cash transaction and reduce the selected account balance.",
      )
    ) {
      return;
    }

    setIsSavingPettyCash(true);
    try {
      const entry = await api.post<PettyCashEntry>("/petty-cash", {
        entry_number: pettyCashForm.entry_number,
        account_id: pettyCashForm.account_id || null,
        entry_type: pettyCashForm.entry_type,
        amount: Number(pettyCashForm.amount),
        purpose: pettyCashForm.purpose,
        spent_by: pettyCashForm.spent_by || null,
        status: pettyCashForm.status,
        entry_date: inputToApiDate(pettyCashForm.entry_date) || null,
      });
      setPettyCashForm(initialPettyCashForm);
      await Promise.all([loadReferenceData(), refreshTransactions(), refreshOverview()]);
      setSuccess(
        entry.transaction_created
          ? "Petty cash entry created. A linked transaction was recorded automatically."
          : "Petty cash entry created.",
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create petty cash entry");
    } finally {
      setIsSavingPettyCash(false);
    }
  }

  async function handlePettyCashStatusUpdate(entry: PettyCashEntry, status: string) {
    clearMessages();
    if (
      entry.account_id &&
      ["approved", "settled"].includes(status) &&
      entry.status !== status &&
      !window.confirm(
        "Approving/settling will create a petty cash transaction and reduce the selected account balance.",
      )
    ) {
      return;
    }

    setBusyId(entry.id);
    try {
      const updatedEntry = await api.patch<PettyCashEntry>(`/petty-cash/${entry.id}`, { status });
      await Promise.all([loadReferenceData(), refreshTransactions(), refreshOverview()]);
      setSuccess(
        updatedEntry.transaction_created
          ? "Petty cash status updated. A linked transaction was recorded."
          : "Petty cash status updated.",
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update petty cash status");
    } finally {
      setBusyId(null);
    }
  }

  async function handleSupplierPaymentSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearMessages();
    setIsSavingSupplierPayment(true);
    try {
      const payment = await api.post<SupplierPayment>("/supplier-payments", {
        supplier_id: supplierPaymentForm.supplier_id || null,
        account_id: supplierPaymentForm.account_id,
        payment_number: supplierPaymentForm.payment_number,
        amount: Number(supplierPaymentForm.amount),
        payment_method: supplierPaymentForm.payment_method || null,
        reference: supplierPaymentForm.reference || null,
        notes: supplierPaymentForm.notes || null,
        payment_date: inputToApiDate(supplierPaymentForm.payment_date) || null,
      });
      setSupplierPaymentForm(initialSupplierPaymentForm);
      await Promise.all([loadReferenceData(), refreshTransactions(), refreshOverview()]);
      setSuccess(
        `Supplier payment created. Transaction ${payment.transaction?.transaction_number || payment.transaction_id || ""} recorded automatically. Account balance is now ${formatCurrency(payment.account.current_balance)}.`,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create supplier payment");
    } finally {
      setIsSavingSupplierPayment(false);
    }
  }

  const selectedSupplierPaymentAccount =
    accounts.find((account) => account.id === supplierPaymentForm.account_id) || null;

  if (isLoading) {
    return <LoadingState label="Loading finance workspace..." />;
  }

  return (
    <div className="space-y-5">
      <section className="card-base p-6 sm:p-8">
        <OpsPageHeader
          eyebrow="Finance Console"
          title="Finance workspace"
          description="Run the practical finance foundation with linked supplier payment and petty cash transactions, clearer account groupings, and browser-side CSV exports."
          meta="Overview, accounts, transactions, petty cash, and supplier payments"
          actions={
            <OpsActionButton
              type="button"
              variant="secondary"
              onClick={() => void handleOverviewRefresh()}
              disabled={isRefreshingOverview}
            >
              {isRefreshingOverview ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh overview
            </OpsActionButton>
          }
        />
      </section>

      <OpsTabs tabs={tabs.map((tab) => ({ id: tab.id, label: tab.label }))} activeTab={activeTab} onChange={(id) => setActiveTab(id as TabId)} />

      {error ? <ErrorAlert message={error} /> : null}
      {success ? (
        <div className="rounded-[28px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-700 shadow-[var(--shadow-soft)]">
          {success}
        </div>
      ) : null}

      {activeTab === "overview" && summary ? (
        <div className="space-y-4">
          <OpsFilterBar title="Finance Filters" description="Filter income, expense, supplier payment totals, and net cash flow by date range before reviewing recent movement.">
              <label className="block min-w-[220px] flex-1">
                <span className="mb-2 block text-sm font-medium text-slate-700">Date from</span>
                <input type="datetime-local" value={summaryFilters.date_from} onChange={(event) => setSummaryFilters((current) => ({ ...current, date_from: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" />
              </label>
              <label className="block min-w-[220px] flex-1">
                <span className="mb-2 block text-sm font-medium text-slate-700">Date to</span>
                <input type="datetime-local" value={summaryFilters.date_to} onChange={(event) => setSummaryFilters((current) => ({ ...current, date_to: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" />
              </label>
              <div className="flex items-end gap-2">
                <OpsActionButton type="button" variant="primary" onClick={() => void handleOverviewRefresh()} disabled={isRefreshingOverview}>
                  {isRefreshingOverview ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Refresh
                </OpsActionButton>
              </div>
          </OpsFilterBar>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <OpsSummaryCard label="Cash / Bank Balance" value={formatCurrency(summary.total_cash_bank_balance)} icon={Wallet} eyebrow="Liquidity" />
            <OpsSummaryCard label="Total Income" value={formatCurrency(summary.total_income)} icon={Landmark} eyebrow="Inflow" tone="success" />
            <OpsSummaryCard label="Total Expense" value={formatCurrency(summary.total_expense)} icon={ReceiptText} eyebrow="Outflow" tone="warning" />
            <OpsSummaryCard label="Net Cash Flow" value={formatCurrency(summary.net_cash_flow)} icon={CreditCard} eyebrow="Net Position" tone={Number(summary.net_cash_flow) >= 0 ? "info" : "danger"} />
            <OpsSummaryCard label="Pending Petty Cash" value={String(summary.pending_petty_cash_count)} icon={CreditCard} eyebrow="Review Queue" tone="warning" helper="Pending requests still need finance review." />
            <OpsSummaryCard label="Supplier Payments" value={formatCurrency(summary.supplier_payments_total)} icon={Building2} eyebrow="Procurement" helper="Supplier payment saves can create linked transactions." />
          </section>

          <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-800 shadow-[var(--shadow-subtle)]">
            Petty cash and supplier-payment actions can affect linked finance transactions. Double-check account and amount fields before saving.
          </div>

          <FormCard title="Recent transactions" description="This list stays lightweight for day-to-day monitoring while the summary cards respect the selected date range.">
            <div className="space-y-3">
              {summary.recent_transactions.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                  No finance transactions yet.
                </div>
              ) : (
                summary.recent_transactions.map((transaction) => (
                  <div key={transaction.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-950">{transaction.transaction_number}</p>
                        <p className="mt-1 text-slate-500">
                          {transaction.account.name}
                          {transaction.related_account ? ` -> ${transaction.related_account.name}` : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-slate-950">{formatCurrency(transaction.amount)}</p>
                        <p className="mt-1 text-slate-500">{formatLabel(transaction.transaction_type)}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </FormCard>
        </div>
      ) : null}

      {activeTab === "accounts" ? (
        <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <FormCard title={editingAccountId ? "Edit account" : "Create account"} description="Track practical cash, bank, mobile banking, receivable, payable, income, and expense buckets.">
            <form onSubmit={handleAccountSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Name</span>
                  <input value={accountForm.name} onChange={(event) => setAccountForm((current) => ({ ...current, name: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" required />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Code</span>
                  <input value={accountForm.code} onChange={(event) => setAccountForm((current) => ({ ...current, code: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" required />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Account type</span>
                  <select value={accountForm.account_type} onChange={(event) => setAccountForm((current) => ({ ...current, account_type: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white">
                    {["cash", "bank", "mobile_banking", "receivable", "payable", "expense", "income", "other"].map((value) => (
                      <option key={value} value={value}>{formatLabel(value)}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Opening balance</span>
                  <input type="number" step="0.01" value={accountForm.opening_balance} onChange={(event) => setAccountForm((current) => ({ ...current, opening_balance: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" disabled={Boolean(editingAccountId)} />
                </label>
                <label className="block md:col-span-2">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Notes</span>
                  <textarea rows={3} value={accountForm.notes} onChange={(event) => setAccountForm((current) => ({ ...current, notes: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" />
                </label>
                <label className="inline-flex items-center gap-3 text-sm font-medium text-slate-700">
                  <input type="checkbox" checked={accountForm.is_active} onChange={(event) => setAccountForm((current) => ({ ...current, is_active: event.target.checked }))} className="h-4 w-4 rounded border-slate-300" />
                  Account is active
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={isSavingAccount} className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60">
                  {isSavingAccount ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {editingAccountId ? "Save account" : "Create account"}
                </button>
                {editingAccountId ? (
                  <button type="button" onClick={() => { setEditingAccountId(null); setAccountForm(initialAccountForm); }} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                    Cancel edit
                  </button>
                ) : null}
              </div>
            </form>
          </FormCard>

          <FormCard title="Accounts" description="Export the currently loaded account list or edit/deactivate accounts in place.">
            <div className="mb-4 flex justify-end">
              <button type="button" onClick={() => downloadCsv("accounts.csv", ["Name", "Code", "Type", "Opening Balance", "Current Balance", "Active", "Notes"], accounts.map((account) => [account.name, account.code, account.account_type, account.opening_balance, account.current_balance, account.is_active ? "Yes" : "No", account.notes]))} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                <Download className="h-4 w-4" />
                Accounts CSV
              </button>
            </div>
            <div className="space-y-3">
              {accounts.map((account) => (
                <div key={account.id} className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-slate-950">{account.name}</h3>
                      <p className="mt-1 text-sm text-slate-500">{account.code} · {formatLabel(account.account_type)}</p>
                      <p className="mt-2 text-sm text-slate-600">{account.notes || "No notes"}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-slate-950">{formatCurrency(account.current_balance)}</p>
                      <p className="mt-1 text-sm text-slate-500">{account.is_active ? "Active" : "Inactive"}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" onClick={() => populateAccountForm(account)} className="rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white">Edit</button>
                    {account.is_active ? (
                      <button type="button" onClick={() => void handleDeactivateAccount(account.id)} disabled={busyId === account.id} className="rounded-full border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-60">Deactivate</button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </FormCard>
        </div>
      ) : null}

      {activeTab === "transactions" ? (
        <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <FormCard title="Create transaction" description="Record direct income, expense, transfer, refund, customer payment, and adjustment activity.">
            <form onSubmit={handleTransactionSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Transaction number</span><input value={transactionForm.transaction_number} onChange={(event) => setTransactionForm((current) => ({ ...current, transaction_number: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" required /></label>
                <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Account</span><select value={transactionForm.account_id} onChange={(event) => setTransactionForm((current) => ({ ...current, account_id: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" required><option value="">Select account</option>{accounts.filter((item) => item.is_active).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
                <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Transaction type</span><select value={transactionForm.transaction_type} onChange={(event) => { const value = event.target.value; setTransactionForm((current) => ({ ...current, transaction_type: value, direction: value === "transfer" ? "out" : value === "income" || value === "customer_payment" ? "in" : current.direction })); }} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white">{["income", "expense", "transfer", "supplier_payment", "customer_payment", "refund", "petty_cash", "adjustment"].map((value) => <option key={value} value={value}>{formatLabel(value)}</option>)}</select></label>
                <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Direction</span><select value={transactionForm.direction} onChange={(event) => setTransactionForm((current) => ({ ...current, direction: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"><option value="in">In</option><option value="out">Out</option></select></label>
                {transactionForm.transaction_type === "transfer" ? (
                  <label className="block md:col-span-2"><span className="mb-2 block text-sm font-medium text-slate-700">Destination account</span><select value={transactionForm.related_account_id} onChange={(event) => setTransactionForm((current) => ({ ...current, related_account_id: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" required><option value="">Select destination account</option>{accounts.filter((item) => item.is_active).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
                ) : null}
                <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Category</span><input value={transactionForm.category} onChange={(event) => setTransactionForm((current) => ({ ...current, category: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" /></label>
                <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Amount</span><input type="number" step="0.01" value={transactionForm.amount} onChange={(event) => setTransactionForm((current) => ({ ...current, amount: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" required /></label>
                <label className="block md:col-span-2"><span className="mb-2 block text-sm font-medium text-slate-700">Description</span><textarea rows={3} value={transactionForm.description} onChange={(event) => setTransactionForm((current) => ({ ...current, description: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" /></label>
                <label className="block md:col-span-2"><span className="mb-2 block text-sm font-medium text-slate-700">Transaction date</span><input type="datetime-local" value={transactionForm.transaction_date} onChange={(event) => setTransactionForm((current) => ({ ...current, transaction_date: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" /></label>
              </div>
              <button type="submit" disabled={isSavingTransaction} className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60">{isSavingTransaction ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Create transaction</button>
            </form>
          </FormCard>

          <FormCard title="Transactions" description="Filter operational finance activity and export the loaded result set to CSV.">
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Account</span><select value={transactionFilters.account_id} onChange={(event) => setTransactionFilters((current) => ({ ...current, account_id: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"><option value="">All accounts</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
                <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Transaction type</span><select value={transactionFilters.transaction_type} onChange={(event) => setTransactionFilters((current) => ({ ...current, transaction_type: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"><option value="">All types</option>{["income", "expense", "transfer", "supplier_payment", "customer_payment", "refund", "petty_cash", "adjustment"].map((value) => <option key={value} value={value}>{formatLabel(value)}</option>)}</select></label>
                <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Direction</span><select value={transactionFilters.direction} onChange={(event) => setTransactionFilters((current) => ({ ...current, direction: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"><option value="">All directions</option><option value="in">In</option><option value="out">Out</option></select></label>
                <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Search</span><input value={transactionFilters.search} onChange={(event) => setTransactionFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Number, description, or category" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" /></label>
                <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Date from</span><input type="datetime-local" value={transactionFilters.date_from} onChange={(event) => setTransactionFilters((current) => ({ ...current, date_from: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" /></label>
                <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Date to</span><input type="datetime-local" value={transactionFilters.date_to} onChange={(event) => setTransactionFilters((current) => ({ ...current, date_to: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" /></label>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void handleTransactionRefresh()} disabled={isRefreshingTransactions} className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60">
                  {isRefreshingTransactions ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Refresh
                </button>
                <button type="button" onClick={() => { setTransactionFilters(initialTransactionFilters); void handleTransactionRefresh(initialTransactionFilters); }} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Clear filters</button>
                <button type="button" onClick={() => downloadCsv("transactions.csv", ["Transaction Number", "Type", "Direction", "Account", "Related Account", "Amount", "Category", "Reference Type", "Reference ID", "Description", "Transaction Date"], transactions.map((transaction) => [transaction.transaction_number, transaction.transaction_type, transaction.direction, transaction.account.name, transaction.related_account?.name || "", transaction.amount, transaction.category, transaction.reference_type, transaction.reference_id, transaction.description, transaction.transaction_date]))} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                  <Download className="h-4 w-4" />
                  Transactions CSV
                </button>
              </div>
              <div className="space-y-3">
                {transactions.map((transaction) => (
                  <div key={transaction.id} className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold text-slate-950">{transaction.transaction_number}</h3>
                        <p className="mt-1 text-sm text-slate-500">{formatLabel(transaction.transaction_type)} · {formatLabel(transaction.direction)}</p>
                        <p className="mt-2 text-sm text-slate-600">{transaction.account.name}{transaction.related_account ? ` -> ${transaction.related_account.name}` : ""}</p>
                        <p className="mt-2 text-sm text-slate-500">{transaction.description || "No description"}</p>
                        {transaction.reference_type ? (
                          <p className="mt-1 text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                            {transaction.reference_type}: {transaction.reference_id}
                          </p>
                        ) : null}
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-slate-950">{formatCurrency(transaction.amount)}</p>
                        <p className="mt-1 text-sm text-slate-500">{formatDateTime(transaction.transaction_date)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </FormCard>
        </div>
      ) : null}

      {activeTab === "petty-cash" ? (
        <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <FormCard title="Create petty cash entry" description="Approved or settled entries with a linked account will create a finance transaction automatically.">
            <form onSubmit={handlePettyCashSubmit} className="space-y-4">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Approving or settling will create a petty cash transaction and reduce the selected account balance.
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Entry number</span><input value={pettyCashForm.entry_number} onChange={(event) => setPettyCashForm((current) => ({ ...current, entry_number: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" required /></label>
                <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Account</span><select value={pettyCashForm.account_id} onChange={(event) => setPettyCashForm((current) => ({ ...current, account_id: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"><option value="">No linked account</option>{accounts.filter((item) => item.is_active).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
                <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Entry type</span><input value={pettyCashForm.entry_type} onChange={(event) => setPettyCashForm((current) => ({ ...current, entry_type: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" required /></label>
                <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Amount</span><input type="number" step="0.01" value={pettyCashForm.amount} onChange={(event) => setPettyCashForm((current) => ({ ...current, amount: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" required /></label>
                <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Spent by</span><input value={pettyCashForm.spent_by} onChange={(event) => setPettyCashForm((current) => ({ ...current, spent_by: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" /></label>
                <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Status</span><select value={pettyCashForm.status} onChange={(event) => setPettyCashForm((current) => ({ ...current, status: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white">{["pending", "approved", "rejected", "settled"].map((value) => <option key={value} value={value}>{formatLabel(value)}</option>)}</select></label>
                <label className="block md:col-span-2"><span className="mb-2 block text-sm font-medium text-slate-700">Purpose</span><textarea rows={3} value={pettyCashForm.purpose} onChange={(event) => setPettyCashForm((current) => ({ ...current, purpose: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" required /></label>
                <label className="block md:col-span-2"><span className="mb-2 block text-sm font-medium text-slate-700">Entry date</span><input type="datetime-local" value={pettyCashForm.entry_date} onChange={(event) => setPettyCashForm((current) => ({ ...current, entry_date: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" /></label>
              </div>
              <button type="submit" disabled={isSavingPettyCash} className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60">{isSavingPettyCash ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Create petty cash entry</button>
            </form>
          </FormCard>

          <FormCard title="Petty cash entries" description="Export the loaded petty cash entries and watch which rows already created finance transactions.">
            <div className="mb-4 flex justify-end">
              <button type="button" onClick={() => downloadCsv("petty-cash.csv", ["Entry Number", "Status", "Entry Type", "Account", "Amount", "Purpose", "Spent By", "Transaction Created", "Transaction ID", "Entry Date"], pettyCashEntries.map((entry) => [entry.entry_number, entry.status, entry.entry_type, entry.account?.name || "", entry.amount, entry.purpose, entry.spent_by, entry.transaction_created ? "Yes" : "No", entry.transaction_id, entry.entry_date]))} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                <Download className="h-4 w-4" />
                Petty Cash CSV
              </button>
            </div>
            <div className="space-y-3">
              {pettyCashEntries.map((entry) => (
                <div key={entry.id} className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-slate-950">{entry.entry_number}</h3>
                      <p className="mt-1 text-sm text-slate-500">{entry.account?.name || "No linked account"} · {formatLabel(entry.status)}</p>
                      <p className="mt-2 text-sm text-slate-600">{entry.purpose}</p>
                      <p className="mt-2 text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                        {entry.transaction_created ? `Transaction created: ${entry.transaction_id || "linked"}` : "No finance transaction yet"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-slate-950">{formatCurrency(entry.amount)}</p>
                      <p className="mt-1 text-sm text-slate-500">{formatDateTime(entry.entry_date)}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {["approved", "rejected", "settled"].map((status) => (
                      <button key={status} type="button" onClick={() => void handlePettyCashStatusUpdate(entry, status)} disabled={busyId === entry.id || entry.status === status} className="rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white disabled:opacity-60">
                        {formatLabel(status)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </FormCard>
        </div>
      ) : null}

      {activeTab === "supplier-payments" ? (
        <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <FormCard title="Create supplier payment" description="Each supplier payment now records a linked finance transaction automatically.">
            <form onSubmit={handleSupplierPaymentSubmit} className="space-y-4">
              {selectedSupplierPaymentAccount ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  Selected account balance: <span className="font-semibold text-slate-950">{formatCurrency(selectedSupplierPaymentAccount.current_balance)}</span>
                </div>
              ) : null}
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Supplier</span><select value={supplierPaymentForm.supplier_id} onChange={(event) => setSupplierPaymentForm((current) => ({ ...current, supplier_id: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"><option value="">Unlinked payment</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
                <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Account</span><select value={supplierPaymentForm.account_id} onChange={(event) => setSupplierPaymentForm((current) => ({ ...current, account_id: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" required><option value="">Select account</option>{accounts.filter((item) => item.is_active).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
                <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Payment number</span><input value={supplierPaymentForm.payment_number} onChange={(event) => setSupplierPaymentForm((current) => ({ ...current, payment_number: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" required /></label>
                <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Amount</span><input type="number" step="0.01" value={supplierPaymentForm.amount} onChange={(event) => setSupplierPaymentForm((current) => ({ ...current, amount: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" required /></label>
                <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Payment method</span><input value={supplierPaymentForm.payment_method} onChange={(event) => setSupplierPaymentForm((current) => ({ ...current, payment_method: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" /></label>
                <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Reference</span><input value={supplierPaymentForm.reference} onChange={(event) => setSupplierPaymentForm((current) => ({ ...current, reference: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" /></label>
                <label className="block md:col-span-2"><span className="mb-2 block text-sm font-medium text-slate-700">Notes</span><textarea rows={3} value={supplierPaymentForm.notes} onChange={(event) => setSupplierPaymentForm((current) => ({ ...current, notes: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" /></label>
                <label className="block md:col-span-2"><span className="mb-2 block text-sm font-medium text-slate-700">Payment date</span><input type="datetime-local" value={supplierPaymentForm.payment_date} onChange={(event) => setSupplierPaymentForm((current) => ({ ...current, payment_date: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" /></label>
              </div>
              <button type="submit" disabled={isSavingSupplierPayment} className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60">{isSavingSupplierPayment ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Create supplier payment</button>
            </form>
          </FormCard>

          <FormCard title="Supplier payments" description="Review account balance impact and the linked transaction reference for each payment.">
            <div className="mb-4 flex justify-end">
              <button type="button" onClick={() => downloadCsv("supplier-payments.csv", ["Payment Number", "Supplier", "Account", "Amount", "Payment Method", "Reference", "Transaction Number", "Transaction ID", "Payment Date"], supplierPayments.map((payment) => [payment.payment_number, payment.supplier?.name || "", payment.account.name, payment.amount, payment.payment_method, payment.reference, payment.transaction?.transaction_number || "", payment.transaction_id, payment.payment_date]))} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                <Download className="h-4 w-4" />
                Supplier Payments CSV
              </button>
            </div>
            <div className="space-y-3">
              {supplierPayments.map((payment) => (
                <div key={payment.id} className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-slate-950">{payment.payment_number}</h3>
                      <p className="mt-1 text-sm text-slate-500">{payment.supplier?.name || "Unlinked supplier"} · {payment.account.name}</p>
                      <p className="mt-2 text-sm text-slate-600">{payment.payment_method || "No payment method"}{payment.reference ? ` · ${payment.reference}` : ""}</p>
                      <p className="mt-2 text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                        Transaction: {payment.transaction?.transaction_number || payment.transaction_id || "Pending"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Account balance after payment: {formatCurrency(payment.account.current_balance)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-slate-950">{formatCurrency(payment.amount)}</p>
                      <p className="mt-1 text-sm text-slate-500">{formatDateTime(payment.payment_date)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </FormCard>
        </div>
      ) : null}

      <div className="rounded-[28px] border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600 shadow-[var(--shadow-soft)]">
        Need an invoice-linked payment flow next? The current finance polish keeps supplier payments and petty cash operationally consistent without turning this phase into full accounting. <Link href="/dashboard/reports" className="font-semibold text-slate-950 underline-offset-4 hover:underline">Open reports</Link>
      </div>
    </div>
  );
}
