import { AsyncButton } from "@/components/ui/async-button";
import { useModalRequestClose } from "@/components/ui/control-modal";

export function FormActions({ pending, onCancel, saveLabel = "Save", pendingLabel = "Saving...", destructive = false, sticky = false }: { pending?: boolean; onCancel: () => void; saveLabel?: string; pendingLabel?: string; destructive?: boolean; sticky?: boolean }) {
  const requestModalClose = useModalRequestClose();
  return <div className={`flex flex-col-reverse gap-3 border-t border-[var(--color-brd)] pt-5 sm:flex-row sm:justify-end ${sticky ? "sticky bottom-0 z-10 -mx-5 bg-[var(--color-surf)] px-5 pb-1 sm:-mx-6 sm:px-6" : ""}`}>
    <button type="button" onClick={requestModalClose ?? onCancel} disabled={pending} className="rounded-xl border border-[var(--color-brd)] px-4 py-2.5 text-sm font-semibold disabled:opacity-50">Cancel</button>
    <AsyncButton type="submit" pending={pending} pendingLabel={pendingLabel} className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 ${destructive ? "bg-rose-600" : "bg-[var(--color-accent)]"}`}>{saveLabel}</AsyncButton>
  </div>;
}
