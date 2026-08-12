"use client";

import { useCallback, useState } from "react";

type HistoryState<T> = { past: T[]; present: T | null; future: T[] };

export function useBuilderHistory<T>(initial: T | null) {
  const [state, setState] = useState<HistoryState<T>>({ past: [], present: initial, future: [] });

  const reset = useCallback((value: T) => setState({ past: [], present: value, future: [] }), []);

  const commit = useCallback((value: T | ((current: T) => T)) => {
    setState((current) => {
      if (current.present === null) return current;
      const next = typeof value === "function" ? (value as (item: T) => T)(current.present) : value;
      if (Object.is(current.present, next)) return current;
      return { past: [...current.past.slice(-74), current.present], present: next, future: [] };
    });
  }, []);

  const undo = useCallback(() => setState((current) => {
    const previous = current.past.at(-1);
    if (!previous || current.present === null) return current;
    return { past: current.past.slice(0, -1), present: previous, future: [current.present, ...current.future] };
  }), []);

  const redo = useCallback(() => setState((current) => {
    const next = current.future[0];
    if (!next || current.present === null) return current;
    return { past: [...current.past, current.present], present: next, future: current.future.slice(1) };
  }), []);

  return { present: state.present, commit, reset, undo, redo, canUndo: state.past.length > 0, canRedo: state.future.length > 0 };
}
