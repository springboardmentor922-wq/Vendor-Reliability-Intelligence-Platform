export type QueryValue = string | number | boolean | null | undefined;

const configuredBase = import.meta.env.VITE_API_BASE?.trim();

export const API_BASE = configuredBase || "/backend";

type CachedGet = { value: unknown; expiresAt: number };
const GET_CACHE = new Map<string, CachedGet>();
const GET_TTL_MS = 15_000;

function invalidateGetCache() {
  GET_CACHE.clear();
}


function getErrorMessage(payload: any, fallback: string): string {
  if (typeof payload?.detail === "string") {
    return payload.detail;
  }

  if (Array.isArray(payload?.detail)) {
    return payload.detail
      .map((item: any) => {
        if (typeof item === "string") {
          return item;
        }

        if (item?.msg) {
          const location = Array.isArray(item.loc) ? item.loc.join(".") : "";

          return location ? `${location}: ${item.msg}` : item.msg;
        }

        return "";
      })
      .filter(Boolean)
      .join(" ");
  }

  if (typeof payload?.message === "string") {
    return payload.message;
  }

  return fallback;
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  query?: Record<string, QueryValue>,
): Promise<T> {
  const url = new URL(`${API_BASE}${path}`, window.location.origin);

  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  const method = (init.method ?? "GET").toUpperCase();
  const cacheable = method === "GET" && !path.includes("/search");
  const cacheKey = cacheable ? `${url.toString()}::${localStorage.getItem("vendoriq_token") ?? ""}` : "";

  if (cacheable) {
    const cached = GET_CACHE.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value as T;
    }
    if (cached) GET_CACHE.delete(cacheKey);
  }

  const headers = new Headers(init.headers);

  const token = localStorage.getItem("vendoriq_token");

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (!(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url.toString(), {
    ...init,
    headers,
  });

  if (response.status === 401) {
    localStorage.removeItem("vendoriq_token");
  }

  if (!response.ok) {
    let payload: any = null;

    try {
      payload = await response.json();
    } catch {
      // Non-JSON response.
    }

    throw Object.assign(
      new Error(
        getErrorMessage(
          payload,
          `Request failed with status ${response.status}.`,
        ),
      ),
      {
        status: response.status,
        detail: getErrorMessage(payload, "Something went wrong."),
      },
    );
  }

  if (response.status === 204) {
    invalidateGetCache();
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const value = await response.json();
    if (cacheable) {
      GET_CACHE.set(cacheKey, { value, expiresAt: Date.now() + GET_TTL_MS });
    }
    return value as T;
  }

  const value = await response.text();
  if (cacheable) {
    GET_CACHE.set(cacheKey, { value, expiresAt: Date.now() + GET_TTL_MS });
  }
  return value as T;
}

export function apiGet<T>(
  path: string,
  query?: Record<string, QueryValue>,
): Promise<T> {
  return request<T>(
    path,
    {
      method: "GET",
    },
    query,
  );
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const value = await request<T>(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
  invalidateGetCache();
  return value;
}

export async function apiPut<T>(path: string, body: unknown = {}): Promise<T> {
  const value = await request<T>(path, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  invalidateGetCache();
  return value;
}

export async function apiDelete<T>(path: string): Promise<T> {
  const value = await request<T>(path, {
    method: "DELETE",
  });
  invalidateGetCache();
  return value;
}

export async function apiPostForm<T>(path: string, form: FormData): Promise<T> {
  const value = await request<T>(path, {
    method: "POST",
    body: form,
  });
  invalidateGetCache();
  return value;
}

export async function apiDownload(path: string): Promise<void> {
  const url = `${API_BASE}${path}`;

  const token = localStorage.getItem("vendoriq_token");

  const response = await fetch(url, {
    headers: token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : undefined,
  });

  if (!response.ok) {
    throw new Error("Export could not be generated.");
  }

  const blob = await response.blob();

  const disposition = response.headers.get("content-disposition") ?? "";

  const match = disposition.match(/filename\*?=(?:UTF-8''|")?([^;"]+)/i);

  const filename = match?.[1]
    ? decodeURIComponent(match[1].replace(/"/g, ""))
    : "vendoriq-export";

  const objectUrl = URL.createObjectURL(blob);

  const anchor = document.createElement("a");

  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();

  URL.revokeObjectURL(objectUrl);
}
