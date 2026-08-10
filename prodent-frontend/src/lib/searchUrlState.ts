export const SEARCH_MAX_PRICE = 10_000_000;
export const SEARCH_MAX_PAGE = 10_000;

export type SearchSort = "rating" | "price-asc" | "price-desc" | "experience";
export type SearchView = "list" | "grid" | "map";

export interface SearchUrlState {
  q: string;
  specialty: string;
  city: string;
  district: string;
  minPrice: number;
  maxPrice: number;
  rating: number | null;
  video: boolean;
  sort: SearchSort;
  view: SearchView;
  page: number;
}

export const DEFAULT_SEARCH_URL_STATE: Readonly<SearchUrlState> = Object.freeze({
  q: "",
  specialty: "all",
  city: "all",
  district: "all",
  minPrice: 0,
  maxPrice: SEARCH_MAX_PRICE,
  rating: null,
  video: false,
  sort: "rating",
  view: "list",
  page: 0,
});

const SORTS = new Set<SearchSort>(["rating", "price-asc", "price-desc", "experience"]);
const VIEWS = new Set<SearchView>(["list", "grid", "map"]);
const PAGE_RESET_KEYS = new Set<keyof SearchUrlState>([
  "q",
  "specialty",
  "city",
  "district",
  "minPrice",
  "maxPrice",
  "rating",
  "video",
  "sort",
]);

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function finiteNumber(value: unknown, fallback: number): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizedToken(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim() : "all";
}

function normalizedRating(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = finiteNumber(value, Number.NaN);
  return Number.isFinite(number) ? clamp(number, 0, 5) : null;
}

export function normalizeSearchUrlState(
  state: Partial<SearchUrlState> = {},
): SearchUrlState {
  const minPrice = clamp(
    finiteNumber(state.minPrice, DEFAULT_SEARCH_URL_STATE.minPrice),
    0,
    SEARCH_MAX_PRICE,
  );
  const requestedMaxPrice = clamp(
    finiteNumber(state.maxPrice, DEFAULT_SEARCH_URL_STATE.maxPrice),
    0,
    SEARCH_MAX_PRICE,
  );
  const sort = SORTS.has(state.sort as SearchSort)
    ? (state.sort as SearchSort)
    : DEFAULT_SEARCH_URL_STATE.sort;
  const view = VIEWS.has(state.view as SearchView)
    ? (state.view as SearchView)
    : DEFAULT_SEARCH_URL_STATE.view;

  return {
    q: typeof state.q === "string" ? state.q.trim() : "",
    specialty: normalizedToken(state.specialty),
    city: normalizedToken(state.city),
    district: normalizedToken(state.district),
    minPrice,
    maxPrice: Math.max(minPrice, requestedMaxPrice),
    rating: normalizedRating(state.rating),
    video: state.video === true,
    sort,
    view,
    page: Math.floor(
      clamp(finiteNumber(state.page, DEFAULT_SEARCH_URL_STATE.page), 0, SEARCH_MAX_PAGE),
    ),
  };
}

function toSearchParams(input: URLSearchParams | string): URLSearchParams {
  if (input instanceof URLSearchParams) return input;
  return new URLSearchParams(input.startsWith("?") ? input.slice(1) : input);
}

export function parseSearchUrlState(input: URLSearchParams | string): SearchUrlState {
  const params = toSearchParams(input);

  return normalizeSearchUrlState({
    q: params.get("q") ?? undefined,
    specialty: params.get("specialty") ?? undefined,
    city: params.get("city") ?? undefined,
    district: params.get("district") ?? undefined,
    minPrice: params.get("minPrice") ?? undefined,
    maxPrice: params.get("maxPrice") ?? undefined,
    rating: params.get("rating"),
    video: params.get("video") === "1" || params.get("video") === "true",
    sort: (params.get("sort") ?? undefined) as SearchSort | undefined,
    view: (params.get("view") ?? undefined) as SearchView | undefined,
    page: params.get("page") ?? undefined,
  } as Partial<SearchUrlState>);
}

export function serializeSearchUrlState(
  input: Partial<SearchUrlState>,
): URLSearchParams {
  const state = normalizeSearchUrlState(input);
  const params = new URLSearchParams();

  if (state.q) params.set("q", state.q);
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
  if (state.rating !== DEFAULT_SEARCH_URL_STATE.rating) {
    params.set("rating", String(state.rating));
  }
  if (state.video) params.set("video", "1");
  if (state.sort !== DEFAULT_SEARCH_URL_STATE.sort) params.set("sort", state.sort);
  if (state.view !== DEFAULT_SEARCH_URL_STATE.view) params.set("view", state.view);
  if (state.page !== DEFAULT_SEARCH_URL_STATE.page) params.set("page", String(state.page));

  return params;
}

export function patchSearchUrlState(
  current: SearchUrlState,
  patch: Partial<SearchUrlState>,
): SearchUrlState {
  const normalizedCurrent = normalizeSearchUrlState(current);
  const next = normalizeSearchUrlState({ ...normalizedCurrent, ...patch });
  const changedFilter = Object.keys(patch).some((key) => {
    const stateKey = key as keyof SearchUrlState;
    return PAGE_RESET_KEYS.has(stateKey) && next[stateKey] !== normalizedCurrent[stateKey];
  });

  return changedFilter ? { ...next, page: 0 } : next;
}
