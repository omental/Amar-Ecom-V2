import { BadgeCheck, CreditCard, PackageCheck, Shield } from "lucide-react";

import { MotionReveal } from "./MotionReveal";

const TRUST_ITEMS = [
  {
    icon: PackageCheck,
    title: "Nationwide delivery",
    description: "Structured for Dhaka-first speed and all-Bangladesh coverage.",
  },
  {
    icon: Shield,
    title: "Stock-aware browsing",
    description: "Public storefront respects availability so buyers see clearer product intent.",
  },
  {
    icon: CreditCard,
    title: "Checkout-ready CTA",
    description: "Order-focused buttons are placed where mobile shoppers naturally pause.",
  },
  {
    icon: BadgeCheck,
    title: "Premium presentation",
    description: "Glass surfaces, subtle motion, and image-first cards elevate the brand feel.",
  },
];

export function TrustBadges() {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {TRUST_ITEMS.map((item, index) => (
        <MotionReveal key={item.title} delay={index * 0.04}>
          <div className="rounded-[28px] border border-white/70 bg-white/88 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.06)] backdrop-blur">
            <item.icon className="h-6 w-6 text-[var(--store-accent)]" />
            <h3 className="mt-4 text-lg font-semibold tracking-[-0.03em] text-slate-950">
              {item.title}
            </h3>
            <p className="mt-2 text-sm leading-7 text-slate-500">{item.description}</p>
          </div>
        </MotionReveal>
      ))}
    </section>
  );
}
