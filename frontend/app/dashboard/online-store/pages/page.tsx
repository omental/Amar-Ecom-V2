"use client";

import { FormEvent, useEffect, useState } from "react";

import { OnlineStoreTabs } from "@/components/dashboard/online-store/OnlineStoreTabs";
import { ErrorAlert } from "@/components/ui/error-alert";
import { FormCard } from "@/components/ui/form-card";
import { LoadingState } from "@/components/ui/loading-state";
import { OpsPageHeader } from "@/components/ui/ops-page-header";
import { api, ApiError } from "@/lib/api";
import type { OnlineStorePage } from "@/lib/online-store";
import { buildSectionFromPreset, storefrontSectionPresets } from "@/lib/storefront-section-presets";

const initialPage = {
  title: "",
  slug: "",
  page_type: "custom",
  content: "",
  seo_title: "",
  seo_description: "",
  status: "draft",
};

export default function OnlineStorePagesPage() {
  const [pages, setPages] = useState<OnlineStorePage[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState(initialPage);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [newSectionType, setNewSectionType] = useState("flexible_grid");

  async function loadPages() {
    const payload = await api.get<OnlineStorePage[]>("/admin/storefront/pages");
    setPages(payload);
    setSelectedPageId((current) => current || payload[0]?.id || null);
  }

  useEffect(() => {
    let mounted = true;
    async function run() {
      try {
        if (!mounted) return;
        await loadPages();
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof ApiError ? err.message : "Failed to load storefront pages.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void run();
    return () => {
      mounted = false;
    };
  }, []);

  const selectedPage = pages.find((page) => page.id === selectedPageId) || null;

  async function createPage(event: FormEvent) {
    event.preventDefault();
    try {
      await api.post("/admin/storefront/pages", createForm);
      setCreateForm(initialPage);
      await loadPages();
      setSuccess("Page created.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create page.");
    }
  }

  async function savePage(page: OnlineStorePage) {
    if (!page.id) return;
    try {
      await api.put(`/admin/storefront/pages/${page.id}`, {
        title: page.title,
        slug: page.slug,
        content: page.content,
        seo_title: page.seo_title,
        seo_description: page.seo_description,
        status: page.status,
        page_type: page.page_type,
      });
      await loadPages();
      setSuccess("Page updated.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update page.");
    }
  }

  async function deletePage(page: OnlineStorePage) {
    if (!page.id || page.is_system) return;
    try {
      await api.delete(`/admin/storefront/pages/${page.id}`);
      await loadPages();
      setSuccess("Page deleted.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete page.");
    }
  }

  async function addSectionToPage(page: OnlineStorePage) {
    if (!page.id) return;
    try {
      const payload = buildSectionFromPreset(newSectionType);
      await api.post(`/admin/storefront/pages/${page.id}/sections`, payload);
      await loadPages();
      setSuccess("Section added to page.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add page section.");
    }
  }

  async function saveSection(pageId: string, sectionId: string, title: string, settings: Record<string, unknown> | null, content: Record<string, unknown> | null) {
    try {
      await api.put(`/admin/storefront/sections/${sectionId}`, {
        title,
        settings,
        content,
      });
      await loadPages();
      setSuccess("Page section updated.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update page section.");
    }
  }

  async function deleteSection(sectionId: string) {
    try {
      await api.delete(`/admin/storefront/sections/${sectionId}`);
      await loadPages();
      setSuccess("Page section deleted.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete page section.");
    }
  }

  return (
    <div className="space-y-6">
      <OpsPageHeader
        eyebrow="Online Store"
        title="Pages"
        description="Create and maintain custom storefront pages while protecting required system pages like the homepage."
      />
      <OnlineStoreTabs />
      {loading ? <LoadingState label="Loading storefront pages..." /> : null}
      {!loading && error ? <ErrorAlert message={error} /> : null}
      {success ? (
        <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-700">
          {success}
        </div>
      ) : null}

      {!loading ? (
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <FormCard title="Create Page" description="Add custom storefront pages with SEO fields and publish control.">
            <form onSubmit={createPage} className="grid gap-4">
              <input value={createForm.title} onChange={(e) => setCreateForm((c) => ({ ...c, title: e.target.value }))} placeholder="Title" className="rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm outline-none" />
              <input value={createForm.slug} onChange={(e) => setCreateForm((c) => ({ ...c, slug: e.target.value }))} placeholder="Slug" className="rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm outline-none" />
              <div className="grid gap-4 md:grid-cols-2">
                <select value={createForm.page_type} onChange={(e) => setCreateForm((c) => ({ ...c, page_type: e.target.value }))} className="rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm outline-none">
                  {["custom", "policy", "landing"].map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
                <select value={createForm.status} onChange={(e) => setCreateForm((c) => ({ ...c, status: e.target.value }))} className="rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm outline-none">
                  {["draft", "published"].map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </div>
              <textarea value={createForm.content} onChange={(e) => setCreateForm((c) => ({ ...c, content: e.target.value }))} placeholder="Page content" className="min-h-32 rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm outline-none" />
              <input value={createForm.seo_title} onChange={(e) => setCreateForm((c) => ({ ...c, seo_title: e.target.value }))} placeholder="SEO title" className="rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm outline-none" />
              <textarea value={createForm.seo_description} onChange={(e) => setCreateForm((c) => ({ ...c, seo_description: e.target.value }))} placeholder="SEO description" className="min-h-24 rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm outline-none" />
              <button type="submit" className="rounded-full bg-[var(--color-accent)] px-4 py-3 text-sm font-semibold text-white">Create Page</button>
            </form>
          </FormCard>

          <FormCard title="Edit Pages" description="Select a page to update title, slug, content, SEO, and publication status.">
            <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
              <div className="space-y-2">
                {pages.map((page) => (
                  <button key={page.id} type="button" onClick={() => setSelectedPageId(page.id || null)} className={`w-full rounded-[18px] border px-4 py-3 text-left text-sm ${selectedPageId === page.id ? "border-[var(--color-accent)] bg-[color-mix(in_srgb,var(--color-accent)_8%,white)]" : "border-[var(--color-brd)] bg-[var(--color-surf-hover)]"}`}>
                    <div className="font-semibold text-[var(--color-txt-pri)]">{page.title}</div>
                    <div className="mt-1 text-xs text-[var(--color-txt-sec)]">/{page.slug} · {page.status}</div>
                  </button>
                ))}
              </div>

              {selectedPage ? (
                <div className="space-y-4">
                  <input value={selectedPage.title} onChange={(e) => setPages((current) => current.map((item) => item.id === selectedPage.id ? { ...item, title: e.target.value } : item))} className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm outline-none" />
                  <input value={selectedPage.slug} onChange={(e) => setPages((current) => current.map((item) => item.id === selectedPage.id ? { ...item, slug: e.target.value } : item))} className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm outline-none" />
                  <div className="grid gap-4 md:grid-cols-2">
                    <select value={selectedPage.page_type || "custom"} onChange={(e) => setPages((current) => current.map((item) => item.id === selectedPage.id ? { ...item, page_type: e.target.value } : item))} className="rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm outline-none">
                      {["home", "custom", "policy", "landing"].map((value) => <option key={value} value={value}>{value}</option>)}
                    </select>
                    <select value={selectedPage.status || "draft"} onChange={(e) => setPages((current) => current.map((item) => item.id === selectedPage.id ? { ...item, status: e.target.value } : item))} className="rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm outline-none">
                      {["draft", "published"].map((value) => <option key={value} value={value}>{value}</option>)}
                    </select>
                  </div>
                  <textarea value={selectedPage.content || ""} onChange={(e) => setPages((current) => current.map((item) => item.id === selectedPage.id ? { ...item, content: e.target.value } : item))} className="min-h-36 w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm outline-none" />
                  <input value={selectedPage.seo_title || ""} onChange={(e) => setPages((current) => current.map((item) => item.id === selectedPage.id ? { ...item, seo_title: e.target.value } : item))} className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm outline-none" />
                  <textarea value={selectedPage.seo_description || ""} onChange={(e) => setPages((current) => current.map((item) => item.id === selectedPage.id ? { ...item, seo_description: e.target.value } : item))} className="min-h-24 w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm outline-none" />
                  <div className="flex flex-wrap justify-end gap-3">
                    {!selectedPage.is_system ? (
                      <button type="button" onClick={() => void deletePage(selectedPage)} className="rounded-full border border-rose-200 px-4 py-3 text-sm font-semibold text-rose-600">
                        Delete Page
                      </button>
                    ) : null}
                    <button type="button" onClick={() => void savePage(selectedPage)} className="rounded-full bg-[var(--color-accent)] px-4 py-3 text-sm font-semibold text-white">
                      Save Page
                    </button>
                  </div>
                  <div className="space-y-4 rounded-[20px] border border-[var(--color-brd)] bg-[var(--color-surf-hover)] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[var(--color-txt-pri)]">Page Sections</p>
                        <p className="text-xs text-[var(--color-txt-sec)]">Add controlled sections like Flexible Grid to custom and landing pages.</p>
                      </div>
                      <div className="flex gap-2">
                        <select value={newSectionType} onChange={(e) => setNewSectionType(e.target.value)} className="rounded-full border border-[var(--color-brd)] bg-white px-4 py-2 text-sm">
                          {storefrontSectionPresets.map((preset) => (
                            <option key={preset.type} value={preset.type}>{preset.label}</option>
                          ))}
                        </select>
                        <button type="button" onClick={() => void addSectionToPage(selectedPage)} className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white">
                          Add Section
                        </button>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {(selectedPage.sections || []).map((section) => (
                        <div key={section.id} className="space-y-3 rounded-[18px] border border-[var(--color-brd)] bg-white p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <span className="text-sm font-semibold text-[var(--color-txt-pri)]">{section.type.replace(/_/g, " ")}</span>
                            {!selectedPage.is_system ? (
                              <button type="button" onClick={() => void deleteSection(section.id || "")} className="rounded-full border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600">
                                Delete
                              </button>
                            ) : null}
                          </div>
                          <input value={section.title || ""} onChange={(e) => setPages((current) => current.map((page) => page.id === selectedPage.id ? { ...page, sections: (page.sections || []).map((item) => item.id === section.id ? { ...item, title: e.target.value } : item) } : page))} className="w-full rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm outline-none" />
                          <details className="rounded-2xl border border-[var(--color-brd)] bg-[var(--color-surf-hover)]">
                            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-[var(--color-txt-pri)]">Section JSON</summary>
                            <div className="space-y-3 border-t border-[var(--color-brd)] p-4">
                              <textarea value={JSON.stringify(section.settings || {}, null, 2)} onChange={(e) => { try { const parsed = JSON.parse(e.target.value || "{}"); setPages((current) => current.map((page) => page.id === selectedPage.id ? { ...page, sections: (page.sections || []).map((item) => item.id === section.id ? { ...item, settings: parsed } : item) } : page)); } catch {} }} className="min-h-28 w-full rounded-2xl border border-[var(--color-brd)] bg-white px-4 py-3 font-mono text-xs outline-none" />
                              <textarea value={JSON.stringify(section.content || {}, null, 2)} onChange={(e) => { try { const parsed = JSON.parse(e.target.value || "{}"); setPages((current) => current.map((page) => page.id === selectedPage.id ? { ...page, sections: (page.sections || []).map((item) => item.id === section.id ? { ...item, content: parsed } : item) } : page)); } catch {} }} className="min-h-28 w-full rounded-2xl border border-[var(--color-brd)] bg-white px-4 py-3 font-mono text-xs outline-none" />
                            </div>
                          </details>
                          <div className="flex justify-end">
                            <button type="button" onClick={() => void saveSection(selectedPage.id || "", section.id || "", section.title || "", section.settings || {}, section.content || {})} className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white">
                              Save Section
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </FormCard>
        </div>
      ) : null}
    </div>
  );
}
