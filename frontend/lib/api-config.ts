export const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000/api/v1";

export function getApiBaseUrl() {
  if (typeof window !== "undefined") {
    // Browser traffic stays on the storefront origin so Host remains the public
    // tenant selector. Next.js proxies /api/v1 to the private FastAPI origin.
    return "/api/v1";
  }
  return (process.env.AMAR_INTERNAL_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/$/, "");
}

export function buildApiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
}
