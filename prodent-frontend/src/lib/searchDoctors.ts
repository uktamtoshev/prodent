export interface SearchDoctor {
  id: string;
  specialty: string | null;
  experience_years: number | null;
  price_from: number | null;
  rating: number | null;
  review_count?: number | null;
  is_verified?: boolean | null;
  images?: string[] | null;
  video_url: string | null;
  latitude?: number | null;
  longitude?: number | null;
  subscription_plan: string | null;
  profiles: { full_name: string | null; avatar_url?: string | null; gender?: string | null } | null;
  clinics: {
    id: string;
    name?: string | null;
    city: string | null;
    district: string | null;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
}

export interface SearchDoctorFilters {
  searchQuery: string;
  spec: string;
  city: string;
  district: string;
  priceRange: [number, number];
  minRating: number | null;
  hasVideo: boolean;
}

export type SearchDoctorSort = "rating" | "price-asc" | "price-desc" | "experience" | string;

export const SEARCH_SPECIALTY_KEYWORDS: Record<string, string[]> = {
  therapist: ["терапевт"],
  orthodontist: ["ортодонт"],
  surgeon: ["хирург"],
  orthopedist: ["ортопед"],
  implantologist: ["имплантолог"],
  pediatric: ["детский"],
  periodontist: ["пародонтолог"],
  endodontist: ["эндодонтист"],
};

export const SEARCH_CITY_KEYWORDS: Record<string, string[]> = {
  tashkent: ["ташкент"],
  samarkand: ["самарканд"],
  bukhara: ["бухара"],
  fergana: ["фергана"],
  andijan: ["андижан"],
  navoi: ["навои"],
};

function includesAny(value: string | null | undefined, keywords: string[]) {
  if (!value || keywords.length === 0) return false;
  const normalized = value.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword));
}

function planPriority(plan: string | null) {
  if (plan === "top" || plan === "gold") return 0;
  if (plan === "premium" || plan === "standard") return 1;
  return 2;
}

export function filterSearchDoctors(doctors: SearchDoctor[], filters: SearchDoctorFilters) {
  const q = filters.searchQuery.trim().toLowerCase();

  return doctors.filter((doctor) => {
    const fullName = doctor.profiles?.full_name?.toLowerCase() || "";
    const specialty = doctor.specialty?.toLowerCase() || "";
    const clinic = doctor.clinics;

    if (q && !fullName.includes(q) && !specialty.includes(q)) return false;

    if (filters.spec !== "all") {
      if (!includesAny(specialty, SEARCH_SPECIALTY_KEYWORDS[filters.spec] || [])) return false;
    }

    if (filters.city !== "all") {
      if (!includesAny(clinic?.city, SEARCH_CITY_KEYWORDS[filters.city] || [])) return false;
    }

    if (filters.district !== "all") {
      if (!clinic?.district?.toLowerCase().includes(filters.district.toLowerCase())) return false;
    }

    if (
      doctor.price_from != null &&
      (doctor.price_from < filters.priceRange[0] || doctor.price_from > filters.priceRange[1])
    ) {
      return false;
    }

    if (filters.minRating && (doctor.rating || 0) < filters.minRating) return false;
    if (filters.hasVideo && !doctor.video_url) return false;

    return true;
  });
}

export function sortSearchDoctors(doctors: SearchDoctor[], sortBy: SearchDoctorSort) {
  const sorted = [...doctors];

  sorted.sort((a, b) => {
    const planDiff = planPriority(a.subscription_plan) - planPriority(b.subscription_plan);
    if (planDiff !== 0) return planDiff;

    switch (sortBy) {
      case "price-asc":
        return (a.price_from || 0) - (b.price_from || 0);
      case "price-desc":
        return (b.price_from || 0) - (a.price_from || 0);
      case "experience":
        return (b.experience_years || 0) - (a.experience_years || 0);
      case "rating":
      default:
        return (b.rating || 0) - (a.rating || 0);
    }
  });

  return sorted;
}

export function getSearchDoctors(
  doctors: SearchDoctor[],
  filters: SearchDoctorFilters,
  sortBy: SearchDoctorSort,
) {
  return sortSearchDoctors(filterSearchDoctors(doctors, filters), sortBy);
}
