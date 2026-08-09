type ErrorAlertProps = {
  message: string;
  title?: string;
  onRetry?: () => void;
  persistent?: boolean;
};

export function ErrorAlert({ message, title = "Something went wrong", onRetry, persistent = true }: ErrorAlertProps) {
  return (
    <div role={persistent ? "alert" : "status"} aria-live={persistent ? "assertive" : "polite"} className="rounded-[24px] border border-rose-200 bg-rose-50 px-5 py-4 shadow-[var(--shadow-subtle)]">
      <p className="ops-micro-label text-rose-600">{title}</p>
      <p className="mt-2 text-sm font-medium leading-6 text-rose-700">{message}</p>
      {onRetry ? <button type="button" onClick={onRetry} className="mt-3 rounded-xl border border-rose-300 bg-white px-3 py-2 text-sm font-semibold text-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2">Try again</button> : null}
    </div>
  );
}
