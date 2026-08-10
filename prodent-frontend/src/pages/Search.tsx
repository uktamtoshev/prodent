import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Filter,
  MapPin,
  MessageSquare,
  Play,
  Search as SearchIcon,
  Shield,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { PageMeta } from "@/components/PageMeta";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLanguage } from "@/contexts/LanguageContext";
import { defaultDoctorPlaceholder } from "@/lib/defaultAvatar";
import { useActiveBadges, type ActiveBadge } from "@/hooks/useBadgeAssignments";
import { useDoctorBoosts, type BoostInfo } from "@/hooks/useAdCampaigns";
import { BoostBadge } from "@/components/ads/BoostBadge";
import { AwardBadgeOverlay } from "@/components/badges/AwardBadgeOverlay";
import { analytics } from "@/lib/analytics";
import type { SearchDoctor } from "@/lib/searchDoctors";
import { searchPublicDoctors } from "@/lib/publicDoctorSearch";
import {
  DEFAULT_SEARCH_URL_STATE,
  parseSearchUrlState,
  patchSearchUrlState,
  serializeSearchUrlState,
  type SearchSort,
  type SearchUrlState,
  type SearchView,
} from "@/lib/searchUrlState";
import { cn, formatPrice } from "@/lib/utils";
import { formatAmount } from "@/lib/localization";

const DoctorsMapDialog = lazy(() =>
  import("@/components/search/DoctorsMapDialog").then((module) => ({
    default: module.DoctorsMapDialog,
  })),
);

/* ──────────────────────────────────────────────────────────
   Constants
   ────────────────────────────────────────────────────────── */

const DISTRICTS = [
  { v: "all", key: "search.allDistricts" },
  { v: "Мирзо-Улугбекский", key: "search.districtMirzoUlugbek" },
  { v: "Юнусабадский", key: "search.districtYunusabad" },
  { v: "Чиланзарский", key: "search.districtChilanzar" },
  { v: "Яккасарайский", key: "search.districtYakkasaray" },
  { v: "Мирабадский", key: "search.districtMirabad" },
  { v: "Алмазарский", key: "search.districtAlmazar" },
  { v: "Шайхантахурский", key: "search.districtShaykhantahur" },
  { v: "Учтепинский", key: "search.districtUchtepa" },
  { v: "Яшнабадский", key: "search.districtYashnabad" },
] as const;

const TONE_GRADIENTS = [
  "linear-gradient(140deg, hsl(175 60% 38%), hsl(180 70% 28%))",
  "linear-gradient(140deg, hsl(345 70% 50%), hsl(355 80% 38%))",
  "linear-gradient(140deg, hsl(265 55% 50%), hsl(275 65% 38%))",
  "linear-gradient(140deg, hsl(35 90% 55%), hsl(25 85% 42%))",
  "linear-gradient(140deg, hsl(205 75% 50%), hsl(215 75% 38%))",
  "linear-gradient(140deg, hsl(155 60% 42%), hsl(165 70% 28%))",
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

/* ──────────────────────────────────────────────────────────
   Hero
   ────────────────────────────────────────────────────────── */

interface HeroProps {
  count: number;
  query: string;
  setQuery: (v: string) => void;
  spec: string;
  setSpec: (v: string) => void;
  city: string;
  setCity: (v: string) => void;
  minRating: number | null;
  setMinRating: (v: number | null) => void;
  hasVideo: boolean;
  setHasVideo: (v: boolean) => void;
  onSearch: () => void;
}

function SearchHero({
  count,
  query,
  setQuery,
  spec,
  setSpec,
  city,
  setCity,
  minRating,
  setMinRating,
  hasVideo,
  setHasVideo,
  onSearch,
}: HeroProps) {
  const { t } = useLanguage();
  const SPECIALTIES_LOC = [
    { v: "all",            l: t("search.allSpecialties") },
    { v: "therapist",      l: t("hero.specialties.therapist") },
    { v: "orthodontist",   l: t("hero.specialties.orthodontist") },
    { v: "implantologist", l: t("hero.specialties.implantologist") },
    { v: "surgeon",        l: t("hero.specialties.surgeon") },
    { v: "orthopedist",    l: t("hero.specialties.orthopedist") },
    { v: "pediatric",      l: t("hero.specialties.pediatric") },
    { v: "periodontist",   l: t("hero.specialties.periodontist") },
    { v: "endodontist",    l: t("hero.specialties.endodontist") },
  ];
  const CITIES_LOC = [
    { v: "all",       l: t("clinics.allCities") },
    { v: "tashkent",  l: t("hero.cities.tashkent") },
    { v: "samarkand", l: t("hero.cities.samarkand") },
    { v: "bukhara",   l: t("hero.cities.bukhara") },
    { v: "fergana",   l: t("search.cityFergana") },
    { v: "andijan",   l: t("hero.cities.andijan") },
    { v: "navoi",     l: t("search.cityNavoi") },
  ];
  return (
    <section className="relative overflow-x-clip border-b border-border bg-background">
      <div
        className="absolute inset-0 -z-10"
        style={{
          background: "radial-gradient(800px 300px at 80% 0%, hsl(175 50% 95%) 0%, transparent 70%)",
        }}
      />
      <div className="max-w-[1440px] mx-auto px-4 lg:px-8 pt-10 pb-6">
        <div className="flex min-w-0 items-end justify-between gap-8 mb-6 flex-wrap">
          <div className="min-w-0 max-w-full">
            <div className="break-words font-mono text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              {`// ${t("search.catalog")} · ${CITIES_LOC.find((c) => c.v === city)?.l ?? t("clinics.allCities")}`}
            </div>
            <h1 className="mt-2 break-words text-[34px] sm:text-[44px] leading-[1.05] font-extrabold tracking-tight font-display">
              {t("search.findYourDentist")}
            </h1>
            <p className="mt-2 max-w-[600px] text-[14.5px] text-muted-foreground">
              <span className="font-semibold tabular-nums text-foreground">{count}</span>{" "}
              {t("search.heroSubtitleParts")}
            </p>
          </div>
        </div>

        {/* Query bar */}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSearch();
          }}
          className="flex flex-col items-stretch gap-1.5 rounded-[18px] border border-border bg-card p-1.5 md:flex-row md:gap-0"
          style={{ boxShadow: "0 12px 36px -16px rgba(15,23,42,0.18)" }}
        >
          <div className="flex-1 flex items-center gap-2 px-4">
            <SearchIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <input
              aria-label={t("search.mainPlaceholder")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("search.mainPlaceholder")}
              className="h-12 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            />
            {query && (
              <button
                type="button"
                aria-label={t("search.resetShort")}
                onClick={() => setQuery("")}
                className="grid h-11 w-11 place-items-center rounded-full bg-muted text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
          <div className="my-2 hidden w-px bg-border md:block" />
          <select
            aria-label={t("search.specialty")}
            value={spec}
            onChange={(e) => setSpec(e.target.value)}
            className="h-12 cursor-pointer bg-transparent px-4 text-[14px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {SPECIALTIES_LOC.map((s) => (
              <option key={s.v} value={s.v}>
                {s.l}
              </option>
            ))}
          </select>
          <div className="my-2 hidden w-px bg-border md:block" />
          <select
            aria-label={t("clinics.city")}
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="h-12 cursor-pointer bg-transparent px-4 text-[14px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {CITIES_LOC.map((c) => (
              <option key={c.v} value={c.v}>
                {c.l}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-[12px] px-6 text-[14px] font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:ml-1"
            style={{
              background: "linear-gradient(140deg, hsl(175 60% 32%), hsl(180 70% 22%))",
              boxShadow: "0 6px 16px -4px hsl(175 60% 32% / 0.45)",
            }}
          >
            <SearchIcon className="h-4 w-4" aria-hidden="true" /> {t("search.searchAction")}
          </button>
        </form>

        {/* Quick chips */}
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <span className="mr-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {t("search.quickShort")}
          </span>
          {[
            {
              l: t("search.chipRating48"),
              icon: Sparkles,
              active: minRating === 4.8,
              onClick: () => setMinRating(minRating === 4.8 ? null : 4.8),
            },
            {
              l: t("search.chipVideo"),
              icon: Play,
              active: hasVideo,
              onClick: () => setHasVideo(!hasVideo),
            },
          ].map((c) => {
            const I = c.icon;
            return (
              <button
                type="button"
                key={c.l}
                aria-pressed={c.active}
                onClick={c.onClick}
                className={cn(
                  "inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-[12.5px] ring-1 ring-inset focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  c.active
                    ? "bg-primary/10 text-foreground ring-primary/30"
                    : "bg-muted text-foreground ring-border hover:bg-muted/80",
                )}
              >
                <I className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                {c.l}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────────────────
   Filter sidebar
   ────────────────────────────────────────────────────────── */

interface FiltersProps {
  spec: string;
  setSpec: (v: string) => void;
  district: string;
  setDistrict: (v: string) => void;
  priceRange: [number, number];
  setPriceRange: (v: [number, number]) => void;
  minRating: number | null;
  setMinRating: (v: number | null) => void;
  hasVideo: boolean;
  setHasVideo: (v: boolean) => void;
  count: number;
  resetFilters: () => void;
  activeCount: number;
  onApply?: () => void;
  /** Mobile: whether the (otherwise hidden) filter panel is expanded. */
  open?: boolean;
}

function FilterGroup({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-border py-5 first:pt-0 last:border-0">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground">
          {title}
        </div>
        {count != null && <div className="font-mono text-xs text-muted-foreground">{count}</div>}
      </div>
      {children}
    </div>
  );
}

function CheckRow({
  label,
  count,
  checked,
  onChange,
}: {
  label: string;
  count?: number;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="group flex min-h-11 cursor-pointer items-center gap-2.5 py-1">
      <span
        className={cn(
          "grid h-4 w-4 shrink-0 place-items-center rounded border-[1.5px] transition-colors",
          checked ? "border-primary bg-primary text-primary-foreground" : "border-border group-hover:border-foreground/50"
        )}
      >
        {checked && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
      </span>
      <span className="flex-1 text-[13px] text-foreground">{label}</span>
      {count != null && (
        <span className="font-mono text-xs tabular-nums text-muted-foreground">{count}</span>
      )}
      <input type="checkbox" className="sr-only" checked={checked} onChange={onChange} />
    </label>
  );
}

function SearchFilters({
  spec,
  setSpec,
  district,
  setDistrict,
  priceRange,
  setPriceRange,
  minRating,
  setMinRating,
  hasVideo,
  setHasVideo,
  count,
  resetFilters,
  activeCount,
  onApply,
  open = false,
}: FiltersProps) {
  const { language, t } = useLanguage();
  const [showAllDistricts, setShowAllDistricts] = useState(false);
  const SPECIALTIES_LOC = [
    { v: "all",            l: t("search.allSpecialties") },
    { v: "therapist",      l: t("hero.specialties.therapist") },
    { v: "orthodontist",   l: t("hero.specialties.orthodontist") },
    { v: "implantologist", l: t("hero.specialties.implantologist") },
    { v: "surgeon",        l: t("hero.specialties.surgeon") },
    { v: "orthopedist",    l: t("hero.specialties.orthopedist") },
    { v: "pediatric",      l: t("hero.specialties.pediatric") },
    { v: "periodontist",   l: t("hero.specialties.periodontist") },
    { v: "endodontist",    l: t("hero.specialties.endodontist") },
  ];
  return (
    <aside
      id="search-filters"
      className={cn(
        "w-full lg:w-[280px] shrink-0 lg:sticky lg:top-[80px] lg:self-start",
        open ? "block" : "hidden lg:block",
      )}
    >
      <div
        className="rounded-[18px] border border-border bg-card p-5"
        style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.03)" }}
      >
        <div className="flex items-center justify-between mb-1">
          <div className="font-bold text-[15px] tracking-tight font-display">{t("search.filters")}</div>
          <button
            type="button"
            onClick={resetFilters}
            className="min-h-11 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("search.resetShort")}
          </button>
        </div>
        <div className="text-xs text-muted-foreground">{activeCount} {t("search.activeFiltersSuffix")}</div>

        <FilterGroup title={t("search.specialty")} count={SPECIALTIES_LOC.length - 1}>
          <div className="space-y-1">
            {SPECIALTIES_LOC.filter((s) => s.v !== "all").map((s) => (
              <CheckRow
                key={s.v}
                label={s.l}
                checked={spec === s.v}
                onChange={() => setSpec(spec === s.v ? "all" : s.v)}
              />
            ))}
          </div>
        </FilterGroup>

        <FilterGroup title={t("search.district")} count={DISTRICTS.length - 1}>
          <div className="space-y-1">
            {DISTRICTS.filter((d) => d.v !== "all")
              .slice(0, showAllDistricts ? undefined : 5)
              .map((d) => (
                <CheckRow
                  key={d.v}
                  label={t(d.key)}
                  checked={district === d.v}
                  onChange={() => setDistrict(district === d.v ? "all" : d.v)}
                />
              ))}
            {!showAllDistricts && (
              <button
                type="button"
                onClick={() => setShowAllDistricts(true)}
                className="mt-1 min-h-11 text-xs font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                + {t("search.moreDistricts")} {DISTRICTS.length - 6}
              </button>
            )}
          </div>
        </FilterGroup>

        <FilterGroup title={t("search.priceAppointment")}>
          <div className="flex items-center gap-2 mb-3">
            <input
              aria-label={t("search.priceFromLabel")}
              type="number"
              value={priceRange[0]}
              onChange={(e) =>
                setPriceRange([Math.max(0, Number(e.target.value) || 0), priceRange[1]])
              }
              className="h-11 min-w-0 flex-1 rounded-[10px] border border-input bg-background px-2.5 font-mono text-xs tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <input
              aria-label={t("search.priceToLabel")}
              type="number"
              value={priceRange[1]}
              onChange={(e) =>
                setPriceRange([priceRange[0], Math.max(priceRange[0], Number(e.target.value) || 0)])
              }
              className="h-11 min-w-0 flex-1 rounded-[10px] border border-input bg-background px-2.5 font-mono text-xs tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <input
            aria-label={t("search.priceToLabel")}
            type="range"
            min={0}
            max={10000000}
            step={50000}
            value={priceRange[1]}
            onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])}
            className="h-11 w-full cursor-pointer accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="mt-1 flex items-center justify-between font-mono text-xs text-muted-foreground">
            <span>0</span>
            <span>{formatAmount(10_000_000, language)}</span>
          </div>
        </FilterGroup>

        <FilterGroup title={t("search.rating")}>
          <div className="space-y-1">
            {[5, 4.5, 4].map((r) => (
              <label key={r} className="flex min-h-11 cursor-pointer items-center gap-2.5 py-1">
                <span
                  className={cn(
                    "grid h-4 w-4 place-items-center rounded-full border-[1.5px]",
                    minRating === r ? "border-primary" : "border-border"
                  )}
                >
                  {minRating === r && <span className="h-2 w-2 rounded-full bg-primary" />}
                </span>
                <div className="flex items-center gap-1 text-[13px]">
                  <span className="text-warning-amber">★</span>
                  <span className="font-semibold tabular-nums">{r}</span>
                  <span className="text-muted-foreground">+</span>
                </div>
                <input
                  type="radio"
                  name="rating"
                  className="sr-only"
                  checked={minRating === r}
                  onChange={() => setMinRating(minRating === r ? null : r)}
                />
              </label>
            ))}
          </div>
        </FilterGroup>

        <FilterGroup title={t("search.additional")}>
          <div className="space-y-1">
            <CheckRow
              label={t("search.chipVideo")}
              checked={hasVideo}
              onChange={() => setHasVideo(!hasVideo)}
            />
          </div>
        </FilterGroup>

        <button
          type="button"
          onClick={onApply}
          className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[12px] bg-primary text-[13.5px] font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {t("search.showButton")} {count} {count === 1 ? t("search.doctorOne") : t("search.doctorPlural")} <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}

/* ──────────────────────────────────────────────────────────
   Doctor card
   ────────────────────────────────────────────────────────── */

interface Doctor extends SearchDoctor {
  id: string;
  specialty: string | null;
  experience_years: number | null;
  price_from: number | null;
  rating: number | null;
  review_count: number | null;
  is_verified: boolean | null;
  images: string[] | null;
  video_url: string | null;
  latitude: number | null;
  longitude: number | null;
  subscription_plan: string | null;
  profiles: { full_name: string | null; avatar_url: string | null; gender: string | null } | null;
  clinics: {
    id: string;
    name: string | null;
    city: string | null;
    district: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
}

function DoctorCard({ doctor, index, boost, awardBadge }: { doctor: Doctor; index: number; boost?: BoostInfo; awardBadge?: ActiveBadge }) {
  const { t } = useLanguage();
  const profile = doctor.profiles;
  const clinic = doctor.clinics;
  const canBook = Boolean(clinic?.id);
  const name = profile?.full_name || doctor.specialty || t("search.doctorDefault");
  const initials = initialsFor(name);
  const grad = TONE_GRADIENTS[index % TONE_GRADIENTS.length];
  const isGold = doctor.subscription_plan === "top" || doctor.subscription_plan === "gold";
  const rating = Number(doctor.rating || 0).toFixed(2);
  const reviews = doctor.review_count || 0;
  const cityLine = clinic
    ? [clinic.city, clinic.district].filter(Boolean).join(" · ")
    : t("search.countryUz");

  return (
    <article
      data-testid="doctor-card"
      className="group block overflow-hidden rounded-[18px] border border-border bg-card transition-colors hover:border-foreground/50"
      style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.03)" }}
    >
      <div className="grid grid-cols-1 md:grid-cols-[180px,1fr,200px]">
        {/* Portrait */}
        <Link
          to={`/doctor/${doctor.id}`}
          className="relative aspect-[4/5] md:aspect-[4/5] overflow-hidden"
          style={{ background: "repeating-linear-gradient(135deg,#e7eceb 0 6px,#eef2f1 6px 12px)" }}
        >
          <img
            src={
              profile?.avatar_url ||
              doctor.images?.[0] ||
              defaultDoctorPlaceholder(profile?.gender)
            }
            alt={name}
            loading="lazy"
            decoding="async"
            width={360}
            height={450}
            className="absolute inset-0 h-full w-full bg-background object-cover"
          />
          {isGold && (
            <div className="absolute left-2 top-2 inline-flex min-h-6 items-center gap-1 rounded-full bg-warning-amber/20 px-2 text-xs font-bold uppercase tracking-wide text-warning-amber">
              ★ {t("search.top")}
            </div>
          )}
          {/* Promoted-doctor ribbon (top_day / top_week / top_month). */}
          <BoostBadge boost={boost} size="lg" />
          {/* Admin-assigned award badge (top-left, opposite to boost). */}
          <AwardBadgeOverlay badge={awardBadge} size="lg" className="!top-3 !left-3" />
          {doctor.video_url && (
            <span className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-background/95 text-foreground backdrop-blur">
              <Play className="h-3 w-3" aria-hidden="true" />
            </span>
          )}
        </Link>

        {/* Body */}
        <Link to={`/doctor/${doctor.id}`} className="min-w-0 p-5 md:border-x md:border-border">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-[19px] tracking-tight truncate font-display">
                  {name}
                </h3>
                {doctor.is_verified && (
                  <span className="inline-flex items-center text-success-green">
                    <Shield className="h-4 w-4" aria-hidden="true" />
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-[13.5px] font-medium text-foreground">
                {doctor.specialty}
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                {clinic?.name && <span className="truncate">{clinic.name}</span>}
                {clinic?.name && cityLine && <span className="text-border">·</span>}
                <span>{cityLine}</span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-4 grid grid-cols-2 gap-3 border-y border-border py-3">
            <div>
              <div className="flex items-center gap-1">
                <span className="text-[14px] text-warning-amber">★</span>
                <span className="font-bold text-[14px] tabular-nums">{reviews > 0 ? rating : "—"}</span>
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {reviews > 0 ? `${reviews} ${t("search.reviewsLabel")}` : t("search.newDoctor")}
              </div>
            </div>
            <div>
              <div className="font-bold text-[14px] tabular-nums">{doctor.experience_years ?? "—"}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{t("search.yearsLabel")}</div>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-1.5 flex-wrap">
            {doctor.specialty && (
              <span className="inline-flex min-h-6 items-center rounded-full bg-muted px-2 text-xs font-medium text-foreground">
                {doctor.specialty}
              </span>
            )}
            {doctor.is_verified && (
              <span className="inline-flex min-h-6 items-center gap-1 rounded-full bg-success-green/10 px-2 text-xs font-medium text-success-green ring-1 ring-inset ring-success-green/30">
                <Shield className="h-3 w-3" aria-hidden="true" /> {t("search.verifiedShort")}
              </span>
            )}
          </div>
        </Link>

        {/* Booking */}
        <div className="p-5 flex flex-col">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {t("search.appointmentFrom")}
          </div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-[24px] font-extrabold tabular-nums tracking-tight font-display">
              {doctor.price_from ? formatPrice(doctor.price_from, "") : "—"}
            </span>
            <span className="text-xs text-muted-foreground">{t("search.sum")}</span>
          </div>

          <div className="mt-3 flex-1">
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {t("search.freeSlots")}
            </div>
            <p className="text-sm text-muted-foreground">
              {canBook
                ? t("search.availabilityOnBooking")
                : t("search.bookingUnavailable")}
            </p>
          </div>

          {canBook && (
            <Link
              to={`/book/${doctor.id}`}
              className="mt-4 inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-[10px] text-[13px] font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              style={{ background: "linear-gradient(140deg, hsl(175 60% 32%), hsl(180 70% 22%))" }}
            >
              {t("search.book")} <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          )}
          <Link to={`/doctor/${doctor.id}`} className="mt-1.5 inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-[10px] border border-border bg-background text-[12.5px] font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <MessageSquare className="w-3.5 h-3.5" /> {t("search.write")}
          </Link>
        </div>
      </div>
    </article>
  );
}

/* ──────────────────────────────────────────────────────────
   Toolbar
   ────────────────────────────────────────────────────────── */

function Toolbar({
  count,
  city,
  spec,
  district,
  removeChip,
  sortBy,
  setSortBy,
  view,
  setView,
}: {
  count: number;
  city: string;
  spec: string;
  district: string;
  removeChip: (kind: "city" | "spec" | "district") => void;
  sortBy: string;
  setSortBy: (v: string) => void;
  view: "list" | "grid" | "map";
  setView: (v: "list" | "grid" | "map") => void;
}) {
  const { t } = useLanguage();
  const CITIES_LOC = [
    { v: "all",       l: t("clinics.allCities") },
    { v: "tashkent",  l: t("hero.cities.tashkent") },
    { v: "samarkand", l: t("hero.cities.samarkand") },
    { v: "bukhara",   l: t("hero.cities.bukhara") },
    { v: "fergana",   l: t("search.cityFergana") },
    { v: "andijan",   l: t("hero.cities.andijan") },
    { v: "navoi",     l: t("search.cityNavoi") },
  ];
  const SPECIALTIES_LOC = [
    { v: "all",            l: t("search.allSpecialties") },
    { v: "therapist",      l: t("hero.specialties.therapist") },
    { v: "orthodontist",   l: t("hero.specialties.orthodontist") },
    { v: "implantologist", l: t("hero.specialties.implantologist") },
    { v: "surgeon",        l: t("hero.specialties.surgeon") },
    { v: "orthopedist",    l: t("hero.specialties.orthopedist") },
    { v: "pediatric",      l: t("hero.specialties.pediatric") },
    { v: "periodontist",   l: t("hero.specialties.periodontist") },
    { v: "endodontist",    l: t("hero.specialties.endodontist") },
  ];
  const cityLabel = CITIES_LOC.find((c) => c.v === city)?.l;
  const specLabel = SPECIALTIES_LOC.find((s) => s.v === spec)?.l;
  const districtKey = DISTRICTS.find((d) => d.v === district)?.key;
  const distLabel = districtKey ? t(districtKey) : undefined;

  return (
    <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="text-[14px]">
          <span className="font-semibold tabular-nums">{count}</span>
          <span className="text-muted-foreground"> {t("search.doctorPlural")}{cityLabel && cityLabel !== t("clinics.allCities") ? `, ${cityLabel}` : ""}</span>
        </div>
        <div className="hidden md:flex items-center gap-1 flex-wrap">
          {city !== "all" && cityLabel && (
            <span className="inline-flex min-h-11 items-center gap-1 rounded-full bg-primary/10 pl-2.5 pr-0 text-xs font-medium text-foreground ring-1 ring-inset ring-primary/30">
              {cityLabel}
              <button
                type="button"
                aria-label={t("search.resetShort")}
                onClick={() => removeChip("city")}
                className="grid h-11 w-11 place-items-center rounded-full hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          )}
          {spec !== "all" && specLabel && (
            <span className="inline-flex min-h-11 items-center gap-1 rounded-full bg-primary/10 pl-2.5 pr-0 text-xs font-medium text-foreground ring-1 ring-inset ring-primary/30">
              {specLabel}
              <button
                type="button"
                aria-label={t("search.resetShort")}
                onClick={() => removeChip("spec")}
                className="grid h-11 w-11 place-items-center rounded-full hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          )}
          {district !== "all" && distLabel && (
            <span className="inline-flex min-h-11 items-center gap-1 rounded-full bg-primary/10 pl-2.5 pr-0 text-xs font-medium text-foreground ring-1 ring-inset ring-primary/30">
              {distLabel}
              <button
                type="button"
                aria-label={t("search.resetShort")}
                onClick={() => removeChip("district")}
                className="grid h-11 w-11 place-items-center rounded-full hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          )}
        </div>
      </div>
      <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
        <select
          aria-label={t("search.sort")}
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="h-11 min-w-0 max-w-full flex-1 cursor-pointer rounded-[10px] border border-input bg-background px-3 text-[13px] text-foreground focus-visible:ring-2 focus-visible:ring-ring sm:flex-none"
        >
          <option value="rating">{t("search.byRating")}</option>
          <option value="price-asc">{t("search.sortPriceAscShort")}</option>
          <option value="price-desc">{t("search.sortPriceDescShort")}</option>
          <option value="experience">{t("search.byExperience")}</option>
        </select>
        <div className="inline-flex min-h-11 shrink-0 rounded-[10px] bg-muted p-0.5">
          {([
            { v: "list", I: Filter },
            { v: "grid", I: Sparkles },
            { v: "map", I: MapPin },
          ] as const).map((b) => {
            const I = b.I;
            return (
              <button
                aria-label={b.v === "map" ? t("clinics.mapButtonShort") : b.v === "list" ? t("search.results") : t("search.catalog")}
                aria-pressed={view === b.v}
                key={b.v}
                onClick={() => setView(b.v)}
                className={cn(
                  "grid h-11 w-11 place-items-center rounded-[8px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  view === b.v
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <I className="w-3.5 h-3.5" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   Page
   ────────────────────────────────────────────────────────── */

const Search = () => {
  const { t } = useLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlState = useMemo(() => parseSearchUrlState(searchParams), [searchParams]);
  const [searchQuery, setSearchQuery] = useState(urlState.q);
  const [showMap, setShowMap] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const { data: activeBadges = [] } = useActiveBadges();

  const updateUrlState = useCallback(
    (patch: Partial<SearchUrlState>, replace = false) => {
      const next = patchSearchUrlState(urlState, patch);
      setSearchParams(serializeSearchUrlState(next), { replace });
    },
    [setSearchParams, urlState],
  );

  useEffect(() => {
    setSearchQuery(urlState.q);
  }, [urlState.q]);

  useEffect(() => {
    const normalized = searchQuery.trim();
    if (normalized === urlState.q) return;
    const timeout = window.setTimeout(() => {
      updateUrlState({ q: normalized }, true);
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [searchQuery, updateUrlState, urlState.q]);

  useEffect(() => {
    setShowMap(urlState.view === "map");
  }, [urlState.view]);

  const {
    data: searchPage,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["public-doctors-search", urlState],
    queryFn: ({ signal }) => searchPublicDoctors(urlState, { signal }),
  });

  const doctors = (searchPage?.items ?? []) as Doctor[];
  const totalDoctors = searchPage?.totalElements ?? 0;
  const spec = urlState.specialty;
  const city = urlState.city;
  const district = urlState.district;
  const priceRange = useMemo<[number, number]>(
    () => [urlState.minPrice, urlState.maxPrice],
    [urlState.maxPrice, urlState.minPrice],
  );
  const minRating = urlState.rating;
  const hasVideo = urlState.video;
  const sortBy = urlState.sort;
  const view = urlState.view;

  // Batch boost lookup for visible doctor cards (avoids N+1 per-card fetch).
  const { data: boosts } = useDoctorBoosts(doctors.map((d) => d.id));

  const activeCount = useMemo(() => {
    let n = 0;
    if (spec !== "all") n++;
    if (city !== "all") n++;
    if (district !== "all") n++;
    if (minRating) n++;
    if (hasVideo) n++;
    if (priceRange[0] > 0 || priceRange[1] < 10000000) n++;
    if (searchQuery) n++;
    return n;
  }, [spec, city, district, minRating, hasVideo, priceRange, searchQuery]);

  const resetFilters = () => {
    setSearchQuery("");
    setSearchParams(serializeSearchUrlState(DEFAULT_SEARCH_URL_STATE));
  };

  const removeChip = (kind: "city" | "spec" | "district") => {
    if (kind === "city") updateUrlState({ city: "all" });
    if (kind === "spec") updateUrlState({ specialty: "all" });
    if (kind === "district") updateUrlState({ district: "all" });
  };

  // Report search to analytics (debounced) whenever the query or filters change
  // and the user has actually entered a search term or narrowed by a filter.
  useEffect(() => {
    if (!searchQuery && spec === "all" && city === "all" && district === "all") return;
    const id = window.setTimeout(() => {
      analytics.search(searchQuery, { spec, city, district });
    }, 600);
    return () => window.clearTimeout(id);
  }, [searchQuery, spec, city, district]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PageMeta
        title={t("search.pageTitle")}
        description={t("search.pageDescription")}
        canonical="https://prodent.uz/search"
        robots={searchParams.size > 0 ? "noindex,follow" : "index,follow"}
      />
      <Header />

      <SearchHero
        count={totalDoctors}
        query={searchQuery}
        setQuery={setSearchQuery}
        spec={spec}
        setSpec={(value) => updateUrlState({ specialty: value })}
        city={city}
        setCity={(value) => updateUrlState({ city: value })}
        minRating={minRating}
        setMinRating={(value) => updateUrlState({ rating: value })}
        hasVideo={hasVideo}
        setHasVideo={(value) => updateUrlState({ video: value })}
        onSearch={() => updateUrlState({ q: searchQuery.trim() })}
      />

      <main className="max-w-[1440px] mx-auto px-4 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          <SearchFilters
            spec={spec}
            setSpec={(value) => updateUrlState({ specialty: value })}
            district={district}
            setDistrict={(value) => updateUrlState({ district: value })}
            priceRange={priceRange}
            setPriceRange={(value) =>
              updateUrlState({ minPrice: value[0], maxPrice: value[1] }, true)
            }
            minRating={minRating}
            setMinRating={(value) => updateUrlState({ rating: value })}
            hasVideo={hasVideo}
            setHasVideo={(value) => updateUrlState({ video: value })}
            count={totalDoctors}
            resetFilters={resetFilters}
            activeCount={activeCount}
            onApply={() => setMobileFiltersOpen(false)}
            open={mobileFiltersOpen}
          />
          <div className="flex-1 min-w-0 w-full">
            <button
              type="button"
              aria-controls="search-filters"
              aria-expanded={mobileFiltersOpen}
              onClick={() => setMobileFiltersOpen((v) => !v)}
              className="mb-3 inline-flex h-11 items-center gap-2 rounded-[10px] border border-border bg-card px-4 text-[13px] font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
            >
              <Filter className="w-4 h-4" />
              {t("search.filters")}
              {activeCount > 0 && (
                <span className="ml-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs text-primary-foreground">
                  {activeCount}
                </span>
              )}
            </button>
            <Toolbar
              count={totalDoctors}
              city={city}
              spec={spec}
              district={district}
              removeChip={removeChip}
              sortBy={sortBy}
              setSortBy={(value) => updateUrlState({ sort: value as SearchSort })}
              view={view}
              setView={(value) => {
                updateUrlState({ view: value as SearchView });
                if (value === "map") setShowMap(true);
              }}
            />

            {isLoading ? (
              <div className="space-y-3" role="status" aria-live="polite" aria-busy="true">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton
                    key={i}
                    className="h-[260px] w-full rounded-[18px] border border-border bg-card"
                  />
                ))}
              </div>
            ) : isError ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between gap-3">
                  <span>{t("search.loadError")}</span>
                  <button
                    type="button"
                    onClick={() => refetch()}
                    className="min-h-11 shrink-0 font-medium underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {t("search.retry")}
                  </button>
                </AlertDescription>
              </Alert>
            ) : doctors.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {t("search.noResultsLong")}
                </AlertDescription>
              </Alert>
            ) : (
              <div className={cn("space-y-3", view === "grid" && "grid grid-cols-1 sm:grid-cols-2 gap-3 space-y-0")}>
                {doctors.map((d, i) => (
                  <DoctorCard
                    key={d.id}
                    doctor={d}
                    index={i}
                    boost={boosts?.[d.id]}
                    awardBadge={activeBadges.find((b) => b.doctor_id === d.id)}
                  />
                ))}
              </div>
            )}
            {!isLoading && !isError && (searchPage?.totalPages ?? 0) > 1 && (
              <nav
                className="mt-6 flex items-center justify-center gap-3"
                aria-label={t("search.results")}
              >
                <button
                  type="button"
                  disabled={searchPage?.first}
                  onClick={() => updateUrlState({ page: Math.max(0, urlState.page - 1) })}
                  className="inline-flex h-11 items-center gap-1 rounded-[10px] border border-border bg-card px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                  {t("common.previous")}
                </button>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {urlState.page + 1} / {searchPage?.totalPages}
                </span>
                <button
                  type="button"
                  disabled={searchPage?.last}
                  onClick={() => updateUrlState({ page: urlState.page + 1 })}
                  className="inline-flex h-11 items-center gap-1 rounded-[10px] border border-border bg-card px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t("common.next")}
                  <ChevronRight className="h-4 w-4" />
                </button>
              </nav>
            )}
          </div>
        </div>
      </main>

      <Footer />

      {showMap && (
        <Suspense fallback={null}>
          <DoctorsMapDialog
            open={showMap}
            onOpenChange={(open) => {
              setShowMap(open);
              if (!open && urlState.view === "map") {
                updateUrlState({ view: "list" }, true);
              }
            }}
            doctors={doctors.map((doctor) => ({
              ...doctor,
              specialty: doctor.specialty ?? "",
              experience_years: doctor.experience_years ?? 0,
              price_from: doctor.price_from ?? 0,
              profiles: doctor.profiles
                ? {
                    full_name: doctor.profiles.full_name ?? "",
                    avatar_url: doctor.profiles.avatar_url,
                  }
                : null,
              clinics: doctor.clinics
                ? {
                    ...doctor.clinics,
                    name: doctor.clinics.name ?? "",
                    city: doctor.clinics.city ?? "",
                  }
                : null,
            }))}
          />
        </Suspense>
      )}
    </div>
  );
};

export default Search;
