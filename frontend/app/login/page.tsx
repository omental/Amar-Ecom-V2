"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LockKeyhole, Mail } from "lucide-react";

import { api, ApiError } from "@/lib/api";
import { getApiBaseUrl } from "@/lib/api-config";
import { fetchCurrentUser, saveToken, saveUser } from "@/lib/auth";
import Link from "next/link";

type LoginResponse = {
  access_token: string;
  token_type: string;
  user: {
    id: string;
    full_name: string;
    email: string;
    role: string;
    is_active: boolean;
    permissions?: string[];
    created_at?: string;
    updated_at?: string;
  };
  permissions: string[];
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await api.post<LoginResponse>("/auth/login", {
        email,
        password,
      });

      saveToken(response.access_token);
      const fallbackUser = {
        ...response.user,
        permissions: response.permissions,
      };
      saveUser(fallbackUser);
      await fetchCurrentUser().catch(() => fallbackUser);
      router.replace("/dashboard");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Unable to sign in right now. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="app-shell flex min-h-screen items-center justify-center px-4 py-10">
      <div className="grid w-full max-w-6xl overflow-hidden rounded-[36px] border border-slate-200 bg-white shadow-[0_40px_120px_rgba(15,23,42,0.12)] lg:grid-cols-[1.1fr_0.9fr]">
        <section className="relative hidden min-h-[720px] overflow-hidden bg-slate-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(148,163,184,0.24),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.18),transparent_24%)]" />
          <div className="relative z-10">
            <p className="text-xs uppercase tracking-[0.36em] text-slate-400">
              Amar eCom v2
            </p>
            <h1 className="mt-6 max-w-lg text-5xl font-semibold leading-tight tracking-tight">
              Run your commerce operations from one clean command center.
            </h1>
            <p className="mt-6 max-w-md text-base leading-7 text-slate-300">
              A focused admin dashboard for products, orders, inventory,
              customers, and warehouse workflows powered by FastAPI and Next.js.
            </p>
          </div>

          <div className="relative z-10 grid gap-4 sm:grid-cols-2">
            {[
              "JWT-protected backend",
              "Modular product catalog",
              "Warehouse-aware inventory",
              "Operational dashboard foundation",
            ].map((item) => (
              <div
                key={item}
                className="rounded-3xl border border-white/10 bg-white/5 px-5 py-5 backdrop-blur"
              >
                <p className="text-sm font-medium text-slate-200">{item}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="flex min-h-[720px] items-center justify-center px-6 py-10 sm:px-10">
          <div className="w-full max-w-md">
            <div className="mb-10">
              <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
                Secure Sign In
              </p>
              <h2 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
                Welcome back
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                Use your Amar eCom v2 credentials to access the admin dashboard.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Email address
                </span>
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus-within:border-slate-400 focus-within:bg-white">
                  <Mail className="h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="admin@example.com"
                    className="w-full bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400"
                    required
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Password
                </span>
                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus-within:border-slate-400 focus-within:bg-white">
                  <LockKeyhole className="h-4 w-4 text-slate-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    className="w-full bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400"
                    required
                  />
                </div>
              </label>

              {error ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span>{isSubmitting ? "Signing in..." : "Sign in"}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-500">
              New to Amar?{" "}
              <Link href="/signup" className="font-semibold text-slate-950 hover:underline">
                Create your store
              </Link>
            </p>

            <div className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 px-5 py-5">
              <p className="text-sm font-medium text-slate-700">
                Backend connection
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Make sure the FastAPI backend is running at{" "}
                <span className="font-medium text-slate-800">
                  {getApiBaseUrl()}
                </span>
                .
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
