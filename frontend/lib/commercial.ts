export type EntitlementValue = boolean | number | string | null;

export type PlanSummary = {
  id: string;
  key: string;
  version: number;
  name: string;
  description: string | null;
  status: string;
  sort_order: number;
  is_public: boolean;
  monthly_price_display: string | null;
  annual_price_display: string | null;
  trial_days: number;
  entitlements: Record<string, EntitlementValue>;
};

export type UsageSummary = {
  feature: string;
  usage: number;
  limit: number | null;
  remaining: number | null;
  over_limit: boolean;
};

export type CommercialSummary = {
  store_id: string;
  plan: PlanSummary;
  status: "trialing" | "active" | "expired" | "suspended" | string;
  trial: {
    started_at: string | null;
    ends_at: string | null;
    days_remaining: number | null;
  };
  entitlements: Record<string, EntitlementValue>;
  usage: Record<string, UsageSummary>;
};

export function hasEntitlement(summary: CommercialSummary | null, feature: string) {
  return Boolean(summary && ["active", "trialing"].includes(summary.status) && summary.entitlements[feature] === true);
}

export function entitlementLimit(summary: CommercialSummary | null, feature: string) {
  const value = summary?.entitlements[feature];
  return typeof value === "number" ? value : value === null ? null : undefined;
}

export function formatLimit(value: number | null | undefined) {
  return value === null ? "Unlimited" : value === undefined ? "Not available" : value.toLocaleString();
}

export function usagePercent(item: UsageSummary) {
  if (item.limit === null) return 0;
  if (item.limit <= 0) return item.usage > 0 ? 100 : 0;
  return Math.min(100, Math.round((item.usage / item.limit) * 100));
}

export function trialLabel(summary: CommercialSummary | null) {
  if (!summary) return null;
  if (summary.status === "expired") return "Trial expired";
  if (summary.status !== "trialing" || summary.trial.days_remaining === null) return null;
  const days = summary.trial.days_remaining;
  return days === 1 ? "1 day left in your trial" : `${days} days left in your trial`;
}
