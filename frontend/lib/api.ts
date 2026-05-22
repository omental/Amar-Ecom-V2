export class ApiError extends Error {
  status: number;
  payload?: unknown;

  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000/api/v1";

function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_BASE_URL || DEFAULT_API_BASE_URL;
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
    let message = `Request failed with status ${response.status}`;

    if (typeof payload === "string" && payload.trim()) {
      message = payload;
    } else if (typeof payload === "object" && payload !== null) {
      if ("detail" in payload) {
        const detail = payload.detail;
        if (typeof detail === "string") {
          message = detail;
        } else if (Array.isArray(detail)) {
          const firstIssue = detail[0];
          if (
            firstIssue &&
            typeof firstIssue === "object" &&
            "msg" in firstIssue &&
            typeof firstIssue.msg === "string"
          ) {
            message = firstIssue.msg;
          }
        }
      } else if ("message" in payload && typeof payload.message === "string") {
        message = payload.message;
      }
    }

    throw new ApiError(message, response.status, payload);
  }

  return payload as T;
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");

  if (!(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const token = getAuthToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  return parseResponse<T>(response);
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
  baseUrl: getApiBaseUrl,
};
