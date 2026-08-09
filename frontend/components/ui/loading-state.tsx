import { Loader2 } from "lucide-react";

type LoadingStateProps = {
  label: string;
  variant?: "page" | "section" | "table";
};

export function LoadingState({ label, variant = "section" }: LoadingStateProps) {
  return (
    <div role="status" aria-live="polite" className={`rounded-[24px] border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-5 shadow-[var(--shadow-subtle)] ${variant === "page" ? "py-12" : variant === "table" ? "py-8" : "py-5"}`}>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--color-brd)] bg-white text-[var(--color-accent)]">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        </div>
        <div>
          <p className="ops-micro-label">Loading</p>
          <p className="mt-1 text-sm text-[var(--color-txt-sec)]">{label}</p>
        </div>
      </div>
    </div>
  );
}
