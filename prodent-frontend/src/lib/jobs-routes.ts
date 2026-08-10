// Single source of truth for the Jobs module's paths.
//
// The shared SPA always keeps Jobs under its own prefix. This remains true on
// work.prodent.uz because the application also owns the public `/` route there.
// A host-level redirect may lead visitors from `/` to this collision-free path.
export const JOBS_BASE = "/jobs";

/** Build an in-module path, e.g. jobsPath("resumes") -> "/jobs/resumes". */
export const jobsPath = (sub = ""): string => {
  const clean = sub.replace(/^\/+/, "");
  return clean ? `${JOBS_BASE}/${clean}` : JOBS_BASE;
};

export const JOBS_ROUTES = {
  feed: () => jobsPath(),
  listing: (id: string) => jobsPath(`listing/${id}`),
  resumes: () => jobsPath("resumes"),
  resume: (id: string) => jobsPath(`resume/${id}`),
  my: () => jobsPath("my"),
  post: () => jobsPath("post"),
  edit: (id: string) => jobsPath(`post/${id}`),
  moderation: () => jobsPath("moderation"),
};

/** Where the "Кабинет" button returns to. */
export const CABINET_HOME = "/crm";
