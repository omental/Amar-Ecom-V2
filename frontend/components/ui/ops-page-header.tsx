import type { ReactNode } from "react";

type OpsPageHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  meta?: ReactNode;
  actions?: ReactNode;
};

export function OpsPageHeader({
  eyebrow,
  title,
  description,
  meta,
  actions,
}: OpsPageHeaderProps) {
  return (
    <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
      <div className="min-w-0">
        <p className="ops-micro-label">{eyebrow}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--color-txt-pri)] sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--color-txt-sec)] sm:text-[15px]">
          {description}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {meta ? (
          <div className="rounded-[20px] border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm font-medium text-[var(--color-txt-sec)] shadow-[var(--shadow-subtle)]">
            {meta}
          </div>
        ) : null}
        {actions}
      </div>
    </div>
  );
}
