import { buildApiUrl, getApiBaseUrl } from "@/lib/api-config";
import { getPublicStoreSlug, getSelectedStoreSlug } from "@/lib/tenant";

export type ApiErrorKind = "unauthenticated" | "forbidden" | "conflict" | "validation" | "network" | "server" | "request";
export type FieldError = { field: string; message: string };

export class ApiError extends Error {
  status: number;
  payload?: unknown;
  kind: ApiErrorKind;
  fieldErrors: FieldError[];

  constructor(message: string, status: number, payload?: unknown, kind: ApiErrorKind = "request", fieldErrors: FieldError[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
    this.kind = kind;
    this.fieldErrors = fieldErrors;
  }
}

function getAuthToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem("amar_token");
}

async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const fieldErrors: FieldError[] = [];
    let message = response.status >= 500 ? "The server could not complete the request. Please try again." : `Request failed with status ${response.status}`;

    if (typeof payload === "string" && payload.trim()) {
      message = payload;
    } else if (typeof payload === "object" && payload !== null) {
      if ("detail" in payload) {
        const detail = payload.detail;
        if (typeof detail === "string") {
          message = detail;
        } else if (detail && typeof detail === "object" && "message" in detail && typeof detail.message === "string") {
          message = detail.message;
        } else if (Array.isArray(detail)) {
          for (const issue of detail) {
            if (!issue || typeof issue !== "object" || !("msg" in issue) || typeof issue.msg !== "string") continue;
            const location = "loc" in issue && Array.isArray(issue.loc) ? (issue.loc as unknown[]).filter((part: unknown) => part !== "body").map(String) : [];
            const field = location.join(".") || "request";
            fieldErrors.push({ field, message: issue.msg.replace(/^Value error,\s*/i, "") });
          }
          if (fieldErrors.length) message = fieldErrors.map(({ field, message: issueMessage }) => `${field === "request" ? "Request" : field}: ${issueMessage}`).join("; ");
        }
      } else if ("message" in payload && typeof payload.message === "string") {
        message = payload.message;
      }
    }

    const kind: ApiErrorKind = response.status === 401 ? "unauthenticated" : response.status === 403 ? "forbidden" : response.status === 409 ? "conflict" : response.status === 422 ? "validation" : response.status >= 500 ? "server" : "request";
    if (response.status === 401 && typeof window !== "undefined") {
      window.localStorage.removeItem("amar_token");
      window.localStorage.removeItem("amar_user");
      window.localStorage.removeItem("amar_current_store");
      window.dispatchEvent(new CustomEvent("amar:session-expired"));
    }
    throw new ApiError(message, response.status, payload, kind, fieldErrors);
  }

  return payload as T;
}

export async function request<T>(
  path: string,
  init: RequestInit = {},
  authenticated = true,
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");

  if (!(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const token = authenticated ? getAuthToken() : null;
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
    const storeSlug = getSelectedStoreSlug();
    if (storeSlug) headers.set("X-Amar-Store", storeSlug);
  }
  if (!authenticated) {
    if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
      const publicStoreSlug = getPublicStoreSlug();
      if (publicStoreSlug && process.env.NEXT_PUBLIC_API_BASE_URL) headers.set("X-Storefront-Store", publicStoreSlug);
    }
  }

  try {
    const response = await fetch(buildApiUrl(path), { ...init, headers, cache: "no-store" });
    if (response.status === 204) return undefined as T;
    return await parseResponse<T>(response);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("Unable to reach the server. Check your connection and try again.", 0, error, "network");
  }
}

async function download(path: string) {
  const headers = new Headers({ Accept: "text/csv, application/octet-stream" });
  const token = getAuthToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const storeSlug = getSelectedStoreSlug();
  if (storeSlug) headers.set("X-Amar-Store", storeSlug);
  try {
    const response = await fetch(buildApiUrl(path), { headers, cache: "no-store" });
    if (!response.ok) await parseResponse<never>(response);
    return await response.blob();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("Unable to download the file. Check your connection and try again.", 0, error, "network");
  }
}

export const api = {
  get<T>(path: string) {
    return request<T>(path, { method: "GET" });
  },
  post<T>(path: string, body?: unknown) {
    return request<T>(path, {
      method: "POST",
      body:
        body === undefined
          ? undefined
          : body instanceof FormData
            ? body
            : JSON.stringify(body),
    });
  },
  put<T>(path: string, body?: unknown) {
    return request<T>(path, {
      method: "PUT",
      body:
        body === undefined
          ? undefined
          : body instanceof FormData
            ? body
            : JSON.stringify(body),
    });
  },
  patch<T>(path: string, body?: unknown) {
    return request<T>(path, {
      method: "PATCH",
      body:
        body === undefined
          ? undefined
          : body instanceof FormData
            ? body
            : JSON.stringify(body),
    });
  },
  delete<T>(path: string) {
    return request<T>(path, { method: "DELETE" });
  },
  download,
  baseUrl: getApiBaseUrl,
};

export const publicApi = {
  get<T>(path: string) { return request<T>(path, { method: "GET" }, false); },
  post<T>(path: string, body?: unknown) { return request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }, false); },
};

export function getErrorMessage(error: unknown, fallback = "Something went wrong. Please try again.") {
  return error instanceof ApiError || error instanceof Error ? error.message : fallback;
}
