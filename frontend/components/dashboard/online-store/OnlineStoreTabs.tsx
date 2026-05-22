"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { label: "Overview", href: "/dashboard/online-store" },
  { label: "Customize", href: "/dashboard/online-store/customize" },
  { label: "Header & Footer", href: "/dashboard/online-store/header-footer" },
  { label: "Navigation", href: "/dashboard/online-store/navigation" },
  { label: "Pages", href: "/dashboard/online-store/pages" },
  { label: "Banners", href: "/dashboard/online-store/banners" },
  { label: "Coupons", href: "/dashboard/online-store/coupons" },
  { label: "Theme Settings", href: "/dashboard/online-store/theme" },
  { label: "SEO", href: "/dashboard/online-store/seo" },
];

export function OnlineStoreTabs() {
  const pathname = usePathname();

  return (
    <div className="no-scrollbar overflow-x-auto">
      <div className="inline-flex min-w-full gap-2 rounded-[22px] border border-[var(--color-brd)] bg-[var(--color-surf)] p-2 shadow-[var(--shadow-subtle)]">
        {tabs.map((tab) => {
          const active = pathname === tab.href;

          return (
            <Link
              key={tab.href}
              href={tab.href}
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
  );
}
