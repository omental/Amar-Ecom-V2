import { AsyncButton } from "@/components/ui/async-button";

export function FormActions({ pending, onCancel, saveLabel = "Save", pendingLabel = "Saving...", destructive = false }: { pending?: boolean; onCancel: () => void; saveLabel?: string; pendingLabel?: string; destructive?: boolean }) {
  return <div className="flex flex-col-reverse gap-3 border-t border-[var(--color-brd)] pt-5 sm:flex-row sm:justify-end">
    <button type="button" onClick={onCancel} disabled={pending} className="rounded-xl border border-[var(--color-brd)] px-4 py-2.5 text-sm font-semibold disabled:opacity-50">Cancel</button>
    <AsyncButton type="submit" pending={pending} pendingLabel={pendingLabel} className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 ${destructive ? "bg-rose-600" : "bg-[var(--color-accent)]"}`}>{saveLabel}</AsyncButton>
  </div>;
}
