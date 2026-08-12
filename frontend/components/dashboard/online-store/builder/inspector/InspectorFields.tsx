export const inspectorInputClass = "w-full rounded-xl border border-[var(--color-brd)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--color-accent)]";

export function InspectorField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-semibold text-[var(--color-txt-sec)]">{label}</span>{children}</label>;
}

export function InspectorGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="border-b border-[var(--color-brd)] p-4"><h3 className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-[var(--color-txt-sec)]">{title}</h3><div className="space-y-3">{children}</div></section>;
}
