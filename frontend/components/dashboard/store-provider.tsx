"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { api } from "@/lib/api";
import { clearSelectedStore, getSelectedStoreSlug, setSelectedStoreSlug, type StoreContextResponse, type StoreSummary } from "@/lib/tenant";

type DashboardStoreContextValue = StoreContextResponse & {
  switching: boolean;
  switchStore: (store: StoreSummary) => Promise<void>;
};

const DashboardStoreContext = createContext<DashboardStoreContextValue | null>(null);

export function DashboardStoreProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [tenant, setTenant] = useState<StoreContextResponse | null>(null);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadTenant() {
      try {
        let response: StoreContextResponse;
        try {
          response = await api.get<StoreContextResponse>("/tenant/current");
        } catch {
          clearSelectedStore();
          response = await api.get<StoreContextResponse>("/tenant/current");
        }
        if (!active) return;
        setSelectedStoreSlug(response.store.slug);
        setTenant(response);
      } catch {
        if (active) window.dispatchEvent(new CustomEvent("amar:session-expired"));
      }
    }
    void loadTenant();
    return () => { active = false; };
  }, []);

  const value = useMemo<DashboardStoreContextValue | null>(() => tenant ? {
    ...tenant,
    switching,
    async switchStore(store) {
      if (store.id === tenant.store.id || switching) return;
      setSwitching(true);
      try {
        const switched = await api.post<{ store: StoreSummary }>(`/tenant/switch/${encodeURIComponent(store.slug)}`);
        setSelectedStoreSlug(store.slug);
        window.dispatchEvent(new CustomEvent("amar:store-changed", { detail: { storeId: store.id, storeSlug: store.slug } }));
        setTenant((current) => current ? { ...current, store: switched.store } : current);
        router.replace("/dashboard");
        router.refresh();
      } finally {
        setSwitching(false);
      }
    },
  } : null, [router, switching, tenant]);

  if (!value) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">Loading store workspace…</div>;
  }
  return <DashboardStoreContext.Provider value={value}><div key={value.store.id} className="contents">{children}</div></DashboardStoreContext.Provider>;
}

export function useDashboardStore() {
  const context = useContext(DashboardStoreContext);
  if (!context) throw new Error("useDashboardStore must be used inside DashboardStoreProvider");
  return context;
}

export function selectedStoreForRequest() {
  return getSelectedStoreSlug();
}
