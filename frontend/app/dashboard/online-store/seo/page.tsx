"use client";

import { FormEvent, useEffect, useState } from "react";

import { MediaPicker } from "@/components/dashboard/online-store/MediaPicker";
import { OnlineStoreTabs } from "@/components/dashboard/online-store/OnlineStoreTabs";
import { ErrorAlert } from "@/components/ui/error-alert";
import { FormCard } from "@/components/ui/form-card";
import { LoadingState } from "@/components/ui/loading-state";
import { OpsPageHeader } from "@/components/ui/ops-page-header";
import { api, ApiError } from "@/lib/api";
import type { OnlineStorePage, OnlineStoreSettings } from "@/lib/online-store";

export default function OnlineStoreSeoPage() {
  const [settings, setSettings] = useState<OnlineStoreSettings | null>(null);
  const [homePage, setHomePage] = useState<OnlineStorePage | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let mounted = true;
    async function run() {
      try {
        const [settingsPayload, pages] = await Promise.all([
          api.get<OnlineStoreSettings>("/admin/storefront/settings"),
          api.get<OnlineStorePage[]>("/admin/storefront/pages"),
        ]);
        const home = pages.find((item) => item.slug === "home") || pages[0] || null;
        let homeDetail = home;
        if (home?.id) {
          homeDetail = await api.get<OnlineStorePage>(`/admin/storefront/pages/${home.id}`);
        }
        if (!mounted) return;
        setSettings(settingsPayload);
        setHomePage(homeDetail);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof ApiError ? err.message : "Failed to load SEO settings.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void run();
    return () => {
      mounted = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!settings || !homePage?.id) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const [updatedSettings, updatedHome] = await Promise.all([
        api.put<OnlineStoreSettings>("/admin/storefront/settings", settings),
        api.put<OnlineStorePage>(`/admin/storefront/pages/${homePage.id}`, {
          seo_title: homePage.seo_title,
          seo_description: homePage.seo_description,
          title: homePage.title,
          slug: homePage.slug,
          page_type: homePage.page_type,
          status: homePage.status,
          content: homePage.content,
        }),
      ]);
      setSettings(updatedSettings);
      setHomePage(updatedHome);
      setSuccess("SEO settings updated.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update SEO settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <OpsPageHeader
        eyebrow="Online Store"
        title="SEO"
        description="Keep homepage and default storefront metadata manageable from one focused settings page."
      />
      <OnlineStoreTabs />
      {loading ? <LoadingState label="Loading SEO settings..." /> : null}
      {!loading && error ? <ErrorAlert message={error} /> : null}

      {!loading && settings && homePage ? (
        <form className="space-y-6" onSubmit={handleSubmit}>
          {success ? (
            <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-700">
              {success}
            </div>
          ) : null}

          <FormCard title="Homepage SEO" description="Update the public homepage title and description returned through the storefront API.">
            <div className="grid gap-4">
              <input value={homePage.seo_title || ""} onChange={(e) => setHomePage((current) => current ? { ...current, seo_title: e.target.value } : current)} placeholder="Homepage SEO title" className="rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm outline-none" />
              <textarea value={homePage.seo_description || ""} onChange={(e) => setHomePage((current) => current ? { ...current, seo_description: e.target.value } : current)} placeholder="Homepage SEO description" className="min-h-24 rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm outline-none" />
            </div>
          </FormCard>

          <FormCard title="Default Storefront SEO" description="Manage the broader storefront metadata and social preview image.">
            <div className="grid gap-4">
              <input value={settings.seo_title || ""} onChange={(e) => setSettings((current) => current ? { ...current, seo_title: e.target.value } : current)} placeholder="Default meta title" className="rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm outline-none" />
              <textarea value={settings.seo_description || ""} onChange={(e) => setSettings((current) => current ? { ...current, seo_description: e.target.value } : current)} placeholder="Default meta description" className="min-h-24 rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm outline-none" />
              <MediaPicker
                label="Social share image"
                mediaType="general"
                value={settings.social_share_image_url}
                onChange={(value) => setSettings((current) => current ? { ...current, social_share_image_url: value } : current)}
                helperText="Optional default social share image for storefront links."
              />
              <div className="rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] p-4">
                <p className="text-sm font-semibold text-[var(--color-txt-pri)]">Favicon preview</p>
                <div className="mt-3 flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-[var(--color-brd)] bg-white">
                  {settings.favicon_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={settings.favicon_url} alt="Favicon preview" className="h-full w-full object-contain" />
                  ) : (
                    <span className="text-[11px] text-[var(--color-txt-mut)]">No favicon</span>
                  )}
                </div>
              </div>
            </div>
          </FormCard>

          <div className="flex justify-end">
            <button type="submit" disabled={saving} className="rounded-full bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">
              {saving ? "Saving..." : "Save SEO settings"}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
