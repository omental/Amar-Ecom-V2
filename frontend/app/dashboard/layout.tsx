"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Toaster } from "sonner";

import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { DashboardTopbar } from "@/components/dashboard/topbar";
import { AuthorizationProvider } from "@/components/dashboard/authorization-provider";
import { DashboardStoreProvider } from "@/components/dashboard/store-provider";
import { EntitlementProvider } from "@/components/dashboard/entitlement-provider";
import { TrialBanner } from "@/components/dashboard/trial-banner";
import { DashboardBreadcrumbs } from "@/components/dashboard/breadcrumbs";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading-state";
import {
  fetchCurrentUser,
  getUser,
  isAuthenticated,
  logout,
  type AuthUser,
} from "@/lib/auth";
import { can } from "@/lib/capabilities";
import { getNavigationEntry } from "@/lib/navigation";
import { api } from "@/lib/api";
import type { AccountState } from "@/lib/onboarding";

const sidebarExpandableItems = [
  {
    name: "Orders",
    matchers: ["/dashboard/orders", "/dashboard/returns"],
  },
  {
    name: "Inventory",
    matchers: [
      "/dashboard/inventory",
      "/dashboard/products",
      "/dashboard/categories",
      "/dashboard/brands",
      "/dashboard/warehouses",
      "/dashboard/stock-movements",
      "/dashboard/suppliers",
      "/dashboard/purchase-orders",
    ],
  },
];

function getInitialExpandedItems(pathname: string) {
  const activeItem = sidebarExpandableItems.find(({ matchers }) =>
    matchers.some((matcher) => pathname === matcher || pathname.startsWith(`${matcher}/`)),
  );

  return activeItem ? [activeItem.name] : [];
}

function getStoredTheme() {
  if (typeof window === "undefined") {
    return "light";
  }

  return window.localStorage.getItem("amar_theme") === "dark" ? "dark" : "light";
}

export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const router = useRouter();
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => getUser());
  const [isLoading, setIsLoading] = useState(true);
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [theme, setTheme] = useState<"light" | "dark">(() => getStoredTheme());

  useEffect(() => {
    const hasToken = isAuthenticated();
    if (!hasToken) {
      router.replace("/login");
      return;
    }

    let isMounted = true;

    async function loadCurrentUser() {
      setIsLoading(true);
      try {
        const user = await fetchCurrentUser();
        if (!isMounted) return;
        const accountState = await api.get<AccountState>("/onboarding/account-state");
        if (!isMounted) return;
        if (!accountState.has_store) {
          router.replace("/onboarding/setup");
          return;
        }
        setCurrentUser(user);
        setWorkspaceReady(true);
      } catch {
        logout();
        if (isMounted) {
          router.replace("/login");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadCurrentUser();

    return () => {
      isMounted = false;
    };
  }, [router]);

  useEffect(() => {
    function handleSessionExpired() {
      setCurrentUser(null);
      router.replace("/login?reason=session-expired");
    }
    window.addEventListener("amar:session-expired", handleSessionExpired);
    return () => window.removeEventListener("amar:session-expired", handleSessionExpired);
  }, [router]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const hasToken = typeof window !== "undefined" ? isAuthenticated() : false;

  const isDark = useMemo(() => theme === "dark", [theme]);
  const effectiveSidebarCollapsed = isSidebarCollapsed;
  const effectiveExpandedItems = useMemo(() => {
    const routeExpandedItems = getInitialExpandedItems(pathname);
    return Array.from(new Set([...routeExpandedItems, ...expandedItems]));
  }, [expandedItems, pathname]);

  function handleLogout() {
    logout();
    router.replace("/login");
  }

  function handleToggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
    window.localStorage.setItem("amar_theme", nextTheme);
  }

  function handleToggleExpand(name: string) {
    setExpandedItems((current) =>
      current.includes(name) ? current.filter((item) => item !== name) : [name],
    );
  }

  if (typeof window === "undefined" || !hasToken || isLoading || !workspaceReady) {
    return (
      <div className="app-shell flex min-h-screen items-center justify-center p-6">
        <div className="card-base px-6 py-5 text-sm font-medium text-[var(--color-txt-sec)]">
          <LoadingState label="Preparing your workspace..." variant="page" />
        </div>
      </div>
    );
  }

  const routeEntry = getNavigationEntry(pathname);
  const canViewRoute = routeEntry ? can(currentUser, routeEntry.capability) : false;

  return (
    <div className="dashboard-shell min-h-screen overflow-x-hidden">
      <Toaster position="top-right" richColors closeButton />
      <DashboardStoreProvider><EntitlementProvider><div className="flex min-h-screen bg-[var(--color-surf)] transition-colors duration-300">
        <DashboardSidebar
          user={currentUser}
          isCollapsed={effectiveSidebarCollapsed}
          isMobileOpen={isMobileMenuOpen}
          expandedItems={effectiveExpandedItems}
          onToggleCollapse={() => setIsSidebarCollapsed((current) => !current)}
          onToggleExpand={handleToggleExpand}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
          onLogout={handleLogout}
        />

        <div className="flex min-w-0 max-w-full flex-1 flex-col overflow-hidden bg-[var(--color-bg)]">
          <DashboardTopbar
            user={currentUser}
            isDark={isDark}
            onToggleTheme={handleToggleTheme}
            onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
          />

          <main className="flex-1 overflow-auto min-w-0 max-w-full">
            <div className="mx-auto w-full max-w-[1600px] min-w-0 max-w-full px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
              <AuthorizationProvider user={currentUser}>
                <DashboardBreadcrumbs />
                <TrialBanner />
                <div className="min-w-0 w-full max-w-full overflow-x-hidden">
                  {canViewRoute ? children : <ErrorAlert title="Permission denied" message="You do not have permission to view this workspace. Ask an administrator to update your access." persistent />}
                </div>
              </AuthorizationProvider>
            </div>
          </main>
        </div>
      </div></EntitlementProvider></DashboardStoreProvider>
    </div>
  );
}
