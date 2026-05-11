type EmptyStateProps = {
  title: string;
  description: string;
};

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
      <p className="text-base font-medium text-slate-700">{title}</p>
      <p className="mt-2 text-sm leading-7 text-slate-500">{description}</p>
    </div>
  );
}
