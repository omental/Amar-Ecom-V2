"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getErrorMessage, publicApi } from "@/lib/api";
import { saveToken, saveUser, type AuthUser } from "@/lib/auth";

type VerifyResponse = { access_token: string; user: AuthUser; permissions: string[] };

export function VerifyEmailClient({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState(token ? "" : "This verification link is incomplete.");

  useEffect(() => {
    if (!token) return;
    let active = true;
    publicApi.post<VerifyResponse>("/onboarding/verify-email", { token }).then((response) => {
      if (!active) return;
      saveToken(response.access_token);
      saveUser({ ...response.user, permissions: response.permissions });
      router.replace("/dashboard");
    }).catch((cause) => {
      if (active) setError(getErrorMessage(cause, "This verification link could not be used."));
    });
    return () => { active = false; };
  }, [router, token]);

  return <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white"><div className="max-w-md rounded-3xl border border-white/10 bg-white/5 p-10 text-center"><h1 className="text-3xl font-semibold">Verifying your email</h1><p className="mt-4 text-sm text-slate-300">{error || "Preparing your Amar workspace…"}</p>{error ? <Link className="mt-6 inline-flex rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-950" href="/login">Return to sign in</Link> : null}</div></main>;
}
