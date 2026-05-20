import type { ReactNode } from "react";

export function BatchActionBar({
  label,
  children,
}: {
  label: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="glass-morphism rounded-[24px] border border-[var(--color-brd)] px-4 py-4 shadow-[var(--shadow-premium)]">
      <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="ops-micro-label">Batch Actions</p>
          <div className="mt-1 break-words text-sm font-semibold text-[var(--color-txt-pri)]">{label}</div>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-3">{children}</div>
      </div>
    </section>
  );
}
