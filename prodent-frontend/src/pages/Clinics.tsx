import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { pluralRu } from "@/lib/plural";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  Building2,
  Check,
  ChevronRight,
  Clock,
  Crown,
  Filter,
  Globe,
  MapPin,
  Phone,
  Search as SearchIcon,
  X,
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { PageMeta } from "@/components/PageMeta";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import {
  parseClinicSearchUrlState,
  patchClinicSearchUrlState,
  serializeClinicSearchUrlState,
} from "@/lib/clinicSearchUrlState";
import {
  searchPublicClinics,
  type PublicClinicSearchItem,
} from "@/lib/publicClinicSearch";

const ClinicsMapDialog = lazy(() =>
  import("@/components/search/ClinicsMapDialog").then((module) => ({
    default: module.ClinicsMapDialog,
  })),
);

type Clinic = PublicClinicSearchItem;

const TONE_GRADIENTS = [
  "linear-gradient(140deg, hsl(175 60% 38%), hsl(180 70% 28%))",
  "linear-gradient(140deg, hsl(345 70% 50%), hsl(355 80% 38%))",
  "linear-gradient(140deg, hsl(265 55% 50%), hsl(275 65% 38%))",
  "linear-gradient(140deg, hsl(35 90% 55%), hsl(25 85% 42%))",
  "linear-gradient(140deg, hsl(205 75% 50%), hsl(215 75% 38%))",
];

function initialsFor(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * Best-effort render of a clinic's working hours from the `working_hours` jsonb.
 * The column shape is not strictly defined, so we only return a string when we
 * can confidently derive one (a flat {open, close} pair or a per-day object with
 * one). Returns null when nothing usable is present so the badge is omitted
 * rather than showing a fabricated value.
 */
function formatWorkingHours(wh: Record<string, unknown> | null | undefined): string | null {
  if (!wh || typeof wh !== "object") return null;

  const pickPair = (obj: Record<string, unknown>): string | null => {
    const open = obj.open ?? obj.from ?? obj.start;
    const close = obj.close ?? obj.to ?? obj.end;
    if (typeof open === "string" && typeof close === "string" && open && close) {
      return `${open}–${close}`;
    }
    return null;
  };

  // Flat shape: { open: "09:00", close: "18:00" }
  const flat = pickPair(wh);
  if (flat) return flat;

  // Per-day shape: { mon: { open, close }, ... } — use the first usable day.
  for (const value of Object.values(wh)) {
    if (value && typeof value === "object") {
      const pair = pickPair(value as Record<string, unknown>);
      if (pair) return pair;
    }
  }
  return null;
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-border py-5 first:pt-0 last:border-0">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground mb-3">
        {title}
      </div>
      {children}
    </div>
  );
}

function CheckRow({
  label,
  checked,
  onChange,
  count,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  count?: number;
}) {
  return (
    <label className="flex min-h-11 items-center gap-2.5 cursor-pointer group">
      <span
        className={cn(
          "w-4 h-4 rounded border-[1.5px] grid place-items-center transition-colors shrink-0",
          checked
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border group-hover:border-primary"
        )}
      >
        {checked && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
      </span>
      <span className="text-[13px] text-foreground flex-1 truncate">{label}</span>
      {count != null && (
        <span className="text-xs text-muted-foreground font-mono tabular-nums">{count}</span>
      )}
      <input type="checkbox" className="sr-only" checked={checked} onChange={onChange} />
    </label>
  );
}

function ClinicCard({ clinic, index, onOpenMap }: { clinic: Clinic; index: number; onOpenMap: () => void }) {
  const { t } = useLanguage();
  const isGold =
    clinic.subscription_plan === "top" || clinic.subscription_plan === "gold";
  const grad = TONE_GRADIENTS[index % TONE_GRADIENTS.length];
  const initials = initialsFor(clinic.name || "К");
  const cityLine = [clinic.city, clinic.district].filter(Boolean).join(" · ");
  const ratingValue = Number(clinic.rating || 0);
  const hasRating = ratingValue > 0;
  const reviews = clinic.review_count || 0;
  const workHours = formatWorkingHours(clinic.working_hours);
  const hasMapPoint = clinic.latitude != null && clinic.longitude != null;

  return (
    <article
      className="group block bg-card rounded-[18px] border border-border overflow-hidden hover:border-foreground transition-colors"
      style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.03)" }}
    >
      <div className="grid grid-cols-1 md:grid-cols-[200px,1fr,200px]">
        {/* Cover */}
        <Link
          to={`/clinic/${clinic.id}`}
          className="relative aspect-[4/3] md:aspect-auto overflow-hidden block"
          style={{ background: "repeating-linear-gradient(135deg,#e7eceb 0 6px,#eef2f1 6px 12px)" }}
        >
          {clinic.cover_url || clinic.logo_url ? (
            <img
              src={clinic.cover_url || clinic.logo_url || ""}
              alt={clinic.name || ""}
              loading="lazy"
              decoding="async"
              width={400}
              height={300}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div
              className="absolute inset-0 grid place-items-center text-primary-foreground font-bold text-[42px] font-display"
              style={{ background: grad }}
            >
              {initials}
            </div>
          )}
          {isGold && (
            <div className="absolute top-2 left-2 inline-flex items-center gap-1 min-h-6 px-2 rounded-full bg-warning-amber/20 text-warning-amber text-xs font-bold uppercase tracking-wide">
              <Crown className="w-3 h-3" /> TOP
            </div>
          )}
          {clinic.is_verified && !isGold && (
            <div className="absolute top-2 left-2 inline-flex items-center gap-1 min-h-6 px-2 rounded-full bg-success-green/15 text-success-green text-xs font-semibold">
              <Check className="w-3 h-3" /> verified
            </div>
          )}
        </Link>

        {/* Body */}
        <Link
          to={`/clinic/${clinic.id}`}
          className="p-5 min-w-0 md:border-x md:border-border block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-bold text-[19px] tracking-tight truncate font-display">
                {clinic.name}
              </h3>
              <div className="mt-1 flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">
                  {clinic.address || cityLine || t("clinics.defaultCountry")}
                </span>
              </div>
              {cityLine && clinic.address && (
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                  {cityLine}
                </div>
              )}
            </div>
          </div>

          {clinic.description && (
            <p className="mt-3 text-[13px] text-muted-foreground leading-[1.55] line-clamp-2">
              {clinic.description}
            </p>
          )}

          <div className="mt-4 grid grid-cols-3 gap-3 py-3 border-y border-border">
            <div>
              <div className="font-bold text-[14px] tabular-nums">{clinic.doctorCount}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{t("clinics.cardDoctors")}</div>
            </div>
            <div>
              <div className="flex items-center gap-1">
                <span className="text-warning-amber text-[14px]">★</span>
                <span className="font-bold text-[14px] tabular-nums">
                  {hasRating ? ratingValue.toFixed(1) : "—"}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {hasRating && reviews > 0
                  ? `${reviews} ${t("search.reviewsLabel")}`
                  : t("clinics.cardAvgRating")}
              </div>
            </div>
            <div>
              {workHours ? (
                <>
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-success-green" />
                    <span className="font-bold text-[14px] tabular-nums">{workHours}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{t("clinics.cardWorkHours")}</div>
                </>
              ) : (
                <>
                  <div className="font-bold text-[14px] tabular-nums text-muted-foreground">—</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{t("clinics.cardWorkHours")}</div>
                </>
              )}
            </div>
          </div>

          <div className="mt-3 flex items-center gap-1.5 flex-wrap text-xs text-muted-foreground">
            {clinic.phone && (
              <span className="inline-flex items-center gap-1 min-h-6 px-2 rounded-full bg-muted">
                <Phone className="w-3 h-3" /> {clinic.phone}
              </span>
            )}
            {clinic.website && (
              <span className="inline-flex items-center gap-1 min-h-6 px-2 rounded-full bg-muted">
                <Globe className="w-3 h-3" />
                {clinic.website.replace(/^https?:\/\//, "")}
              </span>
            )}
          </div>
        </Link>

        {/* Action */}
        <div className="p-5 flex flex-col">
          <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground font-semibold">
            {t("clinics.cardClinicLabel")}
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-[24px] font-extrabold tabular-nums tracking-tight font-display">
              {clinic.doctorCount}
            </span>
            <span className="text-xs text-muted-foreground">{t("clinics.cardDoctorsShort")}</span>
          </div>

          <div className="mt-3 flex-1 text-[12.5px] text-muted-foreground leading-[1.55]">
            {t("clinics.cardDescription")}
          </div>

          <Link
            to={`/clinic/${clinic.id}`}
            className="mt-4 h-11 w-full rounded-[10px] text-primary-foreground font-semibold text-[13px] inline-flex items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            style={{ background: "linear-gradient(140deg, hsl(175 60% 32%), hsl(180 70% 22%))" }}
          >
            {t("clinics.openProfile")} <ChevronRight className="w-3.5 h-3.5" />
          </Link>
          <button
            type="button"
            onClick={onOpenMap}
            disabled={!hasMapPoint}
            className="mt-1.5 h-11 w-full rounded-[10px] bg-card border border-border text-foreground font-medium text-[12.5px] inline-flex items-center justify-center gap-1.5 hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <MapPin className="w-3.5 h-3.5" /> {t("clinics.mapButton")}
          </button>
        </div>
      </div>
    </article>
  );
}

const Clinics = () => {
  const { t, language } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlState = useMemo(() => parseClinicSearchUrlState(searchParams), [searchParams]);
  const [searchQuery, setSearchQuery] = useState(urlState.q);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const selectedCity = urlState.city;
  const selectedDistrict = urlState.district;
  const verifiedOnly = true;
  const showMap = urlState.view === "map";

  const updateUrlState = useCallback((
    patch: Parameters<typeof patchClinicSearchUrlState>[1],
    replace = false,
  ) => {
    setSearchParams(
      serializeClinicSearchUrlState(patchClinicSearchUrlState(urlState, patch)),
      { replace },
    );
  }, [setSearchParams, urlState]);
  const setShowMap = (open: boolean) => updateUrlState({ view: open ? "map" : "list" });

  useEffect(() => {
    setSearchQuery(urlState.q);
  }, [urlState.q]);

  useEffect(() => {
    if (searchQuery.trim() === urlState.q) return;
    const timeout = window.setTimeout(
      () => updateUrlState({ q: searchQuery }, true),
      350,
    );
    return () => window.clearTimeout(timeout);
  }, [searchQuery, updateUrlState, urlState.q]);

  const { data: result, isLoading, isError, refetch } = useQuery({
    queryKey: ["public-clinic-search", urlState],
    queryFn: ({ signal }) => searchPublicClinics(urlState, { signal }),
  });
  const clinics = useMemo(() => result?.items ?? [], [result?.items]);
  const totalClinics = result?.totalElements ?? 0;

  const sorted = clinics;

  // Первые шесть городов бэкенд знает по латинскому слагу и сам подбирает
  // синонимы («toshkent», «ташкент», «г. ташкент»). Для остальных синонимов нет,
  // поэтому отправляем название так, как оно лежит в базе — там срабатывает
  // точное сравнение. Раньше в списке было только шесть городов, и клиники из
  // Намангана, Карши, Ургенча, Термеза, Джизака, Нукуса и Чирчика было нечем
  // отфильтровать; в самом списке при этом показывался сырой слаг «tashkent».
  const cities = useMemo(
    () => [
      { value: "tashkent", label: t("hero.cities.tashkent") },
      { value: "samarkand", label: t("hero.cities.samarkand") },
      { value: "bukhara", label: t("hero.cities.bukhara") },
      { value: "fergana", label: t("clinics.cityFergana") },
      { value: "andijan", label: t("hero.cities.andijan") },
      { value: "navoi", label: t("clinics.cityNavoi") },
      { value: "Наманган", label: t("hero.cities.namangan") },
      { value: "Карши", label: t("clinics.cityKarshi") },
      { value: "Ургенч", label: t("clinics.cityUrgench") },
      { value: "Термез", label: t("clinics.cityTermez") },
      { value: "Джизак", label: t("clinics.cityJizzakh") },
      { value: "Нукус", label: t("clinics.cityNukus") },
      { value: "Чирчик", label: t("clinics.cityChirchik") },
    ],
    [t],
  );
  const districts = useMemo(
    () => Array.from(new Set([
      ...(selectedDistrict !== "all" ? [selectedDistrict] : []),
      ...clinics.map((c) => c.district).filter(Boolean) as string[],
    ])),
    [clinics, selectedDistrict],
  );

  const activeCount = useMemo(() => {
    let n = 0;
    if (selectedCity !== "all") n++;
    if (selectedDistrict !== "all") n++;
    if (searchQuery) n++;
    return n;
  }, [selectedCity, selectedDistrict, searchQuery]);

  const resetFilters = () => {
    setSearchQuery("");
    setSearchParams(new URLSearchParams());
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PageMeta
        title={t("clinics.pageMetaTitle")}
        description={t("clinics.pageMetaDescription")}
        canonical="https://prodent.uz/clinics"
        robots={searchParams.size > 0 ? "noindex,follow" : "index,follow"}
      />
      <Header />

      <section className="relative bg-card border-b border-border">
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(800px 300px at 80% 0%, hsl(175 50% 95%) 0%, transparent 70%)",
          }}
        />
        <div className="max-w-[1440px] mx-auto px-4 lg:px-8 pt-10 pb-6">
          <div className="flex items-end justify-between gap-8 mb-6 flex-wrap">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-primary font-semibold font-mono">
                {t("clinics.breadcrumb")}
              </div>
              <h1 className="mt-2 text-[34px] sm:text-[44px] leading-[1.05] font-extrabold tracking-tight font-display">
                {t("clinics.h1Title")}
              </h1>
              <p className="mt-2 text-[14.5px] text-muted-foreground max-w-[600px]">
                <span className="text-foreground font-semibold tabular-nums">
                  {totalClinics}
                </span>{" "}
                {language === "ru"
                  ? `${pluralRu(totalClinics, ["клиника", "клиники", "клиник"])} · сортировка по верификации, рейтингу и подписчикам`
                  : t("clinics.sortHint")}
              </p>
            </div>
          </div>

          <div
            className="bg-card rounded-[18px] border border-border flex flex-col md:flex-row items-stretch p-1.5 gap-1.5 md:gap-0"
            style={{ boxShadow: "0 12px 36px -16px rgba(15,23,42,0.18)" }}
          >
            <div className="flex-1 flex items-center gap-2 px-4">
              <SearchIcon className="w-4 h-4 text-muted-foreground" />
              <input
                aria-label={t("clinics.searchInputPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("clinics.searchInputPlaceholder")}
                className="flex-1 h-12 bg-transparent outline-none text-[15px] placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
              />
              {searchQuery && (
                <button
                  aria-label={t("clinics.filtersResetShort")}
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="w-11 h-11 grid place-items-center rounded-full bg-muted text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <div className="hidden md:block w-px bg-border my-2" />
            <select
              aria-label={t("clinics.filterCity")}
              value={selectedCity}
              onChange={(e) => updateUrlState({ city: e.target.value })}
              className="h-12 px-4 bg-transparent outline-none text-[14px] text-foreground cursor-pointer focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="all">{t("clinics.allCities")}</option>
              {cities.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowMap(true)}
              className="h-12 px-6 md:ml-1 inline-flex items-center justify-center gap-2 rounded-[12px] text-primary-foreground font-semibold text-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              style={{
                background: "linear-gradient(140deg, hsl(175 60% 32%), hsl(180 70% 22%))",
                boxShadow: "0 6px 16px -4px hsl(175 60% 32% / 0.45)",
              }}
            >
              <MapPin className="w-4 h-4" /> {t("clinics.mapButton")}
            </button>
          </div>

          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <span className="text-xs uppercase tracking-[0.14em] text-muted-foreground font-semibold mr-1">
              {t("clinics.quickShort")}
            </span>
            <span className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary/10 pl-2.5 pr-3 text-[12.5px] font-medium text-foreground ring-1 ring-inset ring-primary/30">
              <Check className="w-3.5 h-3.5" /> {t("clinics.chipVerified")}
            </span>
          </div>
        </div>
      </section>

      <main className="max-w-[1440px] mx-auto px-4 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          <aside
            id="clinic-filters"
            className={cn(
              "w-full lg:w-[280px] shrink-0 lg:sticky lg:top-[80px] lg:self-start",
              mobileFiltersOpen ? "block" : "hidden lg:block",
            )}
          >
            <div
              className="bg-card rounded-[18px] border border-border p-5"
              style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.03)" }}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="font-bold text-[15px] tracking-tight font-display">{t("clinics.filtersTitle")}</div>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="min-h-11 text-xs text-primary font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {t("clinics.filtersResetShort")}
                </button>
              </div>
              <div className="text-xs text-muted-foreground">{activeCount} {t("clinics.filtersActiveSuffix")}</div>

              {cities.length > 0 && (
                <FilterGroup title={t("clinics.filterCity")}>
                  <div className="space-y-1">
                    {cities.map((c) => (
                      <CheckRow
                        key={c.value}
                        label={c.label}
                        checked={selectedCity === c.value}
                        onChange={() =>
                          updateUrlState({ city: selectedCity === c.value ? "all" : c.value })
                        }
                      />
                    ))}
                  </div>
                </FilterGroup>
              )}

              {districts.length > 0 && (
                <FilterGroup title={t("clinics.filterDistrict")}>
                  <div className="space-y-1">
                    {districts.slice(0, 8).map((d) => (
                      <CheckRow
                        key={d}
                        label={d}
                        checked={selectedDistrict === d}
                        onChange={() =>
                          updateUrlState({ district: selectedDistrict === d ? "all" : d })
                        }
                      />
                    ))}
                  </div>
                </FilterGroup>
              )}

              <FilterGroup title={t("clinics.filterAdditional")}>
                <div className="flex min-h-11 items-center gap-2.5 text-[13px] text-foreground">
                  <span className="grid h-4 w-4 shrink-0 place-items-center rounded border border-primary bg-primary text-primary-foreground">
                    <Check className="h-2.5 w-2.5" strokeWidth={3} />
                  </span>
                  {t("clinics.filterOnlyVerified")}
                </div>
              </FilterGroup>

              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                className="mt-4 h-11 w-full rounded-[12px] bg-primary text-primary-foreground text-[13.5px] font-semibold inline-flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {t("clinics.showCount")} {totalClinics} {language === "ru" ? pluralRu(totalClinics, ["клиника", "клиники", "клиник"]) : t("clinics.countShort")} <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </aside>

          <div className="flex-1 min-w-0 w-full">
            <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="text-[14px]">
                  <span className="font-semibold tabular-nums">{totalClinics}</span>
                  <span className="text-muted-foreground"> {language === "ru" ? pluralRu(totalClinics, ["клиника", "клиники", "клиник"]) : t("clinics.countShort")}</span>
                </div>
                {(selectedCity !== "all" || selectedDistrict !== "all" || verifiedOnly) && (
                  <div className="hidden md:flex items-center gap-1 flex-wrap">
                    {selectedCity !== "all" && (
                      <span className="inline-flex min-h-11 items-center gap-1 pl-2.5 pr-1.5 rounded-full bg-primary/10 text-foreground text-xs font-medium ring-1 ring-inset ring-primary/30">
                        {selectedCity}
                        <button
                          type="button"
                          aria-label={`${t("clinics.filtersResetShort")}: ${selectedCity}`}
                          onClick={() => updateUrlState({ city: "all" })}
                          className="w-11 h-11 rounded-full grid place-items-center hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    )}
                    {selectedDistrict !== "all" && (
                      <span className="inline-flex min-h-11 items-center gap-1 pl-2.5 pr-1.5 rounded-full bg-primary/10 text-foreground text-xs font-medium ring-1 ring-inset ring-primary/30">
                        {selectedDistrict}
                        <button
                          type="button"
                          aria-label={`${t("clinics.filtersResetShort")}: ${selectedDistrict}`}
                          onClick={() => updateUrlState({ district: "all" })}
                          className="w-11 h-11 rounded-full grid place-items-center hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    )}
                    {verifiedOnly && (
                      <span className="inline-flex min-h-11 items-center gap-1 pl-2.5 pr-1.5 rounded-full bg-primary/10 text-foreground text-xs font-medium ring-1 ring-inset ring-primary/30">
                        {t("clinics.verifiedChip")}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowMap(true)}
                  className="h-11 px-3 rounded-[10px] bg-card border border-border text-[13px] text-foreground inline-flex items-center gap-1.5 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <MapPin className="w-3.5 h-3.5" /> {t("clinics.mapButtonShort")}
                </button>
                <div className="min-h-11 p-0.5 inline-flex bg-muted rounded-[10px] lg:hidden">
                  <button
                    type="button"
                    aria-label={t("clinics.filtersTitle")}
                    aria-controls="clinic-filters"
                    aria-expanded={mobileFiltersOpen}
                    onClick={() => setMobileFiltersOpen((open) => !open)}
                    className="w-11 h-11 grid place-items-center rounded-[8px] bg-card shadow-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Filter className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {isLoading ? (
              <div className="space-y-3" role="status" aria-live="polite" aria-busy="true">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton
                    key={i}
                    className="w-full h-[260px] rounded-[18px] bg-card border border-border"
                  />
                ))}
              </div>
            ) : isError ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between gap-3">
                  <span>Не удалось загрузить</span>
                  <button
                    type="button"
                    onClick={() => refetch()}
                    className="min-h-11 shrink-0 underline font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Повторить
                  </button>
                </AlertDescription>
              </Alert>
            ) : sorted.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {t("clinics.noFiltersResult")}
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="space-y-3">
                  {sorted.map((c, i) => (
                    <ClinicCard key={c.id} clinic={c} index={i} onOpenMap={() => setShowMap(true)} />
                  ))}
                </div>
                {(result?.totalPages ?? 0) > 1 && (
                  <nav className="mt-6 flex items-center justify-center gap-3" aria-label="Страницы клиник">
                    <button
                      type="button"
                      disabled={result?.first}
                      onClick={() => updateUrlState({ page: Math.max(0, urlState.page - 1) })}
                      className="h-11 px-4 rounded-[10px] border border-border bg-card disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Назад
                    </button>
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {urlState.page + 1} / {result?.totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={result?.last}
                      onClick={() => updateUrlState({ page: urlState.page + 1 })}
                      className="h-11 px-4 rounded-[10px] border border-border bg-card disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Вперёд
                    </button>
                  </nav>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      <Footer />

      {showMap && (
        <Suspense fallback={null}>
          <ClinicsMapDialog
            open={showMap}
            onOpenChange={setShowMap}
            clinics={clinics.map((clinic) => ({
              id: clinic.id,
              name: clinic.name || t("clinics.cardClinicLabel"),
              city: clinic.city || "",
              district: clinic.district,
              address: clinic.address || "",
              phone: clinic.phone,
              verified: clinic.is_verified,
              images: clinic.cover_url ? [clinic.cover_url] : null,
              latitude: clinic.latitude,
              longitude: clinic.longitude,
              doctorCount: clinic.doctorCount,
            }))}
          />
        </Suspense>
      )}
    </div>
  );
};

export default Clinics;
