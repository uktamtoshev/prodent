import { useEffect, useState, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { Briefcase, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { jobs } from "@/lib/jobs";
import { JOBS_ROUTES } from "@/lib/jobs-routes";
import { APPLICATION_STATUS_LABELS } from "@/lib/jobs-constants";
import { ApplicationProgress, ApplicationTimeline, EmptyState, ErrorState } from "@/components/jobs/JobsShared";
import { cn } from "@/lib/utils";

interface JobApplication {
  id: string;
  status: string;
  applicant_photo?: string | null;
  applicant_name?: string | null;
  listing_title?: string | null;
  clinic_name?: string | null;
  direction?: string | null;
  cover_message?: string | null;
  rejection_reason?: string | null;
  events?: unknown[];
  created_at?: string | null;
  seeker_profile_id?: string | null;
  listing_id?: string | null;
}

// Status actions a clinic may apply at each stage.
const CLINIC_NEXT: Record<string, { to: string; label: string }[]> = {
  new: [{ to: "viewed", label: "Просмотрено" }, { to: "shortlisted", label: "В шорт-лист" }, { to: "rejected", label: "Отклонить" }],
  viewed: [{ to: "shortlisted", label: "В шорт-лист" }, { to: "interview", label: "На собеседование" }, { to: "rejected", label: "Отклонить" }],
  shortlisted: [{ to: "interview", label: "На собеседование" }, { to: "offer", label: "Сделать оффер" }, { to: "rejected", label: "Отклонить" }],
  interview: [{ to: "offer", label: "Сделать оффер" }, { to: "rejected", label: "Отклонить" }],
  offer: [{ to: "accepted", label: "Принять" }, { to: "rejected", label: "Отклонить" }],
};
const seekerNext = (status: string) => {
  const out: { to: string; label: string }[] = [];
  if (status === "offer") out.push({ to: "accepted", label: "Принять оффер" });
  if (!["accepted", "rejected", "withdrawn"].includes(status)) out.push({ to: "withdrawn", label: "Отозвать" });
  return out;
};

/**
 * "Мои отклики" (seeker) / "Отклики на вакансии" (clinic) — a self-contained
 * block: loads the caller's applications, lets them filter by status and drive
 * the funnel. Reused by the standalone page and the "Мои" hub.
 */
export default function ApplicationsList({ role }: { role: "clinic" | "seeker" }) {
  const [items, setItems] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await jobs.listApplications(role);
      setItems(Array.isArray(data) ? data as JobApplication[] : []);
    } catch (e: unknown) {
      setError((e instanceof Error ? e.message : undefined) || "Не удалось загрузить отклики");
    } finally { setLoading(false); }
  }, [role]);
  useEffect(() => { load(); }, [load]);

  const act = async (id: string, to: string) => {
    let reason: string | undefined;
    if (to === "rejected") reason = prompt("Причина отказа (необязательно):") || undefined;
    setBusy(id);
    try { await jobs.transitionApplication(id, to, reason); toast.success("Статус обновлён"); load(); }
    catch (e: unknown) { toast.error((e instanceof Error ? e.message : undefined) || "Не удалось обновить"); }
    finally { setBusy(null); }
  };

  // Status chips: only statuses actually present, plus counts.
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const a of items) m[a.status] = (m[a.status] || 0) + 1;
    return m;
  }, [items]);
  const shown = filter === "all" ? items : items.filter((a) => a.status === filter);

  if (loading) return <Skeleton className="h-40 w-full rounded-prodent" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (items.length === 0) return (
    <EmptyState
      title={role === "clinic" ? "Откликов пока нет" : "Вы ещё не откликались"}
      hint={role === "clinic"
        ? "Они появятся, когда кандидаты откликнутся на ваши вакансии."
        : "Найдите подходящую вакансию в разделе «Вакансии» и откликнитесь."} />
  );

  return (
    <div className="space-y-4">
      {/* Status filter */}
      <div className="flex flex-wrap gap-1.5">
        <Chip active={filter === "all"} onClick={() => setFilter("all")} label={`Все (${items.length})`} />
        {Object.keys(counts).map((s) => (
          <Chip key={s} active={filter === s} onClick={() => setFilter(s)}
            label={`${APPLICATION_STATUS_LABELS[s] || s} (${counts[s]})`} />
        ))}
      </div>

      <div className="space-y-3">
        {shown.map((a) => {
          const actions = role === "clinic" ? (CLINIC_NEXT[a.status] || []) : seekerNext(a.status);
          return (
            <div key={a.id} className="rounded-prodent border border-border bg-card p-4 shadow-design-card">
              <div className="grid min-w-0 grid-cols-[44px_minmax(0,1fr)] items-start gap-3 sm:flex">
                {role === "clinic" ? (
                  a.applicant_photo
                    ? <img src={a.applicant_photo} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
                    : <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground/70"><UserRound className="h-5 w-5" /></div>
                ) : (
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700"><Briefcase className="h-5 w-5" /></div>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-semibold text-foreground">
                    {role === "clinic" ? (a.applicant_name || "Кандидат") : (a.listing_title || a.clinic_name)}
                  </h3>
                  <p className="truncate text-sm text-muted-foreground">
                    {role === "clinic" ? (a.listing_title || "—") : a.clinic_name}
                    {a.direction === "clinic_to_seeker" && <span className="ml-2 rounded bg-tashkent-sky/10 px-1.5 py-0.5 text-xs font-medium text-tashkent-sky">приглашение</span>}
                  </p>
                  {a.cover_message && <p className="mt-1.5 break-words rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground [overflow-wrap:anywhere]">{a.cover_message}</p>}
                  {a.rejection_reason && a.status === "rejected" && <p className="mt-1 break-words text-xs text-destructive [overflow-wrap:anywhere]">Причина: {a.rejection_reason}</p>}
                  <div className="mt-3"><ApplicationProgress status={a.status} /></div>
                  <ApplicationTimeline events={a.events} createdAt={a.created_at} status={a.status} />
                </div>
                <div className="col-span-2 flex min-w-0 flex-wrap gap-3 sm:col-auto sm:shrink-0 sm:flex-col sm:items-end sm:gap-1.5">
                  {role === "clinic" && a.seeker_profile_id && (
                    <Link to={JOBS_ROUTES.resume(a.seeker_profile_id)} className="text-xs text-brand-700 hover:underline">Резюме →</Link>
                  )}
                  {role === "seeker" && a.listing_id && (
                    <Link to={JOBS_ROUTES.listing(a.listing_id)} className="text-xs text-brand-700 hover:underline">Вакансия →</Link>
                  )}
                </div>
              </div>
              {actions.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-border/60 pt-3">
                  {actions.map((a2) => (
                    <Button key={a2.to} size="sm"
                      className="max-w-full whitespace-normal"
                      variant={a2.to === "rejected" || a2.to === "withdrawn" ? "outline" : "default"}
                      disabled={busy === a.id}
                      onClick={() => act(a.id, a2.to)}>
                      {a2.label}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick}
      className={cn("min-h-11 rounded-full px-3 py-1.5 text-sm font-medium transition",
        active ? "bg-brand text-white shadow-design-btn" : "bg-card text-muted-foreground ring-1 ring-border hover:bg-muted/50")}>
      {label}
    </button>
  );
}
