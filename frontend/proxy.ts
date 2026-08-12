import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

type DomainContext = {
  hostname: string;
  canonical_url: string;
  redirect_to_primary: boolean;
};

export async function proxy(request: NextRequest) {
  if (!(["GET", "HEAD"] as string[]).includes(request.method)) return NextResponse.next();
  const hostname = request.headers.get("host") || "";
  const backend = (process.env.AMAR_BACKEND_ORIGIN || "http://127.0.0.1:8000").replace(/\/$/, "");
  const secret = process.env.STOREFRONT_INTERNAL_SECRET || (process.env.NODE_ENV !== "production" ? "amar-development-storefront-proxy" : "");
  if (!secret) return NextResponse.next();
  try {
    const response = await fetch(`${backend}/api/v1/public/storefront/context`, {
      headers: {
        Accept: "application/json",
        "X-Amar-Storefront-Host": hostname,
        "X-Amar-Internal-Secret": secret,
      },
      cache: "no-store",
    });
    if (!response.ok) return NextResponse.next();
    const context = await response.json() as DomainContext;
    if (!context.redirect_to_primary) return NextResponse.next();
    const target = new URL(context.canonical_url);
    if (target.hostname.toLowerCase() === hostname.split(":", 1)[0].toLowerCase()) return NextResponse.next();
    target.pathname = request.nextUrl.pathname;
    target.search = request.nextUrl.search;
    return NextResponse.redirect(target, 308);
  } catch {
    // A resolver outage must not turn into a redirect loop or an untrusted fallback.
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    "/",
    "/products/:path*",
    "/categories/:path*",
    "/pages/:path*",
    "/search/:path*",
    "/cart/:path*",
    "/checkout/:path*",
  ],
};
