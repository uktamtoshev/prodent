import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { jobs } from "@/lib/jobs";
import { JOBS_ROUTES } from "@/lib/jobs-routes";
import { catLabel } from "@/lib/jobs-constants";
import { EmptyState } from "@/components/jobs/JobsShared";

type JobsApiError = { message?: string } | Error | unknown;
type ModerationListing = {
  id: string;
  title?: string | null;
  category?: string | null;
  clinic_name?: string | null;
  is_published?: boolean | null;
};
type ModerationResume = {
  id: string;
  full_name?: string | null;
  headline?: string | null;
  category?: string | null;
  is_published?: boolean | null;
};
type ModerationReport = {
  id: string;
  target_type: "listing" | "resume";
  target_id: string;
  reason?: string | null;
};
type ModerationQueue = {
  listings: ModerationListing[];
  resumes: ModerationResume[];
};

const errorMessage = (error: JobsApiError, fallback = "Ошибка") =>
  error instanceof Error ? error.message : fallback;

export default function JobsModeration() {
  const [queue, setQueue] = useState<ModerationQueue>({ listings: [], resumes: [] });
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [q, r] = await Promise.all([jobs.moderationQueue(), jobs.listReports("open")]);
      setQueue(q as ModerationQueue); setReports(Array.isArray(r) ? (r as ModerationReport[]) : []);
    } catch (e: JobsApiError) { toast.error(errorMessage(e, "Ошибка загрузки")); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggleListing = async (id: string, publish: boolean) => {
    const reason = window.prompt(publish ? "Причина публикации:" : "Причина скрытия:")?.trim();
    if (!reason) { toast.error("Укажите причину решения"); return; }
    if (!publish && !window.confirm("Скрыть вакансию? Она пропадёт из поиска.")) return;
    try { await jobs.moderateListing(id, publish, reason); toast.success(publish ? "Опубликовано" : "Скрыто"); load(); }
    catch (e: JobsApiError) { toast.error(errorMessage(e)); }
  };
  const toggleResume = async (id: string, publish: boolean) => {
    const reason = window.prompt(publish ? "Причина публикации:" : "Причина скрытия:")?.trim();
    if (!reason) { toast.error("Укажите причину решения"); return; }
    if (!publish && !window.confirm("Скрыть резюме? Оно пропадёт из поиска.")) return;
    try { await jobs.moderateResume(id, publish, reason); toast.success(publish ? "Опубликовано" : "Скрыто"); load(); }
    catch (e: JobsApiError) { toast.error(errorMessage(e)); }
  };
  const resolve = async (id: string, status: "reviewed" | "dismissed") => {
    const action = status === "reviewed" ? "закрыть как обработанную" : "отклонить";
    const reason = window.prompt("Причина решения по жалобе:")?.trim();
    if (!reason) { toast.error("Укажите причину решения"); return; }
    if (!window.confirm(`Точно ${action} эту жалобу?`)) return;
    try { await jobs.resolveReport(id, status, reason); toast.success("Жалоба обработана"); load(); }
    catch (e: JobsApiError) { toast.error(errorMessage(e)); }
  };

  if (loading) return <Skeleton className="h-64 w-full rounded-prodent" />;

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-heading text-xl font-bold tracking-tight text-foreground">Модерация · Работа</h1>
      <Tabs defaultValue="reports">
        <TabsList className="h-auto w-full flex-wrap justify-start">
          <TabsTrigger value="reports">Жалобы {reports.length > 0 && <span className="ml-1 rounded-full bg-destructive px-1.5 text-xs text-white">{reports.length}</span>}</TabsTrigger>
          <TabsTrigger value="listings">Вакансии</TabsTrigger>
          <TabsTrigger value="resumes">Резюме</TabsTrigger>
        </TabsList>

        <TabsContent value="reports" className="mt-4 space-y-3">
          {reports.length === 0 ? <EmptyState title="Открытых жалоб нет" /> : reports.map((r) => (
            <div key={r.id} className="rounded-prodent border border-border bg-card p-4 shadow-design-card">
              <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                    {r.target_type === "listing" ? "вакансия" : "резюме"}
                  </span>
                  <p className="mt-1.5 break-words text-sm text-foreground [overflow-wrap:anywhere]">{r.reason}</p>
                  <Link
                    to={r.target_type === "listing" ? JOBS_ROUTES.listing(r.target_id) : JOBS_ROUTES.resume(r.target_id)}
                    className="mt-1 inline-block text-xs text-brand-700 hover:underline">
                    Открыть объект →
                  </Link>
                </div>
                <div className="flex flex-wrap gap-2 sm:shrink-0">
                  <Button size="sm" variant="outline" onClick={() => resolve(r.id, "dismissed")}>Отклонить</Button>
                  <Button size="sm" onClick={() => resolve(r.id, "reviewed")}>Обработано</Button>
                </div>
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="listings" className="mt-4 space-y-2">
          {queue.listings.map((l) => (
            <ModRow key={l.id} title={l.title} subtitle={`${catLabel(l.category)} · ${l.clinic_name || ""}`}
              published={l.is_published} onToggle={(p) => toggleListing(l.id, p)}
              href={JOBS_ROUTES.listing(l.id)} />
          ))}
        </TabsContent>

        <TabsContent value="resumes" className="mt-4 space-y-2">
          {queue.resumes.map((r) => (
            <ModRow key={r.id} title={r.full_name || r.headline || "Соискатель"} subtitle={catLabel(r.category)}
              published={r.is_published} onToggle={(p) => toggleResume(r.id, p)}
              href={JOBS_ROUTES.resume(r.id)} />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ModRow({ title, subtitle, published, onToggle, href }: {
  title: string; subtitle: string; published: boolean; onToggle: (p: boolean) => void; href: string;
}) {
  return (
    <div className="flex flex-col items-stretch gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
      <Link to={href} className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{title}</p>
        <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
      </Link>
      {published ? (
        <Button className="self-start sm:self-auto" size="sm" variant="outline" onClick={() => onToggle(false)}><EyeOff className="mr-1 h-4 w-4" />Скрыть</Button>
      ) : (
        <Button className="self-start sm:self-auto" size="sm" onClick={() => onToggle(true)}><Eye className="mr-1 h-4 w-4" />Показать</Button>
      )}
    </div>
  );
}
