"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { api } from "@/lib/api";
import { entitlementLimit, hasEntitlement, type CommercialSummary, type UsageSummary } from "@/lib/commercial";
import { useDashboardStore } from "@/components/dashboard/store-provider";

type EntitlementContextValue = {
  summary: CommercialSummary | null;
  loading: boolean;
  can: (feature: string) => boolean;
  limit: (feature: string) => number | null | undefined;
  usage: (feature: string) => UsageSummary | undefined;
  refresh: () => Promise<void>;
};

const EntitlementContext = createContext<EntitlementContextValue | null>(null);

export function EntitlementProvider({ children }: { children: ReactNode }) {
  const { store } = useDashboardStore();
  const [summary, setSummary] = useState<CommercialSummary | null>(null);

  const refresh = useCallback(async () => {
    try {
      setSummary(await api.get<CommercialSummary>("/commercial/summary"));
    } catch {
      setSummary(null);
    }
  }, []);

  useEffect(() => {
    let active = true;
    api.get<CommercialSummary>("/commercial/summary").then(
      (value) => { if (active) setSummary(value); },
      () => { if (active) setSummary(null); },
    );
    return () => { active = false; };
  }, [store.id]);

  useEffect(() => {
    const listener = () => { void refresh(); };
    window.addEventListener("amar:commercial-changed", listener);
    return () => window.removeEventListener("amar:commercial-changed", listener);
  }, [refresh]);

  const loading = summary?.store_id !== store.id;

  const value = useMemo<EntitlementContextValue>(() => ({
    summary,
    loading,
    can: (feature) => hasEntitlement(summary, feature),
    limit: (feature) => entitlementLimit(summary, feature),
    usage: (feature) => summary?.usage[feature],
    refresh,
  }), [loading, refresh, summary]);

  return <EntitlementContext.Provider value={value}>{children}</EntitlementContext.Provider>;
}

export function useEntitlements() {
  const context = useContext(EntitlementContext);
  if (!context) throw new Error("useEntitlements must be used inside EntitlementProvider");
  return context;
}
