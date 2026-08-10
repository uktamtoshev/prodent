import { useEffect, useState, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Briefcase, MapPin, Search, Sofa } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { jobs, ListingFilters } from "@/lib/jobs";
import { JOBS_ROUTES } from "@/lib/jobs-routes";
import { JobsLocationSelect } from "@/components/jobs/JobsLocationSelect";
import {
  catLabel,
  empLabel,
  getCategoryOptions,
  getEmploymentOptions,
  salaryText,
} from "@/lib/jobs-constants";
import { EmptyState } from "@/components/jobs/JobsShared";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  listingFiltersFromSearchParams,
  listingFiltersToSearchParams,
} from "@/lib/jobs-navigation";

interface Listing {
  id: string;
  listing_type: string;
  category: string;
  title: string;
  description?: string;
  city?: string;
  employment_type?: string;
  clinic_name?: string;
  clinic_logo?: string;
  salary_min?: number | string | null;
  salary_max?: number | string | null;
  currency?: string | null;
  salary_mode?: string | null;
}

const TYPE_TABS = [
  { value: "", key: "jobs.feed.all" },
  { value: "vacancy", key: "jobs.feed.vacancies" },
  { value: "chair_rental", key: "jobs.feed.chairRental" },
];

export default function JobsFeed() {
  const { language, t } = useLanguage();
  const [items, setItems] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<ListingFilters>(() =>
    listingFiltersFromSearchParams(searchParams),
  );
  const [q, setQ] = useState(() => searchParams.get("q") || "");

  const load = useCallback(async (f: ListingFilters) => {
    setLoading(true);
    setError(null);
    try {
      const data = await jobs.listListings(f);
      setItems(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(filters); }, [filters, load]);
  useEffect(() => {
    const fromUrl = listingFiltersFromSearchParams(searchParams);
    setFilters((current) =>
      listingFiltersToSearchParams(current).toString() ===
      listingFiltersToSearchParams(fromUrl).toString()
        ? current
        : fromUrl,
    );
    setQ(searchParams.get("q") || "");
  }, [searchParams]);
  useEffect(() => {
    const next = listingFiltersToSearchParams(filters);
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [filters, searchParams, setSearchParams]);

  // Debounced search.
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => ({ ...f, q: q || undefined })), 350);
    return () => clearTimeout(t);
  }, [q]);

  const set = (patch: Partial<ListingFilters>) => setFilters((f) => ({ ...f, ...patch }));

  return (
    <div className="space-y-section">
      <header>
        <h1 className="font-heading text-xl font-bold tracking-tight text-foreground">
          {t("jobs.feed.title")}
        </h1>
      </header>
      {/* Показатель эталона «Открытых вакансий». Три остальных («Мои отклики»,
          «Приглашения клиник», «Просмотры резюме») живут в разделе «Мои» и
          требуют данных отклика и счётчика просмотров — в ленте их нет. */}
      <div className="mb-section max-w-[220px] rounded-panel border border-border bg-card px-card-x py-3">
        <p className="text-meta font-medium text-muted-foreground">{t("jobs.feed.openOffers")}</p>
        <p className="text-kpi tabular-nums font-heading">
          {loading ? "—" : items.length}
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      {/* Filters rail */}
      <aside className="space-y-section">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("jobs.feed.type")}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {TYPE_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => set({ listing_type: tab.value || undefined })}
                aria-pressed={(filters.listing_type || "") === tab.value}
                /* Форма вкладки как во всём кабинете. Раньше это были круглые
                   пилюли с заливкой бренда — они читались как кнопки действия,
                   а не как выбор одного среза ленты. */
                className={cn("cabinet-control inline-flex items-center rounded-t-field px-3 py-2 text-cell transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  (filters.listing_type || "") === tab.value
                    ? "border border-b-0 border-border bg-card font-semibold text-brand shadow-design-card"
                    : "font-medium text-muted-foreground hover:text-foreground")}
              >
                {t(tab.key)}
              </button>
            ))}
          </div>
        </div>

        <FilterSelect label={t("jobs.feed.specialty")} value={filters.category} onChange={(v) => set({ category: v })}
          options={getCategoryOptions(t)} />
        <FilterSelect label={t("jobs.feed.employment")} value={filters.employment_type} onChange={(v) => set({ employment_type: v })}
          options={getEmploymentOptions(t)} />
        <JobsLocationSelect
          variant="filter"
          region={filters.city}
          district={filters.district}
          onRegionChange={(v) => set({ city: v || undefined })}
          onDistrictChange={(v) => set({ district: v || undefined })}
        />
      </aside>

      {/* Feed */}
      <section className="min-w-0 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
            <Input
              className="pl-9"
              placeholder={t("jobs.feed.searchPlaceholder")}
              aria-label={t("jobs.feed.searchPlaceholder")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <select
            value={filters.sort || ""}
            onChange={(e) => set({ sort: e.target.value || undefined })}
            className="h-10 rounded-prodent-input border border-border bg-card px-3 text-sm text-foreground outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20 sm:w-52"
            aria-label={t("jobs.feed.sortLabel")}
          >
            <option value="">{t("jobs.feed.sortNew")}</option>
            <option value="cheap">{t("jobs.feed.sortCheap")}</option>
            <option value="expensive">{t("jobs.feed.sortExpensive")}</option>
          </select>
        </div>

        {loading ? (
          <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 w-full rounded-prodent" />)}</div>
        ) : error ? (
          <div role="alert" className="rounded-prodent border border-destructive/30 bg-destructive/5 p-5">
            <p className="font-semibold text-destructive">{t("jobs.feed.loadError")}</p>
            {error && <p className="mt-1 text-sm text-muted-foreground">{error}</p>}
            <button
              type="button"
              onClick={() => load(filters)}
              className="mt-3 min-h-11 rounded-prodent-btn bg-brand px-4 text-sm font-semibold text-white"
            >
              {t("jobs.feed.retry")}
            </button>
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title={t("jobs.feed.nothingFound")}
            hint={t("jobs.feed.changeFilters")}
          />
        ) : (
          <div className="space-y-3">
            {items.map((l) => (
              <ListingCard key={l.id} l={l} />
            ))}
          </div>
        )}
      </section>
      </div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: {
  label: string; value?: string; onChange: (v?: string) => void; options: { value: string; label: string }[];
}) {
  const { t } = useLanguage();
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <select
        aria-label={label}
        value={value || ""}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="h-10 w-full rounded-prodent-input border border-border bg-card px-3 text-sm text-foreground outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20"
      >
        <option value="">{t("jobs.feed.all")}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function ListingCard({ l }: { l: Listing }) {
  const { language, t } = useLanguage();
  const isRental = l.listing_type === "chair_rental";
  return (
    <Link
      to={JOBS_ROUTES.listing(l.id)}
      className="block overflow-hidden rounded-prodent border border-border bg-card p-4 shadow-design-card transition hover:border-brand/40 hover:shadow-medium"
    >
      <div className="flex flex-wrap items-start gap-3 sm:flex-nowrap">
        <div className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl",
          isRental ? "bg-warning-amber/10 text-warning-amber" : "bg-brand-50 text-brand-700")}>
          {isRental ? <Sofa className="h-5 w-5" /> : <Briefcase className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {catLabel(l.category, t)}
            </span>
            {l.employment_type && (
              <span className="text-xs text-muted-foreground">
                {empLabel(l.employment_type, t)}
              </span>
            )}
          </div>
          <h3 className="mt-1 truncate text-base font-semibold text-foreground">{l.title}</h3>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {l.clinic_name}
            {l.city && <span className="ml-2 inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{l.city}</span>}
          </p>
        </div>
        <div className="w-full min-w-0 pl-14 text-left sm:w-auto sm:shrink-0 sm:pl-0 sm:text-right">
          <p className="break-words text-sm font-bold text-brand-700">
            {salaryText(l, t, language)}
          </p>
        </div>
      </div>
    </Link>
  );
}
