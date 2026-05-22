"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { OnlineStoreTabs } from "@/components/dashboard/online-store/OnlineStoreTabs";
import { ErrorAlert } from "@/components/ui/error-alert";
import { FormCard } from "@/components/ui/form-card";
import { LoadingState } from "@/components/ui/loading-state";
import { OpsPageHeader } from "@/components/ui/ops-page-header";
import { api, ApiError } from "@/lib/api";
import type { OnlineStoreTemplatePreset } from "@/lib/online-store";

export default function OnlineStoreTemplatesPage() {
  const [templates, setTemplates] = useState<OnlineStoreTemplatePreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingKey, setWorkingKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const payload = await api.get<OnlineStoreTemplatePreset[]>("/admin/storefront/templates");
        if (!mounted) return;
        setTemplates(payload);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof ApiError ? err.message : "Failed to load storefront templates.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  async function applyTemplate(templateKey: string) {
    const confirmed = window.confirm(
      "This will replace the homepage section layout, but keep products, orders, coupons, media, and custom pages.",
    );
    if (!confirmed) return;

    setWorkingKey(templateKey);
    setError("");
    setSuccess("");
    try {
      await api.post(`/admin/storefront/templates/${templateKey}/apply`, {
        replace_homepage: true,
      });
      setSuccess("Template applied. You can continue in Customize to fine-tune the homepage.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to apply template.");
    } finally {
      setWorkingKey(null);
    }
  }

  return (
    <div className="space-y-6">
      <OpsPageHeader
        eyebrow="Online Store"
        title="Templates"
        description="Choose a controlled storefront preset to reset the homepage layout safely without affecting products, orders, coupons, media, or checkout."
      />
      <OnlineStoreTabs />
      {loading ? <LoadingState label="Loading storefront templates..." /> : null}
      {!loading && error ? <ErrorAlert message={error} /> : null}
      {success ? (
        <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-700">
          {success}
        </div>
      ) : null}

      {!loading ? (
        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {templates.map((template) => (
            <FormCard
              key={template.key}
              title={template.name}
              description={template.description}
              action={(
                <button
                  type="button"
                  onClick={() => void applyTemplate(template.key)}
                  disabled={workingKey === template.key}
                  className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {workingKey === template.key ? "Applying..." : "Apply Template"}
                </button>
              )}
            >
              <div className="space-y-4 text-sm text-[var(--color-txt-sec)]">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--color-txt-mut)]">Best For</p>
                  <p className="mt-2">{template.best_for}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    template.recommended_typography_preset,
                    template.recommended_color_preset,
                    template.recommended_animation_preset,
                    template.product_card_style,
                    template.button_style,
                  ].map((item) => (
                    <span key={item} className="rounded-full bg-[var(--color-surf-hover)] px-3 py-1.5 text-[11px] font-semibold text-[var(--color-txt-pri)]">
                      {item.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--color-txt-mut)]">Included Sections</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {template.default_homepage_sections.map((section) => (
                      <span key={`${template.key}-${section.type}-${section.title || ""}`} className="rounded-full border border-[var(--color-brd)] px-3 py-1.5 text-[11px] font-semibold text-[var(--color-txt-pri)]">
                        {section.type.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                  This will replace the homepage section layout, but keep products, orders, coupons, media, and custom pages.
                </div>
                <Link href="/dashboard/online-store/customize" className="inline-flex text-sm font-semibold text-[var(--color-accent)]">
                  Go to Customize
                </Link>
              </div>
            </FormCard>
          ))}
        </div>
      ) : null}
    </div>
  );
}
