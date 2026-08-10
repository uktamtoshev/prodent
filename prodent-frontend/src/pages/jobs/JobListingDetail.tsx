import { useCallback, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Briefcase, Building2, Clock, MapPin, Phone, Sofa } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserRole } from "@/hooks/useUserRole";
import { jobs } from "@/lib/jobs";
import { JOBS_ROUTES } from "@/lib/jobs-routes";
import { catLabel, coopLabel, empLabel, salaryText } from "@/lib/jobs-constants";
import { ReportButton } from "@/components/jobs/JobsShared";
import { canShowJobContacts } from "@/lib/jobs-access";

interface ListingDetail {
  id: string;
  listing_type: string;
  category: string;
  title: string;
  clinic_name?: string | null;
  city?: string | null;
  employment_type?: string | null;
  cooperation_type?: string | null;
  description?: string | null;
  requirements?: string | null;
  can_see_contacts?: boolean;
  contact_phone?: string | null;
  contact_name?: string | null;
  is_owner?: boolean;
  has_applied?: boolean;
  salary_min?: number | string | null;
  salary_max?: number | string | null;
  currency?: string | null;
  salary_mode?: string | null;
}

export default function JobListingDetail() {
  const { id = "" } = useParams();
  const { role } = useUserRole();
  const [l, setL] = useState<ListingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [cover, setCover] = useState("");
  const [applying, setApplying] = useState(false);

  const isSeeker = role === "doctor";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setL(await jobs.getListing(id) as ListingDetail);
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : undefined) || "Не удалось загрузить вакансию");
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => { if (id) load(); }, [id, load]);

  const apply = async () => {
    setApplying(true);
    try {
      await jobs.apply(id, cover.trim() || undefined);
      toast.success("Отклик отправлен!");
      setCover("");
      await load();
    } catch (e: unknown) {
      toast.error((e instanceof Error ? e.message : undefined) || "Не удалось откликнуться");
    } finally {
      setApplying(false);
    }
  };

  if (loading) return <Skeleton className="h-96 w-full rounded-prodent" />;
  if (!l) return <p className="text-muted-foreground">Вакансия не найдена.</p>;

  const isRental = l.listing_type === "chair_rental";

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link to={JOBS_ROUTES.feed()} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> К вакансиям
      </Link>

      <div className="rounded-prodent border border-border bg-card p-4 shadow-design-card sm:p-6">
        <div className="flex items-start gap-4">
          <div className={`grid h-14 w-14 shrink-0 place-items-center rounded-prodent ${isRental ? "bg-warning-amber/10 text-warning-amber" : "bg-brand-50 text-brand-700"}`}>
            {isRental ? <Sofa className="h-6 w-6" /> : <Briefcase className="h-6 w-6" />}
          </div>
          <div className="min-w-0 flex-1">
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">{catLabel(l.category)}</span>
            <h1 className="leading-tight font-heading text-xl font-bold tracking-tight text-foreground">{l.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="min-w-0 break-words"><Building2 className="mr-1 inline h-4 w-4" />{l.clinic_name}</span>
              {l.city && <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" />{l.city}</span>}
              {l.employment_type && <span className="inline-flex items-center gap-1"><Clock className="h-4 w-4" />{empLabel(l.employment_type)}</span>}
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <Stat label="Условия" value={salaryText(l)} />
          {l.cooperation_type && <Stat label="Сотрудничество" value={coopLabel(l.cooperation_type)} />}
        </div>

        {l.description && (
          <Section title="Описание"><p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground [overflow-wrap:anywhere]">{l.description}</p></Section>
        )}
        {l.requirements && (
          <Section title="Требования"><p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground [overflow-wrap:anywhere]">{l.requirements}</p></Section>
        )}

        {canShowJobContacts(l.can_see_contacts) && (l.contact_phone || l.contact_name) && (
          <Section title="Контакты">
            <p className="flex min-w-0 flex-wrap items-center gap-2 break-words text-sm font-medium text-foreground [overflow-wrap:anywhere]">
              <Phone className="h-4 w-4 text-brand" />
              {l.contact_name ? `${l.contact_name}: ` : ""}{l.contact_phone}
            </p>
          </Section>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-4">
          <ReportButton targetType="listing" targetId={l.id} />
        </div>
      </div>

      {/* Apply box (doctors only, not the owner, not already applied) */}
      {isSeeker && !l.is_owner && (
        <div className="rounded-prodent border border-border bg-card p-4 shadow-design-card sm:p-6">
          {l.has_applied ? (
            <p className="text-sm font-medium text-success-green">✓ Вы уже откликнулись на эту вакансию. Статус — в разделе «Мои».</p>
          ) : (
            <>
              <h2 className="text-base font-semibold text-foreground">Откликнуться</h2>
              <Textarea className="mt-3" rows={4} placeholder="Сопроводительное сообщение (необязательно)…"
                value={cover} onChange={(e) => setCover(e.target.value)} />
              <Button className="mt-3" onClick={apply} disabled={applying}>
                {applying ? "Отправка…" : "Отправить отклик"}
              </Button>
            </>
          )}
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
