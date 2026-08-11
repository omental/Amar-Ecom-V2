"use client";

import { createContext, useCallback, useContext, useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { X } from "lucide-react";

const ModalCloseContext = createContext<(() => void) | null>(null);

export function ModalCancelButton({ children = "Cancel", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  const requestClose = useContext(ModalCloseContext);
  return <button type="button" {...props} onClick={requestClose ?? props.onClick}>{children}</button>;
}

export function useModalRequestClose() {
  return useContext(ModalCloseContext);
}

export function ControlModal({
  title,
  description,
  onClose,
  children,
  dirty,
  size = "lg",
  closeGuardMessage = "You have unsaved changes. Close without saving?",
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  dirty?: boolean;
  size?: "sm" | "lg" | "xl";
  closeGuardMessage?: string;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const initialFormState = useRef("");

  const serializeForms = useCallback(() => {
    const forms = dialogRef.current?.querySelectorAll("form") ?? [];
    return Array.from(forms).map((form) => Array.from(new FormData(form).entries()).map(([key, value]) => `${key}:${typeof value === "string" ? value : value.name}`).join("|")).join("||");
  }, []);

  const requestClose = useCallback(() => {
    const formChanged = initialFormState.current !== serializeForms();
    if ((dirty ?? formChanged) && !window.confirm(closeGuardMessage)) return;
    onClose();
  }, [closeGuardMessage, dirty, onClose, serializeForms]);

  useEffect(() => {
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    initialFormState.current = serializeForms();
    const dialog = dialogRef.current;
    const focusable = dialog?.querySelector<HTMLElement>("button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex='-1'])");
    (focusable ?? dialog)?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      restoreFocusRef.current?.focus();
    };
  }, [serializeForms]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const dialogs = Array.from(document.querySelectorAll<HTMLElement>("[role='dialog'][aria-modal='true']"));
      if (dialogs.at(-1) !== dialogRef.current) return;
      if (event.key === "Escape") { event.preventDefault(); requestClose(); return; }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex='-1'])"));
      if (!focusable.length) { event.preventDefault(); dialogRef.current.focus(); return; }
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [requestClose]);

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/55 px-4 py-6 backdrop-blur-sm sm:px-6 sm:py-10" onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose(); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} tabIndex={-1} className={`flex max-h-[calc(100dvh-3rem)] w-full flex-col overflow-hidden rounded-[28px] border border-[var(--color-brd)] bg-[var(--color-surf)] shadow-[var(--shadow-prem)] outline-none sm:max-h-[calc(100dvh-5rem)] ${size === "sm" ? "max-w-xl" : size === "xl" ? "max-w-6xl" : "max-w-3xl"}`}>
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--color-brd)] px-5 py-5 sm:px-6">
          <div className="min-w-0">
            <h2 id={titleId} className="text-xl font-bold text-[var(--color-txt-pri)] sm:text-2xl">{title}</h2>
            {description ? (
              <p id={descriptionId} className="mt-2 text-sm leading-6 text-[var(--color-txt-sec)]">{description}</p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={requestClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--color-brd)] text-[var(--color-txt-mut)] transition hover:bg-[var(--color-surf-hover)] hover:text-[var(--color-txt-pri)]"
            aria-label={`Close ${title}`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <ModalCloseContext.Provider value={requestClose}>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        </ModalCloseContext.Provider>
      </div>
    </div>
  );
}
