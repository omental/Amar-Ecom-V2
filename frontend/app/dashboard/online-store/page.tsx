"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { OnlineStoreTabs } from "@/components/dashboard/online-store/OnlineStoreTabs";
import { ErrorAlert } from "@/components/ui/error-alert";
import { FormCard } from "@/components/ui/form-card";
import { LoadingState } from "@/components/ui/loading-state";
import { OpsPageHeader } from "@/components/ui/ops-page-header";
import { api, ApiError } from "@/lib/api";
import type { StorefrontOverview } from "@/lib/online-store";

export default function OnlineStoreOverviewPage() {
  const [overview, setOverview] = useState<StorefrontOverview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const payload = await api.get<StorefrontOverview>("/admin/storefront/overview");
        if (!mounted) return;
        setOverview(payload);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof ApiError ? err.message : "Failed to load online store overview.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <OpsPageHeader
        eyebrow="Online Store"
        title="Storefront Builder"
        description="Manage the public storefront with controlled sections, navigation, pages, banners, and theme settings."
        actions={
          <Link href="/" className="inline-flex items-center rounded-full bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white">
            View Storefront
          </Link>
        }
      />
      <OnlineStoreTabs />

      {loading ? <LoadingState label="Loading online store overview..." /> : null}
      {!loading && error ? <ErrorAlert message={error} /> : null}

      {!loading && overview ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Storefront Status", value: overview.storefront_status === "active" ? "Active" : "Inactive" },
              { label: "Homepage Sections", value: String(overview.homepage_sections_count) },
              { label: "Menus", value: String(overview.menus_count) },
              { label: "Published Pages", value: String(overview.published_pages_count) },
            ].map((item) => (
              <div key={item.label} className="card-base p-5">
                <p className="ops-micro-label">{item.label}</p>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-[var(--color-txt-pri)]">
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          <FormCard
            title="Quick Actions"
            description="Jump into the areas that shape the public storefront experience."
          >
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Customize Homepage", href: "/dashboard/online-store/customize" },
                { label: "Edit Navigation", href: "/dashboard/online-store/navigation" },
                { label: "Edit Theme Settings", href: "/dashboard/online-store/theme" },
                { label: "View Storefront", href: "/" },
              ].map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="rounded-[18px] border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-4 text-sm font-semibold text-[var(--color-txt-pri)] transition hover:bg-[var(--color-surf)]"
                >
                  {action.label}
                </Link>
              ))}
            </div>
          </FormCard>
        </>
      ) : null}
    </div>
  );
}
