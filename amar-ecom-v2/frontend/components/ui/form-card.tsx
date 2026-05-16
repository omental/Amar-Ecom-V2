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
    <section className="card-base p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="ops-micro-label">Workspace Panel</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-[var(--color-txt-pri)]">
            {title}
          </h2>
          <p className="mt-2 text-sm leading-7 text-[var(--color-txt-sec)]">
            {description}
          </p>
        </div>
        {action ? action : null}
      </div>

      <div className="mt-6">{children}</div>
    </section>
  );
}
