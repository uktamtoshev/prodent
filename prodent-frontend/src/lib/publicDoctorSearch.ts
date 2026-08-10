import type { SearchDoctor } from "./searchDoctors";
import {
  DEFAULT_SEARCH_URL_STATE,
  normalizeSearchUrlState,
  type SearchUrlState,
} from "./searchUrlState";

const PUBLIC_DOCTOR_SEARCH_ENDPOINT = "/api/v1/public/doctors/search";
export const PUBLIC_DOCTOR_SEARCH_PAGE_SIZE = 24;

/**
 * Public search response contract expected from the backend.
 *
 * It intentionally contains only data needed by a public result card. Account
 * contact details, credentials and clinical data must never be added here.
 */
export interface PublicDoctorSearchItemDto {
  id: string;
  fullName: string | null;
  avatarUrl: string | null;
  gender: string | null;
  specialty: string | null;
  experienceYears: number | null;
  priceFrom: number | null;
  rating: number | null;
  reviewCount: number | null;
  isVerified: boolean;
  images: string[] | null;
  videoUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  subscriptionPlan: string | null;
  clinic: {
    id: string;
    name: string | null;
    city: string | null;
    district: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
}

/** Spring-style bounded page returned by the dedicated anonymous endpoint. */
export interface PublicDoctorSearchPageDto {
  content: PublicDoctorSearchItemDto[];
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}

export interface PublicDoctorSearchPage {
  items: SearchDoctor[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}

export interface PublicDoctorSearchOptions {
  signal?: AbortSignal;
}

export class PublicDoctorSearchError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "PublicDoctorSearchError";
  }
}

function appendNonDefaultFilters(params: URLSearchParams, state: SearchUrlState): void {
  if (state.q) params.set("query", state.q);
  if (state.specialty !== DEFAULT_SEARCH_URL_STATE.specialty) {
    params.set("specialty", state.specialty);
  }
  if (state.city !== DEFAULT_SEARCH_URL_STATE.city) params.set("city", state.city);
  if (state.district !== DEFAULT_SEARCH_URL_STATE.district) {
    params.set("district", state.district);
  }
  if (state.minPrice !== DEFAULT_SEARCH_URL_STATE.minPrice) {
    params.set("minPrice", String(state.minPrice));
  }
  if (state.maxPrice !== DEFAULT_SEARCH_URL_STATE.maxPrice) {
    params.set("maxPrice", String(state.maxPrice));
  }
  if (state.rating !== null) params.set("rating", String(state.rating));
  if (state.video) params.set("video", "true");
  if (state.sort !== DEFAULT_SEARCH_URL_STATE.sort) params.set("sort", state.sort);
}

export function buildPublicDoctorSearchUrl(input: Partial<SearchUrlState>): string {
  const state = normalizeSearchUrlState(input);
  const params = new URLSearchParams();

  appendNonDefaultFilters(params, state);
  params.set("page", String(state.page));
  params.set("size", String(PUBLIC_DOCTOR_SEARCH_PAGE_SIZE));

  return `${PUBLIC_DOCTOR_SEARCH_ENDPOINT}?${params.toString()}`;
}

function adaptDoctor(dto: PublicDoctorSearchItemDto): SearchDoctor {
  return {
    id: dto.id,
    specialty: dto.specialty,
    experience_years: dto.experienceYears,
    price_from: dto.priceFrom,
    rating: dto.rating,
    review_count: dto.reviewCount,
    is_verified: dto.isVerified,
    images: dto.images,
    video_url: dto.videoUrl,
    latitude: dto.latitude,
    longitude: dto.longitude,
    subscription_plan: dto.subscriptionPlan,
    profiles: {
      full_name: dto.fullName,
      avatar_url: dto.avatarUrl,
      gender: dto.gender,
    },
    clinics: dto.clinic
      ? {
          id: dto.clinic.id,
          name: dto.clinic.name,
          city: dto.clinic.city,
          district: dto.clinic.district,
          latitude: dto.clinic.latitude,
          longitude: dto.clinic.longitude,
        }
      : null,
  };
}

export function adaptPublicDoctorSearchPage(
  dto: PublicDoctorSearchPageDto,
): PublicDoctorSearchPage {
  return {
    items: dto.content.map(adaptDoctor),
    page: dto.number,
    size: dto.size,
    totalElements: dto.totalElements,
    totalPages: dto.totalPages,
    first: dto.first,
    last: dto.last,
    empty: dto.empty,
  };
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: unknown; error?: unknown };
    if (typeof body.message === "string" && body.message) return body.message;
    if (typeof body.error === "string" && body.error) return body.error;
  } catch {
    // A non-JSON error still receives the stable HTTP fallback below.
  }
  return `HTTP ${response.status}`;
}

export async function searchPublicDoctors(
  state: Partial<SearchUrlState>,
  options: PublicDoctorSearchOptions = {},
): Promise<PublicDoctorSearchPage> {
  const response = await fetch(buildPublicDoctorSearchUrl(state), {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: options.signal,
  });

  if (!response.ok) {
    throw new PublicDoctorSearchError(await errorMessage(response), response.status);
  }

  const dto = (await response.json()) as PublicDoctorSearchPageDto;
  return adaptPublicDoctorSearchPage(dto);
}
