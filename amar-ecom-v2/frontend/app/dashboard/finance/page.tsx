"use client";

import { useEffect, useState } from "react";
import { Building2, CreditCard, Landmark, Loader2, ReceiptText, Wallet } from "lucide-react";

import { ErrorAlert } from "@/components/ui/error-alert";
import { FormCard } from "@/components/ui/form-card";
import { LoadingState } from "@/components/ui/loading-state";
import { PageHeader } from "@/components/ui/page-header";
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
  description: string | null;
  transaction_date: string;
  account: Account;
  related_account: Account | null;
};

type PettyCashEntry = {
  id: string;
  entry_number: string;
  account_id: string | null;
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
  payment_number: string;
  amount: number | string;
  payment_method: string | null;
  reference: string | null;
  notes: string | null;
  payment_date: string;
  supplier: Supplier | null;
  account: Account;
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
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingAccount, setIsSavingAccount] = useState(false);
  const [isSavingTransaction, setIsSavingTransaction] = useState(false);
  const [isSavingPettyCash, setIsSavingPettyCash] = useState(false);
  const [isSavingSupplierPayment, setIsSavingSupplierPayment] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadData() {
    const [summaryData, accountData, transactionData, pettyCashData, supplierPaymentData, supplierData] =
      await Promise.all([
        api.get<FinanceSummary>("/finance/summary"),
        api.get<Account[]>("/accounts?skip=0&limit=100"),
        api.get<Transaction[]>("/transactions?skip=0&limit=100"),
        api.get<PettyCashEntry[]>("/petty-cash?skip=0&limit=100"),
        api.get<SupplierPayment[]>("/supplier-payments?skip=0&limit=100"),
        api.get<Supplier[]>("/suppliers?skip=0&limit=100").catch(() => []),
      ]);

    setSummary(summaryData);
    setAccounts(accountData);
    setTransactions(transactionData);
    setPettyCashEntries(pettyCashData);
    setSupplierPayments(supplierPaymentData);
    setSuppliers(supplierData);
  }

  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      try {
        await loadData();
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

  async function handleAccountSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
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
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save account");
    } finally {
      setIsSavingAccount(false);
    }
  }

  async function handleDeactivateAccount(accountId: string) {
    setBusyId(accountId);
    setError("");
    setSuccess("");
    try {
      await api.delete(`/accounts/${accountId}`);
      await loadData();
      setSuccess("Account deactivated.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to deactivate account");
    } finally {
      setBusyId(null);
    }
  }

  async function handleTransactionSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
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
        transaction_date: transactionForm.transaction_date || null,
      });
      setTransactionForm(initialTransactionForm);
      await loadData();
      setSuccess("Transaction created.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create transaction");
    } finally {
      setIsSavingTransaction(false);
    }
  }

  async function handlePettyCashSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSavingPettyCash(true);
    try {
      await api.post<PettyCashEntry>("/petty-cash", {
        entry_number: pettyCashForm.entry_number,
        account_id: pettyCashForm.account_id || null,
        entry_type: pettyCashForm.entry_type,
        amount: Number(pettyCashForm.amount),
        purpose: pettyCashForm.purpose,
        spent_by: pettyCashForm.spent_by || null,
        status: pettyCashForm.status,
        entry_date: pettyCashForm.entry_date || null,
      });
      setPettyCashForm(initialPettyCashForm);
      await loadData();
      setSuccess("Petty cash entry created.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create petty cash entry");
    } finally {
      setIsSavingPettyCash(false);
    }
  }

  async function handlePettyCashStatusUpdate(entryId: string, status: string) {
    setBusyId(entryId);
    setError("");
    setSuccess("");
    try {
      await api.patch<PettyCashEntry>(`/petty-cash/${entryId}`, { status });
      await loadData();
      setSuccess("Petty cash status updated.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update petty cash status");
    } finally {
      setBusyId(null);
    }
  }

  async function handleSupplierPaymentSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSavingSupplierPayment(true);
    try {
      await api.post<SupplierPayment>("/supplier-payments", {
        supplier_id: supplierPaymentForm.supplier_id || null,
        account_id: supplierPaymentForm.account_id,
        payment_number: supplierPaymentForm.payment_number,
        amount: Number(supplierPaymentForm.amount),
        payment_method: supplierPaymentForm.payment_method || null,
        reference: supplierPaymentForm.reference || null,
        notes: supplierPaymentForm.notes || null,
        payment_date: supplierPaymentForm.payment_date || null,
      });
      setSupplierPaymentForm(initialSupplierPaymentForm);
      await loadData();
      setSuccess("Supplier payment created.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create supplier payment");
    } finally {
      setIsSavingSupplierPayment(false);
    }
  }

  if (isLoading) {
    return <LoadingState label="Loading finance workspace..." />;
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)] sm:p-8">
        <PageHeader
          eyebrow="Finance Foundation"
          title="Finance workspace"
          description="Track operational accounts, transactions, petty cash, supplier settlements, and a practical finance summary without turning this phase into full accounting."
          meta="Overview + operations"
        />
      </section>

      <div className="rounded-[28px] border border-slate-200 bg-white p-3 shadow-[var(--shadow-soft)]">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                  isActive ? "bg-slate-950 text-white" : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {error ? <ErrorAlert message={error} /> : null}
      {success ? (
        <div className="rounded-[28px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-700 shadow-[var(--shadow-soft)]">
          {success}
        </div>
      ) : null}

      {activeTab === "overview" && summary ? (
        <div className="space-y-4">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[
              { label: "Cash / Bank Balance", value: formatCurrency(summary.total_cash_bank_balance), icon: Wallet },
              { label: "Total Income", value: formatCurrency(summary.total_income), icon: Landmark },
              { label: "Total Expense", value: formatCurrency(summary.total_expense), icon: ReceiptText },
              { label: "Net Cash Flow", value: formatCurrency(summary.net_cash_flow), icon: CreditCard },
              { label: "Pending Petty Cash", value: String(summary.pending_petty_cash_count), icon: CreditCard },
              { label: "Supplier Payments", value: formatCurrency(summary.supplier_payments_total), icon: Building2 },
            ].map(({ label, value, icon: Icon }) => (
              <article key={label} className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">{label}</p>
                    <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
              </article>
            ))}
          </section>

          <FormCard title="Recent transactions" description="Latest finance activity across income, expense, and transfers.">
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
          <FormCard title={editingAccountId ? "Edit account" : "Create account"} description="Track operational ledgers like cash, bank, receivable, payable, income, and expense buckets.">
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
              </div>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Notes</span>
                <textarea rows={3} value={accountForm.notes} onChange={(event) => setAccountForm((current) => ({ ...current, notes: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" />
              </label>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                <input type="checkbox" checked={accountForm.is_active} onChange={(event) => setAccountForm((current) => ({ ...current, is_active: event.target.checked }))} />
                Account is active
              </label>
              <div className="flex flex-wrap gap-3">
                <button type="submit" disabled={isSavingAccount} className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60">
                  {isSavingAccount ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {editingAccountId ? "Update account" : "Create account"}
                </button>
                {editingAccountId ? (
                  <button type="button" onClick={() => { setEditingAccountId(null); setAccountForm(initialAccountForm); }} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                    Cancel edit
                  </button>
                ) : null}
              </div>
            </form>
          </FormCard>

          <FormCard title="Accounts" description="Active and historical accounts with current balances.">
            <div className="space-y-3">
              {accounts.map((account) => (
                <div key={account.id} className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-slate-950">{account.name}</h3>
                      <p className="mt-1 text-sm text-slate-500">{account.code} · {formatLabel(account.account_type)}</p>
                      <p className="mt-2 text-sm text-slate-600">Current balance: <span className="font-semibold text-slate-950">{formatCurrency(account.current_balance)}</span></p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => populateAccountForm(account)} className="rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white">Edit</button>
                      {account.is_active ? (
                        <button type="button" onClick={() => void handleDeactivateAccount(account.id)} disabled={busyId === account.id} className="rounded-full border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-60">Deactivate</button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </FormCard>
        </div>
      ) : null}

      {activeTab === "transactions" ? (
        <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <FormCard title="Create transaction" description="Record direct income, expense, transfers, and other operational finance movements.">
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

          <FormCard title="Transactions" description="Recent recorded movements with account context.">
            <div className="space-y-3">
              {transactions.map((transaction) => (
                <div key={transaction.id} className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-slate-950">{transaction.transaction_number}</h3>
                      <p className="mt-1 text-sm text-slate-500">{formatLabel(transaction.transaction_type)} · {formatLabel(transaction.direction)}</p>
                      <p className="mt-2 text-sm text-slate-600">{transaction.account.name}{transaction.related_account ? ` -> ${transaction.related_account.name}` : ""}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-slate-950">{formatCurrency(transaction.amount)}</p>
                      <p className="mt-1 text-sm text-slate-500">{formatDateTime(transaction.transaction_date)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </FormCard>
        </div>
      ) : null}

      {activeTab === "petty-cash" ? (
        <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <FormCard title="Create petty cash entry" description="Capture small cash disbursements and move them through a lightweight approval flow.">
            <form onSubmit={handlePettyCashSubmit} className="space-y-4">
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

          <FormCard title="Petty cash entries" description="Pending entries can be approved, rejected, or marked settled.">
            <div className="space-y-3">
              {pettyCashEntries.map((entry) => (
                <div key={entry.id} className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-slate-950">{entry.entry_number}</h3>
                      <p className="mt-1 text-sm text-slate-500">{entry.account?.name || "No linked account"} · {formatLabel(entry.status)}</p>
                      <p className="mt-2 text-sm text-slate-600">{entry.purpose}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-slate-950">{formatCurrency(entry.amount)}</p>
                      <p className="mt-1 text-sm text-slate-500">{formatDateTime(entry.entry_date)}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {["approved", "rejected", "settled"].map((status) => (
                      <button key={status} type="button" onClick={() => void handlePettyCashStatusUpdate(entry.id, status)} disabled={busyId === entry.id || entry.status === status} className="rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white disabled:opacity-60">
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
          <FormCard title="Create supplier payment" description="Record practical supplier settlements against an account without building full procurement accounting yet.">
            <form onSubmit={handleSupplierPaymentSubmit} className="space-y-4">
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

          <FormCard title="Supplier payments" description="Recent supplier settlements and their payment accounts.">
            <div className="space-y-3">
              {supplierPayments.map((payment) => (
                <div key={payment.id} className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-slate-950">{payment.payment_number}</h3>
                      <p className="mt-1 text-sm text-slate-500">{payment.supplier?.name || "Unlinked supplier"} · {payment.account.name}</p>
                      <p className="mt-2 text-sm text-slate-600">{payment.payment_method || "No payment method"}{payment.reference ? ` · ${payment.reference}` : ""}</p>
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
    </div>
  );
}
