"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { OnlineStoreTabs } from "@/components/dashboard/online-store/OnlineStoreTabs";
import { ErrorAlert } from "@/components/ui/error-alert";
import { FormCard } from "@/components/ui/form-card";
import { LoadingState } from "@/components/ui/loading-state";
import { OpsPageHeader } from "@/components/ui/ops-page-header";
import {
  fetchAdminStorefrontRevisions,
  restoreAdminStorefrontRevision,
  type OnlineStoreRevision,
} from "@/lib/online-store";

export default function OnlineStoreRevisionsPage() {
  const [revisions, setRevisions] = useState<OnlineStoreRevision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const payload = await fetchAdminStorefrontRevisions();
        if (!mounted) return;
        setRevisions(payload);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Failed to load revisions.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  async function handleRestore(revisionId: string) {
    const confirmed = window.confirm("Restore this storefront revision? This will replace the saved page layout and theme snapshot for that revision.");
    if (!confirmed) return;
    setRestoringId(revisionId);
    setError("");
    setSuccess("");
    try {
      const response = await restoreAdminStorefrontRevision(revisionId);
      setSuccess(response.message);
      const payload = await fetchAdminStorefrontRevisions();
      setRevisions(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to restore revision.");
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <div className="space-y-6">
      <OpsPageHeader
        eyebrow="Online Store"
        title="Revisions"
        description="Review rollback snapshots created before template apply, publish, and theme changes."
      />
      <OnlineStoreTabs />
      {loading ? <LoadingState label="Loading storefront revisions..." /> : null}
      {!loading && error ? <ErrorAlert message={error} /> : null}
      {success ? (
        <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-700">
          {success} <Link href="/dashboard/online-store/customize" className="underline">Go to Customize</Link>
        </div>
      ) : null}

      {!loading ? (
        <FormCard title="Revision History" description="Recent storefront safety snapshots for homepage and theme changes.">
          <div className="space-y-3">
            {revisions.length === 0 ? (
              <p className="text-sm text-[var(--color-txt-sec)]">No revisions yet.</p>
            ) : (
              revisions.map((revision) => (
                <div key={revision.id} className="flex flex-wrap items-center justify-between gap-4 rounded-[18px] border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[var(--color-surf)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-txt-pri)]">
                        {revision.revision_type.replace(/_/g, " ")}
                      </span>
                      <span className="text-sm font-semibold text-[var(--color-txt-pri)]">{revision.title}</span>
                    </div>
                    <p className="text-xs text-[var(--color-txt-sec)]">
                      {new Date(revision.created_at).toLocaleString()}
                      {revision.created_by_name ? ` • ${revision.created_by_name}` : ""}
                    </p>
                  </div>
                  {revision.revision_type === "theme_publish" ? <span className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-600">Republish from Themes</span> : <button
                    type="button"
                    onClick={() => void handleRestore(revision.id)}
                    disabled={restoringId === revision.id}
                    className="rounded-full border border-[var(--color-brd)] px-4 py-2 text-sm font-semibold text-[var(--color-txt-pri)] disabled:opacity-60"
                  >
                    {restoringId === revision.id ? "Restoring..." : "Restore"}
                  </button>}
                </div>
              ))
            )}
          </div>
        </FormCard>
      ) : null}
    </div>
  );
}
