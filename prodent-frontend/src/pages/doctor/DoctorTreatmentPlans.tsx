import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useClinic } from "@/contexts/ClinicContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { DoctorLayout } from "@/components/doctor/DoctorLayout";
import { DoctorTopbar } from "@/components/doctor/DoctorTopbar";
import { DoctorTreatmentPlanCreateFlow } from "@/components/crm/treatment/DoctorTreatmentPlanCreateFlow";
import {
  ChevronRight,
  ClipboardList,
  Copy,
  Loader2,
  MoreHorizontal,
  Plus,
  Printer,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { InitialsAvatar as Avatar } from "@/components/shared/InitialsAvatar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { a11yLabel } from "@/lib/a11y-labels";

type TabKey = "active" | "draft" | "completed" | "all";

interface PlanRow {
  id: string;
  patient_id: string;
  doctor_id: string;
  clinic_id: string;
  title: string;
  description: string | null;
  status: string;
  total_cost: number | null;
  currency: string | null;
  created_at: string;
  updated_at: string;
}

interface PatientNameRow {
  id: string;
  full_name: string | null;
}

const fmtSum = (n: number | null | undefined) =>
  Math.round(n || 0).toLocaleString("ru-RU");

const statusGroup = (status: string): TabKey => {
  const s = status?.toUpperCase();
  if (s === "COMPLETED") return "completed";
  if (s === "DRAFT" || s === "PLANNED") return "draft";
  return "active";
};

const statusBadge = (
  status: string,
  labels: {
    completed: string;
    active: string;
    draft: string;
    planned: string;
    cancelled: string;
  }
) => {
  const s = status?.toUpperCase();
  if (s === "COMPLETED")
    return {
      label: labels.completed,
      cls:
        "bg-status-success-bg text-status-success ring-1 ring-status-success/30",
    };
  if (s === "ACTIVE" || s === "IN_PROGRESS")
    return {
      label: labels.active,
      cls: "bg-primary/10 text-primary ring-1 ring-primary/20",
    };
  if (s === "DRAFT")
    return {
      label: labels.draft,
      cls: "bg-status-warning-bg text-status-warning ring-1 ring-status-warning/30",
    };
  if (s === "PLANNED")
    return {
      label: labels.planned,
      cls: "bg-status-info-bg text-status-info ring-1 ring-status-info/30",
    };
  if (s === "CANCELLED")
    return {
      label: labels.cancelled,
      cls: "bg-status-danger-bg text-status-danger ring-1 ring-status-danger/30",
    };
  return {
    label: status || "—",
    cls: "bg-muted text-muted-foreground ring-1 ring-border",
  };
};

export default function DoctorTreatmentPlans() {
  const { user } = useAuth();
  const { clinics, currentClinic, loading: clinicsLoading } = useClinic();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const statusLabels = {
    completed: t("doctorTreatmentPlans.statusCompleted"),
    active: t("doctorTreatmentPlans.statusActive"),
    draft: t("doctorTreatmentPlans.statusDraft"),
    planned: t("doctorTreatmentPlans.statusPlanned"),
    cancelled: t("doctorTreatmentPlans.statusCancelled"),
  };
  const [tab, setTab] = useState<TabKey>("active");
  const [query, setQuery] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const { data: doctor, isLoading: doctorLoading } = useQuery({
    queryKey: ["current-doctor", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("doctors")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: plans, isLoading, refetch: refetchPlans } = useQuery({
    queryKey: ["treatment-plans", doctor?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("treatment_plans")
        .select("*")
        .eq("doctor_id", doctor!.id)
        .order("updated_at", { ascending: false });
      return (data || []) as PlanRow[];
    },
    enabled: !!doctor?.id,
  });

  const { data: patientNames } = useQuery({
    queryKey: ["plan-patient-names", plans?.map((p) => p.patient_id).join(",")],
    queryFn: async () => {
      const ids = [...new Set((plans || []).map((p) => p.patient_id))];
      if (ids.length === 0) return {} as Record<string, string>;
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", ids);
      const out: Record<string, string> = {};
      (profiles as PatientNameRow[] | null)?.forEach((profile: PatientNameRow) => {
        out[profile.id] = profile.full_name || t("doctorTreatmentPlans.patient");
      });
      return out;
    },
    enabled: !!plans && plans.length > 0,
  });

  const counts = useMemo(() => {
    const c = { all: 0, active: 0, draft: 0, completed: 0 };
    plans?.forEach((p) => {
      c.all++;
      const g = statusGroup(p.status);
      c[g]++;
    });
    return c;
  }, [plans]);

  const filtered = useMemo(() => {
    if (!plans) return [];
    return plans.filter((p) => {
      const matchTab = tab === "all" || statusGroup(p.status) === tab;
      const q = query.toLowerCase().trim();
      const patient = (patientNames?.[p.patient_id] || "").toLowerCase();
      const matchQ =
        !q ||
        p.title.toLowerCase().includes(q) ||
        patient.includes(q) ||
        (p.description || "").toLowerCase().includes(q);
      return matchTab && matchQ;
    });
  }, [plans, tab, query, patientNames]);

  const openCreatePlan = () => {
    if (!doctor?.id) {
      toast.error(t("common.error"));
      return;
    }
    if (clinics.length === 0) {
      toast.error(t("crmTreatmentForm.clinicNotSelected"));
      return;
    }
    setCreateDialogOpen(true);
  };

  return (
    <DoctorLayout>
      <DoctorTopbar
        title={t("doctorTreatmentPlans.title")}
        subtitle={t("doctorTreatmentPlans.subtitle")}
      />
      <div className="space-y-4 px-6 py-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="cabinet-page-title font-heading text-xl font-bold tracking-tight text-foreground">
              {t("doctorTreatmentPlans.heading")}
            </h1>
            <p className="mt-0.5 text-meta text-muted-foreground">
              {counts.all} {t("doctorTreatmentPlans.stats")}{" "}
              <span className="tabular-nums">{counts.active}</span>
            </p>
          </div>

        {/* Показатели планов. Считаются из уже загруженного списка. Двух
            эталонных здесь нет: «Сумма в работе» и «Просроченных этапов»
            требуют стоимости плана и сроков этапов, которых в списке не
            приходит — показывать их нулями значит вводить в заблуждение. */}
        <div className="grid grid-cols-3 gap-section sm:max-w-lg">
          {([
            { label: t("doctorTreatmentPlans.tabActive"), value: counts.active },
            { label: t("doctorTreatmentPlans.tabDraft"), value: counts.draft },
            { label: t("doctorTreatmentPlans.tabCompleted"), value: counts.completed },
          ]).map((kpi) => (
            <div key={kpi.label} className="rounded-panel border border-border bg-card px-card-x py-3">
              <p className="text-meta font-medium text-muted-foreground">{kpi.label}</p>
              <p className="text-kpi tabular-nums font-heading">{kpi.value}</p>
            </div>
          ))}
        </div>
          <div className="flex items-center gap-2">
            <button
              onClick={openCreatePlan}
              disabled={doctorLoading || clinicsLoading}
              className="inline-flex items-center gap-1.5 rounded-prodent-input bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              {t("doctorTreatmentPlans.newPlan")}
            </button>
          </div>
        </div>

        {/* Filter card */}
        <div className="overflow-hidden rounded-prodent border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
            <div className="flex items-center gap-0.5 rounded-prodent-input bg-muted p-0.5">
              {(
                [
                  { k: "active" as const, label: t("doctorTreatmentPlans.tabActive"), count: counts.active },
                  { k: "draft" as const, label: t("doctorTreatmentPlans.tabDraft"), count: counts.draft },
                  {
                    k: "completed" as const,
                    label: t("doctorTreatmentPlans.tabCompleted"),
                    count: counts.completed,
                  },
                  { k: "all" as const, label: t("doctorTreatmentPlans.tabAll"), count: counts.all },
                ]
              ).map((t) => {
                const a = tab === t.k;
                return (
                  <button
                    key={t.k}
                    onClick={() => setTab(t.k)}
                    className={cn(
                      // Форма вкладки как во всём кабинете: язычок на карточке
                      // с рамкой. Своя высота 8 и радиус 8px тратили бюджет
                      // произвольных размеров и расходились с остальными срезами.
                      "cabinet-control flex items-center gap-1.5 rounded-t-field px-3 py-2 text-cell transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      a
                        ? "border border-b-0 border-border bg-card font-semibold text-primary shadow-soft"
                        : "font-medium text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {t.label}
                    <span
                      className={cn(
                        "text-xs tabular-nums",
                        a ? "text-primary" : "text-muted-foreground"
                      )}
                    >
                      {t.count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="relative min-w-[240px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("doctorTreatmentPlans.searchPlaceholder")}
                className="cabinet-control h-ctl w-full rounded-field border border-border bg-card pl-9 pr-3 text-base md:text-cell focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* List */}
          {isLoading ? (
            <div className="flex h-[240px] items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <ClipboardList className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
              <div className="font-heading text-base font-semibold text-foreground">
                {plans && plans.length > 0
                  ? t("doctor.nothingFound")
                  : t("doctorTreatmentPlans.noPlans")}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {plans && plans.length > 0
                  ? t("doctorTreatmentPlans.tryFilters")
                  : t("doctorTreatmentPlans.noPlansDesc")}
              </div>
              <button
                onClick={openCreatePlan}
                disabled={doctorLoading || clinicsLoading}
                className="mt-4 inline-flex items-center gap-1.5 rounded-prodent-input bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                {t("doctorTreatmentPlans.newPlan")}
              </button>
            </div>
          ) : (
            <ul>
              {filtered.map((p) => {
                const patientName = patientNames?.[p.patient_id] || t("doctorTreatmentPlans.patient");
                const badge = statusBadge(p.status, statusLabels);
                return (
                  <li
                    key={p.id}
                    onClick={() => navigate(`/doctor/treatment-plans/${p.id}`)}
                    className="group flex cursor-pointer items-center gap-4 border-b border-border px-card-x py-2.5 transition last:border-b-0 hover:bg-muted/50"
                  >
                    <Avatar name={patientName} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-heading text-base font-semibold text-foreground group-hover:text-primary">
                          {p.title}
                        </span>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wider",
                            badge.cls
                          )}
                        >
                          {badge.label}
                        </span>
                      </div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {patientName}
                        {p.description && (
                          <span className="ml-1 text-muted-foreground">
                            · {p.description}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="hidden text-right md:block">
                      <div className="font-heading text-base font-bold tabular-nums text-foreground">
                        {fmtSum(p.total_cost)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {p.currency || "UZS"}
                      </div>
                    </div>
                    <div className="hidden text-right md:block">
                      <div className="text-xs text-foreground">
                        {format(new Date(p.updated_at), "d MMM yyyy", {
                          locale: ru,
                        })}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {t("doctorTreatmentPlans.updated")}
                      </div>
                    </div>
                    <div
                      className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            title={t("doctor.more")}
                            className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                           aria-label={a11yLabel("more")}>
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/doctor/treatment-plans/${p.id}`)}>
                            <ClipboardList className="mr-2 h-4 w-4" /> {t("doctorTreatmentPlans.openPlan")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toast.info(t("doctorTreatmentPlans.printPlanComingSoon"))}>
                            <Printer className="mr-2 h-4 w-4" /> {t("doctor.print")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toast.info(t("doctorTreatmentPlans.duplicateComingSoon"))}>
                            <Copy className="mr-2 h-4 w-4" /> {t("doctor.duplicate")}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => toast.info(t("doctorTreatmentPlans.deleteComingSoon"))}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> {t("doctor.delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50 group-hover:text-muted-foreground" />
                  </li>
                );
              })}
            </ul>
          )}

          <div className="border-t border-border px-5 py-2.5 text-xs text-muted-foreground">
            {t("doctor.shown")}{" "}
            <b className="tabular-nums text-foreground">{filtered.length}</b> {t("doctor.of")}{" "}
            {plans?.length || 0}
          </div>
        </div>
      </div>
      {doctor?.id && (
        <DoctorTreatmentPlanCreateFlow
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          doctorId={doctor.id}
          clinics={clinics.map(({ id, name }) => ({ id, name }))}
          initialClinicId={currentClinic?.id}
          onSuccess={() => {
            void refetchPlans();
          }}
        />
      )}
    </DoctorLayout>
  );
}
