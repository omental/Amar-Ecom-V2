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
    <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-950">
            {title}
          </h2>
          <p className="mt-2 text-sm leading-7 text-slate-500">
            {description}
          </p>
        </div>
        {action ? action : null}
      </div>

      <div className="mt-6">{children}</div>
    </section>
  );
}
