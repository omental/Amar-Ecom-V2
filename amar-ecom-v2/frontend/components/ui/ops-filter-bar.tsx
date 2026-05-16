import type { ReactNode } from "react";

type OpsFilterBarProps = {
  title?: string;
  description?: string;
  children: ReactNode;
};

export function OpsFilterBar({ title, description, children }: OpsFilterBarProps) {
  return (
    <section className="card-base min-w-0 max-w-full px-5 py-4">
      {title || description ? (
        <div className="mb-4 min-w-0">
          {title ? <p className="ops-micro-label">{title}</p> : null}
          {description ? <p className="mt-2 text-sm text-[var(--color-txt-sec)]">{description}</p> : null}
        </div>
      ) : null}
      <div className="flex min-w-0 flex-wrap items-center gap-3">{children}</div>
    </section>
  );
}
