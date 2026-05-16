type PageHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  meta?: string;
};

export function PageHeader({
  eyebrow,
  title,
  description,
  meta,
}: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="ops-micro-label">{eyebrow}</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--color-txt-pri)] sm:text-3xl">
          {title}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--color-txt-sec)]">
          {description}
        </p>
      </div>

      {meta ? (
        <div className="rounded-[20px] border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm text-[var(--color-txt-sec)] shadow-[var(--shadow-subtle)]">
          {meta}
        </div>
      ) : null}
    </div>
  );
}
