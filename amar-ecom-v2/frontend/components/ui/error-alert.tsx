type ErrorAlertProps = {
  message: string;
};

export function ErrorAlert({ message }: ErrorAlertProps) {
  return (
    <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-5 py-4 shadow-[var(--shadow-subtle)]">
      <p className="ops-micro-label text-rose-600">Warning</p>
      <p className="mt-2 text-sm font-medium leading-6 text-rose-700">{message}</p>
    </div>
  );
}
