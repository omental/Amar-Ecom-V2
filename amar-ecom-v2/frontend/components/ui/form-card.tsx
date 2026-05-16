import type { ReactNode } from "react";

type FormCardProps = {
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
};

export function FormCard({
  title,
  description,
  action,
  children,
}: FormCardProps) {
  return (
    <section className="card-base min-w-0 max-w-full p-6">
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="ops-micro-label">Workspace Panel</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-[var(--color-txt-pri)]">
            {title}
          </h2>
          <p className="mt-2 text-sm leading-7 text-[var(--color-txt-sec)]">
            {description}
          </p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>

      <div className="mt-6 min-w-0 max-w-full">{children}</div>
    </section>
  );
}
