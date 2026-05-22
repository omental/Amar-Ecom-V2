"use client";

import { useState } from "react";

import type { OnlineStoreSection, OnlineStoreSettings } from "@/lib/online-store";

import { SectionWrap } from "./shared";

export function NewsletterSection({
  section,
  settings,
}: {
  section: OnlineStoreSection;
  settings: OnlineStoreSettings;
}) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const buttonText = String((section.content as Record<string, string> | undefined)?.button_text || "Subscribe");
  return (
    <SectionWrap settings={settings} className="rounded-2xl border border-[#e5e7eb] bg-[linear-gradient(135deg,#ffffff_0%,#fff1f3_100%)] px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-[720px] text-center">
        <h2 className="text-2xl font-black uppercase tracking-tight text-black sm:text-3xl">{section.title || "Newsletter"}</h2>
        {section.subtitle ? <p className="mt-3 text-sm leading-7 text-[#4b5563]">{section.subtitle}</p> : null}
        <form
          className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            setSubmitted(true);
          }}
        >
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Enter your email"
            className="h-12 rounded-md border border-[#d1d5db] bg-white px-4 text-sm outline-none"
          />
          <button type="submit" className="rounded-md px-5 py-3 text-sm font-semibold text-white transition" style={{ backgroundColor: settings.primary_color || "#db011c" }}>
            {buttonText}
          </button>
        </form>
        {submitted ? <p className="mt-3 text-sm font-medium text-[var(--store-accent)]">Thanks. Newsletter backend will be connected in a later phase.</p> : null}
      </div>
    </SectionWrap>
  );
}
