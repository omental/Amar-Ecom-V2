import "server-only";

import { headers } from "next/headers";

import { normalizeStorefrontHostname } from "@/lib/storefront-domain";

export async function getServerStorefrontHostname() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  if (!host) throw new Error("Storefront request hostname is missing");
  return normalizeStorefrontHostname(host);
}

export async function getServerStorefrontOrigin(path = "") {
  const hostname = await getServerStorefrontHostname();
  const localHostname = hostname === "localhost" || hostname.endsWith(".localhost");
  const development = process.env.NODE_ENV !== "production" || localHostname;
  const requestPort = (await headers()).get("host")?.match(/:\d+$/)?.[0];
  const configuredPort = process.env.NEXT_PUBLIC_STOREFRONT_DEV_PORT || "3000";
  const port = development ? requestPort || (configuredPort ? `:${configuredPort}` : "") : "";
  const cleanPath = path ? `/${path.replace(/^\/+/, "")}` : "";
  return `${development ? "http" : "https"}://${hostname}${port}${cleanPath}`;
}
