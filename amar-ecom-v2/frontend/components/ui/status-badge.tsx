import { formatLabel } from "@/lib/format";
import { OpsStatusBadge } from "@/components/ui/ops-status-badge";

type StatusTone = "default" | "success" | "warning" | "danger" | "info";

function resolveTone(status: string): StatusTone {
  const normalized = status.toLowerCase();

  if (["active", "paid", "delivered", "confirmed", "received", "restocked", "in stock", "completed", "matched", "settled", "success"].includes(normalized)) {
    return "success";
  }

  if (["new"].includes(normalized)) {
    return "success";
  }

  if (["pending", "processing", "partial", "partially_received", "ordered", "low stock", "partial_delivered", "draft", "skipped"].includes(normalized)) {
    return "warning";
  }

  if (["existing_by_sku", "existing_by_slug", "existing_by_order_number", "existing_by_external_id_if_available", "missing_sku"].includes(normalized)) {
    return "warning";
  }

  if (["cancelled", "refunded", "inactive", "out of stock", "returned", "failed", "mismatch"].includes(normalized)) {
    return "danger";
  }

  if (["shipped", "ready_to_ship", "in_transit", "manual", "website", "facebook", "woocommerce", "unpaid", "submitted"].includes(normalized)) {
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
  return <OpsStatusBadge label={label || formatLabel(status)} tone={tone} dot />;
}
