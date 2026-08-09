"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { can as checkCapability, hasFullAccess, resolveCapabilities, type Capability } from "@/lib/capabilities";
import type { AuthUser } from "@/lib/auth";

type AuthorizationContextValue = {
  user: AuthUser | null;
  capabilities: ReadonlySet<string>;
  hasFullAccess: boolean;
  can: (capability: Capability | string) => boolean;
};

const AuthorizationContext = createContext<AuthorizationContextValue | null>(null);

export function AuthorizationProvider({ user, children }: { user: AuthUser | null; children: ReactNode }) {
  const value = useMemo<AuthorizationContextValue>(() => ({
    user,
    capabilities: resolveCapabilities(user),
    hasFullAccess: hasFullAccess(user),
    can: (capability) => checkCapability(user, capability),
  }), [user]);
  return <AuthorizationContext.Provider value={value}>{children}</AuthorizationContext.Provider>;
}

export function useAuthorization() {
  const context = useContext(AuthorizationContext);
  if (!context) throw new Error("useAuthorization must be used inside AuthorizationProvider");
  return context;
}

export function CapabilityGate({ capability, children, fallback = null }: { capability: Capability | string; children: ReactNode; fallback?: ReactNode }) {
  return useAuthorization().can(capability) ? children : fallback;
}
