import { formatLabel } from "@/lib/format";

type StatusTone = "default" | "success" | "warning" | "danger" | "info";

const toneClasses: Record<StatusTone, string> = {
  default: "border-slate-200 bg-slate-100 text-slate-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  danger: "border-rose-200 bg-rose-50 text-rose-700",
  info: "border-sky-200 bg-sky-50 text-sky-700",
};

function resolveTone(status: string): StatusTone {
  const normalized = status.toLowerCase();

  if (["active", "paid", "delivered", "confirmed", "received", "restocked", "in stock", "completed", "matched", "settled"].includes(normalized)) {
    return "success";
  }

  if (["pending", "processing", "partial", "partially_received", "ordered", "low stock", "partial_delivered", "draft"].includes(normalized)) {
    return "warning";
  }

  if (["cancelled", "refunded", "inactive", "out of stock", "returned", "failed", "mismatch"].includes(normalized)) {
    return "danger";
  }

  if (["shipped", "ready_to_ship", "in_transit", "manual", "website", "facebook", "woocommerce", "unpaid"].includes(normalized)) {
    return "info";
  }

  return "default";
}

export function StatusBadge({
  status,
  label,
}: {
  status: string;
  label?: string;
}) {
  const tone = resolveTone(status);

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${toneClasses[tone]}`}
    >
      {label || formatLabel(status)}
    </span>
  );
}
