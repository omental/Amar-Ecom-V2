"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getBreadcrumbs } from "@/lib/navigation";

export function DashboardBreadcrumbs() {
  const pathname = usePathname();
  const breadcrumbs = getBreadcrumbs(pathname);
  if (pathname === "/dashboard") return null;
  return <nav aria-label="Breadcrumb" className="mb-4">
    <ol className="flex flex-wrap items-center gap-1 text-xs text-[var(--color-txt-mut)]">
      {breadcrumbs.map((crumb, index) => <li key={`${crumb.href}-${index}`} className="flex items-center gap-1">
        {index ? <ChevronRight size={12} aria-hidden="true" /> : null}
        {crumb.current ? <span aria-current="page" className="font-semibold text-[var(--color-txt-sec)]">{crumb.label}</span> : <Link href={crumb.href} className="rounded-sm hover:text-[var(--color-accent)] focus-visible:outline-2 focus-visible:outline-offset-2">{crumb.label}</Link>}
      </li>)}
    </ol>
  </nav>;
}
