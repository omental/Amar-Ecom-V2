"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  CreditCard,
  Download,
  Landmark,
  Loader2,
  Plus,
  ReceiptText,
  RefreshCw,
  Wallet,
} from "lucide-react";

import { ControlModal } from "@/components/ui/control-modal";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { api, ApiError } from "@/lib/api";
import { formatCurrency, formatDateTime, formatLabel } from "@/lib/format";

type Account = {
  id: string;
  name: string;
  code: string;
  account_type?: string;
  accountType?: string;
  type?: string;
  category?: string | null;
  opening_balance: number | string;
  current_balance: number | string;
  balance?: number | string;
  is_active: boolean;
  active?: boolean;
  status?: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  createdAt?: string;
  updatedAt?: string;
};

type Transaction = {
  id: string;
  transaction_number?: string;
  transactionNumber?: string;
  account_id?: string;
  accountId?: string;
  related_account_id?: string | null;
  toAccountId?: string | null;
  related_account_name?: string | null;
  transaction_type?: string;
  type?: string;
  category?: string | null;
  subCategory?: string | null;
  amount: number | string;
  direction: string;
  reference_type?: string | null;
  reference_id?: string | null;
  description?: string | null;
  notes?: string | null;
  transaction_date?: string;
  date?: string;
  status?: string;
  account?: Account | null;
  accountName?: string | null;
  related_account?: Account | null;
};

type PettyCashEntry = {
  id: string;
  entry_number?: string;
  entryNumber?: string;
  account_id?: string | null;
  accountId?: string | null;
  transaction_id?: string | null;
  transaction_created: boolean;
  entry_type?: string;
  type?: string;
  amount: number | string;
  purpose: string;
  note?: string | null;
  spent_by: string | null;
  approved_by_id?: string | null;
  status: string;
  entry_date?: string;
  date?: string;
  account?: Account | null;
};

type Supplier = {
  id: string;
  name: string;
  supplierName?: string;
};

type SupplierPayment = {
  id: string;
  supplier_id?: string | null;
  supplierId?: string | null;
  account_id?: string;
  accountId?: string;
  transaction_id?: string | null;
  payment_number?: string;
  voucherNo?: string;
  amount: number | string;
  paidAmount?: number | string;
  payment_method?: string | null;
  paymentType?: string | null;
  reference?: string | null;
  remark?: string | null;
  notes?: string | null;
  payment_date?: string;
  date?: string;
  supplier?: Supplier | null;
  account: Account;
  transaction?: Transaction | null;
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
  type: string;
  category: string;
  opening_balance: string;
  notes: string;
  active: boolean;
};

type TransactionForm = {
  transactionNumber: string;
  accountId: string;
  toAccountId: string;
  type: string;
  category: string;
  subCategory: string;
  amount: string;
  direction: string;
  notes: string;
  date: string;
};

type PettyCashForm = {
  entryNumber: string;
  accountId: string;
  type: string;
  amount: string;
  purpose: string;
  spentBy: string;
  status: string;
  date: string;
  note: string;
};

type SupplierPaymentForm = {
  supplierId: string;
  accountId: string;
  voucherNo: string;
  amount: string;
  paymentType: string;
  reference: string;
  notes: string;
  date: string;
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
  type: "cash",
  category: "assets",
  opening_balance: "0",
  notes: "",
  active: true,
};

const initialTransactionForm: TransactionForm = {
  transactionNumber: "",
  accountId: "",
  toAccountId: "",
  type: "income",
  category: "income",
  subCategory: "",
  amount: "",
  direction: "in",
  notes: "",
  date: "",
};

const initialPettyCashForm: PettyCashForm = {
  entryNumber: "",
  accountId: "",
  type: "expense",
  amount: "",
  purpose: "",
  spentBy: "",
  status: "pending",
  date: "",
  note: "",
};

const initialSupplierPaymentForm: SupplierPaymentForm = {
  supplierId: "",
  accountId: "",
  voucherNo: "",
  amount: "",
  paymentType: "",
  reference: "",
  notes: "",
  date: "",
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

function getAccountType(account: Account) {
  return account.type || account.accountType || account.account_type || "account";
}

function getAccountBalance(account: Account) {
  return account.balance ?? account.current_balance;
}

function getTransactionNumber(transaction: Transaction) {
  return transaction.transactionNumber || transaction.transaction_number || "Pending";
}

function getTransactionType(transaction: Transaction) {
  return transaction.type || transaction.transaction_type || "transaction";
}

function getTransactionDate(transaction: Transaction) {
  return transaction.date || transaction.transaction_date || "";
}

function getTransactionAccountName(transaction: Transaction) {
  return transaction.accountName || transaction.account?.name || "Unknown account";
}

function getTransactionRelatedName(transaction: Transaction) {
  return transaction.related_account?.name || transaction.related_account_name || "";
}

function getPettyCashNumber(entry: PettyCashEntry) {
  return entry.entryNumber || entry.entry_number || "Pending";
}

function getPettyCashType(entry: PettyCashEntry) {
  return entry.type || entry.entry_type || "entry";
}

function getPettyCashDate(entry: PettyCashEntry) {
  return entry.date || entry.entry_date || "";
}

function getSupplierPaymentNumber(payment: SupplierPayment) {
  return payment.voucherNo || payment.payment_number || "Pending";
}

function getSupplierPaymentDate(payment: SupplierPayment) {
  return payment.date || payment.payment_date || "";
}

function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <h2 className="text-lg font-bold tracking-tight text-slate-950">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      {action}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  helper,
  icon: Icon,
}: {
  label: string;
  value: string;
  helper: string;
  icon: typeof Wallet;
}) {
  return (
    <div className="rounded-[26px] border border-slate-200 bg-white px-5 py-5 shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.26em] text-slate-500">{label}</p>
          <p className="mt-3 text-2xl font-black tracking-tight text-slate-950">{value}</p>
          <p className="mt-2 text-xs font-medium text-slate-500">{helper}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
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
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showPettyCashModal, setShowPettyCashModal] = useState(false);
  const [showSupplierPaymentModal, setShowSupplierPaymentModal] = useState(false);
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

  const selectedSupplierPaymentAccount =
    accounts.find((account) => account.id === supplierPaymentForm.accountId) || null;

  const activeAccounts = useMemo(() => accounts.filter((account) => account.is_active), [accounts]);

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
        const [summaryData, transactionData, accountData, pettyCashData, supplierPaymentData, supplierData] =
          await Promise.all([
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

  function clearMessages() {
    setError("");
    setSuccess("");
  }

  function openNewAccountModal() {
    setEditingAccountId(null);
    setAccountForm(initialAccountForm);
    setShowAccountModal(true);
  }

  function openEditAccountModal(account: Account) {
    setEditingAccountId(account.id);
    setAccountForm({
      name: account.name,
      code: account.code,
      type: getAccountType(account),
      category: account.category || "assets",
      opening_balance: String(account.opening_balance),
      notes: account.notes || "",
      active: account.is_active,
    });
    setShowAccountModal(true);
  }

  function openTransactionModal() {
    setTransactionForm(initialTransactionForm);
    setShowTransactionModal(true);
  }

  function openPettyCashModal() {
    setPettyCashForm(initialPettyCashForm);
    setShowPettyCashModal(true);
  }

  function openSupplierPaymentModal() {
    setSupplierPaymentForm(initialSupplierPaymentForm);
    setShowSupplierPaymentModal(true);
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
          type: accountForm.type,
          category: accountForm.category || null,
          notes: accountForm.notes || null,
          active: accountForm.active,
        });
        setSuccess("Account updated.");
      } else {
        await api.post<Account>("/accounts", {
          name: accountForm.name,
          code: accountForm.code || undefined,
          type: accountForm.type,
          category: accountForm.category || null,
          balance: Number(accountForm.opening_balance || 0),
          opening_balance: Number(accountForm.opening_balance || 0),
          notes: accountForm.notes || null,
          active: accountForm.active,
        });
        setSuccess("Account created.");
      }

      setShowAccountModal(false);
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
        transactionNumber: transactionForm.transactionNumber || undefined,
        accountId: transactionForm.accountId,
        toAccountId: transactionForm.toAccountId || null,
        type: transactionForm.type,
        category: transactionForm.category || null,
        subCategory: transactionForm.subCategory || null,
        amount: Number(transactionForm.amount),
        direction: transactionForm.direction,
        notes: transactionForm.notes || null,
        date: inputToApiDate(transactionForm.date) || null,
        status: "completed",
      });

      setShowTransactionModal(false);
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
      pettyCashForm.accountId &&
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
        entryNumber: pettyCashForm.entryNumber || undefined,
        accountId: pettyCashForm.accountId || null,
        type: pettyCashForm.type,
        amount: Number(pettyCashForm.amount),
        purpose: pettyCashForm.purpose,
        spent_by: pettyCashForm.spentBy || null,
        status: pettyCashForm.status,
        date: inputToApiDate(pettyCashForm.date) || null,
        note: pettyCashForm.note || null,
      });

      setShowPettyCashModal(false);
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
    const linkedAccountId = entry.accountId || entry.account_id;

    if (
      linkedAccountId &&
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
        supplierId: supplierPaymentForm.supplierId || null,
        accountId: supplierPaymentForm.accountId,
        voucherNo: supplierPaymentForm.voucherNo || undefined,
        paidAmount: Number(supplierPaymentForm.amount),
        amount: Number(supplierPaymentForm.amount),
        paymentType: supplierPaymentForm.paymentType || null,
        reference: supplierPaymentForm.reference || null,
        remark: supplierPaymentForm.notes || null,
        notes: supplierPaymentForm.notes || null,
        date: inputToApiDate(supplierPaymentForm.date) || null,
      });

      setShowSupplierPaymentModal(false);
      setSupplierPaymentForm(initialSupplierPaymentForm);
      await Promise.all([loadReferenceData(), refreshTransactions(), refreshOverview()]);
      setSuccess(
        `Supplier payment created. Transaction ${
          payment.transaction?.transactionNumber || payment.transaction?.transaction_number || payment.transaction_id || ""
        } recorded automatically. Account balance is now ${formatCurrency(getAccountBalance(payment.account))}.`,
      );
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
    <div className="min-w-0 space-y-5">
      <section className="rounded-[32px] border border-slate-200 bg-white px-6 py-7 shadow-[var(--shadow-soft)] sm:px-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-slate-500">Finance Center</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">Finance</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-500">
              Run the practical finance foundation with accounts, transactions, petty cash, supplier payments, and date-based summary checks.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void handleOverviewRefresh()}
              disabled={isRefreshingOverview}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-70"
            >
              {isRefreshingOverview ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </button>
            {activeTab === "accounts" ? (
              <button
                type="button"
                onClick={openNewAccountModal}
                className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                <Plus className="h-4 w-4" />
                Add Account
              </button>
            ) : null}
            {activeTab === "transactions" ? (
              <button
                type="button"
                onClick={openTransactionModal}
                className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                <Plus className="h-4 w-4" />
                Add Transaction
              </button>
            ) : null}
            {activeTab === "petty-cash" ? (
              <button
                type="button"
                onClick={openPettyCashModal}
                className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                <Plus className="h-4 w-4" />
                Add Petty Cash
              </button>
            ) : null}
            {activeTab === "supplier-payments" ? (
              <button
                type="button"
                onClick={openSupplierPaymentModal}
                className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                <Plus className="h-4 w-4" />
                Add Payment
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="overflow-x-auto rounded-[28px] border border-slate-200 bg-white p-2 shadow-[var(--shadow-soft)]">
        <div className="flex min-w-max gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 rounded-[22px] px-5 py-3 text-sm font-bold transition ${
                activeTab === tab.id
                  ? "bg-slate-950 text-white"
                  : "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {error ? <ErrorAlert message={error} /> : null}
      {success ? (
        <div className="rounded-[28px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-700 shadow-[var(--shadow-soft)]">
          {success}
        </div>
      ) : null}

      {activeTab === "overview" && summary ? (
        <div className="space-y-5">
          <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
            <SectionHeader title="Overview" description="Date-filtered finance totals and recent movement." />
            <div className="mt-6 grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">Date From</span>
                <input
                  type="datetime-local"
                  value={summaryFilters.date_from}
                  onChange={(event) => setSummaryFilters((current) => ({ ...current, date_from: event.target.value }))}
                  className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">Date To</span>
                <input
                  type="datetime-local"
                  value={summaryFilters.date_to}
                  onChange={(event) => setSummaryFilters((current) => ({ ...current, date_to: event.target.value }))}
                  className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                />
              </label>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => void handleOverviewRefresh()}
                  disabled={isRefreshingOverview}
                  className="w-full rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 lg:w-auto"
                >
                  Apply Range
                </button>
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <SummaryCard
              label="Cash / Bank Balance"
              value={formatCurrency(summary.total_cash_bank_balance)}
              helper="Live liquidity view"
              icon={Wallet}
            />
            <SummaryCard
              label="Total Income"
              value={formatCurrency(summary.total_income)}
              helper="Selected date range"
              icon={Landmark}
            />
            <SummaryCard
              label="Total Expense"
              value={formatCurrency(summary.total_expense)}
              helper="Selected date range"
              icon={ReceiptText}
            />
            <SummaryCard
              label="Net Cash Flow"
              value={formatCurrency(summary.net_cash_flow)}
              helper="Income minus expense"
              icon={CreditCard}
            />
            <SummaryCard
              label="Pending Petty Cash"
              value={String(summary.pending_petty_cash_count)}
              helper="Review queue"
              icon={CreditCard}
            />
            <SummaryCard
              label="Supplier Payments"
              value={formatCurrency(summary.supplier_payments_total)}
              helper="Recorded through finance"
              icon={Building2}
            />
          </section>

          <div className="rounded-[28px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-800 shadow-[var(--shadow-soft)]">
            Petty cash approvals and supplier payments can create linked finance transactions and change account balances immediately. Double-check account and amount fields before saving.
          </div>

          <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
            <SectionHeader title="Recent Transactions" description="Lightweight operational view of the latest recorded transactions." />
            <div className="mt-6">
              {summary.recent_transactions.length === 0 ? (
                <EmptyState title="No finance transactions yet" description="Transactions will appear here as the workspace is used." />
              ) : (
                <DataTable columns={["Number", "Type", "Account", "Amount", "When"]}>
                  {summary.recent_transactions.map((transaction) => (
                    <div key={transaction.id} className="grid grid-cols-1 gap-3 px-5 py-4 text-sm text-slate-600 lg:grid-cols-5">
                      <span className="font-medium text-slate-950">{getTransactionNumber(transaction)}</span>
                      <span>
                        <StatusBadge status={getTransactionType(transaction)} label={formatLabel(getTransactionType(transaction))} />
                      </span>
                      <span>
                        {getTransactionAccountName(transaction)}
                        {getTransactionRelatedName(transaction) ? ` -> ${getTransactionRelatedName(transaction)}` : ""}
                      </span>
                      <span>{formatCurrency(transaction.amount)}</span>
                      <span>{formatDateTime(getTransactionDate(transaction))}</span>
                    </div>
                  ))}
                </DataTable>
              )}
            </div>
          </section>
        </div>
      ) : null}

      {activeTab === "accounts" ? (
        <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
          <SectionHeader
            title="Accounts"
            description="Manage operational cash, bank, mobile, asset, and liability accounts."
            action={
              <button
                type="button"
                onClick={() =>
                  downloadCsv(
                    "accounts.csv",
                    ["Name", "Code", "Type", "Category", "Balance", "Status", "Created At"],
                    accounts.map((account) => [
                      account.name,
                      account.code,
                      getAccountType(account),
                      account.category,
                      getAccountBalance(account),
                      account.status || (account.is_active ? "active" : "inactive"),
                      account.createdAt || account.created_at,
                    ]),
                  )
                }
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                <Download className="h-4 w-4" />
                Accounts CSV
              </button>
            }
          />
          <div className="mt-6">
            {accounts.length === 0 ? (
              <EmptyState title="No accounts yet" description="Add an account to start recording finance activity." />
            ) : (
              <DataTable columns={["Account", "Code", "Type", "Category", "Balance", "Status", "Actions"]}>
                {accounts.map((account) => (
                  <div key={account.id} className="grid grid-cols-1 gap-3 px-5 py-4 text-sm text-slate-600 xl:grid-cols-7">
                    <span className="font-medium text-slate-950">{account.name}</span>
                    <span>{account.code || "Auto"}</span>
                    <span>{formatLabel(getAccountType(account))}</span>
                    <span>{formatLabel(account.category || "general")}</span>
                    <span className="font-semibold text-slate-950">{formatCurrency(getAccountBalance(account))}</span>
                    <span>
                      <StatusBadge
                        status={account.status || (account.is_active ? "active" : "inactive")}
                        label={formatLabel(account.status || (account.is_active ? "active" : "inactive"))}
                      />
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openEditAccountModal(account)}
                        className="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Edit
                      </button>
                      {account.is_active ? (
                        <button
                          type="button"
                          onClick={() => void handleDeactivateAccount(account.id)}
                          disabled={busyId === account.id}
                          className="rounded-full border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-60"
                        >
                          Deactivate
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </DataTable>
            )}
          </div>
        </section>
      ) : null}

      {activeTab === "transactions" ? (
        <div className="space-y-5">
          <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
            <SectionHeader title="Transactions" description="Filter operational income, expense, and transfer rows before export." />
            <div className="mt-6 grid gap-3 xl:grid-cols-3">
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">Search</span>
                <input
                  value={transactionFilters.search}
                  onChange={(event) => setTransactionFilters((current) => ({ ...current, search: event.target.value }))}
                  className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                  placeholder="Number, note, reference..."
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">Account</span>
                <select
                  value={transactionFilters.account_id}
                  onChange={(event) => setTransactionFilters((current) => ({ ...current, account_id: event.target.value }))}
                  className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                >
                  <option value="">All Accounts</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">Type</span>
                <select
                  value={transactionFilters.transaction_type}
                  onChange={(event) =>
                    setTransactionFilters((current) => ({ ...current, transaction_type: event.target.value }))
                  }
                  className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                >
                  <option value="">All Types</option>
                  {["income", "expense", "transfer"].map((value) => (
                    <option key={value} value={value}>
                      {formatLabel(value)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">Direction</span>
                <select
                  value={transactionFilters.direction}
                  onChange={(event) => setTransactionFilters((current) => ({ ...current, direction: event.target.value }))}
                  className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                >
                  <option value="">All Directions</option>
                  {["in", "out"].map((value) => (
                    <option key={value} value={value}>
                      {formatLabel(value)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">Date From</span>
                <input
                  type="datetime-local"
                  value={transactionFilters.date_from}
                  onChange={(event) => setTransactionFilters((current) => ({ ...current, date_from: event.target.value }))}
                  className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">Date To</span>
                <input
                  type="datetime-local"
                  value={transactionFilters.date_to}
                  onChange={(event) => setTransactionFilters((current) => ({ ...current, date_to: event.target.value }))}
                  className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                />
              </label>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleTransactionRefresh()}
                disabled={isRefreshingTransactions}
                className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {isRefreshingTransactions ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Refresh
              </button>
              <button
                type="button"
                onClick={() => {
                  setTransactionFilters(initialTransactionFilters);
                  void handleTransactionRefresh(initialTransactionFilters);
                }}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Clear Filters
              </button>
              <button
                type="button"
                onClick={() =>
                  downloadCsv(
                    "transactions.csv",
                    ["Transaction Number", "Type", "Direction", "Account", "Related Account", "Amount", "Category", "Sub Category", "Date", "Notes"],
                    transactions.map((transaction) => [
                      getTransactionNumber(transaction),
                      getTransactionType(transaction),
                      transaction.direction,
                      getTransactionAccountName(transaction),
                      getTransactionRelatedName(transaction),
                      transaction.amount,
                      transaction.category,
                      transaction.subCategory,
                      getTransactionDate(transaction),
                      transaction.notes || transaction.description,
                    ]),
                  )
                }
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <Download className="h-4 w-4" />
                Transactions CSV
              </button>
            </div>
          </section>

          <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
            <SectionHeader title="Transaction List" description="Current filtered finance transactions." />
            <div className="mt-6">
              {transactions.length === 0 ? (
                <EmptyState title="No transactions found" description="Try a different filter or create the first transaction." />
              ) : (
                <DataTable columns={["Number", "Type", "Account", "Amount", "Date", "Note"]}>
                  {transactions.map((transaction) => (
                    <div key={transaction.id} className="grid grid-cols-1 gap-3 px-5 py-4 text-sm text-slate-600 2xl:grid-cols-6">
                      <span className="font-medium text-slate-950">{getTransactionNumber(transaction)}</span>
                      <span>
                        <StatusBadge status={getTransactionType(transaction)} label={formatLabel(getTransactionType(transaction))} />
                      </span>
                      <span>
                        {getTransactionAccountName(transaction)}
                        {getTransactionRelatedName(transaction) ? ` -> ${getTransactionRelatedName(transaction)}` : ""}
                      </span>
                      <span className="font-semibold text-slate-950">{formatCurrency(transaction.amount)}</span>
                      <span>{formatDateTime(getTransactionDate(transaction))}</span>
                      <span>{transaction.notes || transaction.description || "No note"}</span>
                    </div>
                  ))}
                </DataTable>
              )}
            </div>
          </section>
        </div>
      ) : null}

      {activeTab === "petty-cash" ? (
        <div className="space-y-5">
          <div className="rounded-[28px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-800 shadow-[var(--shadow-soft)]">
            Approving or settling petty cash with a linked account will create a finance transaction and reduce the selected account balance.
          </div>
          <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
            <SectionHeader
              title="Petty Cash"
              description="Track requests, approval states, and linked transaction creation."
              action={
                <button
                  type="button"
                  onClick={() =>
                    downloadCsv(
                      "petty-cash.csv",
                      ["Entry Number", "Status", "Type", "Account", "Amount", "Purpose", "Spent By", "Transaction Created", "Date"],
                      pettyCashEntries.map((entry) => [
                        getPettyCashNumber(entry),
                        entry.status,
                        getPettyCashType(entry),
                        entry.account?.name || "",
                        entry.amount,
                        entry.purpose,
                        entry.spent_by,
                        entry.transaction_created ? "Yes" : "No",
                        getPettyCashDate(entry),
                      ]),
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <Download className="h-4 w-4" />
                  Petty Cash CSV
                </button>
              }
            />
            <div className="mt-6">
              {pettyCashEntries.length === 0 ? (
                <EmptyState title="No petty cash entries yet" description="Create the first petty cash request to start the review loop." />
              ) : (
                <DataTable columns={["Entry", "Status", "Account", "Amount", "Purpose", "Actions"]}>
                  {pettyCashEntries.map((entry) => (
                    <div key={entry.id} className="grid grid-cols-1 gap-3 px-5 py-4 text-sm text-slate-600 2xl:grid-cols-6">
                      <div>
                        <p className="font-medium text-slate-950">{getPettyCashNumber(entry)}</p>
                        <p className="mt-1 text-xs text-slate-500">{formatDateTime(getPettyCashDate(entry))}</p>
                      </div>
                      <span>
                        <StatusBadge status={entry.status} label={formatLabel(entry.status)} />
                      </span>
                      <span>{entry.account?.name || "No linked account"}</span>
                      <span className="font-semibold text-slate-950">{formatCurrency(entry.amount)}</span>
                      <div>
                        <p>{entry.purpose}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {entry.transaction_created ? `Transaction created: ${entry.transaction_id || "linked"}` : "No finance transaction yet"}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {["approved", "rejected", "settled"].map((status) => (
                          <button
                            key={status}
                            type="button"
                            onClick={() => void handlePettyCashStatusUpdate(entry, status)}
                            disabled={busyId === entry.id || entry.status === status}
                            className="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                          >
                            {formatLabel(status)}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </DataTable>
              )}
            </div>
          </section>
        </div>
      ) : null}

      {activeTab === "supplier-payments" ? (
        <div className="space-y-5">
          <div className="rounded-[28px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-800 shadow-[var(--shadow-soft)]">
            Supplier payments record a linked finance transaction automatically and reduce the chosen account balance immediately after save.
          </div>
          <section className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
            <SectionHeader
              title="Supplier Payments"
              description="Review procurement-related payments and their linked transaction references."
              action={
                <button
                  type="button"
                  onClick={() =>
                    downloadCsv(
                      "supplier-payments.csv",
                      ["Voucher", "Supplier", "Account", "Amount", "Method", "Reference", "Transaction", "Date"],
                      supplierPayments.map((payment) => [
                        getSupplierPaymentNumber(payment),
                        payment.supplier?.supplierName || payment.supplier?.name || "",
                        payment.account.name,
                        payment.paidAmount || payment.amount,
                        payment.paymentType || payment.payment_method,
                        payment.reference,
                        payment.transaction?.transactionNumber || payment.transaction?.transaction_number || payment.transaction_id,
                        getSupplierPaymentDate(payment),
                      ]),
                    )
                  }
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <Download className="h-4 w-4" />
                  Supplier Payments CSV
                </button>
              }
            />
            <div className="mt-6">
              {supplierPayments.length === 0 ? (
                <EmptyState title="No supplier payments yet" description="Create a supplier payment when procurement spending needs to be recorded." />
              ) : (
                <DataTable columns={["Voucher", "Supplier", "Account", "Amount", "Method", "Transaction"]}>
                  {supplierPayments.map((payment) => (
                    <div key={payment.id} className="grid grid-cols-1 gap-3 px-5 py-4 text-sm text-slate-600 2xl:grid-cols-6">
                      <div>
                        <p className="font-medium text-slate-950">{getSupplierPaymentNumber(payment)}</p>
                        <p className="mt-1 text-xs text-slate-500">{formatDateTime(getSupplierPaymentDate(payment))}</p>
                      </div>
                      <span>{payment.supplier?.supplierName || payment.supplier?.name || "Unlinked supplier"}</span>
                      <span>{payment.account.name}</span>
                      <span className="font-semibold text-slate-950">{formatCurrency(payment.paidAmount || payment.amount)}</span>
                      <div>
                        <p>{payment.paymentType || payment.payment_method || "No method"}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {payment.reference ? `Ref: ${payment.reference}` : "No reference"}
                        </p>
                      </div>
                      <div>
                        <p className="font-medium text-slate-950">
                          {payment.transaction?.transactionNumber || payment.transaction?.transaction_number || payment.transaction_id || "Pending"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Balance after payment: {formatCurrency(getAccountBalance(payment.account))}
                        </p>
                      </div>
                    </div>
                  ))}
                </DataTable>
              )}
            </div>
          </section>
        </div>
      ) : null}

      {showAccountModal ? (
        <ControlModal
          title={editingAccountId ? "Edit Account" : "Add Account"}
          description="Use the v1-style finance loop to manage operational accounts without leaving the page."
          onClose={() => setShowAccountModal(false)}
        >
          <form onSubmit={handleAccountSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Account Name</span>
                <input
                  required
                  value={accountForm.name}
                  onChange={(event) => setAccountForm((current) => ({ ...current, name: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Code</span>
                <input
                  value={accountForm.code}
                  onChange={(event) => setAccountForm((current) => ({ ...current, code: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                  placeholder="Leave blank to auto-generate"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Type</span>
                <select
                  value={accountForm.type}
                  onChange={(event) => setAccountForm((current) => ({ ...current, type: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                >
                  {["cash", "bank", "mobile", "asset", "liability", "equity"].map((value) => (
                    <option key={value} value={value}>
                      {formatLabel(value)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Category</span>
                <select
                  value={accountForm.category}
                  onChange={(event) => setAccountForm((current) => ({ ...current, category: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                >
                  {["assets", "liabilities", "equity", "income", "cogs", "expenses"].map((value) => (
                    <option key={value} value={value}>
                      {formatLabel(value)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Opening Balance</span>
                <input
                  type="number"
                  step="0.01"
                  value={accountForm.opening_balance}
                  onChange={(event) =>
                    setAccountForm((current) => ({ ...current, opening_balance: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                />
              </label>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={accountForm.active}
                  onChange={(event) => setAccountForm((current) => ({ ...current, active: event.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Active account
              </label>
              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-medium text-slate-700">Notes</span>
                <textarea
                  rows={3}
                  value={accountForm.notes}
                  onChange={(event) => setAccountForm((current) => ({ ...current, notes: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAccountModal(false)}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingAccount}
                className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {isSavingAccount ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {editingAccountId ? "Save Account" : "Create Account"}
              </button>
            </div>
          </form>
        </ControlModal>
      ) : null}

      {showTransactionModal ? (
        <ControlModal
          title="Add Transaction"
          description="Record a finance transaction without leaving the current workspace."
          onClose={() => setShowTransactionModal(false)}
        >
          <form onSubmit={handleTransactionSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Transaction Number</span>
                <input
                  value={transactionForm.transactionNumber}
                  onChange={(event) =>
                    setTransactionForm((current) => ({ ...current, transactionNumber: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                  placeholder="Leave blank to auto-generate"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Type</span>
                <select
                  value={transactionForm.type}
                  onChange={(event) => setTransactionForm((current) => ({ ...current, type: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                >
                  {["income", "expense", "transfer"].map((value) => (
                    <option key={value} value={value}>
                      {formatLabel(value)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  {transactionForm.type === "transfer" ? "From Account" : "Account"}
                </span>
                <select
                  required
                  value={transactionForm.accountId}
                  onChange={(event) => setTransactionForm((current) => ({ ...current, accountId: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                >
                  <option value="">Select account</option>
                  {activeAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </label>
              {transactionForm.type === "transfer" ? (
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">To Account</span>
                  <select
                    required
                    value={transactionForm.toAccountId}
                    onChange={(event) =>
                      setTransactionForm((current) => ({ ...current, toAccountId: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                  >
                    <option value="">Select account</option>
                    {activeAccounts
                      .filter((account) => account.id !== transactionForm.accountId)
                      .map((account) => (
                        <option key={account.id} value={account.id}>
                          {account.name}
                        </option>
                      ))}
                  </select>
                </label>
              ) : (
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Direction</span>
                  <select
                    value={transactionForm.direction}
                    onChange={(event) => setTransactionForm((current) => ({ ...current, direction: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                  >
                    {["in", "out"].map((value) => (
                      <option key={value} value={value}>
                        {formatLabel(value)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Category</span>
                <input
                  value={transactionForm.category}
                  onChange={(event) => setTransactionForm((current) => ({ ...current, category: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Sub Category</span>
                <input
                  value={transactionForm.subCategory}
                  onChange={(event) =>
                    setTransactionForm((current) => ({ ...current, subCategory: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Amount</span>
                <input
                  required
                  type="number"
                  step="0.01"
                  value={transactionForm.amount}
                  onChange={(event) => setTransactionForm((current) => ({ ...current, amount: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                />
              </label>
              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-medium text-slate-700">Transaction Date</span>
                <input
                  type="datetime-local"
                  value={transactionForm.date}
                  onChange={(event) => setTransactionForm((current) => ({ ...current, date: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                />
              </label>
              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-medium text-slate-700">Notes</span>
                <textarea
                  rows={3}
                  value={transactionForm.notes}
                  onChange={(event) => setTransactionForm((current) => ({ ...current, notes: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowTransactionModal(false)}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingTransaction}
                className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {isSavingTransaction ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save Transaction
              </button>
            </div>
          </form>
        </ControlModal>
      ) : null}

      {showPettyCashModal ? (
        <ControlModal
          title="Add Petty Cash Entry"
          description="Approved or settled entries with a linked account can create a finance transaction automatically."
          onClose={() => setShowPettyCashModal(false)}
        >
          <form onSubmit={handlePettyCashSubmit} className="space-y-4">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Approving or settling will create a petty cash transaction and reduce the selected account balance.
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Entry Number</span>
                <input
                  value={pettyCashForm.entryNumber}
                  onChange={(event) =>
                    setPettyCashForm((current) => ({ ...current, entryNumber: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                  placeholder="Leave blank to auto-generate"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Account</span>
                <select
                  value={pettyCashForm.accountId}
                  onChange={(event) => setPettyCashForm((current) => ({ ...current, accountId: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                >
                  <option value="">No linked account</option>
                  {activeAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Type</span>
                <input
                  value={pettyCashForm.type}
                  onChange={(event) => setPettyCashForm((current) => ({ ...current, type: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Amount</span>
                <input
                  required
                  type="number"
                  step="0.01"
                  value={pettyCashForm.amount}
                  onChange={(event) => setPettyCashForm((current) => ({ ...current, amount: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Spent By</span>
                <input
                  value={pettyCashForm.spentBy}
                  onChange={(event) => setPettyCashForm((current) => ({ ...current, spentBy: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Status</span>
                <select
                  value={pettyCashForm.status}
                  onChange={(event) => setPettyCashForm((current) => ({ ...current, status: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                >
                  {["pending", "approved", "rejected", "settled"].map((value) => (
                    <option key={value} value={value}>
                      {formatLabel(value)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-medium text-slate-700">Purpose</span>
                <textarea
                  required
                  rows={3}
                  value={pettyCashForm.purpose}
                  onChange={(event) => setPettyCashForm((current) => ({ ...current, purpose: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                />
              </label>
              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-medium text-slate-700">Note</span>
                <textarea
                  rows={2}
                  value={pettyCashForm.note}
                  onChange={(event) => setPettyCashForm((current) => ({ ...current, note: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                />
              </label>
              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-medium text-slate-700">Entry Date</span>
                <input
                  type="datetime-local"
                  value={pettyCashForm.date}
                  onChange={(event) => setPettyCashForm((current) => ({ ...current, date: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowPettyCashModal(false)}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingPettyCash}
                className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {isSavingPettyCash ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save Entry
              </button>
            </div>
          </form>
        </ControlModal>
      ) : null}

      {showSupplierPaymentModal ? (
        <ControlModal
          title="Add Supplier Payment"
          description="Supplier payments create linked finance transactions automatically and reduce the chosen account balance."
          onClose={() => setShowSupplierPaymentModal(false)}
        >
          <form onSubmit={handleSupplierPaymentSubmit} className="space-y-4">
            {selectedSupplierPaymentAccount ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                Selected account balance:{" "}
                <span className="font-semibold text-slate-950">{formatCurrency(getAccountBalance(selectedSupplierPaymentAccount))}</span>
              </div>
            ) : null}
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Supplier</span>
                <select
                  value={supplierPaymentForm.supplierId}
                  onChange={(event) =>
                    setSupplierPaymentForm((current) => ({ ...current, supplierId: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                >
                  <option value="">Unlinked payment</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.supplierName || supplier.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Account</span>
                <select
                  required
                  value={supplierPaymentForm.accountId}
                  onChange={(event) =>
                    setSupplierPaymentForm((current) => ({ ...current, accountId: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                >
                  <option value="">Select account</option>
                  {activeAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Voucher Number</span>
                <input
                  value={supplierPaymentForm.voucherNo}
                  onChange={(event) =>
                    setSupplierPaymentForm((current) => ({ ...current, voucherNo: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                  placeholder="Leave blank to auto-generate"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Amount</span>
                <input
                  required
                  type="number"
                  step="0.01"
                  value={supplierPaymentForm.amount}
                  onChange={(event) =>
                    setSupplierPaymentForm((current) => ({ ...current, amount: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Payment Type</span>
                <input
                  value={supplierPaymentForm.paymentType}
                  onChange={(event) =>
                    setSupplierPaymentForm((current) => ({ ...current, paymentType: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Reference</span>
                <input
                  value={supplierPaymentForm.reference}
                  onChange={(event) =>
                    setSupplierPaymentForm((current) => ({ ...current, reference: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                />
              </label>
              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-medium text-slate-700">Notes / Remark</span>
                <textarea
                  rows={3}
                  value={supplierPaymentForm.notes}
                  onChange={(event) =>
                    setSupplierPaymentForm((current) => ({ ...current, notes: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                />
              </label>
              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-medium text-slate-700">Payment Date</span>
                <input
                  type="datetime-local"
                  value={supplierPaymentForm.date}
                  onChange={(event) => setSupplierPaymentForm((current) => ({ ...current, date: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowSupplierPaymentModal(false)}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingSupplierPayment}
                className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {isSavingSupplierPayment ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save Payment
              </button>
            </div>
          </form>
        </ControlModal>
      ) : null}
    </div>
  );
}
