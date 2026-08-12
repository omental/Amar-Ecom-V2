const HOST_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function normalizeStorefrontHostname(input: string) {
  let value = input.trim().toLowerCase().replace(/\.$/, "");
  if (!value || value.length > 253 || value.includes("://") || /[/?#@]/.test(value)) {
    throw new Error("Invalid storefront hostname");
  }
  const portIndex = value.lastIndexOf(":");
  if (portIndex > -1) {
    const port = value.slice(portIndex + 1);
    if (!/^\d+$/.test(port)) throw new Error("Invalid storefront hostname");
    value = value.slice(0, portIndex);
  }
  if (value.length > 253 || value.split(".").some((label) => !HOST_LABEL.test(label))) {
    throw new Error("Invalid storefront hostname");
  }
  return value;
}

export function getHostedStorefrontUrl(slug: string) {
  const development = process.env.NODE_ENV !== "production";
  const baseDomain = development
    ? process.env.NEXT_PUBLIC_STOREFRONT_DEV_BASE_DOMAIN || "localhost"
    : process.env.NEXT_PUBLIC_STOREFRONT_BASE_DOMAIN || "amar-ecom.com";
  const scheme = development ? "http" : "https";
  const port = development ? process.env.NEXT_PUBLIC_STOREFRONT_DEV_PORT || "3000" : "";
  const hostname = normalizeStorefrontHostname(`${slug}.${baseDomain}`);
  return `${scheme}://${hostname}${port ? `:${port}` : ""}`;
}

export function getCanonicalStorefrontUrl(hostname: string, path = "") {
  const normalized = normalizeStorefrontHostname(hostname);
  const scheme = process.env.NODE_ENV === "production" ? "https" : "http";
  const cleanPath = path ? `/${path.replace(/^\/+/, "")}` : "";
  return `${scheme}://${normalized}${cleanPath}`;
}

export function getStorefrontCartNamespace(host: string) {
  return `amar_storefront_cart:${host.trim().toLowerCase().replace(/\.$/, "")}`;
}

