"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { CartProvider } from "@/components/storefront/CartProvider";
import { StoreCategoryNav } from "@/components/storefront/StoreCategoryNav";
import { StoreFooter } from "@/components/storefront/StoreFooter";
import { StoreHeader } from "@/components/storefront/StoreHeader";
import { StorefrontHome } from "@/components/storefront/StorefrontHome";
import { StoreTopBar } from "@/components/storefront/StoreTopBar";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading-state";
import { OpsPageHeader } from "@/components/ui/ops-page-header";
import {
  FALLBACK_STOREFRONT_HOME,
  previewAdminStorefrontPage,
  type PublicStorefrontResponse,
} from "@/lib/online-store";

export default function OnlineStorePreviewPage() {
  const searchParams = useSearchParams();
  const pageId = searchParams.get("pageId");
  const [storefront, setStorefront] = useState<PublicStorefrontResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!pageId) {
        setStorefront(FALLBACK_STOREFRONT_HOME);
        setLoading(false);
        return;
      }
      try {
        const payload = await previewAdminStorefrontPage(pageId);
        if (!mounted) return;
        setStorefront(payload);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to load draft preview.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [pageId]);

  return (
    <div className="space-y-6">
      <OpsPageHeader
        eyebrow="Online Store"
        title="Preview Draft"
        description="Preview mode is visible only inside the authenticated dashboard and can include draft homepage changes."
      />
      <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-medium text-amber-800">
        Preview mode. Draft content is being rendered for admin review only.
      </div>
      {loading ? <LoadingState label="Loading draft preview..." /> : null}
      {!loading && error ? <ErrorAlert message={error} /> : null}
      {!loading && storefront ? (
        <CartProvider>
          <div className="overflow-hidden rounded-[28px] border border-[var(--color-brd)] bg-white">
            <StoreTopBar settings={storefront.settings} />
            <StoreHeader settings={storefront.settings} navigation={storefront.menus.main_nav || []} />
            <StoreCategoryNav settings={storefront.settings} items={storefront.menus.category_nav || []} />
            <div className="mx-auto max-w-[1200px] px-4 py-4 sm:px-5">
              <StorefrontHome storefront={storefront} />
            </div>
            <StoreFooter
              settings={storefront.settings}
              footerServices={storefront.menus.footer_services || []}
              footerJoinUs={storefront.menus.footer_join_us || []}
              footerSocial={storefront.menus.footer_social || []}
            />
          </div>
        </CartProvider>
      ) : null}
    </div>
  );
}
