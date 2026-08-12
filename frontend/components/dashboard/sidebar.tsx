"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3, BadgeDollarSign, Boxes, Building2, Calculator, ClipboardList, History, LogOut, Package,
  MessageSquareText, PanelLeftClose, PanelLeftOpen, RotateCcw, Settings, ShieldCheck, ShoppingCart, Store,
  Images, Tags, Truck, UserPlus, Users, Wallet, Warehouse, Waypoints, Workflow, X, type LucideIcon,
} from "lucide-react";

import { can, type Capability } from "@/lib/capabilities";
import type { AuthUser } from "@/lib/auth";
import { NAVIGATION_GROUPS, matchesNavigationPath, navigationRegistry } from "@/lib/navigation";

type SidebarProps = {
  user: AuthUser | null;
  isCollapsed: boolean;
  isMobileOpen: boolean;
  expandedItems: string[];
  onToggleCollapse: () => void;
  onToggleExpand: (name: string) => void;
  onCloseMobile: () => void;
  onLogout: () => void;
};

const icons: Record<string, LucideIcon> = {
  dashboard: Boxes, reports: BarChart3, orders: ShoppingCart, pos: Calculator, returns: RotateCcw,
  products: Package, media: Images, inventory: Boxes, categories: ClipboardList, brands: Tags, warehouses: Warehouse,
  stock: Boxes, suppliers: UserPlus, purchases: Building2, logistics: Truck, shipments: Truck,
  couriers: Truck, customers: Users, finance: Wallet, hr: Users, tasks: ClipboardList, team: UserPlus,
  woocommerce: Waypoints, store: Store, integrations: Workflow, activity: History, settings: Settings,
  admin: ShieldCheck,
  plan: BadgeDollarSign,
  inbox: MessageSquareText,
};

function SidebarContent({ pathname, user, isCollapsed, onToggleCollapse, onNavigate, onLogout }: {
  pathname: string; user: AuthUser | null; isCollapsed: boolean; onToggleCollapse: () => void;
  onNavigate?: () => void; onLogout: () => void;
}) {
  const profileName = user?.display_name ?? user?.name ?? user?.full_name ?? "User";
  const visible = navigationRegistry.filter((entry) => can(user, entry.capability as Capability));

  return <>
    <div className={`flex p-4 ${isCollapsed ? "flex-col items-center gap-4" : "items-center justify-between gap-3"}`}>
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-accent)] text-white"><ShoppingCart size={18} /></div>
        {!isCollapsed ? <div><p className="text-lg font-extrabold">Amar <span className="text-[var(--color-accent)]">e-Com</span></p><p className="text-[8px] font-bold uppercase tracking-[0.28em] text-[var(--color-txt-sec)]">Business OS</p></div> : null}
      </div>
      <button type="button" onClick={onToggleCollapse} className="rounded-md border border-[var(--color-brd)] p-1 text-[var(--color-txt-mut)]" aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}>
        {isCollapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
      </button>
    </div>
    <nav aria-label="Primary navigation" className="dashboard-scrollbar flex-1 overflow-y-auto px-3 py-1">
      {NAVIGATION_GROUPS.map((group) => {
        const entries = visible.filter((entry) => entry.group === group);
        if (!entries.length) return null;
        return <div key={group} className="mb-4">
          {!isCollapsed ? <p className="mb-2 px-3 text-[9px] font-black uppercase tracking-[0.12em] text-[var(--color-txt-mut)]">{group}</p> : null}
          <div className="space-y-0.5">{entries.map((entry) => {
            const Icon = icons[entry.icon] ?? Boxes;
            const active = matchesNavigationPath(pathname, entry);
            return <Link key={entry.href} href={entry.href} onClick={onNavigate} aria-current={active ? "page" : undefined} aria-label={isCollapsed ? entry.label : undefined} title={isCollapsed ? entry.label : undefined} className={`group flex items-center rounded-xl px-3 py-2.5 text-[13px] transition ${isCollapsed ? "justify-center" : "gap-3"} ${active ? "bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)] font-bold text-[var(--color-accent)]" : "font-medium text-[var(--color-txt-sec)] hover:bg-[var(--color-surf-hover)]"}`}>
              <Icon size={18} aria-hidden="true" />{!isCollapsed ? <span>{entry.label}</span> : null}
            </Link>;
          })}</div>
        </div>;
      })}
    </nav>
    <div className="border-t border-[var(--color-brd)] p-3">
      {!isCollapsed ? <div className="mb-3 rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-3 py-3"><p className="truncate text-[13px] font-bold">{profileName}</p><p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[var(--color-txt-mut)]">{user?.role}</p></div> : null}
      <button type="button" onClick={onLogout} aria-label={isCollapsed ? "Log out" : undefined} className={`flex w-full items-center rounded-lg px-3 py-2.5 text-[13px] font-medium text-[var(--color-txt-sec)] hover:bg-red-50 hover:text-red-500 ${isCollapsed ? "justify-center" : "gap-3"}`}><LogOut size={18} />{!isCollapsed ? <span>Log out</span> : null}</button>
    </div>
  </>;
}

export function DashboardSidebar(props: SidebarProps) {
  const { user, isCollapsed, isMobileOpen, onToggleCollapse, onCloseMobile, onLogout } = props;
  const pathname = usePathname();
  return <>
    <aside className={`dashboard-sidebar hidden shrink-0 flex-col border-r border-[var(--color-brd)] bg-[var(--color-surf)] md:flex ${isCollapsed ? "w-16" : "w-[240px]"}`}><SidebarContent pathname={pathname} user={user} isCollapsed={isCollapsed} onToggleCollapse={onToggleCollapse} onLogout={onLogout} /></aside>
    {isMobileOpen ? <div className="fixed inset-0 z-[100] flex justify-end md:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
      <button type="button" onClick={onCloseMobile} className="absolute inset-0 h-full w-full bg-black/60" aria-label="Close mobile menu" />
      <div className="relative flex h-full w-80 flex-col bg-[var(--color-surf)] pt-6 shadow-2xl"><button type="button" onClick={onCloseMobile} aria-label="Close mobile menu" className="absolute right-4 top-4 rounded-xl p-2"><X size={20} /></button><SidebarContent pathname={pathname} user={user} isCollapsed={false} onToggleCollapse={onToggleCollapse} onNavigate={onCloseMobile} onLogout={onLogout} /></div>
    </div> : null}
  </>;
}
