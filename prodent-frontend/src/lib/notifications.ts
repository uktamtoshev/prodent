// Client for the notifications API (/api/v1/notifications). Mirrors the auth/refresh
// pattern of lib/marketplace.ts (bearer token from localStorage, silent refresh on 401).

const API_BASE = "/api/v1/notifications";
const TOKEN_KEY = "prodent_access_token";
const REFRESH_KEY = "prodent_refresh_token";

function doFetch(path: string, opts: RequestInit): Promise<Response> {
  const token = localStorage.getItem(TOKEN_KEY);
  return fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
}

async function tryRefresh(): Promise<boolean> {
  const rt = localStorage.getItem(REFRESH_KEY);
  if (!rt) return false;
  try {
    const r = await fetch("/api/v1/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: rt }),
    });
    if (!r.ok) return false;
    const b = (await r.json()) as {
      access_token?: string;
      token?: string;
      refresh_token?: string;
      data?: { access_token?: string; refresh_token?: string };
    };
    const at = b.access_token ?? b.token ?? b.data?.access_token;
    if (!at) return false;
    localStorage.setItem(TOKEN_KEY, at);
    const newRt = b.refresh_token ?? b.data?.refresh_token;
    if (newRt) localStorage.setItem(REFRESH_KEY, newRt);
    return true;
  } catch {
    return false;
  }
}

async function req<T = unknown>(path: string, opts: RequestInit = {}): Promise<T> {
  let res = await doFetch(path, opts);
  if (res.status === 401 && (await tryRefresh())) {
    res = await doFetch(path, opts);
  }
  const text = await res.text();
  const data = (text ? JSON.parse(text) : null) as { error?: string; message?: string } | null;
  if (!res.ok) {
    throw new Error((data && (data.error || data.message)) || `HTTP ${res.status}`);
  }
  return data as T;
}

export const notificationsApi = {
  // Admin broadcast: SYSTEM notification to all users, or all users of a role.
  broadcast: (body: { title: string; message: string; role?: string }) =>
    req<{ recipients: number }>("/admin/broadcast", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
