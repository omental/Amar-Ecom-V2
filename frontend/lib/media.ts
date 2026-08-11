import { getApiBaseUrl } from "@/lib/api-config";

export type MediaAsset = {
  id: string;
  filename: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  width: number | null;
  height: number | null;
  title: string | null;
  alt_text: string | null;
  caption: string | null;
  uploaded_by_id: string | null;
  created_at: string;
  updated_at: string;
  public_url: string;
};

export type MediaPage = {
  items: MediaAsset[];
  total: number;
  skip: number;
  limit: number;
  has_more: boolean;
};

export function resolveImageUrl(url?: string | null) {
  const value = url?.trim() || "";
  if (!value || (!value.startsWith("/media/") && !value.startsWith("/uploads/"))) return value;
  const apiOrigin = getApiBaseUrl().replace(/\/api\/v1$/, "");
  return `${apiOrigin}${value}`;
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function uniqueMediaUrls(urls: string[]) {
  return Array.from(new Set(urls.map((url) => url.trim()).filter(Boolean)));
}

export function moveMediaUrl(urls: string[], index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= urls.length) return urls;
  const next = [...urls];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
