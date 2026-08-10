import {
  DEFAULT_CLINIC_SEARCH_URL_STATE,
  normalizeClinicSearchUrlState,
  type ClinicSearchUrlState,
} from "./clinicSearchUrlState";

export const PUBLIC_CLINIC_SEARCH_PAGE_SIZE = 24;

export interface PublicClinicSearchItemDto {
  id: string;
  name: string | null;
  city: string | null;
  district: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  description: string | null;
  isVerified: boolean;
  logoUrl: string | null;
  coverUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  subscriptionPlan: string | null;
  rating: number | null;
  reviewCount: number | null;
  workingHours: Record<string, unknown> | null;
  doctorCount: number;
}

export interface PublicClinicSearchPageDto {
  content: PublicClinicSearchItemDto[];
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}

export interface PublicClinicSearchItem {
  id: string;
  name: string | null;
  city: string | null;
  district: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  description: string | null;
  is_verified: boolean;
  logo_url: string | null;
  cover_url: string | null;
  latitude: number | null;
  longitude: number | null;
  subscription_plan: string | null;
  rating: number | null;
  review_count: number | null;
  working_hours: Record<string, unknown> | null;
  doctorCount: number;
}

export interface PublicClinicSearchPage {
  items: PublicClinicSearchItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}

export function buildPublicClinicSearchUrl(input: Partial<ClinicSearchUrlState>): string {
  const state = normalizeClinicSearchUrlState(input);
  const params = new URLSearchParams();
  if (state.q) params.set("query", state.q);
  if (state.city !== DEFAULT_CLINIC_SEARCH_URL_STATE.city) params.set("city", state.city);
  if (state.district !== DEFAULT_CLINIC_SEARCH_URL_STATE.district) {
    params.set("district", state.district);
  }
  if (state.sort !== DEFAULT_CLINIC_SEARCH_URL_STATE.sort) params.set("sort", state.sort);
  params.set("page", String(state.page));
  params.set("size", String(PUBLIC_CLINIC_SEARCH_PAGE_SIZE));
  return `/api/v1/public/clinics/search?${params.toString()}`;
}

export async function searchPublicClinics(
  state: Partial<ClinicSearchUrlState>,
  options: { signal?: AbortSignal } = {},
): Promise<PublicClinicSearchPage> {
  const response = await fetch(buildPublicClinicSearchUrl(state), {
    headers: { Accept: "application/json" },
    signal: options.signal,
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const dto = (await response.json()) as PublicClinicSearchPageDto;
  return {
    items: dto.content.map((item) => ({
      id: item.id,
      name: item.name,
      city: item.city,
      district: item.district,
      address: item.address,
      phone: item.phone,
      email: item.email,
      website: item.website,
      description: item.description,
      is_verified: item.isVerified,
      logo_url: item.logoUrl,
      cover_url: item.coverUrl,
      latitude: item.latitude,
      longitude: item.longitude,
      subscription_plan: item.subscriptionPlan,
      rating: item.rating,
      review_count: item.reviewCount,
      working_hours: item.workingHours,
      doctorCount: item.doctorCount,
    })),
    page: dto.number,
    size: dto.size,
    totalElements: dto.totalElements,
    totalPages: dto.totalPages,
    first: dto.first,
    last: dto.last,
    empty: dto.empty,
  };
}
