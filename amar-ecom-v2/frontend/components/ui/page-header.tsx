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
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
          {eyebrow}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
          {title}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-500">
          {description}
        </p>
      </div>

      {meta ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
          {meta}
        </div>
      ) : null}
    </div>
  );
}
