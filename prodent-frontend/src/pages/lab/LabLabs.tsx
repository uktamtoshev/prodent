import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Building2,
  ChevronDown,
  ChevronUp,
  Loader2,
  MapPin,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  Star,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { lab, type LabTechnician, type LabServiceItem } from "@/lib/lab";
import { LAB_ROUTES } from "@/lib/lab-routes";

const money = (v: number | null): string =>
  v == null ? "—" : `${v.toLocaleString("ru-RU")} сум`;

type SortKey = "verified" | "name" | "services";

const SELECT_CLS =
  "h-10 rounded-prodent-input border border-border bg-card px-3 text-sm text-foreground outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20";

// Лаборатория › Лаборатории — catalog of technicians/labs the clinic or doctor
// can order from. Reads the same secure lab API (/api/v1/lab) the create-order
// picker uses (listTechnicians + technicianServices) — no PII leak, scope-safe.
export default function LabLabs() {
  const [techs, setTechs] = useState<LabTechnician[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [sort, setSort] = useState<SortKey>("verified");
  const [tab, setTab] = useState<"all" | "mine">("all");

  const [openId, setOpenId] = useState<string | null>(null);
  const [services, setServices] = useState<Record<string, LabServiceItem[]>>({});
  const [servicesLoading, setServicesLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTechs(await lab.listTechnicians());
    } catch (e: unknown) {
      setError((e instanceof Error ? (e instanceof Error ? e.message : undefined) : undefined) || "Не удалось загрузить лаборатории");
      setTechs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = useCallback(
    async (id: string) => {
      if (openId === id) {
        setOpenId(null);
        return;
      }
      setOpenId(id);
      if (!services[id]) {
        setServicesLoading(id);
        try {
          const list = await lab.technicianServices(id);
          setServices((prev) => ({ ...prev, [id]: list }));
        } catch {
          setServices((prev) => ({ ...prev, [id]: [] }));
        } finally {
          setServicesLoading(null);
        }
      }
    },
    [openId, services],
  );

  // Optimistic favorite toggle — updates the card immediately, reverts on error.
  const toggleFavorite = useCallback(async (t: LabTechnician) => {
    const next = !t.is_favorite;
    setTechs((prev) => prev.map((x) => (x.id === t.id ? { ...x, is_favorite: next } : x)));
    try {
      if (next) await lab.addFavorite(t.id);
      else await lab.removeFavorite(t.id);
    } catch {
      setTechs((prev) => prev.map((x) => (x.id === t.id ? { ...x, is_favorite: !next } : x)));
    }
  }, []);

  const favCount = useMemo(() => techs.filter((t) => t.is_favorite).length, [techs]);

  const allCities = useMemo(
    () =>
      Array.from(new Set(techs.map((t) => t.city).filter(Boolean))).sort((a, b) =>
        String(a).localeCompare(String(b), "ru"),
      ) as string[],
    [techs],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = techs.filter((t) => {
      const matchQ =
        !q ||
        [t.full_name, t.city, t.address, t.description]
          .filter(Boolean)
          .some((f) => String(f).toLowerCase().includes(q));
      const matchCity = !cityFilter || t.city === cityFilter;
      const matchTab = tab === "all" || !!t.is_favorite;
      return matchQ && matchCity && matchTab;
    });
    const byName = (a: LabTechnician, b: LabTechnician) =>
      (a.full_name || "").localeCompare(b.full_name || "", "ru");
    return [...filtered].sort((a, b) => {
      if (sort === "name") return byName(a, b);
      if (sort === "services") return (b.service_count || 0) - (a.service_count || 0);
      // "verified" (default): verified labs first, then alphabetical.
      const av = a.verified_at ? 1 : 0;
      const bv = b.verified_at ? 1 : 0;
      return av !== bv ? bv - av : byName(a, b);
    });
  }, [techs, query, cityFilter, sort, tab]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 font-heading text-xl font-bold tracking-tight text-foreground">
            <Building2 className="h-6 w-6" />
            Лаборатории
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Выберите зуботехника, посмотрите прайс-лист и создайте заказ.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative sm:w-60">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по имени, адресу, городу"
              className="pl-9"
            />
          </div>
          {allCities.length > 0 && (
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className={SELECT_CLS}
              aria-label="Город"
            >
              <option value="">Все города</option>
              {allCities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className={SELECT_CLS}
            aria-label="Сортировка"
          >
            <option value="verified">Сначала проверенные</option>
            <option value="name">По имени (А–Я)</option>
            <option value="services">Больше услуг</option>
          </select>
        </div>
      </div>

      {/* Мои лаборатории (избранные) / Все */}
      <div className="flex gap-1.5">
        {(["mine", "all"] as const).map((tk) => (
          <button
            key={tk}
            type="button"
            onClick={() => setTab(tk)}
            className={
              "rounded-full px-3.5 py-1.5 text-sm font-medium transition " +
              (tab === tk
                ? "bg-brand text-white shadow-design-btn"
                : "bg-card text-muted-foreground ring-1 ring-border hover:bg-muted/50")
            }
          >
            {tk === "mine"
              ? `Мои лаборатории${favCount ? ` (${favCount})` : ""}`
              : `Все (${techs.length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-brand" />
        </div>
      ) : error ? (
        <div className="rounded-prodent-input border border-destructive/30 bg-destructive/5 p-6 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={load}>
            Повторить
          </Button>
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-prodent-input border border-border bg-card p-10 text-center">
          <Building2 className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">
            {query.trim()
              ? "Ничего не найдено"
              : tab === "mine"
                ? "В «Мои лаборатории» пока пусто — отметьте ★ во вкладке «Все»"
                : "Пока нет доступных лабораторий"}
          </p>
          {tab === "mine" && !query.trim() && (
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setTab("all")}>
              Перейти ко «Все»
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((t) => {
            const open = openId === t.id;
            const svc = services[t.id];
            return (
              <div
                key={t.id}
                className="flex flex-col rounded-prodent-card border border-border bg-card p-4 shadow-design-card"
              >
                <div className="flex items-start gap-3">
                  {t.avatar_url ? (
                    <img
                      src={t.avatar_url}
                      alt={t.full_name || "Лаборатория"}
                      className="h-12 w-12 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700 font-semibold">
                      {(t.full_name || "?").charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate font-semibold text-foreground">
                        {t.full_name || "Без имени"}
                      </p>
                      {t.verified_at && (
                        <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-500" />
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      {t.city && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {t.city}
                        </span>
                      )}
                      {t.phone && (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {t.phone}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleFavorite(t)}
                    title={t.is_favorite ? "Убрать из «Мои лаборатории»" : "Добавить в «Мои лаборатории»"}
                    aria-pressed={!!t.is_favorite}
                    className="shrink-0 rounded-full p-1.5 transition-colors hover:bg-muted"
                  >
                    <Star
                      className={`h-5 w-5 ${t.is_favorite ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`}
                    />
                  </button>
                </div>

                {t.address && (
                  <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="mt-px h-3.5 w-3.5 shrink-0 text-brand-700" />
                    <span>{t.address}</span>
                  </p>
                )}

                {t.description && (
                  <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{t.description}</p>
                )}

                <button
                  type="button"
                  onClick={() => toggle(t.id)}
                  className="mt-3 inline-flex items-center gap-1 self-start text-sm font-medium text-brand-700 hover:underline"
                >
                  Прайс-лист{typeof t.service_count === "number" ? ` (${t.service_count})` : ""}
                  {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                {open && (
                  <div className="mt-2 rounded-prodent-input border border-border bg-muted/30 p-3">
                    {servicesLoading === t.id ? (
                      <div className="flex justify-center py-3">
                        <Loader2 className="h-4 w-4 animate-spin text-brand" />
                      </div>
                    ) : svc && svc.length > 0 ? (
                      <ul className="space-y-1.5">
                        {svc.map((s) => (
                          <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
                            <span className="truncate text-foreground">{s.work_type}</span>
                            <span className="shrink-0 font-medium text-foreground">
                              {money(s.price)}
                              <span className="text-xs text-muted-foreground"> / {s.unit}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="py-1 text-center text-xs text-muted-foreground">
                        Прайс-лист пуст
                      </p>
                    )}
                  </div>
                )}

                <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                  <Badge variant="outline" className="text-xs">
                    {t.verified_at ? "Проверен" : "Новый"}
                  </Badge>
                  <Button asChild size="sm">
                    <Link to={LAB_ROUTES.orders()}>
                      <Plus className="mr-1 h-4 w-4" />
                      Создать заказ
                    </Link>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
