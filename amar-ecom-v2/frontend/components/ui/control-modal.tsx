"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";

export function ControlModal({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/55 px-4 py-6 backdrop-blur-sm sm:px-6 sm:py-10">
      <div className="w-full max-w-3xl rounded-[28px] border border-[var(--color-brd)] bg-[var(--color-surf)] shadow-[var(--shadow-prem)]">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--color-brd)] px-5 py-5 sm:px-6">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-[var(--color-txt-pri)] sm:text-2xl">{title}</h2>
            {description ? (
              <p className="mt-2 text-sm leading-6 text-[var(--color-txt-sec)]">{description}</p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--color-brd)] text-[var(--color-txt-mut)] transition hover:bg-[var(--color-surf-hover)] hover:text-[var(--color-txt-pri)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-5 sm:px-6">{children}</div>
      </div>
    </div>
  );
}
