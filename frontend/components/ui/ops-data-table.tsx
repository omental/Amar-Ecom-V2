import type { ReactNode } from "react";

export function OpsDataTable({
  columns,
  children,
}: {
  columns: string[];
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 max-w-full overflow-hidden rounded-[24px] border border-[var(--color-brd)] bg-white shadow-[var(--shadow-subtle)]">
      <div className="max-w-full overflow-x-auto">
        <div
          className="grid min-w-[640px] gap-4 border-b border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-5 py-4 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--color-txt-mut)]"
          style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
        >
          {columns.map((column) => (
            <span key={column}>{column}</span>
          ))}
        </div>
        <div className="min-w-[640px] divide-y divide-[var(--color-brd)]">{children}</div>
      </div>
    </div>
  );
}
