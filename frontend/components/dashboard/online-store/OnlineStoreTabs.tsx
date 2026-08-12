"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { label: "Overview", href: "/dashboard/online-store" },
  { label: "Themes", href: "/dashboard/online-store/themes" },
  { label: "Customize", href: "/dashboard/online-store/customize" },
  { label: "Templates", href: "/dashboard/online-store/templates" },
  { label: "Revisions", href: "/dashboard/online-store/revisions" },
  { label: "Header & Footer", href: "/dashboard/online-store/header-footer" },
  { label: "Navigation", href: "/dashboard/online-store/navigation" },
  { label: "Pages", href: "/dashboard/online-store/pages" },
  { label: "Custom Data", href: "/dashboard/online-store/custom-data" },
  { label: "Domains", href: "/dashboard/online-store/domains" },
  { label: "Banners", href: "/dashboard/online-store/banners" },
  { label: "Coupons", href: "/dashboard/online-store/coupons" },
  { label: "Theme Settings", href: "/dashboard/online-store/theme" },
  { label: "SEO", href: "/dashboard/online-store/seo" },
];

export function OnlineStoreTabs() {
  const pathname = usePathname();

  return (
    <div className="space-y-3">
    <div className="no-scrollbar overflow-x-auto">
      <div className="inline-flex min-w-full gap-2 rounded-[22px] border border-[var(--color-brd)] bg-[var(--color-surf)] p-2 shadow-[var(--shadow-subtle)]">
        {tabs.map((tab) => {
          const active = pathname === tab.href;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`rounded-[16px] px-4 py-2.5 text-sm font-semibold transition ${
                active
                  ? "bg-[var(--color-accent)] text-white"
                  : "text-[var(--color-txt-sec)] hover:bg-[var(--color-surf-hover)] hover:text-[var(--color-txt-pri)]"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
      </div>
      <div role="note" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
        Seeded storefront defaults and demo/reference media may be present. Verify products, links, contact details, banners, and published status before treating content as production-ready.
      </div>
    </div>
  );
}
