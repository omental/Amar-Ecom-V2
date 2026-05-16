import { Loader2 } from "lucide-react";

type LoadingStateProps = {
  label: string;
};

export function LoadingState({ label }: LoadingStateProps) {
  return (
    <div className="flex items-center gap-3 rounded-[20px] border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-4 text-sm text-[var(--color-txt-sec)] shadow-[var(--shadow-subtle)]">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>{label}</span>
    </div>
  );
}
