"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { OnlineStoreTabs } from "@/components/dashboard/online-store/OnlineStoreTabs";
import { ErrorAlert } from "@/components/ui/error-alert";
import { FormCard } from "@/components/ui/form-card";
import { LoadingState } from "@/components/ui/loading-state";
import { OpsPageHeader } from "@/components/ui/ops-page-header";
import { api, ApiError } from "@/lib/api";
import type { OnlineStoreMenu, OnlineStoreSettings } from "@/lib/online-store";

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
  social_links: {},
};

export default function OnlineStoreHeaderFooterPage() {
  const [settings, setSettings] = useState<OnlineStoreSettings>(initialSettings);
  const [menus, setMenus] = useState<OnlineStoreMenu[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let mounted = true;
    async function run() {
      try {
        const [settingsPayload, menuPayload] = await Promise.all([
          api.get<OnlineStoreSettings>("/admin/storefront/settings"),
          api.get<OnlineStoreMenu[]>("/admin/storefront/menus"),
        ]);
        if (!mounted) return;
        setSettings({ ...initialSettings, ...settingsPayload });
        setMenus(menuPayload);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof ApiError ? err.message : "Failed to load header and footer settings.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void run();
    return () => {
      mounted = false;
    };
  }, []);

  const menusByLocation = useMemo(
    () => Object.fromEntries(menus.map((menu) => [menu.location, menu])),
    [menus],
  );

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const payload = await api.put<OnlineStoreSettings>("/admin/storefront/settings", settings);
      setSettings((current) => ({ ...current, ...payload }));
      setSuccess("Header and footer settings updated.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update header and footer settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <OpsPageHeader
        eyebrow="Online Store"
        title="Header & Footer"
        description="Control storefront contact display, shopping toggles, and footer copy without changing the main dashboard."
      />
      <OnlineStoreTabs />
      {loading ? <LoadingState label="Loading header and footer settings..." /> : null}
      {!loading && error ? <ErrorAlert message={error} /> : null}

      {!loading ? (
        <form className="space-y-6" onSubmit={handleSubmit}>
          {success ? (
            <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-700">
              {success}
            </div>
          ) : null}

          <FormCard title="Header Controls" description="Manage the public topbar, search, cart, and order tracking display.">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-2 block font-medium text-[var(--color-txt-sec)]">Brand name</span>
                <input value={settings.brand_name} onChange={(e) => setSettings((current) => ({ ...current, brand_name: e.target.value }))} className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 outline-none" />
              </label>
              <label className="block text-sm">
                <span className="mb-2 block font-medium text-[var(--color-txt-sec)]">Topbar phone/email</span>
                <input value={settings.phone || ""} onChange={(e) => setSettings((current) => ({ ...current, phone: e.target.value }))} className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 outline-none" />
              </label>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
                    onChange={(e) => setSettings((current) => ({ ...current, [field]: e.target.checked }))}
                  />
                  {label}
                </label>
              ))}
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] p-4">
                <p className="text-sm font-semibold text-[var(--color-txt-pri)]">Main nav location</p>
                <p className="mt-2 text-sm text-[var(--color-txt-sec)]">
                  {menusByLocation.main_nav?.name || "Main Navigation"} with {menusByLocation.main_nav?.items.length || 0} items
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] p-4">
                <p className="text-sm font-semibold text-[var(--color-txt-pri)]">Category nav location</p>
                <p className="mt-2 text-sm text-[var(--color-txt-sec)]">
                  {menusByLocation.category_nav?.name || "Category Navigation"} with {menusByLocation.category_nav?.items.length || 0} items
                </p>
              </div>
            </div>
          </FormCard>

          <FormCard title="Footer Controls" description="Manage footer copy, contact details, and menu group usage.">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm md:col-span-2">
                <span className="mb-2 block font-medium text-[var(--color-txt-sec)]">Footer brand description</span>
                <textarea value={settings.footer_description || ""} onChange={(e) => setSettings((current) => ({ ...current, footer_description: e.target.value }))} className="min-h-24 w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 outline-none" />
              </label>
              <label className="block text-sm">
                <span className="mb-2 block font-medium text-[var(--color-txt-sec)]">Footer copyright text</span>
                <input value={settings.footer_copyright_text || ""} onChange={(e) => setSettings((current) => ({ ...current, footer_copyright_text: e.target.value }))} className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 outline-none" />
              </label>
              <label className="block text-sm">
                <span className="mb-2 block font-medium text-[var(--color-txt-sec)]">Contact address</span>
                <input value={settings.address || ""} onChange={(e) => setSettings((current) => ({ ...current, address: e.target.value }))} className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 outline-none" />
              </label>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {["footer_services", "footer_join_us", "footer_social"].map((location) => (
                <div key={location} className="rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] p-4">
                  <p className="text-sm font-semibold text-[var(--color-txt-pri)]">{location.replace(/_/g, " ")}</p>
                  <p className="mt-2 text-sm text-[var(--color-txt-sec)]">
                    {menusByLocation[location]?.items.length || 0} linked items
                  </p>
                </div>
              ))}
            </div>
          </FormCard>

          <div className="flex justify-end">
            <button type="submit" disabled={saving} className="rounded-full bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">
              {saving ? "Saving..." : "Save header & footer"}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
