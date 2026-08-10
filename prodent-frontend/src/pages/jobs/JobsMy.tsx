import { useEffect, useState, useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link, useSearchParams } from "react-router-dom";
import { Eye, MessageSquare, Pencil, Plus, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserRole } from "@/hooks/useUserRole";
import { jobs } from "@/lib/jobs";
import { JOBS_ROUTES } from "@/lib/jobs-routes";
import { catLabel, salaryText } from "@/lib/jobs-constants";
import { EmptyState, ErrorState } from "@/components/jobs/JobsShared";
import ApplicationsList from "@/components/jobs/ApplicationsList";
import ResumeEditor from "@/components/jobs/ResumeEditor";
import { jobsMessagesPath, normalizeJobsMyTab } from "@/lib/jobs-navigation";

const CLINIC_ROLES = new Set(["super_admin", "admin", "clinic_admin", "clinic_manager"]);

interface MyListing {
  id: string;
  category: string;
  status: string;
  is_published?: boolean;
  title: string;
  applications_count?: number;
  new_applications_count?: number;
  salary_min?: number | string | null;
  salary_max?: number | string | null;
  currency?: string | null;
  salary_mode?: string | null;
}

export default function JobsMy() {
  const { t } = useLanguage();
  const { role } = useUserRole();
  const isClinic = !!role && CLINIC_ROLES.has(role);
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = normalizeJobsMyTab(searchParams.get("tab"), isClinic);
  const messagesPath = jobsMessagesPath(role);
  const setTab = (value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", value);
    setSearchParams(next, { replace: true });
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-xl font-bold tracking-tight text-foreground">{t("jobs.feed.myTitle")}</h1>
        {messagesPath && (
          <Link to={messagesPath}>
            <Button variant="outline" className="min-h-11">
              <MessageSquare className="mr-2 h-4 w-4" />
              Центр сообщений
            </Button>
          </Link>
        )}
      </div>
      {isClinic
        ? <ClinicView tab={tab} onTabChange={setTab} />
        : <SeekerView tab={tab} onTabChange={setTab} />}
    </div>
  );
}

// ── Clinic ──────────────────────────────────────────────────────────────────
function ClinicView({ tab, onTabChange }: { tab: string; onTabChange: (tab: string) => void }) {
  return (
    <Tabs value={tab} onValueChange={onTabChange}>
      <TabsList>
        <TabsTrigger value="listings">Мои объявления</TabsTrigger>
        <TabsTrigger value="applications">Кандидаты</TabsTrigger>
      </TabsList>
      <TabsContent value="listings" className="mt-4"><MyListings /></TabsContent>
      <TabsContent value="applications" className="mt-4"><ApplicationsList role="clinic" /></TabsContent>
    </Tabs>
  );
}

function MyListings() {
  const [items, setItems] = useState<MyListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await jobs.myListings();
      setItems(Array.isArray(data) ? data as MyListing[] : []);
    } catch (e: unknown) {
      setError((e instanceof Error ? e.message : undefined) || "Не удалось загрузить объявления");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const close = async (id: string) => {
    if (!confirm("Закрыть объявление?")) return;
    try { await jobs.closeListing(id); toast.success("Объявление закрыто"); load(); }
    catch (e: unknown) { toast.error((e instanceof Error ? e.message : undefined) || "Ошибка"); }
  };

  if (loading) return <Skeleton className="h-40 w-full rounded-prodent" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (items.length === 0) return (
    <div className="space-y-4">
      <EmptyState title="Пока нет объявлений" hint="Опубликуйте первую вакансию или аренду кресла." />
      <Link to={JOBS_ROUTES.post()}><Button><Plus className="mr-1.5 h-4 w-4" />Разместить</Button></Link>
    </div>
  );

  return (
    <div className="space-y-3">
      {items.map((l) => (
        <div key={l.id} className="rounded-prodent border border-border bg-card p-4 shadow-design-card">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{catLabel(l.category)}</span>
                <StatusPill status={l.status} published={l.is_published} />
              </div>
              <h3 className="mt-1 truncate text-base font-semibold text-foreground">{l.title}</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">{salaryText(l)}</p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                Откликов: {l.applications_count}
                {l.new_applications_count > 0 && <span className="ml-1 font-semibold text-brand-700">(+{l.new_applications_count} новых)</span>}
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-1.5">
              <Link to={JOBS_ROUTES.listing(l.id)}><Button variant="outline" size="sm" className="min-h-11 min-w-11" aria-label="Открыть объявление"><Eye className="h-4 w-4" /></Button></Link>
              <Link to={JOBS_ROUTES.edit(l.id)}><Button variant="outline" size="sm" className="min-h-11 min-w-11" aria-label="Редактировать объявление"><Pencil className="h-4 w-4" /></Button></Link>
              {l.status !== "closed" && <Button variant="outline" size="sm" className="min-h-11 min-w-11" aria-label="Закрыть объявление" onClick={() => close(l.id)}><XCircle className="h-4 w-4 text-destructive" /></Button>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Seeker ──────────────────────────────────────────────────────────────────
function SeekerView({ tab, onTabChange }: { tab: string; onTabChange: (tab: string) => void }) {
  return (
    <Tabs value={tab} onValueChange={onTabChange}>
      <TabsList>
        <TabsTrigger value="resume">Моё резюме</TabsTrigger>
        <TabsTrigger value="listings">Мои объявления</TabsTrigger>
        <TabsTrigger value="candidates">Кандидаты</TabsTrigger>
        <TabsTrigger value="applications">Мои отклики</TabsTrigger>
      </TabsList>
      <TabsContent value="resume" className="mt-4"><ResumeEditor /></TabsContent>
      <TabsContent value="listings" className="mt-4"><MyListings /></TabsContent>
      <TabsContent value="candidates" className="mt-4"><ApplicationsList role="clinic" /></TabsContent>
      <TabsContent value="applications" className="mt-4"><ApplicationsList role="seeker" /></TabsContent>
    </Tabs>
  );
}

function StatusPill({ status, published }: { status: string; published?: boolean }) {
  if (published === false) return <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">скрыто модератором</span>;
  const map: Record<string, string> = {
    draft: "bg-muted text-muted-foreground", published: "bg-success-green/15 text-success-green",
    paused: "bg-warning-amber/10 text-warning-amber", closed: "bg-muted text-muted-foreground/70",
  };
  const label: Record<string, string> = { draft: "черновик", published: "опубликовано", paused: "на паузе", closed: "закрыто" };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${map[status] || "bg-muted"}`}>{label[status] || status}</span>;
}
