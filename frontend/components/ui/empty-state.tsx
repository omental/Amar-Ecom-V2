import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="rounded-[24px] border border-dashed border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-6 py-10 text-center shadow-[var(--shadow-subtle)]">
      <p className="ops-micro-label">Empty State</p>
      <p className="mt-3 text-base font-semibold text-[var(--color-txt-pri)]">{title}</p>
      <p className="mx-auto mt-2 max-w-2xl text-sm leading-7 text-[var(--color-txt-sec)]">{description}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}
