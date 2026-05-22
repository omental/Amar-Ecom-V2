"use client";

import { FormEvent, useEffect, useState } from "react";

import { OnlineStoreTabs } from "@/components/dashboard/online-store/OnlineStoreTabs";
import { ErrorAlert } from "@/components/ui/error-alert";
import { FormCard } from "@/components/ui/form-card";
import { LoadingState } from "@/components/ui/loading-state";
import { OpsPageHeader } from "@/components/ui/ops-page-header";
import { api, ApiError } from "@/lib/api";
import type { OnlineStorePage } from "@/lib/online-store";

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
                </div>
              ) : null}
            </div>
          </FormCard>
        </div>
      ) : null}
    </div>
  );
}
