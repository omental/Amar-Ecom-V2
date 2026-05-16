type EmptyStateProps = {
  title: string;
  description: string;
};

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="rounded-[24px] border border-dashed border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-6 py-10 text-center shadow-[var(--shadow-subtle)]">
      <p className="ops-micro-label">Empty State</p>
      <p className="mt-3 text-base font-semibold text-[var(--color-txt-pri)]">{title}</p>
      <p className="mt-2 text-sm leading-7 text-[var(--color-txt-sec)]">{description}</p>
    </div>
  );
}
