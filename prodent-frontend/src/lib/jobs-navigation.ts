import type { ListingFilters } from "./jobs";

const LISTING_FILTER_KEYS = [
  "category",
  "listing_type",
  "employment_type",
  "cooperation_type",
  "city",
  "district",
  "q",
  "salary_min",
  "sort",
] as const satisfies readonly (keyof ListingFilters)[];

export const JOBS_MY_TABS = {
  clinic: ["listings", "applications"] as const,
  seeker: ["resume", "listings", "candidates", "applications"] as const,
};

export function listingFiltersFromSearchParams(params: URLSearchParams): ListingFilters {
  return LISTING_FILTER_KEYS.reduce<ListingFilters>((filters, key) => {
    const value = params.get(key)?.trim();
    if (value) filters[key] = value;
    return filters;
  }, {});
}

export function listingFiltersToSearchParams(filters: ListingFilters): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of LISTING_FILTER_KEYS) {
    const value = filters[key];
    if (typeof value === "string" && value) params.set(key, value);
  }
  return params;
}

export function normalizeJobsMyTab(value: string | null, clinic: boolean): string {
  const tabs = clinic ? JOBS_MY_TABS.clinic : JOBS_MY_TABS.seeker;
  return (tabs as readonly string[]).includes(value || "") ? value! : tabs[0];
}

const MESSAGE_ROUTES: Readonly<Record<string, string>> = {
  doctor: "/doctor/messages",
  clinic_admin: "/clinic-admin/messages",
  clinic_manager: "/crm/messages",
  admin: "/crm/messages",
  super_admin: "/crm/messages",
  assistant: "/crm/messages",
  technician: "/technician/messages",
  patient: "/patient/messages",
};

export function jobsMessagesPath(role: string | null | undefined): string | null {
  return role ? MESSAGE_ROUTES[role] ?? null : null;
}
