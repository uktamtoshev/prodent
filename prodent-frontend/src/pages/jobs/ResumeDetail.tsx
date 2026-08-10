import { useCallback, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, MapPin, Phone, Plane, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserRole } from "@/hooks/useUserRole";
import { jobs } from "@/lib/jobs";
import { JOBS_ROUTES } from "@/lib/jobs-routes";
import {
  catLabel, coopLabel, empLabel, SALARY_MODE_LABELS,
} from "@/lib/jobs-constants";
import { ReportButton } from "@/components/jobs/JobsShared";

const CLINIC_ROLES = new Set(["super_admin", "admin", "clinic_admin", "clinic_manager"]);

interface ResumeDetailData {
  id: string;
  category: string;
  headline?: string | null;
  full_name?: string | null;
  resolved_photo_url?: string | null;
  photo_url?: string | null;
  skills?: unknown;
  experience_years?: number | null;
  city?: string | null;
  relocation?: boolean | null;
  desired_cooperation_type?: string | null;
  desired_employment_type?: string | null;
  desired_salary?: number | null;
  currency?: string | null;
  salary_mode?: string | null;
  summary?: string | null;
  experience_text?: string | null;
  education_text?: string | null;
  can_see_contacts?: boolean;
  contact_phone?: string | null;
  is_owner?: boolean;
}

export default function ResumeDetail() {
  const { id = "" } = useParams();
  const { role } = useUserRole();
  const [r, setR] = useState<ResumeDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [inviting, setInviting] = useState(false);

  const isClinic = !!role && CLINIC_ROLES.has(role);

  const load = useCallback(async () => {
    setLoading(true);
    try { setR(await jobs.getResume(id) as ResumeDetailData); }
    catch (e: unknown) { toast.error((e instanceof Error ? e.message : undefined) || "Не удалось загрузить резюме"); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { if (id) load(); }, [id, load]);

  const invite = async () => {
    setInviting(true);
    try {
      await jobs.invite(id, undefined, msg.trim() || undefined);
      toast.success("Приглашение отправлено кандидату!");
      setMsg("");
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : undefined) || "Не удалось отправить приглашение");
    } finally {
      setInviting(false);
    }
  };

  if (loading) return <Skeleton className="h-96 w-full rounded-prodent" />;
  if (!r) return <p className="text-muted-foreground">Резюме не найдено или скрыто.</p>;

  const skills: string[] = Array.isArray(r.skills) ? r.skills : [];
  const photo = r.resolved_photo_url || r.photo_url;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link to={JOBS_ROUTES.resumes()} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> К резюме
      </Link>

      <div className="rounded-prodent border border-border bg-card p-4 shadow-design-card sm:p-6">
        <div className="flex items-start gap-4">
          {photo
            ? <img src={photo} alt="" className="h-16 w-16 rounded-full object-cover" />
            : <div className="grid h-16 w-16 place-items-center rounded-full bg-muted text-muted-foreground/70"><UserRound className="h-8 w-8" /></div>}
          <div className="min-w-0 flex-1">
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">{catLabel(r.category)}</span>
            <h1 className="font-heading text-xl font-bold tracking-tight text-foreground">{r.full_name || r.headline || "Соискатель"}</h1>
            <p className="break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">{r.headline}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {r.experience_years != null && <span>Опыт: {r.experience_years} лет</span>}
              {r.city && <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" />{r.city}</span>}
              {r.relocation && <span className="inline-flex items-center gap-1 text-success-green"><Plane className="h-4 w-4" />готов к переезду</span>}
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          {r.desired_cooperation_type && <Stat label="Желаемое сотрудничество" value={coopLabel(r.desired_cooperation_type)} />}
          {r.desired_employment_type && <Stat label="Занятость" value={empLabel(r.desired_employment_type)} />}
          {r.desired_salary != null && <Stat label="Ожидания по з/п" value={`${new Intl.NumberFormat("ru-RU").format(r.desired_salary)} ${r.currency || "UZS"}`} />}
          {r.salary_mode && SALARY_MODE_LABELS[r.salary_mode] && <Stat label="Формат" value={SALARY_MODE_LABELS[r.salary_mode]} />}
        </div>

        {r.summary && <Section title="О себе"><p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground [overflow-wrap:anywhere]">{r.summary}</p></Section>}
        {r.experience_text && <Section title="Опыт"><p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground [overflow-wrap:anywhere]">{r.experience_text}</p></Section>}
        {r.education_text && <Section title="Образование"><p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground [overflow-wrap:anywhere]">{r.education_text}</p></Section>}
        {skills.length > 0 && (
          <Section title="Навыки">
            <div className="flex flex-wrap gap-1.5">
              {skills.map((s, i) => <span key={i} className="rounded-full bg-brand-50 px-2.5 py-1 text-xs text-brand-700">{s}</span>)}
            </div>
          </Section>
        )}

        {r.can_see_contacts && r.contact_phone && (
          <Section title="Контакты">
            <p className="flex min-w-0 flex-wrap items-center gap-2 break-words text-sm font-medium text-foreground [overflow-wrap:anywhere]">
              <Phone className="h-4 w-4 text-brand" />{r.contact_phone}
            </p>
          </Section>
        )}

        <div className="mt-6 border-t border-border/60 pt-4">
          <ReportButton targetType="resume" targetId={r.id} />
        </div>
      </div>

      {isClinic && !r.is_owner && (
        <div className="rounded-prodent border border-border bg-card p-4 shadow-design-card sm:p-6">
          <h2 className="text-base font-semibold text-foreground">Пригласить кандидата</h2>
          <Textarea className="mt-3" rows={3} placeholder="Сообщение кандидату (необязательно)…" value={msg} onChange={(e) => setMsg(e.target.value)} />
          <Button className="mt-3" onClick={invite} disabled={inviting}>{inviting ? "Отправка…" : "Отправить приглашение"}</Button>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 max-w-full rounded-xl bg-muted/50 px-4 py-2.5">
      <p className="text-xs uppercase tracking-wide text-muted-foreground/70">{label}</p>
      <p className="break-words text-sm font-semibold text-foreground [overflow-wrap:anywhere]">{value}</p>
    </div>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <h2 className="mb-1.5 text-sm font-semibold uppercase tracking-wide text-muted-foreground/70">{title}</h2>
      {children}
    </div>
  );
}
