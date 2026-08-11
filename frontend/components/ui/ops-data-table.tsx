import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading-state";

export function OpsDataTable({
  columns,
  children,
  loading = false,
  empty = false,
  emptyTitle = "No records found",
  emptyDescription = "Try changing the filters or create the first record.",
  error,
  onRetry,
  pagination,
  columnTemplate,
  minWidth = "640px",
}: {
  columns: string[];
  children: ReactNode;
  loading?: boolean;
  empty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  error?: string;
  onRetry?: () => void;
  pagination?: { page: number; totalPages: number; onPageChange: (page: number) => void };
  columnTemplate?: string;
  minWidth?: string;
}) {
  if (loading) return <LoadingState label="Loading table data..." variant="table" />;
  if (error) return <ErrorAlert message={error} onRetry={onRetry} />;
  if (empty) return <EmptyState title={emptyTitle} description={emptyDescription} />;
  return (
    <div className="min-w-0 max-w-full overflow-hidden rounded-[24px] border border-[var(--color-brd)] bg-white shadow-[var(--shadow-subtle)]">
      <div className="max-w-full overflow-x-auto">
        <div
          className="grid gap-4 border-b border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-5 py-4 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--color-txt-mut)]"
          style={{ gridTemplateColumns: columnTemplate ?? `repeat(${columns.length}, minmax(0, 1fr))`, minWidth }}
        >
          {columns.map((column) => (
            <span key={column}>{column}</span>
          ))}
        </div>
        <div className="divide-y divide-[var(--color-brd)]" style={{ minWidth }}>{children}</div>
      </div>
      {pagination && pagination.totalPages > 1 ? <nav aria-label="Table pagination" className="flex items-center justify-between border-t border-[var(--color-brd)] px-5 py-3 text-sm">
        <span>Page {pagination.page} of {pagination.totalPages}</span>
        <div className="flex gap-2"><button type="button" aria-label="Previous page" disabled={pagination.page <= 1} onClick={() => pagination.onPageChange(pagination.page - 1)} className="rounded-lg border p-2 disabled:opacity-40"><ChevronLeft size={16} /></button><button type="button" aria-label="Next page" disabled={pagination.page >= pagination.totalPages} onClick={() => pagination.onPageChange(pagination.page + 1)} className="rounded-lg border p-2 disabled:opacity-40"><ChevronRight size={16} /></button></div>
      </nav> : null}
    </div>
  );
}
