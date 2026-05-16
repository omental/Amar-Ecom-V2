import type { ReactNode } from "react";

export function OpsDataTable({
  columns,
  children,
}: {
  columns: string[];
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-[24px] border border-[var(--color-brd)] bg-white shadow-[var(--shadow-subtle)]">
      <div
        className="grid gap-4 border-b border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-5 py-4 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--color-txt-mut)]"
        style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
      >
        {columns.map((column) => (
          <span key={column}>{column}</span>
        ))}
      </div>
      <div className="divide-y divide-[var(--color-brd)]">{children}</div>
    </div>
  );
}
