"use client";

import { FormEvent, useEffect, useState } from "react";

import { MediaPicker } from "@/components/dashboard/online-store/MediaPicker";
import { OnlineStoreTabs } from "@/components/dashboard/online-store/OnlineStoreTabs";
import { ErrorAlert } from "@/components/ui/error-alert";
import { FormCard } from "@/components/ui/form-card";
import { LoadingState } from "@/components/ui/loading-state";
import { OpsPageHeader } from "@/components/ui/ops-page-header";
import { api, ApiError } from "@/lib/api";
import type { OnlineStoreBanner } from "@/lib/online-store";

const initialBanner: OnlineStoreBanner = {
  title: "",
  subtitle: "",
  image_url: "",
  mobile_image_url: "",
  button_text: "",
  button_url: "",
  location: "hero_slider",
  sort_order: 0,
  is_active: true,
};

export default function OnlineStoreBannersPage() {
  const [banners, setBanners] = useState<OnlineStoreBanner[]>([]);
  const [draftBanner, setDraftBanner] = useState<OnlineStoreBanner>(initialBanner);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadBanners() {
    const payload = await api.get<OnlineStoreBanner[]>("/admin/storefront/banners");
    setBanners(payload);
  }

  useEffect(() => {
    let mounted = true;
    async function run() {
      try {
        if (!mounted) return;
        await loadBanners();
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof ApiError ? err.message : "Failed to load storefront banners.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void run();
    return () => {
      mounted = false;
    };
  }, []);

  async function createBanner(event: FormEvent) {
    event.preventDefault();
    try {
      await api.post("/admin/storefront/banners", draftBanner);
      setDraftBanner(initialBanner);
      await loadBanners();
      setSuccess("Banner created.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create banner.");
    }
  }

  async function saveBanner(banner: OnlineStoreBanner) {
    if (!banner.id) return;
    try {
      await api.put(`/admin/storefront/banners/${banner.id}`, banner);
      await loadBanners();
      setSuccess("Banner updated.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update banner.");
    }
  }

  async function deleteBanner(bannerId: string) {
    try {
      await api.delete(`/admin/storefront/banners/${bannerId}`);
      await loadBanners();
      setSuccess("Banner disabled.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to disable banner.");
    }
  }

  return (
    <div className="space-y-6">
      <OpsPageHeader
        eyebrow="Online Store"
        title="Banners"
        description="Upload and manage reusable storefront banners and hero slides from the dashboard."
      />
      <OnlineStoreTabs />
      {loading ? <LoadingState label="Loading storefront banners..." /> : null}
      {!loading && error ? <ErrorAlert message={error} /> : null}
      {success ? (
        <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-700">
          {success}
        </div>
      ) : null}

      {!loading ? (
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <FormCard title="Create Banner" description="Add a storefront banner and optionally upload the primary image directly.">
            <form onSubmit={createBanner} className="grid gap-4">
              <input value={draftBanner.title} onChange={(e) => setDraftBanner((c) => ({ ...c, title: e.target.value }))} placeholder="Title" className="rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm outline-none" />
              <textarea value={draftBanner.subtitle || ""} onChange={(e) => setDraftBanner((c) => ({ ...c, subtitle: e.target.value }))} placeholder="Subtitle" className="min-h-24 rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm outline-none" />
              <MediaPicker
                label="Banner image"
                mediaType="banner"
                value={draftBanner.image_url}
                onChange={(value) => setDraftBanner((current) => ({ ...current, image_url: value }))}
              />
              <MediaPicker
                label="Mobile banner image"
                mediaType="banner"
                value={draftBanner.mobile_image_url}
                onChange={(value) => setDraftBanner((current) => ({ ...current, mobile_image_url: value }))}
                helperText="Optional mobile-specific image."
              />
              <div className="grid gap-4 md:grid-cols-2">
                <input value={draftBanner.button_text || ""} onChange={(e) => setDraftBanner((c) => ({ ...c, button_text: e.target.value }))} placeholder="Button text" className="rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm outline-none" />
                <input value={draftBanner.button_url || ""} onChange={(e) => setDraftBanner((c) => ({ ...c, button_url: e.target.value }))} placeholder="Button URL" className="rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm outline-none" />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <input value={draftBanner.location || ""} onChange={(e) => setDraftBanner((c) => ({ ...c, location: e.target.value }))} placeholder="Location" className="rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm outline-none" />
                <label className="flex items-center gap-3 rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm">
                  <input type="checkbox" checked={draftBanner.is_active ?? true} onChange={(e) => setDraftBanner((c) => ({ ...c, is_active: e.target.checked }))} />
                  Active
                </label>
              </div>
              <button type="submit" className="rounded-full bg-[var(--color-accent)] px-4 py-3 text-sm font-semibold text-white">Create Banner</button>
            </form>
          </FormCard>

          <FormCard title="Banner Library" description="Edit active hero or promotional banners and soft-disable them when they should stop rendering publicly.">
            <div className="space-y-4">
              {banners.map((banner) => (
                <div key={banner.id} className="rounded-[18px] border border-[var(--color-brd)] bg-[var(--color-surf-hover)] p-4">
                  <div className="grid gap-4 lg:grid-cols-[96px_1fr]">
                    <div className="h-24 w-24 overflow-hidden rounded-2xl border border-[var(--color-brd)] bg-white">
                      {banner.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={banner.image_url} alt={banner.title} className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="grid gap-3">
                      <input value={banner.title} onChange={(e) => setBanners((current) => current.map((item) => item.id === banner.id ? { ...item, title: e.target.value } : item))} className="rounded-2xl border border-[var(--color-brd)] bg-white px-4 py-3 text-sm outline-none" />
                      <MediaPicker
                        label="Banner image"
                        mediaType="banner"
                        value={banner.image_url}
                        onChange={(value) => setBanners((current) => current.map((item) => item.id === banner.id ? { ...item, image_url: value } : item))}
                      />
                      <MediaPicker
                        label="Mobile banner image"
                        mediaType="banner"
                        value={banner.mobile_image_url}
                        onChange={(value) => setBanners((current) => current.map((item) => item.id === banner.id ? { ...item, mobile_image_url: value } : item))}
                      />
                      <div className="grid gap-3 md:grid-cols-2">
                        <input value={banner.button_text || ""} onChange={(e) => setBanners((current) => current.map((item) => item.id === banner.id ? { ...item, button_text: e.target.value } : item))} placeholder="Button text" className="rounded-2xl border border-[var(--color-brd)] bg-white px-4 py-3 text-sm outline-none" />
                        <input value={banner.button_url || ""} onChange={(e) => setBanners((current) => current.map((item) => item.id === banner.id ? { ...item, button_url: e.target.value } : item))} placeholder="Button URL" className="rounded-2xl border border-[var(--color-brd)] bg-white px-4 py-3 text-sm outline-none" />
                      </div>
                      <div className="flex flex-wrap justify-end gap-3">
                        <button type="button" onClick={() => void deleteBanner(banner.id!)} className="rounded-full border border-rose-200 px-4 py-3 text-sm font-semibold text-rose-600">Disable</button>
                        <button type="button" onClick={() => void saveBanner(banner)} className="rounded-full bg-[var(--color-accent)] px-4 py-3 text-sm font-semibold text-white">Save Banner</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </FormCard>
        </div>
      ) : null}
    </div>
  );
}
