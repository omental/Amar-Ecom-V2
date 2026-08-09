import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export function AsyncButton({ pending = false, pendingLabel = "Saving...", children, disabled, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { pending?: boolean; pendingLabel?: string; children: ReactNode }) {
  return <button {...props} disabled={disabled || pending} aria-busy={pending}>
    <span className="inline-flex items-center justify-center gap-2">{pending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}{pending ? pendingLabel : children}</span>
  </button>;
}
