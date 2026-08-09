"use client";

import { useCallback, useEffect, useRef } from "react";

const FOCUSABLE = "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex='-1'])";

export function useDialogAccessibility(onClose: () => void) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const initialStateRef = useRef("");

  const serialize = useCallback(() => Array.from(dialogRef.current?.querySelectorAll("form") ?? []).map((form) => Array.from(new FormData(form).entries()).map(([key, value]) => `${key}:${typeof value === "string" ? value : value.name}`).join("|")).join("||"), []);
  const requestClose = useCallback(() => {
    if (serialize() !== initialStateRef.current && !window.confirm("You have unsaved changes. Close without saving?")) return;
    onClose();
  }, [onClose, serialize]);

  useEffect(() => {
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    initialStateRef.current = serialize();
    const first = dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? dialogRef.current)?.focus();
    return () => restoreFocusRef.current?.focus();
  }, [serialize]);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); requestClose(); return; }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!items.length) return;
      if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus(); }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [requestClose]);

  return { dialogRef, requestClose };
}
