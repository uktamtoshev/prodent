import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { MapPin, Search, UserRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { jobs, ResumeFilters } from "@/lib/jobs";
import { JOBS_ROUTES } from "@/lib/jobs-routes";
import { JobsLocationSelect } from "@/components/jobs/JobsLocationSelect";
import { CATEGORY_OPTIONS, catLabel } from "@/lib/jobs-constants";
import { EmptyState, ErrorState } from "@/components/jobs/JobsShared";

interface Resume {
  id: string;
  category: string;
  headline?: string;
  full_name?: string;
  photo_url?: string;
  city?: string;
  experience_years?: number;
  is_open_to_work?: boolean;

}

export default function ResumesFeed() {
  const [items, setItems] = useState<Resume[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ResumeFilters>({ open_only: "1" });
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("new");

  const load = useCallback(async (f: ResumeFilters) => {
    setLoading(true);
    setError(null);
    try {
      const data = await jobs.listResumes(f);
      setItems(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      setError((e instanceof Error ? e.message : undefined) || "Не удалось загрузить резюме");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(filters); }, [filters, load]);
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => ({ ...f, q: q || undefined })), 350);
    return () => clearTimeout(t);
  }, [q]);

  const set = (patch: Partial<ResumeFilters>) => setFilters((f) => ({ ...f, ...patch }));

  // Client-side sort of the loaded page (the resumes API has no sort param).
  const visible = useMemo(() => {
    if (sort === "experience")
      return [...items].sort((a, b) => (b.experience_years || 0) - (a.experience_years || 0));
    if (sort === "name")
      return [...items].sort((a, b) =>
        (a.full_name || a.headline || "").localeCompare(b.full_name || b.headline || "", "ru"),
      );
    return items; // "new" — server order (created_at desc)
  }, [items, sort]);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-heading text-xl font-bold tracking-tight text-foreground">Резюме кандидатов</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {loading ? "Загрузка…" : `Найдено кандидатов: ${items.length}`}
        </p>
      </header>
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <aside className="space-y-5">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">Специальность</p>
          <select
            value={filters.category || ""}
            onChange={(e) => set({ category: e.target.value || undefined })}
            className="h-10 w-full rounded-prodent-input border border-border bg-card px-3 text-sm text-foreground outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20"
          >
            <option value="">Все</option>
            {CATEGORY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <JobsLocationSelect
          variant="filter"
          region={filters.city}
          district={filters.district}
          onRegionChange={(v) => set({ city: v || undefined })}
          onDistrictChange={(v) => set({ district: v || undefined })}
        />
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={filters.open_only === "1"}
            onChange={(e) => set({ open_only: e.target.checked ? "1" : undefined })} />
          Только открытые к работе
        </label>
      </aside>

      <section className="min-w-0 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
            <Input className="pl-9" placeholder="Поиск по резюме…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="h-10 rounded-prodent-input border border-border bg-card px-3 text-sm text-foreground outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20 sm:w-52"
            aria-label="Сортировка"
          >
            <option value="new">Сначала новые</option>
            <option value="experience">Больше опыта</option>
            <option value="name">По имени (А–Я)</option>
          </select>
        </div>

        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-prodent" />)}</div>
        ) : error ? (
          <ErrorState message={error} onRetry={() => load(filters)} />
        ) : items.length === 0 ? (
          <EmptyState title="Резюме не найдены" hint="Измените фильтры или загляните позже." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {visible.map((r) => (
              <Link key={r.id} to={JOBS_ROUTES.resume(r.id)}
                className="rounded-prodent border border-border bg-card p-4 shadow-design-card transition hover:border-brand/40 hover:shadow-medium">
                <div className="flex items-start gap-3">
                  {r.photo_url
                    ? <img src={r.photo_url} alt="" className="h-12 w-12 rounded-full object-cover" />
                    : <div className="grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground/70"><UserRound className="h-6 w-6" /></div>}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{catLabel(r.category)}</span>
                      {r.is_open_to_work && <span className="text-xs font-medium text-success-green">● открыт</span>}
                    </div>
                    <h3 className="mt-1 truncate text-sm font-semibold text-foreground">{r.full_name || r.headline || "Соискатель"}</h3>
                    <p className="truncate text-sm text-muted-foreground">{r.headline}</p>
                    <p className="mt-1 text-xs text-muted-foreground/70">
                      {r.experience_years != null && <span>Опыт: {r.experience_years} лет</span>}
                      {r.city && <span className="ml-2 inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{r.city}</span>}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
      </div>
    </div>
  );
}
