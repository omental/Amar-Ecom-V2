"use client";

import { useEffect, useMemo, useState } from "react";

import { MediaPicker } from "@/components/dashboard/online-store/MediaPicker";
import { OnlineStoreTabs } from "@/components/dashboard/online-store/OnlineStoreTabs";
import { ProductPicker } from "@/components/dashboard/online-store/ProductPicker";
import { ErrorAlert } from "@/components/ui/error-alert";
import { FormCard } from "@/components/ui/form-card";
import { LoadingState } from "@/components/ui/loading-state";
import { OpsPageHeader } from "@/components/ui/ops-page-header";
import { api, ApiError } from "@/lib/api";
import type { OnlineStorePage, OnlineStoreSection, OnlineStoreSettings } from "@/lib/online-store";
import { buildSectionFromPreset, getSectionPreset, storefrontSectionPresets } from "@/lib/storefront-section-presets";

type PublicCategory = {
  id: string;
  name: string;
  slug: string;
};

type FaqItem = {
  question: string;
  answer: string;
};

type TestimonialItem = {
  customer_name: string;
  quote: string;
  rating: number;
  image_url?: string;
  location?: string;
};

type BrandItem = {
  name: string;
  logo_url?: string;
  link_url?: string;
};

function toPrettyLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function parseIdTextarea(value: string) {
  return value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function stringifyIdTextarea(values: unknown) {
  return Array.isArray(values) ? values.map((item) => String(item)).join("\n") : "";
}

export default function OnlineStoreCustomizePage() {
  const [page, setPage] = useState<OnlineStorePage | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [newSectionType, setNewSectionType] = useState<string>(storefrontSectionPresets[0].type);
  const [settings, setSettings] = useState<OnlineStoreSettings | null>(null);
  const [categories, setCategories] = useState<PublicCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [publishLoading, setPublishLoading] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  async function loadPage() {
    const pages = await api.get<OnlineStorePage[]>("/admin/storefront/pages");
    const home = pages.find((item) => item.slug === "home") || pages[0] || null;
    if (!home?.id) {
      throw new Error("Homepage configuration is missing.");
    }
    const fullPage = await api.get<OnlineStorePage>(`/admin/storefront/pages/${home.id}`);
    setPage(fullPage);
    setHasUnsavedChanges(false);
    setSelectedSectionId((current) => current || fullPage.sections[0]?.id || null);
  }

  useEffect(() => {
    let mounted = true;
    async function run() {
      try {
        if (!mounted) return;
        const [categoryPayload] = await Promise.all([
          api.get<PublicCategory[]>("/public/categories").catch(() => []),
          api.get<OnlineStoreSettings>("/admin/storefront/settings").then(setSettings),
          loadPage(),
        ]);
        if (!mounted) return;
        setCategories(categoryPayload);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Failed to load homepage builder.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void run();
    return () => {
      mounted = false;
    };
  }, []);

  const selectedSection = useMemo(
    () => page?.sections.find((item) => item.id === selectedSectionId) || null,
    [page, selectedSectionId],
  );

  function updateSelectedSection(updater: (section: OnlineStoreSection) => OnlineStoreSection) {
    setPage((current) => {
      if (!current || !selectedSectionId) return current;
      setHasUnsavedChanges(true);
      return {
        ...current,
        sections: current.sections.map((item) => (item.id === selectedSectionId ? updater(item) : item)),
      };
    });
  }

  function updateSelectedSettings(partial: Record<string, unknown>) {
    updateSelectedSection((section) => ({
      ...section,
      settings: {
        ...(section.settings || {}),
        ...partial,
      },
    }));
  }

  function updateSelectedContent(partial: Record<string, unknown>) {
    updateSelectedSection((section) => ({
      ...section,
      content: {
        ...(section.content || {}),
        ...partial,
      },
    }));
  }

  async function saveSection(section: OnlineStoreSection) {
    if (!section.id) return;
    try {
      setError("");
      setSuccess("");
      await api.put(`/admin/storefront/sections/${section.id}`, {
        title: section.title,
        subtitle: section.subtitle,
        is_enabled: section.is_enabled,
        settings: section.settings,
        content: section.content,
      });
      await loadPage();
      setSuccess("Section updated.");
      setHasUnsavedChanges(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update section.");
    }
  }

  async function moveSection(sectionId: string, direction: "up" | "down") {
    if (!page?.id) return;
    const ids = page.sections.map((item) => item.id!).filter(Boolean);
    const index = ids.indexOf(sectionId);
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || swapIndex < 0 || swapIndex >= ids.length) return;
    [ids[index], ids[swapIndex]] = [ids[swapIndex], ids[index]];
    try {
      await api.post(`/admin/storefront/pages/${page.id}/sections/reorder`, { ordered_ids: ids });
      await loadPage();
      setSuccess("Section order updated.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to reorder sections.");
    }
  }

  async function createSection() {
    if (!page?.id) return;
    const payload = buildSectionFromPreset(newSectionType);
    try {
      await api.post(`/admin/storefront/pages/${page.id}/sections`, {
        ...payload,
      });
      await loadPage();
      setSuccess("Section added.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add section.");
    }
  }

  async function duplicateSection(section: OnlineStoreSection) {
    if (!page?.id) return;
    try {
      await api.post(`/admin/storefront/pages/${page.id}/sections`, {
        type: section.type,
        title: section.title,
        subtitle: section.subtitle,
        is_enabled: section.is_enabled ?? true,
        settings: section.settings || {},
        content: section.content || {},
      });
      await loadPage();
      setSuccess("Section duplicated.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to duplicate section.");
    }
  }

  async function deleteSection(sectionId: string) {
    try {
      await api.delete(`/admin/storefront/sections/${sectionId}`);
      await loadPage();
      setSuccess("Section deleted.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete section.");
    }
  }

  async function publishPage() {
    if (!page?.id) return;
    try {
      setError("");
      setSuccess("");
      setPublishLoading(true);
      const response = await api.post<{ message?: string; revision_id?: string }>(`/admin/storefront/pages/${page.id}/publish`);
      await loadPage();
      setSuccess(response.message || "Homepage published.");
      setHasUnsavedChanges(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to publish homepage.");
    } finally {
      setPublishLoading(false);
    }
  }

  function renderStructuredEditor(section: OnlineStoreSection) {
    const settings = (section.settings || {}) as Record<string, unknown>;
    const content = (section.content || {}) as Record<string, unknown>;

    if (section.type === "hero_slider") {
      const slides = Array.isArray(content.slides) ? (content.slides as Array<Record<string, unknown>>) : [];
      const primarySlide = slides[0] || {};
      return (
        <div className="space-y-4">
          <label className="block text-sm">
            <span className="mb-2 block font-medium text-[var(--color-txt-sec)]">Hero headline</span>
            <input
              value={String(primarySlide.title || "")}
              onChange={(e) => updateSelectedContent({ slides: [{ ...primarySlide, title: e.target.value }, ...slides.slice(1)] })}
              className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 outline-none"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-2 block font-medium text-[var(--color-txt-sec)]">Hero subtitle</span>
            <input
              value={String(primarySlide.subtitle || "")}
              onChange={(e) => updateSelectedContent({ slides: [{ ...primarySlide, subtitle: e.target.value }, ...slides.slice(1)] })}
              className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 outline-none"
            />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-2 block font-medium text-[var(--color-txt-sec)]">Discount label</span>
              <input
                value={String(primarySlide.discount || "")}
                onChange={(e) => updateSelectedContent({ slides: [{ ...primarySlide, discount: e.target.value }, ...slides.slice(1)] })}
                className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 outline-none"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-2 block font-medium text-[var(--color-txt-sec)]">Button text</span>
              <input
                value={String(primarySlide.button_text || "")}
                onChange={(e) => updateSelectedContent({ slides: [{ ...primarySlide, button_text: e.target.value }, ...slides.slice(1)] })}
                className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 outline-none"
              />
            </label>
          </div>
          <label className="block text-sm">
            <span className="mb-2 block font-medium text-[var(--color-txt-sec)]">Button URL</span>
            <input
              value={String(primarySlide.button_url || "")}
              onChange={(e) => updateSelectedContent({ slides: [{ ...primarySlide, button_url: e.target.value }, ...slides.slice(1)] })}
              className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 outline-none"
            />
          </label>
          <MediaPicker
            label="Hero image"
            mediaType="banner"
            value={String(primarySlide.image_url || "")}
            onChange={(value) => updateSelectedContent({ slides: [{ ...primarySlide, image_url: value }, ...slides.slice(1)] })}
          />
          <MediaPicker
            label="Hero mobile image"
            mediaType="banner"
            value={String(primarySlide.mobile_image_url || "")}
            onChange={(value) => updateSelectedContent({ slides: [{ ...primarySlide, mobile_image_url: value }, ...slides.slice(1)] })}
            helperText="Optional mobile-specific hero image."
          />
        </div>
      );
    }

    if (["product_grid", "new_arrivals", "featured_collection", "best_selling", "flash_sale"].includes(section.type)) {
      return (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-2 block font-medium text-[var(--color-txt-sec)]">Section title</span>
              <input
                value={section.title || ""}
                onChange={(e) => updateSelectedSection((current) => ({ ...current, title: e.target.value }))}
                className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 outline-none"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-2 block font-medium text-[var(--color-txt-sec)]">Subtitle</span>
              <input
                value={section.subtitle || ""}
                onChange={(e) => updateSelectedSection((current) => ({ ...current, subtitle: e.target.value }))}
                className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 outline-none"
              />
            </label>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-2 block font-medium text-[var(--color-txt-sec)]">Source</span>
              <select
                value={String(settings.source || section.type)}
                onChange={(e) => updateSelectedSettings({ source: e.target.value })}
                className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 outline-none"
              >
                {["new_arrivals", "best_selling", "flash_sale", "category", "manual"].map((value) => (
                  <option key={value} value={value}>{toPrettyLabel(value)}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-2 block font-medium text-[var(--color-txt-sec)]">Limit</span>
              <input
                type="number"
                min={1}
                max={24}
                value={Number(settings.limit || 8)}
                onChange={(e) => updateSelectedSettings({ limit: Number(e.target.value) || 8 })}
                className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 outline-none"
              />
            </label>
          </div>
          {String(settings.source || section.type) === "category" ? (
            <label className="block text-sm">
              <span className="mb-2 block font-medium text-[var(--color-txt-sec)]">Category</span>
              <select
                value={String(settings.category_slug || "")}
                onChange={(e) => updateSelectedSettings({ category_slug: e.target.value })}
                className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 outline-none"
              >
                <option value="">Select category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.slug}>{category.name}</option>
                ))}
              </select>
            </label>
          ) : null}
          {String(settings.source || section.type) === "manual" ? (
            <div className="space-y-3">
              <ProductPicker
                value={(Array.isArray(settings.product_ids) ? settings.product_ids : []).map((item) => String(item))}
                onChange={(ids) => updateSelectedSettings({ product_ids: ids })}
                maxSelection={Number(settings.limit || 8)}
              />
              <label className="block text-sm">
                <span className="mb-2 block font-medium text-[var(--color-txt-sec)]">Advanced product IDs</span>
                <textarea
                  value={stringifyIdTextarea(settings.product_ids)}
                  onChange={(e) => updateSelectedSettings({ product_ids: parseIdTextarea(e.target.value) })}
                  className="min-h-24 w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 font-mono text-xs outline-none"
                />
              </label>
            </div>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-2 block font-medium text-[var(--color-txt-sec)]">Desktop columns</span>
              <input
                type="number"
                min={1}
                max={6}
                value={Number(settings.columns_desktop || 4)}
                onChange={(e) => updateSelectedSettings({ columns_desktop: Number(e.target.value) || 4 })}
                className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 outline-none"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-2 block font-medium text-[var(--color-txt-sec)]">Mobile columns</span>
              <input
                type="number"
                min={1}
                max={3}
                value={Number(settings.columns_mobile || 2)}
                onChange={(e) => updateSelectedSettings({ columns_mobile: Number(e.target.value) || 2 })}
                className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 outline-none"
              />
            </label>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex items-center gap-3 rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm font-medium text-[var(--color-txt-sec)]">
              <input
                type="checkbox"
                checked={Boolean(settings.show_shop_more)}
                onChange={(e) => updateSelectedSettings({ show_shop_more: e.target.checked })}
              />
              Show &quot;Shop More&quot;
            </label>
            <label className="block text-sm">
              <span className="mb-2 block font-medium text-[var(--color-txt-sec)]">Shop more URL</span>
              <input
                value={String(settings.shop_more_url || "/products")}
                onChange={(e) => updateSelectedSettings({ shop_more_url: e.target.value })}
                className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 outline-none"
              />
            </label>
          </div>
        </div>
      );
    }

    if (section.type === "category_grid") {
      const items = Array.isArray(content.items) ? (content.items as Array<Record<string, unknown>>) : [];
      return (
        <div className="space-y-4">
          <label className="block text-sm">
            <span className="mb-2 block font-medium text-[var(--color-txt-sec)]">Section title</span>
            <input
              value={section.title || ""}
              onChange={(e) => updateSelectedSection((current) => ({ ...current, title: e.target.value }))}
              className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 outline-none"
            />
          </label>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="block text-sm">
              <span className="mb-2 block font-medium text-[var(--color-txt-sec)]">Limit</span>
              <input type="number" value={Number(settings.limit || 8)} onChange={(e) => updateSelectedSettings({ limit: Number(e.target.value) || 8 })} className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 outline-none" />
            </label>
            <label className="block text-sm">
              <span className="mb-2 block font-medium text-[var(--color-txt-sec)]">Tile style</span>
              <input value={String(settings.tile_style || "light")} onChange={(e) => updateSelectedSettings({ tile_style: e.target.value })} className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 outline-none" />
            </label>
            <label className="block text-sm">
              <span className="mb-2 block font-medium text-[var(--color-txt-sec)]">Menu source</span>
              <input value={String(settings.menu_source || "category_nav")} onChange={(e) => updateSelectedSettings({ menu_source: e.target.value })} className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 outline-none" />
            </label>
          </div>
          <label className="block text-sm">
            <span className="mb-2 block font-medium text-[var(--color-txt-sec)]">Selected categories</span>
            <textarea
              value={items.map((item) => String(item.label || "")).join("\n")}
              onChange={(e) => updateSelectedContent({
                items: e.target.value.split("\n").map((label) => label.trim()).filter(Boolean).map((label) => ({
                  label,
                  image_url: "",
                })),
              })}
              className="min-h-24 w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 outline-none"
            />
          </label>
        </div>
      );
    }

    if (section.type === "single_banner" || section.type === "banner_grid") {
      return (
        <div className="space-y-4">
          <label className="block text-sm">
            <span className="mb-2 block font-medium text-[var(--color-txt-sec)]">Section title</span>
            <input value={section.title || ""} onChange={(e) => updateSelectedSection((current) => ({ ...current, title: e.target.value }))} className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 outline-none" />
          </label>
          <label className="block text-sm">
            <span className="mb-2 block font-medium text-[var(--color-txt-sec)]">Subtitle</span>
            <textarea value={section.subtitle || ""} onChange={(e) => updateSelectedSection((current) => ({ ...current, subtitle: e.target.value }))} className="min-h-20 w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 outline-none" />
          </label>
          <MediaPicker
            label="Section image"
            mediaType="section"
            value={String(content.image_url || "")}
            onChange={(value) => updateSelectedContent({ image_url: value })}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <input value={String(content.button_text || "")} onChange={(e) => updateSelectedContent({ button_text: e.target.value })} placeholder="Button text" className="rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm outline-none" />
            <input value={String(content.button_url || "")} onChange={(e) => updateSelectedContent({ button_url: e.target.value })} placeholder="Button URL" className="rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm outline-none" />
          </div>
        </div>
      );
    }

    if (section.type === "text_block") {
      return (
        <div className="space-y-4">
          <input value={section.title || ""} onChange={(e) => updateSelectedSection((current) => ({ ...current, title: e.target.value }))} placeholder="Title" className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm outline-none" />
          <textarea value={String(content.text || section.subtitle || "")} onChange={(e) => updateSelectedContent({ text: e.target.value })} placeholder="Content" className="min-h-28 w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 outline-none" />
          <select value={String(settings.alignment || "left")} onChange={(e) => updateSelectedSettings({ alignment: e.target.value })} className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 outline-none">
            {["left", "center", "right"].map((value) => <option key={value} value={value}>{toPrettyLabel(value)}</option>)}
          </select>
        </div>
      );
    }

    if (section.type === "image_text") {
      return (
        <div className="space-y-4">
          <input value={section.title || ""} onChange={(e) => updateSelectedSection((current) => ({ ...current, title: e.target.value }))} placeholder="Title" className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm outline-none" />
          <textarea value={String(content.body || section.subtitle || "")} onChange={(e) => updateSelectedContent({ body: e.target.value })} placeholder="Body content" className="min-h-24 w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 outline-none" />
          <MediaPicker
            label="Image"
            mediaType="section"
            value={String(content.image_url || "")}
            onChange={(value) => updateSelectedContent({ image_url: value })}
          />
          <div className="grid gap-4 md:grid-cols-3">
            <input value={String(content.button_text || "")} onChange={(e) => updateSelectedContent({ button_text: e.target.value })} placeholder="Button text" className="rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm outline-none" />
            <input value={String(content.button_url || "")} onChange={(e) => updateSelectedContent({ button_url: e.target.value })} placeholder="Button URL" className="rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm outline-none" />
            <select value={String(settings.image_position || "right")} onChange={(e) => updateSelectedSettings({ image_position: e.target.value })} className="rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 outline-none">
              {["left", "right"].map((value) => <option key={value} value={value}>{toPrettyLabel(value)}</option>)}
            </select>
          </div>
        </div>
      );
    }

    if (section.type === "newsletter") {
      return (
        <div className="space-y-4">
          <input value={section.title || ""} onChange={(e) => updateSelectedSection((current) => ({ ...current, title: e.target.value }))} placeholder="Title" className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm outline-none" />
          <textarea value={section.subtitle || ""} onChange={(e) => updateSelectedSection((current) => ({ ...current, subtitle: e.target.value }))} placeholder="Subtitle" className="min-h-24 w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 outline-none" />
          <input value={String(content.button_text || "Subscribe")} onChange={(e) => updateSelectedContent({ button_text: e.target.value })} placeholder="Button text" className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm outline-none" />
        </div>
      );
    }

    if (section.type === "faq") {
      const items = Array.isArray(content.items) ? (content.items as FaqItem[]) : [];
      const updateItems = (nextItems: FaqItem[]) => updateSelectedContent({ items: nextItems });
      return (
        <div className="space-y-4">
          <input value={section.title || ""} onChange={(e) => updateSelectedSection((current) => ({ ...current, title: e.target.value }))} placeholder="Title" className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm outline-none" />
          <textarea value={section.subtitle || ""} onChange={(e) => updateSelectedSection((current) => ({ ...current, subtitle: e.target.value }))} placeholder="Subtitle" className="min-h-20 w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 outline-none" />
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={`${item.question}-${index}`} className="space-y-3 rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] p-4">
                <input value={item.question} onChange={(e) => updateItems(items.map((entry, itemIndex) => itemIndex === index ? { ...entry, question: e.target.value } : entry))} placeholder="Question" className="w-full rounded-2xl border border-[var(--color-brd)] bg-white px-4 py-3 text-sm outline-none" />
                <textarea value={item.answer} onChange={(e) => updateItems(items.map((entry, itemIndex) => itemIndex === index ? { ...entry, answer: e.target.value } : entry))} placeholder="Answer" className="min-h-24 w-full rounded-2xl border border-[var(--color-brd)] bg-white px-4 py-3 outline-none" />
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => updateItems(items.filter((_, itemIndex) => itemIndex !== index))} className="rounded-full border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600">Remove</button>
                  <button type="button" disabled={index === 0} onClick={() => updateItems(items.map((entry, itemIndex) => itemIndex === index - 1 ? items[index] : itemIndex === index ? items[index - 1] : entry))} className="rounded-full border border-[var(--color-brd)] px-3 py-2 text-xs font-semibold disabled:opacity-50">Move Up</button>
                  <button type="button" disabled={index === items.length - 1} onClick={() => updateItems(items.map((entry, itemIndex) => itemIndex === index + 1 ? items[index] : itemIndex === index ? items[index + 1] : entry))} className="rounded-full border border-[var(--color-brd)] px-3 py-2 text-xs font-semibold disabled:opacity-50">Move Down</button>
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => updateItems([...items, { question: "", answer: "" }])} className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white">Add FAQ Item</button>
        </div>
      );
    }

    if (section.type === "testimonials") {
      const items = Array.isArray(content.items) ? (content.items as TestimonialItem[]) : [];
      const updateItems = (nextItems: TestimonialItem[]) => updateSelectedContent({ items: nextItems });
      return (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <input value={section.title || ""} onChange={(e) => updateSelectedSection((current) => ({ ...current, title: e.target.value }))} placeholder="Title" className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm outline-none" />
            <select value={String(settings.layout_style || "grid")} onChange={(e) => updateSelectedSettings({ layout_style: e.target.value })} className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 outline-none">
              {["grid", "carousel_static"].map((value) => <option key={value} value={value}>{toPrettyLabel(value)}</option>)}
            </select>
          </div>
          <textarea value={section.subtitle || ""} onChange={(e) => updateSelectedSection((current) => ({ ...current, subtitle: e.target.value }))} placeholder="Subtitle" className="min-h-20 w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 outline-none" />
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={`${item.customer_name}-${index}`} className="space-y-3 rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <input value={item.customer_name} onChange={(e) => updateItems(items.map((entry, itemIndex) => itemIndex === index ? { ...entry, customer_name: e.target.value } : entry))} placeholder="Customer name" className="rounded-2xl border border-[var(--color-brd)] bg-white px-4 py-3 text-sm outline-none" />
                  <input value={item.location || ""} onChange={(e) => updateItems(items.map((entry, itemIndex) => itemIndex === index ? { ...entry, location: e.target.value } : entry))} placeholder="Location" className="rounded-2xl border border-[var(--color-brd)] bg-white px-4 py-3 text-sm outline-none" />
                </div>
                <textarea value={item.quote} onChange={(e) => updateItems(items.map((entry, itemIndex) => itemIndex === index ? { ...entry, quote: e.target.value } : entry))} placeholder="Quote" className="min-h-24 w-full rounded-2xl border border-[var(--color-brd)] bg-white px-4 py-3 outline-none" />
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="block text-sm">
                    <span className="mb-2 block font-medium text-[var(--color-txt-sec)]">Rating</span>
                    <input type="number" min={1} max={5} value={item.rating || 5} onChange={(e) => updateItems(items.map((entry, itemIndex) => itemIndex === index ? { ...entry, rating: Number(e.target.value) || 5 } : entry))} className="w-full rounded-2xl border border-[var(--color-brd)] bg-white px-4 py-3 outline-none" />
                  </label>
                  <MediaPicker
                    label="Customer image"
                    mediaType="section"
                    value={item.image_url || ""}
                    onChange={(value) => updateItems(items.map((entry, itemIndex) => itemIndex === index ? { ...entry, image_url: value } : entry))}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => updateItems(items.filter((_, itemIndex) => itemIndex !== index))} className="rounded-full border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600">Remove</button>
                  <button type="button" disabled={index === 0} onClick={() => updateItems(items.map((entry, itemIndex) => itemIndex === index - 1 ? items[index] : itemIndex === index ? items[index - 1] : entry))} className="rounded-full border border-[var(--color-brd)] px-3 py-2 text-xs font-semibold disabled:opacity-50">Move Up</button>
                  <button type="button" disabled={index === items.length - 1} onClick={() => updateItems(items.map((entry, itemIndex) => itemIndex === index + 1 ? items[index] : itemIndex === index ? items[index + 1] : entry))} className="rounded-full border border-[var(--color-brd)] px-3 py-2 text-xs font-semibold disabled:opacity-50">Move Down</button>
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => updateItems([...items, { customer_name: "", quote: "", rating: 5, image_url: "", location: "" }])} className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white">Add Testimonial</button>
        </div>
      );
    }

    if (section.type === "brand_strip") {
      const items = Array.isArray(content.items) ? (content.items as BrandItem[]) : [];
      const updateItems = (nextItems: BrandItem[]) => updateSelectedContent({ items: nextItems });
      return (
        <div className="space-y-4">
          <input value={section.title || ""} onChange={(e) => updateSelectedSection((current) => ({ ...current, title: e.target.value }))} placeholder="Title" className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm outline-none" />
          <textarea value={section.subtitle || ""} onChange={(e) => updateSelectedSection((current) => ({ ...current, subtitle: e.target.value }))} placeholder="Subtitle" className="min-h-20 w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 outline-none" />
          <div className="space-y-3">
            {items.map((item, index) => (
              <div key={`${item.name}-${index}`} className="space-y-3 rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <input value={item.name} onChange={(e) => updateItems(items.map((entry, itemIndex) => itemIndex === index ? { ...entry, name: e.target.value } : entry))} placeholder="Brand name" className="rounded-2xl border border-[var(--color-brd)] bg-white px-4 py-3 text-sm outline-none" />
                  <input value={item.link_url || ""} onChange={(e) => updateItems(items.map((entry, itemIndex) => itemIndex === index ? { ...entry, link_url: e.target.value } : entry))} placeholder="Link URL (optional)" className="rounded-2xl border border-[var(--color-brd)] bg-white px-4 py-3 text-sm outline-none" />
                </div>
                <MediaPicker
                  label="Brand logo"
                  mediaType="section"
                  value={item.logo_url || ""}
                  onChange={(value) => updateItems(items.map((entry, itemIndex) => itemIndex === index ? { ...entry, logo_url: value } : entry))}
                />
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => updateItems(items.filter((_, itemIndex) => itemIndex !== index))} className="rounded-full border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600">Remove</button>
                  <button type="button" disabled={index === 0} onClick={() => updateItems(items.map((entry, itemIndex) => itemIndex === index - 1 ? items[index] : itemIndex === index ? items[index - 1] : entry))} className="rounded-full border border-[var(--color-brd)] px-3 py-2 text-xs font-semibold disabled:opacity-50">Move Up</button>
                  <button type="button" disabled={index === items.length - 1} onClick={() => updateItems(items.map((entry, itemIndex) => itemIndex === index + 1 ? items[index] : itemIndex === index ? items[index + 1] : entry))} className="rounded-full border border-[var(--color-brd)] px-3 py-2 text-xs font-semibold disabled:opacity-50">Move Down</button>
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => updateItems([...items, { name: "", logo_url: "", link_url: "" }])} className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white">Add Brand</button>
        </div>
      );
    }

    return (
      <p className="text-sm text-[var(--color-txt-sec)]">
        This section does not have a dedicated structured editor yet. Use the advanced settings below.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <OpsPageHeader
        eyebrow="Online Store"
        title="Customize Homepage"
        description="Use predefined storefront sections with structured controls first, then fall back to advanced JSON only when needed."
      />
      <OnlineStoreTabs />
      {!loading && page ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-[var(--color-brd)] bg-[var(--color-surf)] px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-[var(--color-txt-sec)]">Status</span>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
              page.status === "published" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
            }`}>
              {page.status === "published" ? "Published" : "Draft"}
            </span>
            <span className="rounded-full bg-[var(--color-surf-hover)] px-3 py-1 text-xs font-semibold text-[var(--color-txt-pri)]">
              Template: {(settings?.active_template_key || "live_shopping_classic").replace(/_/g, " ")}
            </span>
            {hasUnsavedChanges ? (
              <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
                Unsaved edits
              </span>
            ) : null}
            {page.last_published_at ? (
              <span className="text-xs text-[var(--color-txt-sec)]">
                Last published {new Date(page.last_published_at).toLocaleString()}
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => window.open(`/dashboard/online-store/preview?pageId=${page.id}`, "_blank", "noopener,noreferrer")}
              className="rounded-full border border-[var(--color-brd)] px-4 py-2 text-sm font-semibold text-[var(--color-txt-pri)]"
            >
              Preview Draft
            </button>
            <button
              type="button"
              onClick={() => void publishPage()}
              disabled={publishLoading}
              className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white"
            >
              {publishLoading ? "Publishing..." : "Publish Changes"}
            </button>
          </div>
        </div>
      ) : null}
      {loading ? <LoadingState label="Loading homepage sections..." /> : null}
      {!loading && error ? <ErrorAlert message={error} /> : null}
      {success ? (
        <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-700">
          {success}
        </div>
      ) : null}

      {!loading && page ? (
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <FormCard
            title="Homepage Sections"
            description="Reorder, hide, and manage the predefined sections that make up the public storefront home page."
            action={(
              <div className="flex gap-2">
                <select value={newSectionType} onChange={(e) => setNewSectionType(e.target.value)} className="rounded-full border border-[var(--color-brd)] bg-[var(--color-surf)] px-4 py-2 text-sm">
                  {storefrontSectionPresets.map((preset) => <option key={preset.type} value={preset.type}>{preset.label}</option>)}
                </select>
                <button type="button" onClick={() => void createSection()} className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white">
                  Add Section
                </button>
              </div>
            )}
          >
            <div className="space-y-3">
              {page.sections.map((section, index) => (
                <div key={section.id} className={`rounded-[18px] border p-4 ${selectedSectionId === section.id ? "border-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-accent)_8%,white)]" : "border-[var(--color-brd)] bg-[var(--color-surf-hover)]"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--color-txt-pri)]">[{getSectionPreset(section.type)?.label || toPrettyLabel(section.type)}] {section.title || "Untitled section"}</p>
                      <p className="mt-1 text-xs text-[var(--color-txt-sec)]">{getSectionPreset(section.type)?.description || "Storefront section block"}</p>
                      <p className="mt-1 text-xs text-[var(--color-txt-sec)]">{section.is_enabled ? "Visible" : "Hidden"}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => setSelectedSectionId(section.id || null)} className="rounded-full border border-[var(--color-brd)] px-3 py-2 text-xs font-semibold">Edit</button>
                      <button type="button" onClick={() => void duplicateSection(section)} className="rounded-full border border-[var(--color-brd)] px-3 py-2 text-xs font-semibold">Duplicate</button>
                      <button type="button" onClick={() => void saveSection({ ...section, is_enabled: !section.is_enabled })} className="rounded-full border border-[var(--color-brd)] px-3 py-2 text-xs font-semibold">{section.is_enabled ? "Hide" : "Show"}</button>
                      <button type="button" disabled={index === 0} onClick={() => void moveSection(section.id!, "up")} className="rounded-full border border-[var(--color-brd)] px-3 py-2 text-xs font-semibold disabled:opacity-50">Move Up</button>
                      <button type="button" disabled={index === page.sections.length - 1} onClick={() => void moveSection(section.id!, "down")} className="rounded-full border border-[var(--color-brd)] px-3 py-2 text-xs font-semibold disabled:opacity-50">Move Down</button>
                      <button type="button" onClick={() => void deleteSection(section.id!)} className="rounded-full border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600">Delete</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </FormCard>

          <FormCard title="Section Editor" description="Edit the selected section with structured fields first. Advanced JSON remains available for uncommon cases.">
            {selectedSection ? (
              <div className="space-y-5">
                <label className="flex items-center gap-3 rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm font-medium text-[var(--color-txt-sec)]">
                  <input type="checkbox" checked={selectedSection.is_enabled ?? true} onChange={(e) => updateSelectedSection((current) => ({ ...current, is_enabled: e.target.checked }))} />
                  Enabled
                </label>

                {renderStructuredEditor(selectedSection)}

                <details className="rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)]">
                  <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-[var(--color-txt-pri)]">Advanced settings</summary>
                  <div className="space-y-4 border-t border-[var(--color-brd)] p-4">
                    <label className="block text-sm">
                      <span className="mb-2 block font-medium text-[var(--color-txt-sec)]">Settings JSON</span>
                      <textarea
                        value={JSON.stringify(selectedSection.settings || {}, null, 2)}
                        onChange={(e) => {
                          try {
                            const parsed = JSON.parse(e.target.value || "{}");
                            updateSelectedSection((current) => ({ ...current, settings: parsed }));
                          } catch {}
                        }}
                        className="min-h-40 w-full rounded-2xl border border-[var(--color-brd)] bg-white px-4 py-3 font-mono text-xs outline-none"
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="mb-2 block font-medium text-[var(--color-txt-sec)]">Content JSON</span>
                      <textarea
                        value={JSON.stringify(selectedSection.content || {}, null, 2)}
                        onChange={(e) => {
                          try {
                            const parsed = JSON.parse(e.target.value || "{}");
                            updateSelectedSection((current) => ({ ...current, content: parsed }));
                          } catch {}
                        }}
                        className="min-h-40 w-full rounded-2xl border border-[var(--color-brd)] bg-white px-4 py-3 font-mono text-xs outline-none"
                      />
                    </label>
                  </div>
                </details>

                <div className="flex justify-end">
                  <button type="button" onClick={() => void saveSection(selectedSection)} className="rounded-full bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-white">
                    Save Section
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[var(--color-txt-sec)]">Select a section from the left to edit it.</p>
            )}
          </FormCard>
        </div>
      ) : null}
    </div>
  );
}
