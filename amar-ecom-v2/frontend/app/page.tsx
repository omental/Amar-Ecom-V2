"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { isAuthenticated } from "@/lib/auth";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(isAuthenticated() ? "/dashboard" : "/login");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-surface)]">
      <div className="rounded-3xl border border-[var(--color-border)] bg-white px-6 py-5 text-sm font-medium text-[var(--color-muted)] shadow-[var(--shadow-soft)]">
        Loading Amar eCom v2...
      </div>
    </div>
  );
}
