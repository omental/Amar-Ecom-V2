"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  Calculator,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock,
  CornerDownLeft,
  Eye,
  Grid2x2,
  LayoutGrid,
  Moon,
  Package,
  Plus,
  Search,
  Settings,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Truck,
  User,
  UserPlus,
} from "lucide-react";

import { canAccessModule, type AuthUser } from "@/lib/auth";
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  type DashboardNotification,
} from "@/lib/notifications";
import { useDashboardStore } from "@/components/dashboard/store-provider";

type TopbarProps = {
  user: AuthUser | null;
  isDark: boolean;
  onToggleTheme: () => void;
  onOpenMobileMenu: () => void;
};

type NotificationFilter = "All" | "Orders" | "Tasks" | "System";

type QuickActionItem = {
  label: string;
  description: string;
  href: string;
  accentClass: string;
  iconClass: string;
  icon: typeof ShoppingCart;
  shortcut: string;
  moduleKey: string;
};

const createQuickActions: QuickActionItem[] = [
  {
    label: "New Order",
    description: "Create a new customer order",
    href: "/dashboard/orders",
    accentClass: "bg-[#EEF2FF]",
    iconClass: "text-[#3B82F6]",
    icon: ShoppingCart,
    shortcut: "Enter",
    moduleKey: "orders",
  },
  {
    label: "Add Product",
    description: "Add a new product to inventory",
    href: "/dashboard/products",
    accentClass: "bg-[#FFF7ED]",
    iconClass: "text-[#F97316]",
    icon: Package,
    shortcut: "P",
    moduleKey: "inventory",
  },
  {
    label: "Add Customer",
    description: "Create a new customer profile",
    href: "/dashboard/customers",
    accentClass: "bg-[#F0FDF4]",
    iconClass: "text-[#22C55E]",
    icon: UserPlus,
    shortcut: "C",
    moduleKey: "customers",
  },
  {
    label: "Create Task",
    description: "Create a new task or to-do",
    href: "/dashboard/tasks",
    accentClass: "bg-[#FAF5FF]",
    iconClass: "text-[#A855F7]",
    icon: ClipboardList,
    shortcut: "T",
    moduleKey: "tasks",
  },
];

const otherQuickActions: QuickActionItem[] = [
  {
    label: "Create Shipment",
    description: "Create a new shipment",
    href: "/dashboard/logistics",
    accentClass: "bg-[#FEFCE8]",
    iconClass: "text-[#EAB308]",
    icon: Truck,
    shortcut: "S",
    moduleKey: "logistics",
  },
];

function getNotificationVisual(notification: DashboardNotification) {
  const titleLower = notification.title.toLowerCase();
  const typeLower = notification.type.toLowerCase();

  if (typeLower === "order" || titleLower.includes("order")) {
    return {
      icon: ShoppingCart,
      iconColor: "text-[#3B82F6]",
      iconBg: "bg-[#EEF2FF]",
      filter: "Orders" as const,
    };
  }

  if (typeLower === "task" || titleLower.includes("task")) {
    return {
      icon: ClipboardList,
      iconColor: "text-[#F97316]",
      iconBg: "bg-[#FFF7ED]",
      filter: "Tasks" as const,
    };
  }

  if (titleLower.includes("customer") || titleLower.includes("user")) {
    return {
      icon: User,
      iconColor: "text-[#22C55E]",
      iconBg: "bg-[#F0FDF4]",
      filter: "System" as const,
    };
  }

  if (titleLower.includes("stock") || titleLower.includes("product") || typeLower === "inventory") {
    return {
      icon: Package,
      iconColor: "text-[#A855F7]",
      iconBg: "bg-[#FAF5FF]",
      filter: "System" as const,
    };
  }

  return {
    icon: Settings,
    iconColor: "text-slate-500",
    iconBg: "bg-slate-50",
    filter: "System" as const,
  };
}

function formatNotificationAge(timestamp?: string) {
  if (!timestamp) {
    return "now";
  }

  const createdAt = new Date(timestamp).getTime();
  const diffInMinutes = Math.max(1, Math.floor((Date.now() - createdAt) / 60000));
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays}d ago`;
}

export function DashboardTopbar({
  user,
  isDark,
  onToggleTheme,
  onOpenMobileMenu,
}: TopbarProps) {
  const tenant = useDashboardStore();
  const quickActionRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const [isQuickActionOpen, setIsQuickActionOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notificationFilter, setNotificationFilter] = useState<NotificationFilter>("All");
  const [notifications, setNotifications] = useState<DashboardNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotificationsLoading, setIsNotificationsLoading] = useState(false);
  const profileName = user?.display_name ?? user?.name ?? user?.full_name ?? "Admin";
  const profileInitial = (profileName[0] ?? "A").toUpperCase();

  const visibleCreateActions = useMemo(
    () => createQuickActions.filter((action) => canAccessModule(action.moduleKey, user)),
    [user],
  );
  const visibleOtherActions = useMemo(
    () => otherQuickActions.filter((action) => canAccessModule(action.moduleKey, user)),
    [user],
  );

  async function loadNotifications() {
    try {
      setIsNotificationsLoading(true);
      const [items, count] = await Promise.all([
        fetchNotifications({ limit: 20 }),
        fetchUnreadNotificationCount(),
      ]);
      setNotifications(items);
      setUnreadCount(count.unread_count);
    } finally {
      setIsNotificationsLoading(false);
    }
  }

  useEffect(() => {
    void loadNotifications();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsQuickActionOpen((current) => !current);
      }

      if (event.key === "Escape") {
        setIsQuickActionOpen(false);
        setIsNotificationsOpen(false);
      }
    };

    const handleClickOutside = (event: MouseEvent) => {
      if (quickActionRef.current && !quickActionRef.current.contains(event.target as Node)) {
        setIsQuickActionOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  async function handleMarkNotificationRead(notificationId: string, alreadyRead: boolean) {
    if (alreadyRead) {
      return;
    }

    await markNotificationRead(notificationId);
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === notificationId ? { ...notification, read: true } : notification,
      ),
    );
    setUnreadCount((current) => Math.max(0, current - 1));
  }

  async function handleMarkAllAsRead() {
    await markAllNotificationsRead();
    setNotifications((current) => current.map((notification) => ({ ...notification, read: true })));
    setUnreadCount(0);
  }

  const filteredNotifications = useMemo(() => {
    return notifications.filter((notification) => {
      if (notificationFilter === "All") {
        return true;
      }
      const { filter } = getNotificationVisual(notification);
      return filter === notificationFilter;
    });
  }, [notificationFilter, notifications]);

  return (
    <header className="dashboard-topbar sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[var(--color-brd)] bg-[var(--color-surf)] px-4 transition-all sm:px-6 lg:px-8">
      <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-6">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[color-mix(in_srgb,var(--color-brd)_60%,transparent)] bg-[var(--color-surf)] text-[var(--color-txt-pri)] shadow-[var(--shadow-subtle)] transition-all hover:bg-[var(--color-surf-hover)] md:hidden"
          aria-label="Toggle mobile menu"
        >
          <Grid2x2 size={20} />
        </button>

        <div className="group relative hidden w-full max-w-md md:block">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
            <Search className="text-[var(--color-txt-mut)] transition-colors group-focus-within:text-[var(--color-accent)]" size={18} />
          </div>
          <input
            type="text"
            placeholder="Search resources..."
            className="h-11 w-full rounded-2xl border border-transparent bg-[var(--color-surf)] py-2.5 pl-11 pr-4 text-[14px] font-medium text-[var(--color-txt-pri)] outline-none transition-all placeholder:text-[var(--color-txt-mut)] focus:border-[color-mix(in_srgb,var(--color-accent)_20%,transparent)] focus:bg-[var(--color-card)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--color-accent)_5%,transparent)]"
          />
        </div>

        <div className="flex flex-1 items-center justify-center gap-2 overflow-hidden md:hidden sm:justify-start">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-accent)] text-white">
            <ShoppingCart size={16} />
          </div>
          <span className="truncate text-lg font-bold text-[var(--color-txt-pri)] sm:hidden">Amar e-Com</span>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-6">
        <div className="hidden min-w-0 md:block">
          <label className="sr-only" htmlFor="amar-store-switcher">Current store</label>
          {tenant.stores.length > 1 ? (
            <select
              id="amar-store-switcher"
              value={tenant.store.slug}
              disabled={tenant.switching}
              onChange={(event) => {
                const store = tenant.stores.find((candidate) => candidate.slug === event.target.value);
                if (store) void tenant.switchStore(store);
              }}
              className="max-w-48 rounded-xl border border-[var(--color-brd)] bg-[var(--color-surf)] px-3 py-2 text-sm font-bold text-[var(--color-txt-pri)]"
            >
              {tenant.stores.map((store) => <option key={store.id} value={store.slug}>{store.name}</option>)}
            </select>
          ) : (
            <div className="max-w-44 truncate text-sm font-bold text-[var(--color-txt-pri)]" title={tenant.store.name}>
              {tenant.store.name}
            </div>
          )}
        </div>
        {canAccessModule("pos", user) ? (
          <Link
            href="/dashboard/pos"
            className="group hidden items-center gap-2 rounded-2xl bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)] px-5 py-2.5 text-sm font-bold text-[var(--color-accent)] transition-all hover:bg-[color-mix(in_srgb,var(--color-accent)_18%,transparent)] sm:flex"
          >
            <Calculator size={18} className="transition-transform group-hover:scale-110" />
            Quick POS
          </Link>
        ) : null}

        <div ref={quickActionRef} className="relative hidden shrink-0 sm:block">
          <button
            type="button"
            onClick={() => setIsQuickActionOpen((current) => !current)}
            className={`flex items-center gap-2 rounded-2xl border px-5 py-3 text-[13px] font-black transition-all ${
              isQuickActionOpen
                ? "border-[color-mix(in_srgb,var(--color-accent)_10%,transparent)] bg-[color-mix(in_srgb,var(--color-accent)_5%,transparent)] text-[var(--color-accent)]"
                : "border-transparent bg-[var(--color-surf-hover)] text-[var(--color-txt-sec)] hover:bg-[var(--color-surf-hover)]"
            }`}
          >
            <Plus size={18} strokeWidth={2.5} />
            <span className="hidden lg:inline">New Action</span>
            <ChevronDown size={14} strokeWidth={2.5} className={`transition-transform duration-300 ${isQuickActionOpen ? "rotate-180" : ""}`} />
          </button>

          {isQuickActionOpen ? (
            <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[10vh] cursor-default">
              <div className="fixed inset-0 bg-black/20 backdrop-blur-sm transition-all" />
              <div className="relative w-full max-w-2xl overflow-hidden rounded-[24px] border border-[var(--color-brd)] bg-[var(--color-surf)] shadow-2xl">
                <div className="flex items-start justify-between p-6 pb-4">
                  <div>
                    <h2 className="text-left text-xl font-bold text-[var(--color-txt-pri)]">Quick Action</h2>
                    <p className="text-sm font-medium text-[var(--color-txt-sec)]">Create new or start something</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsQuickActionOpen(false)}
                    className="cursor-pointer rounded-lg border border-[var(--color-brd)] bg-[var(--color-surf)] px-3 py-1.5 text-xs font-semibold text-[var(--color-txt-sec)] shadow-sm transition-colors hover:bg-[var(--color-surf-hover)]"
                  >
                    ESC
                  </button>
                </div>

                <div className="mb-4 px-6">
                  <div className="group flex items-center gap-3 rounded-[16px] border border-[var(--color-brd)] bg-[var(--color-surf)] px-4 py-3 transition-all focus-within:border-[var(--color-accent)] focus-within:ring-4 focus-within:ring-[color-mix(in_srgb,var(--color-accent)_10%,transparent)]">
                    <Search size={20} className="text-[var(--color-txt-mut)]" />
                    <input
                      type="text"
                      autoFocus
                      placeholder="Search actions (e.g. order, product, customer...)"
                      className="flex-1 border-none bg-transparent text-[15px] font-medium text-[var(--color-txt-pri)] outline-none placeholder:text-[var(--color-txt-mut)]"
                    />
                    <div className="flex items-center gap-1 rounded-md border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-2 py-1 text-[11px] font-black tracking-widest text-[var(--color-txt-mut)]">
                      <span>Ctrl</span>
                      <span>K</span>
                    </div>
                  </div>
                </div>

                <div className="mb-2 mt-6 px-6">
                  <p className="text-left text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--color-txt-sec)]">Create New</p>
                </div>

                <div className="space-y-1 px-4">
                  {visibleCreateActions.map((action) => {
                    const ActionIcon = action.icon;
                    return (
                      <Link
                        key={action.label}
                        href={action.href}
                        className="group flex items-center gap-4 rounded-[16px] p-3 transition-all hover:bg-[color-mix(in_srgb,var(--color-accent)_5%,transparent)]"
                        onClick={() => setIsQuickActionOpen(false)}
                      >
                        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] ${action.accentClass}`}>
                          <ActionIcon size={22} className={action.iconClass} strokeWidth={2} />
                        </div>
                        <div className="min-w-0 flex-1 text-left">
                          <p className="text-[15px] font-bold text-[var(--color-txt-pri)]">{action.label}</p>
                          <p className="text-[13px] font-medium text-[var(--color-txt-sec)]">{action.description}</p>
                        </div>
                        <div className="flex items-center gap-3 opacity-0 transition-opacity group-hover:opacity-100">
                          <span className="flex items-center gap-1 rounded-lg border border-[var(--color-brd)] bg-[var(--color-surf)] px-2.5 py-1 text-[11px] font-bold text-[var(--color-txt-sec)] shadow-sm">
                            <CornerDownLeft size={12} />
                            {action.shortcut}
                          </span>
                          <ChevronRight size={18} className="text-[var(--color-txt-mut)]" />
                        </div>
                      </Link>
                    );
                  })}
                </div>

                <div className="mb-2 mt-4 border-t border-[var(--color-brd)] px-6 pt-4">
                  <p className="text-left text-[11px] font-bold uppercase tracking-[0.15em] text-[var(--color-txt-sec)]">Other Actions</p>
                </div>

                <div className="mb-6 space-y-1 px-4">
                  {visibleOtherActions.map((action) => {
                    const ActionIcon = action.icon;
                    return (
                      <Link
                        key={action.label}
                        href={action.href}
                        className="group flex items-center gap-4 rounded-[16px] p-3 transition-all hover:bg-[color-mix(in_srgb,var(--color-warning)_8%,transparent)]"
                        onClick={() => setIsQuickActionOpen(false)}
                      >
                        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] ${action.accentClass}`}>
                          <ActionIcon size={22} className={action.iconClass} strokeWidth={2} />
                        </div>
                        <div className="min-w-0 flex-1 text-left">
                          <p className="text-[15px] font-bold text-[var(--color-txt-pri)]">{action.label}</p>
                          <p className="text-[13px] font-medium text-[var(--color-txt-sec)]">{action.description}</p>
                        </div>
                        <div className="flex items-center gap-3 opacity-0 transition-opacity group-hover:opacity-100">
                          <span className="rounded-lg border border-[var(--color-brd)] bg-[var(--color-surf)] px-2.5 py-1 text-[11px] font-bold text-[var(--color-txt-sec)] shadow-sm">
                            {action.shortcut}
                          </span>
                          <ChevronRight size={18} className="text-[var(--color-txt-mut)]" />
                        </div>
                      </Link>
                    );
                  })}
                </div>

                <div className="relative z-10 mt-2 border-t border-[color-mix(in_srgb,var(--color-brd)_50%,transparent)] bg-[linear-gradient(to_top,rgba(241,245,249,0.5),transparent)] p-4">
                  <div className="flex flex-col justify-between gap-3 rounded-[16px] border border-[var(--color-brd)] bg-[var(--color-surf-hover)] p-3 sm:flex-row sm:items-center">
                    <div className="flex w-full items-center gap-3">
                      <Sparkles size={16} className="shrink-0 text-[var(--color-accent)]" />
                      <span className="truncate text-[13px] font-medium text-[var(--color-txt-sec)]">
                        <strong>Tip:</strong> You can also use shortcuts to quickly create new items
                      </span>
                    </div>
                    <button
                      type="button"
                      className="flex shrink-0 items-center justify-center gap-2 rounded-lg border border-[var(--color-brd)] bg-[var(--color-surf)] px-3 py-1.5 text-[12px] font-bold text-[var(--color-txt-pri)] shadow-sm transition-colors hover:bg-[var(--color-surf-hover)]"
                    >
                      View All Actions <LayoutGrid size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={onToggleTheme}
            className="group relative rounded-xl p-2 text-[var(--color-txt-mut)] transition-all hover:bg-[var(--color-surf-hover)] hover:text-[var(--color-accent)] sm:p-2.5"
            title={`Switch to ${isDark ? "light" : "dark"} mode`}
          >
            {isDark ? <Sun size={22} className="transition-transform group-hover:rotate-45" /> : <Moon size={22} className="transition-transform group-hover:rotate-12" />}
          </button>

          <div ref={notificationsRef} className="relative">
            <button
              type="button"
              onClick={() => setIsNotificationsOpen((current) => !current)}
              className={`relative rounded-xl border border-transparent p-2 transition-all sm:p-2.5 ${
                isNotificationsOpen
                  ? "border-[color-mix(in_srgb,var(--color-accent)_10%,transparent)] bg-[color-mix(in_srgb,var(--color-accent)_5%,transparent)] text-[var(--color-accent)]"
                  : "text-[var(--color-txt-mut)] hover:bg-[var(--color-surf-hover)] hover:text-[var(--color-accent)]"
              }`}
            >
              <Bell size={22} className={unreadCount > 0 ? "fill-[color-mix(in_srgb,var(--color-danger)_10%,transparent)]" : ""} />
              {unreadCount > 0 ? (
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full border-2 border-[var(--color-card)] bg-[var(--color-danger)] ring-4 ring-[color-mix(in_srgb,var(--color-danger)_10%,transparent)]" />
              ) : null}
            </button>

            {isNotificationsOpen ? (
              <div className="shell-popover absolute right-0 mt-4 w-80 overflow-hidden rounded-[20px] border border-[var(--color-brd)] bg-[var(--color-surf)] shadow-2xl sm:w-[420px]">
                <div className="flex items-start justify-between p-4 pb-3">
                  <div>
                    <h3 className="text-lg font-bold tracking-tight text-[var(--color-txt-pri)]">Notifications</h3>
                    <p className="mt-0.5 text-[12px] font-medium text-[var(--color-txt-sec)]">Stay updated with your latest activity</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => void handleMarkAllAsRead()}
                      className="text-[12px] font-bold text-[#3B82F6] transition-all hover:underline"
                    >
                      Mark all as read
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-[var(--color-brd)] bg-[var(--color-surf)] p-1.5 text-[var(--color-txt-sec)] shadow-sm transition-colors hover:bg-[var(--color-surf-hover)] hover:text-[var(--color-txt-pri)]"
                    >
                      <SlidersHorizontal size={16} />
                    </button>
                  </div>
                </div>

                <div className="dashboard-scrollbar flex items-center gap-2 overflow-x-auto border-b border-[color-mix(in_srgb,var(--color-brd)_50%,transparent)] px-4 pb-3">
                  {(["All", "Orders", "Tasks", "System"] as NotificationFilter[]).map((filter) => {
                    const filterStyles =
                      filter === "All"
                        ? "border-[#3B82F6] bg-[#EFF6FF] text-[#3B82F6]"
                        : filter === "Orders"
                          ? "border-[#22C55E] bg-[#F0FDF4] text-[#22C55E]"
                          : filter === "Tasks"
                            ? "border-[#F97316] bg-[#FFF7ED] text-[#F97316]"
                            : "border-[#A855F7] bg-[#FAF5FF] text-[#A855F7]";

                    const isActive = notificationFilter === filter;
                    const FilterIcon =
                      filter === "Orders" ? ShoppingCart : filter === "Tasks" ? ClipboardList : filter === "System" ? Settings : Eye;

                    return (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => setNotificationFilter(filter)}
                        className={`shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-bold transition-colors ${isActive ? filterStyles : "border-[var(--color-brd)] bg-[var(--color-surf)] text-[var(--color-txt-sec)] hover:bg-[var(--color-surf-hover)] hover:text-[var(--color-txt-pri)]"}`}
                      >
                        <span className="flex items-center gap-1.5">
                          <FilterIcon size={14} strokeWidth={2.5} />
                          {filter}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="dashboard-scrollbar max-h-[360px] overflow-y-auto pb-2">
                  {isNotificationsLoading ? (
                    <div className="py-12 text-center text-[var(--color-txt-sec)]">
                      <p className="font-medium">Loading notifications...</p>
                    </div>
                  ) : filteredNotifications.length > 0 ? (
                    <div className="divide-y divide-[color-mix(in_srgb,var(--color-brd)_40%,transparent)]">
                      {filteredNotifications.slice(0, 5).map((notification) => {
                        const isRead = notification.read;
                        const visual = getNotificationVisual(notification);
                        const NotificationIcon = visual.icon;

                        return (
                          <button
                            key={notification.id}
                            type="button"
                            className={`flex w-full cursor-pointer items-start gap-2.5 border-l-2 px-3 py-2.5 text-left transition-all hover:bg-[color-mix(in_srgb,var(--color-surf-hover)_60%,transparent)] ${
                              isRead
                                ? "border-transparent bg-[var(--color-surf)]"
                                : "border-[#3B82F6] bg-[#F8FAFC]"
                            }`}
                            onClick={() => void handleMarkNotificationRead(notification.id, isRead)}
                          >
                            <div className={`mt-0.5 flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-lg ${visual.iconBg}`}>
                              <NotificationIcon size={14} className={visual.iconColor} strokeWidth={2.5} />
                            </div>
                            <div className="min-w-0 flex-1 pr-1">
                              <h4 className={`mb-0.5 text-[12px] font-bold ${isRead ? "text-[var(--color-txt-sec)]" : "text-[var(--color-txt-pri)]"}`}>
                                {notification.title}
                              </h4>
                              <p className="mb-1 line-clamp-1 text-[11px] font-medium leading-snug text-[color-mix(in_srgb,var(--color-txt-sec)_80%,transparent)]">
                                {notification.message}
                              </p>
                              <div className="flex items-center gap-1 text-[var(--color-txt-mut)]">
                                <Clock size={9} strokeWidth={2.5} />
                                <span className="text-[10px] font-semibold">
                                  {formatNotificationAge(notification.created_at)}
                                </span>
                              </div>
                            </div>
                            <div className="flex w-2 shrink-0 items-center justify-center pt-1.5">
                              {!isRead ? <div className="h-1.5 w-1.5 rounded-full bg-[#3B82F6]" /> : null}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-12 text-center text-[var(--color-txt-sec)]">
                      <p className="font-medium">No {notificationFilter.toLowerCase()} notifications found.</p>
                    </div>
                  )}

                  <div className="mt-2 px-6 pt-4">
                    <button
                      type="button"
                      className="group flex w-full items-center justify-between rounded-xl border border-[var(--color-brd)] bg-transparent p-4 transition-colors hover:bg-[var(--color-surf-hover)]"
                    >
                      <div className="flex items-center gap-3 text-[var(--color-txt-sec)] transition-colors group-hover:text-[var(--color-txt-pri)]">
                        <Eye size={18} strokeWidth={2.5} />
                        <span className="text-[14px] font-bold">View all notifications</span>
                      </div>
                      <ChevronRight size={18} className="text-[var(--color-txt-mut)] transition-colors group-hover:text-[var(--color-txt-pri)]" />
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mx-1 hidden h-8 w-px bg-[var(--color-surf-hover)] sm:block" />

        <div className="group flex cursor-pointer items-center gap-3 rounded-2xl p-1 transition-all hover:bg-[var(--color-surf-hover)]">
          <div className="h-10 w-10 overflow-hidden rounded-xl border-2 border-white bg-[var(--color-surf-hover)] shadow-[var(--shadow-subtle)] transition-transform duration-300 group-hover:scale-110">
            {user?.photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.photoURL} alt="Profile" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)] font-bold text-[var(--color-accent)]">
                {profileInitial}
              </div>
            )}
          </div>
          <div className="hidden pr-3 text-left lg:block">
            <p className="mb-1 text-sm font-bold leading-none text-[var(--color-txt-pri)]">{profileName}</p>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--color-txt-mut)]">Business OS Master</p>
          </div>
        </div>
      </div>
    </header>
  );
}
