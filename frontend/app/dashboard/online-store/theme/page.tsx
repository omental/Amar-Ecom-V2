"use client";

import { FormEvent, useEffect, useState } from "react";

import { MediaPicker } from "@/components/dashboard/online-store/MediaPicker";
import { OnlineStoreTabs } from "@/components/dashboard/online-store/OnlineStoreTabs";
import { ErrorAlert } from "@/components/ui/error-alert";
import { FormCard } from "@/components/ui/form-card";
import { LoadingState } from "@/components/ui/loading-state";
import { OpsPageHeader } from "@/components/ui/ops-page-header";
import { api, ApiError } from "@/lib/api";
import type { OnlineStoreSettings } from "@/lib/online-store";

const initialSettings: OnlineStoreSettings = {
  brand_name: "",
  logo_url: "",
  favicon_url: "",
  phone: "",
  email: "",
  address: "",
  primary_color: "#db011c",
  currency: "BDT",
  show_topbar: true,
  show_search: true,
  show_cart: true,
  show_track_order: true,
  footer_description: "",
  footer_copyright_text: "",
  social_share_image_url: "",
  social_links: {
    facebook: "",
    youtube: "",
    instagram: "",
  },
};

export default function OnlineStoreThemePage() {
  const [settings, setSettings] = useState<OnlineStoreSettings>(initialSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const payload = await api.get<OnlineStoreSettings>("/admin/storefront/settings");
        if (!mounted) return;
        setSettings({
          ...initialSettings,
          ...payload,
          social_links: {
            ...initialSettings.social_links,
            ...(payload.social_links || {}),
          },
        });
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof ApiError ? err.message : "Failed to load storefront settings.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const payload = await api.put<OnlineStoreSettings>("/admin/storefront/settings", settings);
      setSettings((current) => ({ ...current, ...payload }));
      setSuccess("Theme settings updated.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update theme settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <OpsPageHeader
        eyebrow="Online Store"
        title="Theme Settings"
        description="Update storefront branding, visibility toggles, and contact details without changing dashboard modules."
      />
      <OnlineStoreTabs />
      {loading ? <LoadingState label="Loading storefront theme settings..." /> : null}
      {!loading && error ? <ErrorAlert message={error} /> : null}
      {!loading ? (
        <form className="space-y-6" onSubmit={handleSubmit}>
          {success ? (
            <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-700">
              {success}
            </div>
          ) : null}

          <FormCard title="Brand & Contact" description="Control core brand identity and public contact info for the storefront.">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-2 block font-medium text-[var(--color-txt-sec)]">Brand name</span>
                <input value={settings.brand_name} onChange={(e) => setSettings((c) => ({ ...c, brand_name: e.target.value }))} className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 outline-none" />
              </label>
              <label className="block text-sm">
                <span className="mb-2 block font-medium text-[var(--color-txt-sec)]">Phone</span>
                <input value={settings.phone || ""} onChange={(e) => setSettings((c) => ({ ...c, phone: e.target.value }))} className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 outline-none" />
              </label>
              <label className="block text-sm">
                <span className="mb-2 block font-medium text-[var(--color-txt-sec)]">Email</span>
                <input value={settings.email || ""} onChange={(e) => setSettings((c) => ({ ...c, email: e.target.value }))} className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 outline-none" />
              </label>
              <label className="block text-sm">
                <span className="mb-2 block font-medium text-[var(--color-txt-sec)]">Currency</span>
                <input value={settings.currency} onChange={(e) => setSettings((c) => ({ ...c, currency: e.target.value }))} className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 outline-none" />
              </label>
              <label className="block text-sm md:col-span-2">
                <span className="mb-2 block font-medium text-[var(--color-txt-sec)]">Address</span>
                <textarea value={settings.address || ""} onChange={(e) => setSettings((c) => ({ ...c, address: e.target.value }))} className="min-h-24 w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 outline-none" />
              </label>
            </div>
          </FormCard>

          <FormCard title="Theme & Visibility" description="Set storefront colors and control which shopping elements stay visible publicly.">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label className="block text-sm">
                <span className="mb-2 block font-medium text-[var(--color-txt-sec)]">Primary color</span>
                <input type="color" value={settings.primary_color} onChange={(e) => setSettings((c) => ({ ...c, primary_color: e.target.value }))} className="h-12 w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-2 py-2" />
              </label>
              <label className="block text-sm">
                <span className="mb-2 block font-medium text-[var(--color-txt-sec)]">Secondary color</span>
                <input type="color" value={settings.secondary_color || "#000000"} onChange={(e) => setSettings((c) => ({ ...c, secondary_color: e.target.value }))} className="h-12 w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-2 py-2" />
              </label>
              {[
                ["show_topbar", "Show topbar"],
                ["show_search", "Show search"],
                ["show_cart", "Show cart"],
                ["show_track_order", "Show track order"],
              ].map(([field, label]) => (
                <label key={field} className="flex items-center gap-3 rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm font-medium text-[var(--color-txt-sec)]">
                  <input
                    type="checkbox"
                    checked={Boolean(settings[field as keyof OnlineStoreSettings])}
                    onChange={(e) => setSettings((c) => ({ ...c, [field]: e.target.checked }))}
                  />
                  {label}
                </label>
              ))}
            </div>
          </FormCard>

          <FormCard title="Logo & Favicon" description="Upload storefront media, reuse uploaded assets, and keep direct URLs as a fallback.">
            <div className="grid gap-6">
              <MediaPicker
                label="Logo"
                mediaType="logo"
                value={settings.logo_url}
                onChange={(value) => setSettings((current) => ({ ...current, logo_url: value }))}
              />
              <MediaPicker
                label="Favicon"
                mediaType="favicon"
                value={settings.favicon_url}
                onChange={(value) => setSettings((current) => ({ ...current, favicon_url: value }))}
              />
            </div>
          </FormCard>

          <FormCard title="Social Links & SEO" description="Keep simple structured social URLs and storefront SEO metadata.">
            <div className="grid gap-4 md:grid-cols-2">
              {["facebook", "youtube", "instagram"].map((key) => (
                <label key={key} className="block text-sm">
                  <span className="mb-2 block font-medium text-[var(--color-txt-sec)]">{key}</span>
                  <input
                    value={settings.social_links?.[key] || ""}
                    onChange={(e) =>
                      setSettings((c) => ({
                        ...c,
                        social_links: { ...(c.social_links || {}), [key]: e.target.value },
                      }))
                    }
                    className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 outline-none"
                  />
                </label>
              ))}
              <label className="block text-sm md:col-span-2">
                <span className="mb-2 block font-medium text-[var(--color-txt-sec)]">SEO title</span>
                <input value={settings.seo_title || ""} onChange={(e) => setSettings((c) => ({ ...c, seo_title: e.target.value }))} className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 outline-none" />
              </label>
              <label className="block text-sm md:col-span-2">
                <span className="mb-2 block font-medium text-[var(--color-txt-sec)]">SEO description</span>
                <textarea value={settings.seo_description || ""} onChange={(e) => setSettings((c) => ({ ...c, seo_description: e.target.value }))} className="min-h-24 w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 outline-none" />
              </label>
            </div>
          </FormCard>

          <div className="flex justify-end">
            <button type="submit" disabled={saving} className="inline-flex items-center rounded-full bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">
              {saving ? "Saving..." : "Save theme settings"}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
