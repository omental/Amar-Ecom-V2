import type { ReactNode } from "react";

type Tone = "default" | "success" | "warning" | "danger" | "info";

const toneClasses: Record<Tone, string> = {
  default: "border-slate-200 bg-slate-100 text-slate-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  danger: "border-rose-200 bg-rose-50 text-rose-700",
  info: "border-sky-200 bg-sky-50 text-sky-700",
};

export function OpsStatusBadge({
  label,
  tone = "default",
  dot,
}: {
  label: ReactNode;
  tone?: Tone;
  dot?: boolean;
}) {
  return (
    <span className={`ops-status-badge ${toneClasses[tone]}`}>
      {dot ? <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-current" /> : null}
      {label}
    </span>
  );
}
