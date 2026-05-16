import type { ReactNode } from "react";

type PageHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  meta?: ReactNode;
};

export function PageHeader({
  eyebrow,
  title,
  description,
  meta,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
      <div className="min-w-0">
        <p className="ops-micro-label">{eyebrow}</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--color-txt-pri)] sm:text-3xl xl:text-[2rem]">
          {title}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--color-txt-sec)] sm:text-[15px]">
          {description}
        </p>
      </div>

      {meta ? (
        <div className="rounded-[20px] border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm font-medium text-[var(--color-txt-sec)] shadow-[var(--shadow-subtle)]">
          {meta}
        </div>
      ) : null}
    </div>
  );
}
