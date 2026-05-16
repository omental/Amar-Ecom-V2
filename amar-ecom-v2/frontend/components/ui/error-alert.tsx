type ErrorAlertProps = {
  message: string;
};

export function ErrorAlert({ message }: ErrorAlertProps) {
  return (
    <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 shadow-[var(--shadow-subtle)]">
      {message}
    </div>
  );
}
