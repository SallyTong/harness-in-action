import { clearToken, getToken, redirectToLogin } from "./auth";

interface RequestOptions {
  /** Send Authorization header and treat 401 as session-expiry. Default true. */
  auth?: boolean;
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  options: RequestOptions = {},
): Promise<T> {
  const auth = options.auth ?? true;
  const headers = new Headers(init.headers);

  if (auth) {
    const token = getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(path, { ...init, headers });

  if (auth && res.status === 401) {
    clearToken();
    redirectToLogin();
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Network error" }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export function apiGet<T = unknown>(path: string): Promise<T> {
  return request<T>(path, { method: "GET" });
}

export function apiPost<T = unknown>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function apiPut<T = unknown>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function apiPatch<T = unknown>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function apiDelete(path: string): Promise<void> {
  return request<void>(path, { method: "DELETE" });
}

export function apiUpload<T = unknown>(path: string, formData: FormData): Promise<T> {
  return request<T>(path, { method: "POST", body: formData });
}

/**
 * Public endpoints (send-code / login): no Authorization header, and a 401 is a
 * business error (wrong code) rather than session expiry, so it must NOT trigger
 * the redirect-to-login behavior.
 */
export function apiPostPublic<T = unknown>(path: string, body?: unknown): Promise<T> {
  return request<T>(
    path,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    },
    { auth: false },
  );
}
