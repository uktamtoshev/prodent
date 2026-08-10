// Client for the secure Jobs API (/api/v1/jobs).
// Unlike the marketplace, the Jobs module is doctors-and-clinics only, so EVERY
// call (reads included) goes through this controller — nothing is read off the
// public data proxy and contact details never leak into a feed.

const API_BASE = "/api/v1/jobs";
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

const qs = <T extends object>(f: T): string => {
  const p = new URLSearchParams();
  Object.entries(f).forEach(([k, v]) => {
    if (typeof v === "string" && v !== "") p.set(k, v);
  });
  const s = p.toString();
  return s ? `?${s}` : "";
};

export type ListingType = "vacancy" | "chair_rental";
export type ApplicationRole = "seeker" | "clinic";

export interface ListingFilters {
  category?: string;
  listing_type?: string;
  employment_type?: string;
  cooperation_type?: string;
  city?: string;
  district?: string;
  q?: string;
  salary_min?: string;
  sort?: string;
  limit?: string;
  offset?: string;
}

export interface ResumeFilters {
  category?: string;
  city?: string;
  district?: string;
  desired_cooperation_type?: string;
  q?: string;
  open_only?: string;
  limit?: string;
  offset?: string;
}

export const jobs = {
  // Listings
  listListings: (f: ListingFilters = {}) => req(`/listings${qs(f)}`),
  getListing: (id: string) => req(`/listings/${id}`),
  createListing: (body: Record<string, unknown>) =>
    req("/listings", { method: "POST", body: JSON.stringify(body) }),
  updateListing: (id: string, body: Record<string, unknown>) =>
    req(`/listings/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  closeListing: (id: string) => req(`/listings/${id}`, { method: "DELETE" }),
  myListings: () => req("/my/listings"),

  // Resumes
  getMyResume: () => req("/resume"),
  upsertResume: (body: Record<string, unknown>) =>
    req("/resume", { method: "PUT", body: JSON.stringify(body) }),
  listResumes: (f: ResumeFilters = {}) => req(`/resumes${qs(f)}`),
  getResume: (id: string) => req(`/resumes/${id}`),

  // Applications
  apply: (listingId: string, coverMessage?: string) =>
    req("/applications", {
      method: "POST",
      body: JSON.stringify({ listing_id: listingId, cover_message: coverMessage }),
    }),
  invite: (resumeId: string, listingId?: string, message?: string) =>
    req("/invites", {
      method: "POST",
      body: JSON.stringify({ resume_id: resumeId, listing_id: listingId, message }),
    }),
  listApplications: (role: ApplicationRole) => req(`/applications?role=${role}`),
  transitionApplication: (id: string, status: string, reason?: string) =>
    req(`/applications/${id}`, {
      method: "PATCH",
      body: JSON.stringify(reason != null ? { status, reason } : { status }),
    }),

  // Reports / moderation
  report: (targetType: "listing" | "resume", targetId: string, reason: string) =>
    req("/reports", { method: "POST", body: JSON.stringify({ target_type: targetType, target_id: targetId, reason }) }),
  listReports: (status?: string) => req(`/reports${status ? `?status=${status}` : ""}`),
  resolveReport: (id: string, status: "reviewed" | "dismissed", reason: string) =>
    req(`/reports/${id}`, { method: "PATCH", body: JSON.stringify({ status, reason }) }),
  moderationQueue: () => req("/moderation/queue"),
  moderateListing: (id: string, publish: boolean, reason: string) =>
    req(`/moderate/listings/${id}`, { method: "POST", body: JSON.stringify({ publish, reason }) }),
  moderateResume: (id: string, publish: boolean, reason: string) =>
    req(`/moderate/resumes/${id}`, { method: "POST", body: JSON.stringify({ publish, reason }) }),
};
