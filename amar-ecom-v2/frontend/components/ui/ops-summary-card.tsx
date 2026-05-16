import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

type OpsSummaryTone = "default" | "success" | "warning" | "danger" | "info";

const toneMap: Record<OpsSummaryTone, string> = {
  default: "border-slate-200 bg-slate-100 text-slate-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  danger: "border-rose-200 bg-rose-50 text-rose-700",
  info: "border-sky-200 bg-sky-50 text-sky-700",
};

type OpsSummaryCardProps = {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  eyebrow?: string;
  helper?: ReactNode;
  tone?: OpsSummaryTone;
};

export function OpsSummaryCard({
  label,
  value,
  icon: Icon,
  eyebrow,
  helper,
  tone = "default",
}: OpsSummaryCardProps) {
  return (
    <article className="card-base card-interactive p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {eyebrow ? <p className="ops-micro-label">{eyebrow}</p> : null}
          <p className="mt-2 text-sm font-medium text-[var(--color-txt-sec)]">{label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-[var(--color-txt-pri)]">{value}</p>
          {helper ? <div className="mt-3 text-xs leading-6 text-[var(--color-txt-mut)]">{helper}</div> : null}
        </div>

        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${toneMap[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </article>
  );
}
