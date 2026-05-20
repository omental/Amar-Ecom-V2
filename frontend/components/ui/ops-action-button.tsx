import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variantClasses: Record<Variant, string> = {
  primary: "btn-primary",
  secondary:
    "inline-flex items-center justify-center gap-2 rounded-full border border-[var(--color-brd)] bg-white px-4 py-3 text-sm font-semibold text-[var(--color-txt-sec)] shadow-[var(--shadow-subtle)] transition hover:bg-[var(--color-surf-hover)]",
  ghost:
    "inline-flex items-center justify-center gap-2 rounded-full border border-transparent px-4 py-3 text-sm font-semibold text-[var(--color-txt-sec)] transition hover:bg-[var(--color-surf-hover)]",
  danger:
    "inline-flex items-center justify-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100",
};

export function OpsActionButton({
  variant = "secondary",
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  children: ReactNode;
}) {
  return (
    <button className={`${variantClasses[variant]} ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}
