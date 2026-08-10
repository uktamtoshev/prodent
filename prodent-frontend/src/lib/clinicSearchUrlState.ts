export type ClinicSearchSort = "featured" | "rating" | "name";
export type ClinicSearchView = "list" | "map";

export interface ClinicSearchUrlState {
  q: string;
  city: string;
  district: string;
  sort: ClinicSearchSort;
  view: ClinicSearchView;
  page: number;
}

export const DEFAULT_CLINIC_SEARCH_URL_STATE: Readonly<ClinicSearchUrlState> = Object.freeze({
  q: "",
  city: "all",
  district: "all",
  sort: "featured",
  view: "list",
  page: 0,
});

const SORTS = new Set<ClinicSearchSort>(["featured", "rating", "name"]);
const VIEWS = new Set<ClinicSearchView>(["list", "map"]);

function token(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim() : "all";
}

export function normalizeClinicSearchUrlState(
  input: Partial<ClinicSearchUrlState> = {},
): ClinicSearchUrlState {
  const requestedPage = Number(input.page);
  return {
    q: typeof input.q === "string" ? input.q.trim() : "",
    city: token(input.city),
    district: token(input.district),
    sort: SORTS.has(input.sort as ClinicSearchSort)
      ? (input.sort as ClinicSearchSort)
      : DEFAULT_CLINIC_SEARCH_URL_STATE.sort,
    view: VIEWS.has(input.view as ClinicSearchView)
      ? (input.view as ClinicSearchView)
      : DEFAULT_CLINIC_SEARCH_URL_STATE.view,
    page: Number.isFinite(requestedPage)
      ? Math.min(10_000, Math.max(0, Math.floor(requestedPage)))
      : 0,
  };
}

export function parseClinicSearchUrlState(
  input: URLSearchParams | string,
): ClinicSearchUrlState {
  const params =
    input instanceof URLSearchParams
      ? input
      : new URLSearchParams(input.startsWith("?") ? input.slice(1) : input);
  return normalizeClinicSearchUrlState({
    q: params.get("q") ?? undefined,
    city: params.get("city") ?? undefined,
    district: params.get("district") ?? undefined,
    sort: (params.get("sort") ?? undefined) as ClinicSearchSort | undefined,
    view: (params.get("view") ?? undefined) as ClinicSearchView | undefined,
    page: params.get("page") ?? undefined,
  } as Partial<ClinicSearchUrlState>);
}

export function serializeClinicSearchUrlState(
  input: Partial<ClinicSearchUrlState>,
): URLSearchParams {
  const state = normalizeClinicSearchUrlState(input);
  const params = new URLSearchParams();
  if (state.q) params.set("q", state.q);
  if (state.city !== "all") params.set("city", state.city);
  if (state.district !== "all") params.set("district", state.district);
  if (state.sort !== "featured") params.set("sort", state.sort);
  if (state.view !== "list") params.set("view", state.view);
  if (state.page !== 0) params.set("page", String(state.page));
  return params;
}

export function patchClinicSearchUrlState(
  current: ClinicSearchUrlState,
  patch: Partial<ClinicSearchUrlState>,
): ClinicSearchUrlState {
  const next = normalizeClinicSearchUrlState({ ...current, ...patch });
  const filterChanged = (["q", "city", "district", "sort"] as const).some(
    (key) => key in patch && next[key] !== current[key],
  );
  return filterChanged ? { ...next, page: 0 } : next;
}
