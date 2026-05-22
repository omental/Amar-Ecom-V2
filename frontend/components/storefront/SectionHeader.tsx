import Link from "next/link";

type SectionHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  href?: string;
  hrefLabel?: string;
};

export function SectionHeader({
  eyebrow,
  title,
  description,
  href,
  hrefLabel = "Explore more",
}: SectionHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <p className="store-eyebrow">{eyebrow}</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-[1.75rem]">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-[15px]">
          {description}
        </p>
      </div>
      {href ? (
        <Link
          href={href}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800 transition hover:text-[var(--store-accent)]"
        >
          {hrefLabel}
        </Link>
      ) : null}
    </div>
  );
}
