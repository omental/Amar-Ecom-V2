export type BillingCycle = "monthly" | "annual";

export type PlanPrice = {
  id: string;
  plan_id: string;
  plan_key: string | null;
  plan_name: string | null;
  key: string;
  billing_cycle: BillingCycle;
  currency: string;
  amount: string;
};

export type Subscription = {
  id: string;
  plan_key: string;
  plan_version: number;
  price_key: string;
  billing_cycle: BillingCycle;
  status: string;
  currency: string;
  unit_amount: string;
  current_period_start: string | null;
  current_period_end: string | null;
  grace_ends_at: string | null;
  cancel_at_period_end: boolean;
  pending_price_id: string | null;
};

export type BillingSummary = {
  billing_account_id: string | null;
  subscription: Subscription | null;
  commercial_status: string;
};

export type CheckoutSession = { id: string; status: string; provider: string; checkout_url: string | null; expires_at: string };

export type BillingInvoice = {
  id: string;
  invoice_number: string;
  status: string;
  currency: string;
  total: string;
  amount_paid: string;
  amount_due: string;
  period_start: string | null;
  period_end: string | null;
  paid_at: string | null;
  created_at: string;
  lines: { description: string; quantity: number; unit_amount: string; amount: string }[];
};

export function formatMoney(amount: string | number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(amount));
}

export function billingStatusMessage(summary: BillingSummary | null) {
  const subscription = summary?.subscription;
  if (!subscription) return "Your Store is using its trial or legacy commercial assignment.";
  if (subscription.status === "past_due") return subscription.grace_ends_at ? `Payment is past due. Grace access continues until ${new Date(subscription.grace_ends_at).toLocaleDateString()}.` : "Payment is past due.";
  if (subscription.cancel_at_period_end) return `Cancellation is scheduled. Access remains active until ${subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString() : "the paid period ends"}.`;
  return `${subscription.plan_key} is ${subscription.status}.`;
}

export function annualSavings(monthly: PlanPrice | undefined, annual: PlanPrice | undefined) {
  if (!monthly || !annual) return 0;
  return Math.max(0, Number(monthly.amount) * 12 - Number(annual.amount));
}
