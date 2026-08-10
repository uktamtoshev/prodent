import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { DoctorLayout } from "@/components/doctor/DoctorLayout";
import { DoctorTopbar } from "@/components/doctor/DoctorTopbar";
import { InitialsAvatar as Avatar } from "@/components/shared/InitialsAvatar";
import { cn } from "@/lib/utils";
import {
  Activity,
  AlertTriangle,
  Calendar,
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Download,
  Edit2,
  FileText,
  Home,
  Loader2,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Search,
  Stethoscope,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { toast } from "sonner";
import { AddMedicalConditionDialog } from "@/components/doctor/AddMedicalConditionDialog";
import { getPatientMedicalRecords } from "@/lib/medical-record-api";
import { medicalAccessApi } from "@/lib/medical-access-api";
import { formatPatientCardId } from "@/lib/accountId";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const fmtSum = (n: number | null | undefined) =>
  Math.round(n || 0).toLocaleString("ru-RU");

const TAB_KEYS = [
  "overview",
  "chart",
  "visits",
  "plan",
  "xray",
  "docs",
  "rx",
] as const;
type TabKey = (typeof TAB_KEYS)[number];

type PatientVisit = {
  id: string;
  appointment_date: string;
  start_time: string | null;
  service: string | null;
  status: string | null;
};

type PatientSummary = {
  id: string;
  full_name?: string | null;
  phone?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  avatar_url?: string | null;
  email?: string | null;
  address?: string | null;
};

type MedicalRecordRow = {
  id: string;
  appointment_id?: string | null;
  diagnosis?: string | null;
  treatment?: string | null;
  notes?: string | null;
  created_at?: string | null;
};

type TreatmentPlanSummary = {
  id: string;
  title?: string | null;
  status?: string | null;
  total_price?: number | null;
  created_at?: string | null;
};

type MedicalConditionRow = {
  id: string;
  title?: string | null;
  name?: string | null;
  description?: string | null;
  priority?: string | null;
};

const TAB_ICONS: Record<TabKey, LucideIcon> = {
  overview: Home,
  chart: Activity,
  visits: Clock,
  plan: ClipboardList,
  xray: Camera,
  docs: FileText,
  rx: Edit2,
};

export default function DoctorMedicalRecords() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const patientId = params.get("id");
  const { user } = useAuth();
  const { t } = useLanguage();

  if (!patientId) {
    return (
      <DoctorLayout>
        <DoctorTopbar
          title={t("doctorMedicalRecords.title")}
          subtitle={t("doctorMedicalRecords.selectFromBase")}
        />
        <PatientPicker userId={user?.id} onPick={(id) => setParams({ id })} />
      </DoctorLayout>
    );
  }

  return (
    <DoctorLayout>
      <DoctorTopbar
        title={t("doctorMedicalRecords.title")}
        subtitle={t("doctorMedicalRecords.patientCard")}
      />
      <PatientMedicalRecord
        patientId={patientId}
        userId={user?.id}
        onBack={() => setParams({})}
        onStartVisit={(visitId) => navigate(`/doctor/visit/${visitId}`)}
        onOpenPlan={(planId) => navigate(`/doctor/treatment-plans/${planId}`)}
      />
    </DoctorLayout>
  );
}

// ───────────────────────── PatientPicker ─────────────────────────
const PatientPicker = ({
  userId,
  onPick,
}: {
  userId?: string;
  onPick: (id: string) => void;
}) => {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");

  const {
    data: doctor,
    isLoading: isDoctorLoading,
    isError: isDoctorError,
    refetch: refetchDoctor,
  } = useQuery({
    queryKey: ["current-doctor", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doctors")
        .select("id")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  const {
    data: patients,
    isLoading: arePatientsLoading,
    isError: isPatientsError,
    refetch: refetchPatients,
  } = useQuery({
    queryKey: ["medical-records-patients", doctor?.id],
    queryFn: async () => {
      const { data: appts, error: appointmentsError } = await supabase
        .from("appointments")
        .select("patient_id")
        .eq("doctor_id", doctor!.id);
      if (appointmentsError) throw appointmentsError;
      const ids = [
        ...new Set(
          (appts || [])
            .map((appointment) => appointment.patient_id)
            .filter(
              (id): id is string => typeof id === "string" && id.length > 0,
            ),
        ),
      ];
      if (ids.length === 0) return [];
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, phone, avatar_url, account_number")
        .in("id", ids);
      if (profilesError) throw profilesError;
      return profiles || [];
    },
    enabled: !!doctor?.id,
  });
  const hasLoadError = isDoctorError || isPatientsError;
  const retryPatientPicker = () => {
    if (isDoctorError) void refetchDoctor();
    if (isPatientsError) void refetchPatients();
  };

  const filtered = useMemo(() => {
    if (!patients) return [];
    const q = search.toLowerCase().trim();
    if (!q) return patients;
    return patients.filter((p: PatientSummary) => {
      return (
        p.full_name?.toLowerCase().includes(q) || p.phone?.includes(search)
      );
    });
  }, [patients, search]);

  return (
    <div className="space-y-4 px-6 py-6 lg:px-8">
      <div>
        <h1 className="cabinet-page-title font-heading text-xl font-bold tracking-tight text-foreground">
          {t("doctorMedicalRecords.title")}
        </h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t("doctorMedicalRecords.pickPatient")}
        </p>
      </div>

      <div className="overflow-hidden rounded-prodent border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="border-b border-border/50 px-card-x py-card-y">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("doctorMedicalRecords.searchByNamePhone")}
              className="h-11 w-full rounded-prodent-input border border-border bg-background pl-9 pr-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {hasLoadError ? (
          <div
            className="flex min-h-[240px] flex-col items-center justify-center gap-3 px-6 text-center"
            role="alert"
          >
            <p className="text-sm font-medium text-destructive">
              {t("common.error")}
            </p>
            <button
              type="button"
              className="min-h-11 rounded-prodent-input border border-border px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={retryPatientPicker}
            >
              {t("common.retry")}
            </button>
          </div>
        ) : isDoctorLoading || arePatientsLoading ? (
          <div
            className="flex h-[240px] items-center justify-center"
            role="status"
            aria-live="polite"
          >
            <Loader2
              className="h-6 w-6 animate-spin text-primary"
              aria-hidden="true"
            />
            <span className="sr-only">{t("common.loading")}</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
            <div className="font-heading text-base font-semibold text-foreground">
              {patients && patients.length > 0
                ? t("doctorMedicalRecords.noResults")
                : t("doctorMedicalRecords.noPatientsYet")}
            </div>
          </div>
        ) : (
          <ul>
            {filtered.map((p: PatientSummary) => (
              <li key={p.id} className="border-b border-border last:border-b-0">
                <button
                  type="button"
                  onClick={() => onPick(p.id)}
                  className="group flex min-h-11 w-full items-center gap-3 px-5 py-3 text-left hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <Avatar
                    name={
                      p.full_name || t("doctorMedicalRecords.patientFallback")
                    }
                    size={36}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-heading text-base font-semibold text-foreground group-hover:text-primary">
                      {p.full_name || t("doctorMedicalRecords.noName")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {p.phone || "—"}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    #P-{formatPatientCardId(p.account_number, p.id)}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

// ───────────────────────── PatientMedicalRecord ─────────────────────────
const PatientMedicalRecord = ({
  patientId,
  userId,
  onBack,
  onStartVisit,
  onOpenPlan,
}: {
  patientId: string;
  userId?: string;
  onBack: () => void;
  onStartVisit: (visitId: string) => void;
  onOpenPlan: (planId: string) => void;
}) => {
  const { t } = useLanguage();
  const TABS = useMemo(
    () => [
      {
        key: "overview" as const,
        label: t("doctorMedicalRecords.tabOverview"),
        icon: TAB_ICONS.overview,
      },
      {
        key: "chart" as const,
        label: t("doctorMedicalRecords.tabChart"),
        icon: TAB_ICONS.chart,
      },
      {
        key: "visits" as const,
        label: t("doctorMedicalRecords.tabVisits"),
        icon: TAB_ICONS.visits,
      },
      {
        key: "plan" as const,
        label: t("doctorMedicalRecords.tabPlan"),
        icon: TAB_ICONS.plan,
      },
      {
        key: "xray" as const,
        label: t("doctorMedicalRecords.tabXray"),
        icon: TAB_ICONS.xray,
      },
      {
        key: "docs" as const,
        label: t("doctorMedicalRecords.tabDocs"),
        icon: TAB_ICONS.docs,
      },
      {
        key: "rx" as const,
        label: t("doctorMedicalRecords.tabRx"),
        icon: TAB_ICONS.rx,
      },
    ],
    [t],
  );
  const [tab, setTab] = useState<TabKey>("overview");

  const {
    data: accessDecision,
    isLoading: accessLoading,
    isError: accessError,
    refetch: refetchAccess,
  } = useQuery({
    queryKey: ["doctor-medical-record-access", patientId, userId],
    queryFn: () => medicalAccessApi.effective(patientId),
    enabled: Boolean(patientId && userId),
  });
  const hasAccess = accessDecision?.hasAccess === true;

  const {
    data: patient,
    isLoading,
    isError: patientError,
    refetch: refetchPatient,
  } = useQuery({
    queryKey: ["patient-medical", patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, phone, email, avatar_url, account_number")
        .eq("id", patientId)
        .maybeSingle();
      if (error) throw error;
      return data as {
        id: string;
        full_name: string | null;
        phone: string | null;
        email: string | null;
        account_number: string | null;
      } | null;
    },
    enabled: hasAccess,
  });

  const {
    data: doctor,
    isError: isDoctorError,
    refetch: refetchDoctor,
  } = useQuery({
    queryKey: ["current-doctor", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doctors")
        .select("id")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  const {
    data: visits,
    isError: isVisitsError,
    refetch: refetchVisits,
  } = useQuery({
    queryKey: ["patient-visits", patientId, doctor?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("id, appointment_date, start_time, service, status")
        .eq("patient_id", patientId)
        .eq("doctor_id", doctor!.id)
        .order("appointment_date", { ascending: false });
      if (error) throw error;
      return (data || []) as PatientVisit[];
    },
    enabled: hasAccess && !!patientId && !!doctor?.id,
  });

  const {
    data: plans,
    isError: isPlansError,
    refetch: refetchPlans,
  } = useQuery({
    queryKey: ["patient-plans", patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("treatment_plans")
        .select("id, title, status, total_cost")
        .eq("patient_id", patientId)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: hasAccess && !!patientId,
  });

  const hasSupportingDataError =
    isDoctorError || isVisitsError || isPlansError;
  const retrySupportingData = () => {
    if (isDoctorError) void refetchDoctor();
    if (isVisitsError) void refetchVisits();
    if (isPlansError) void refetchPlans();
  };

  // D4: medical_records were previously write-only (saved on visit completion
  // but never read back). Read them here so the captured diagnosis/treatment/
  // notes surface in the visits list and the Назначения tab. The jsonb
  // `attachments` column is intentionally excluded. Errors are surfaced, not
  // swallowed.
  const {
    data: records = [],
    isError: isRecordsError,
    refetch: refetchRecords,
  } = useQuery({
    queryKey: ["patient-medical-records", patientId],
    queryFn: async () => {
      const data = await getPatientMedicalRecords(patientId);
      return data
        .map((record) => ({
          ...record,
          appointment_id: record.appointmentId,
          created_at: record.createdAt,
        }))
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
    },
    enabled: hasAccess && !!patientId,
  });

  const recordByAppointment = useMemo(() => {
    const m = new Map<string, MedicalRecordRow>();
    (records as MedicalRecordRow[]).forEach((r) => {
      if (r.appointment_id && !m.has(r.appointment_id)) {
        m.set(r.appointment_id, r);
      }
    });
    return m;
  }, [records]);

  const upcomingVisit = useMemo(() => {
    const eligible = (visits || []).filter((visit) => {
      const status = (visit.status || "").toUpperCase();
      return status === "CONFIRMED" || status === "IN_PROGRESS";
    });
    const inProgress = eligible.find(
      (visit) => (visit.status || "").toUpperCase() === "IN_PROGRESS",
    );
    if (inProgress) return inProgress;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    return eligible
      .filter(
        (visit) =>
          (visit.status || "").toUpperCase() === "CONFIRMED" &&
          new Date(visit.appointment_date).getTime() >= todayStart.getTime(),
      )
      .sort((a, b) => {
        const aStart = `${a.appointment_date}T${a.start_time || "23:59:59"}`;
        const bStart = `${b.appointment_date}T${b.start_time || "23:59:59"}`;
        return new Date(aStart).getTime() - new Date(bStart).getTime();
      })[0];
  }, [visits]);

  const activePlan = useMemo(() => {
    return plans?.find(
      (p: TreatmentPlanSummary) =>
        p.status?.toUpperCase() === "ACTIVE" ||
        p.status?.toUpperCase() === "IN_PROGRESS" ||
        p.status?.toUpperCase() === "PLANNED",
    );
  }, [plans]);

  if (accessLoading) {
    return (
      <div
        className="flex h-cabinet items-center justify-center"
        role="status"
        aria-live="polite"
      >
        <Loader2
          className="h-6 w-6 animate-spin text-primary"
          aria-hidden="true"
        />
        <span className="sr-only">{t("common.loading")}</span>
      </div>
    );
  }

  if (accessError) {
    return (
      <div className="flex h-cabinet flex-col items-center justify-center gap-3 px-4 text-center" role="alert">
        <p className="text-sm font-medium text-destructive">{t("common.error")}</p>
        <button
          type="button"
          className="min-h-11 rounded-prodent-input border border-border px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => void refetchAccess()}
        >
          Повторить
        </button>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div
        className="flex h-cabinet flex-col items-center justify-center gap-4 bg-background px-6 text-center"
        role="alert"
      >
        <AlertTriangle className="h-8 w-8 text-status-warning" />
        <p className="max-w-md text-sm text-muted-foreground">
          {t("doctorMedicalRecords.accessNotConfirmed")}
        </p>
        <button
          type="button"
          onClick={onBack}
          className="min-h-11 rounded-prodent-input border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Назад к пациентам
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        className="flex h-cabinet items-center justify-center"
        role="status"
        aria-live="polite"
      >
        <Loader2
          className="h-6 w-6 animate-spin text-primary"
          aria-hidden="true"
        />
        <span className="sr-only">{t("common.loading")}</span>
      </div>
    );
  }

  if (patientError || !patient) {
    return (
      <div className="flex h-cabinet flex-col items-center justify-center gap-3 px-4 text-center" role="alert">
        <p className="text-sm font-medium text-destructive">{t("common.error")}</p>
        <button
          type="button"
          className="min-h-11 rounded-prodent-input border border-border px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => void refetchPatient()}
        >
          Повторить
        </button>
      </div>
    );
  }

  const patientName =
    patient.full_name || t("doctorMedicalRecords.patientFallback");
  const cardNo = formatPatientCardId(patient.account_number, patient.id);
  const visitsCount =
    isDoctorError || isVisitsError ? null : (visits?.length ?? null);

  return (
    <div className="grid h-cabinet min-w-0 grid-rows-[auto_1fr] bg-background">
      {/* Header */}
      <div className="border-b border-border bg-background">
        <div className="px-4 pt-4 sm:px-8">
          <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
            <button
              onClick={onBack}
              className="inline-flex min-h-11 items-center gap-1 rounded-md px-2 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              {t("doctorMedicalRecords.patients")}
            </button>
            <span>/</span>
            <span className="truncate font-medium text-foreground">
              {patientName}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4 pb-4">
            <Avatar name={patientName} size={56} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-2.5">
                <h1 className="cabinet-page-title font-heading text-xl font-bold tracking-tight text-foreground">
                  {patientName}
                </h1>
                <span className="text-xs tabular-nums text-muted-foreground">
                  #P-{cardNo}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded bg-destructive/10 px-1.5 py-0.5 text-xs font-semibold text-destructive ring-1 ring-destructive/30">
                  <AlertTriangle className="h-3 w-3" />
                  {t("doctorMedicalRecords.risksClarify")}
                </span>
                <span className="text-xs text-muted-foreground">
                  {visitsCount ?? "—"}
                  {t("doctorMedicalRecords.visitNumber")}
                  {patient.phone && ` · ${patient.phone}`}
                </span>
              </div>
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0">
              <button
                onClick={() =>
                  toast.info(t("doctorMedicalRecords.messageSoon"))
                }
                className="inline-flex min-h-11 items-center gap-1.5 rounded-prodent-input border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                {t("doctorMedicalRecords.message")}
              </button>
              <button
                onClick={() =>
                  upcomingVisit
                    ? onStartVisit(upcomingVisit.id)
                    : toast.info(t("doctorMedicalRecords.planFirstVisit"))
                }
                className="inline-flex min-h-11 items-center gap-1.5 rounded-prodent-input bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Stethoscope className="h-4 w-4" />
                {t("doctorMedicalRecords.startAppt")}
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto px-4 sm:px-8">
          {TABS.map((tab2) => {
            const Icon = tab2.icon;
            const a = tab === tab2.key;
            const count =
              tab2.key === "visits" && visitsCount !== null
                ? visitsCount
                : undefined;
            const badge =
              tab2.key === "plan" && activePlan
                ? t("doctorMedicalRecords.tabActiveBadge")
                : undefined;
            return (
              <button
                key={tab2.key}
                type="button"
                onClick={() => setTab(tab2.key)}
                aria-pressed={a}
                /* Форма вкладки как во всём кабинете: активная — язычок на
                   карточке. Раньше активность показывалась только цветом
                   текста: на светлом холсте это слабый признак, а рядом с
                   приглушённым соседом его легко не заметить. */
                className={cn(
                  "cabinet-control relative flex items-center gap-1.5 whitespace-nowrap rounded-t-field px-3 py-2 text-cell transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  a
                    ? "border border-b-0 border-border bg-card font-semibold text-primary shadow-soft"
                    : "font-medium text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{tab2.label}</span>
                {count !== undefined && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-xs font-semibold",
                      a
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {count}
                  </span>
                )}
                {badge && (
                  <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
                    {badge}
                  </span>
                )}
                {a && (
                  <span
                    className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full"
                    style={{ background: "hsl(var(--brand))" }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <div className="min-w-0 overflow-auto p-card-x">
        {hasSupportingDataError && (
          <div
            role="alert"
            className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-prodent-btn border border-destructive/30 bg-destructive/10 px-4 py-3 text-destructive"
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Данные врача, визитов или планов лечения загрузились не полностью.
            </div>
            <button
              type="button"
              onClick={retrySupportingData}
              className="min-h-11 rounded-field border border-destructive/30 bg-background px-3 py-1.5 text-xs font-semibold hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t("common.retry")}
            </button>
          </div>
        )}
        {isRecordsError && (
          <div
            role="alert"
            className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-prodent-btn border border-destructive/30 bg-destructive/10 px-4 py-3 text-destructive"
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Медицинские записи не загрузились. Данные ниже могут быть
              неполными.
            </div>
            <button
              type="button"
              onClick={() => void refetchRecords()}
              className="min-h-11 rounded-field border border-destructive/30 bg-background px-3 py-1.5 text-xs font-semibold hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Повторить
            </button>
          </div>
        )}
        {tab === "overview" && (
          <TabOverview
            patient={patient}
            visits={visits || []}
            showVisits={!isDoctorError && !isVisitsError}
            activePlan={activePlan}
            onOpenPlan={onOpenPlan}
            onOpenVisits={() => setTab("visits")}
          />
        )}
        {tab === "chart" && (
          <EmptyTab
            icon={<Activity className="h-7 w-7 text-primary" />}
            title={t("doctorMedicalRecords.fdiTitle")}
            subtitle={t("doctorMedicalRecords.fdiSubtitle")}
            cta={
              upcomingVisit
                ? {
                    label: t("doctorMedicalRecords.openInVisit"),
                    icon: <Stethoscope className="h-4 w-4" />,
                    onClick: () => onStartVisit(upcomingVisit.id),
                  }
                : undefined
            }
          />
        )}
        {tab === "visits" && !isDoctorError && !isVisitsError && (
          <TabVisits
            visits={visits || []}
            recordByAppointment={recordByAppointment}
          />
        )}
        {tab === "plan" &&
          !isPlansError &&
          (activePlan ? (
            <EmptyTab
              icon={
                <ClipboardList className="h-7 w-7 text-primary" />
              }
              title={
                activePlan.title || t("doctorMedicalRecords.activePlanTitle")
              }
              subtitle={`${fmtSum(activePlan.total_cost)} ${t("doctorPlanEdit.sumUnit")} · ${
                activePlan.status
              }`}
              cta={{
                label: t("doctorMedicalRecords.openPlan"),
                icon: <ClipboardList className="h-4 w-4" />,
                onClick: () => onOpenPlan(activePlan.id),
              }}
            />
          ) : (
            <EmptyTab
              icon={<ClipboardList className="h-7 w-7 text-muted-foreground" />}
              title={t("doctorMedicalRecords.noActivePlan")}
              subtitle={t("doctorMedicalRecords.noActivePlanSubtitle")}
            />
          ))}
        {tab === "xray" && <TabPlaceholder type="xray" />}
        {tab === "docs" && <TabPlaceholder type="docs" />}
        {tab === "rx" && !isRecordsError && (
          <TabRx records={records as MedicalRecordRow[]} />
        )}
      </div>
    </div>
  );
};

// ───────────────────────── TabOverview ─────────────────────────
const TabOverview = ({
  patient,
  visits,
  showVisits,
  activePlan,
  onOpenPlan,
  onOpenVisits,
}: {
  patient: PatientSummary;
  visits: PatientVisit[];
  showVisits: boolean;
  activePlan?: TreatmentPlanSummary;
  onOpenPlan: (id: string) => void;
  onOpenVisits: () => void;
}) => {
  const { t } = useLanguage();
  return (
    <div className="mx-auto grid max-w-[1100px] grid-cols-12 gap-5">
      {/* Left */}
      <div className="col-span-12 space-y-4 lg:col-span-7">
        <ClinicalAlerts patientId={patient?.id} />
        {showVisits && (
          <RecentVisits visits={visits} onOpenVisits={onOpenVisits} />
        )}
      </div>
      {/* Right */}
      <div className="col-span-12 space-y-4 lg:col-span-5">
        {activePlan && <ActivePlanCard plan={activePlan} onOpen={onOpenPlan} />}
        <div className="rounded-prodent border border-border bg-card p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="mb-2.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {t("doctorVisit.quickActions")}
          </div>
          <QuickActions patientId={patient?.id} />
        </div>
        <PassportDetails patient={patient} />
      </div>
    </div>
  );
};

const ClinicalAlerts = ({ patientId }: { patientId?: string }) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [openDialog, setOpenDialog] = useState<
    "allergy" | "comorbidity" | null
  >(null);
  const queryClient = useQueryClient();

  const {
    data: doctor,
    isError: isClinicalDoctorError,
    refetch: refetchClinicalDoctor,
  } = useQuery({
    queryKey: ["clinical-alerts-doctor", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doctors")
        .select("id, clinic_id")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const {
    data: conditions = [],
    isLoading,
    isError: isConditionsError,
    refetch: refetchConditions,
  } = useQuery({
    queryKey: ["medical-conditions", patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_recommendations")
        .select(
          "id, recommendation_type, title, description, priority, created_at",
        )
        .eq("patient_id", patientId!)
        .in("recommendation_type", ["allergy", "comorbidity"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!patientId,
  });

  const allergies = conditions.filter(
    (c) => c.recommendation_type === "allergy",
  );
  const comorbidities = conditions.filter(
    (c) => c.recommendation_type === "comorbidity",
  );
  const total = conditions.length;
  const doctorId = doctor?.id;
  const clinicId = doctor?.clinic_id;
  const canManageConditions = Boolean(patientId && doctorId && clinicId);

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("patient_recommendations")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("doctorMedicalRecords.removed"));
      queryClient.invalidateQueries({
        queryKey: ["medical-conditions", patientId],
      });
    },
    onError: () => toast.error(t("doctorMedicalRecords.removeFailed")),
  });

  const ConditionRow = ({ c }: { c: MedicalConditionRow }) => {
    const tone =
      c.priority === "high"
        ? "bg-status-danger-bg text-status-danger ring-status-danger/30"
        : c.priority === "medium"
          ? "bg-status-warning-bg text-status-warning ring-status-warning/30"
          : "bg-muted text-foreground ring-border";
    return (
      <div className="flex items-start gap-3 rounded-prodent-input border border-border bg-background p-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-sm font-semibold text-foreground">
              {c.title}
            </div>
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
                tone,
              )}
            >
              {c.priority === "high"
                ? t("doctorMedicalRecords.severeHigh")
                : c.priority === "medium"
                  ? t("doctorMedicalRecords.severeMedium")
                  : t("doctorMedicalRecords.severeLow")}
            </span>
          </div>
          {c.description && (
            <div className="mt-0.5 text-xs text-muted-foreground">
              {c.description}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            if (window.confirm(t("doctorMedicalRecords.removeTitle"))) {
              removeMutation.mutate(c.id);
            }
          }}
          disabled={removeMutation.isPending}
          aria-label={t("doctorMedicalRecords.removeTitle")}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          title={t("doctorMedicalRecords.removeTitle")}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  };

  const hasAny = total > 0;
  const hasClinicalAlertsError =
    isClinicalDoctorError || isConditionsError;

  if (hasClinicalAlertsError) {
    return (
      <div
        role="alert"
        className="flex min-h-[160px] flex-col items-center justify-center gap-3 rounded-prodent border border-destructive/30 bg-destructive/10 px-5 py-6 text-center"
      >
        <div className="flex items-center gap-2 text-sm font-medium text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {t("common.error")}
        </div>
        <button
          type="button"
          onClick={() => {
            if (isClinicalDoctorError) void refetchClinicalDoctor();
            if (isConditionsError) void refetchConditions();
          }}
          className="min-h-11 rounded-field border border-destructive/30 bg-background px-4 text-sm font-semibold text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t("common.retry")}
        </button>
      </div>
    );
  }

  return (
    <>
      <div
        className={cn(
          "overflow-hidden rounded-prodent border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.03)]",
          hasAny ? "border-status-warning/30" : "border-status-danger/30",
        )}
      >
        <div
          className={cn(
            "flex items-center gap-2 border-b px-5 py-3",
            hasAny
              ? "border-status-warning/20 bg-status-warning-bg"
              : "border-status-danger/20 bg-status-danger-bg",
          )}
        >
          <AlertTriangle
            className={cn(
              "h-4 w-4",
              hasAny ? "text-status-warning" : "text-status-danger",
            )}
          />
          <div
            className={cn(
              "font-heading text-sm font-bold",
              hasAny ? "text-status-warning" : "text-status-danger",
            )}
          >
            {t("doctorMedicalRecords.importantOnVisit")}
          </div>
          <span
            className={cn(
              "ml-auto text-xs",
              hasAny ? "text-status-warning" : "text-status-danger",
            )}
          >
            {isLoading
              ? t("doctorMedicalRecords.loading")
              : hasAny
                ? `${allergies.length} ${t("doctorMedicalRecords.allergiesCount")} · ${comorbidities.length} ${t("doctorMedicalRecords.comorbiditiesCount")}`
                : t("doctorMedicalRecords.notSpecified")}
          </span>
        </div>
        <div className="space-y-4 px-5 py-4">
          {!hasAny && !isLoading && (
            <div className="text-xs text-muted-foreground">
              {t("doctorMedicalRecords.noAllergiesText")}
            </div>
          )}
          {allergies.length > 0 && (
            <div>
              <div className="mb-2 text-xs font-bold uppercase tracking-wider text-destructive">
                {t("doctorMedicalRecords.allergiesHeading")} ·{" "}
                {allergies.length}
              </div>
              <div className="space-y-2">
                {allergies.map((c) => (
                  <ConditionRow key={c.id} c={c} />
                ))}
              </div>
            </div>
          )}
          {comorbidities.length > 0 && (
            <div>
              <div className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {t("doctorMedicalRecords.comorbiditiesHeading")} ·{" "}
                {comorbidities.length}
              </div>
              <div className="space-y-2">
                {comorbidities.map((c) => (
                  <ConditionRow key={c.id} c={c} />
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                if (canManageConditions) setOpenDialog("allergy");
              }}
              disabled={!canManageConditions}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-prodent-input border border-destructive/30 bg-background px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              {t("doctorMedicalRecords.addAllergy")}
            </button>
            <button
              type="button"
              onClick={() => {
                if (canManageConditions) setOpenDialog("comorbidity");
              }}
              disabled={!canManageConditions}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-prodent-input border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              {t("doctorMedicalRecords.addComorbidity")}
            </button>
          </div>
        </div>
      </div>

      {patientId && doctorId && clinicId && (
        <AddMedicalConditionDialog
          open={openDialog !== null}
          onOpenChange={(v) => !v && setOpenDialog(null)}
          patientId={patientId}
          doctorId={doctorId}
          clinicId={clinicId}
          kind={openDialog || "allergy"}
        />
      )}
    </>
  );
};

const RecentVisits = ({
  visits,
  onOpenVisits,
}: {
  visits: PatientVisit[];
  onOpenVisits: () => void;
}) => {
  const { t } = useLanguage();
  const recent = visits.slice(0, 5);
  return (
    <div className="overflow-hidden rounded-prodent border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="flex items-center border-b border-border px-5 py-3">
        <div className="font-heading text-base font-bold text-foreground">
          {t("doctorMedicalRecords.visitsHistory")}
        </div>
        {visits.length > 0 && (
          <button
            onClick={onOpenVisits}
            className="ml-auto inline-flex min-h-11 items-center rounded-md px-2 text-xs text-primary hover:bg-primary/10 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("doctorMedicalRecords.allOf")} {visits.length}
          </button>
        )}
      </div>
      {recent.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm text-muted-foreground">
          {t("doctorMedicalRecords.noVisitsYet")}
        </div>
      ) : (
        <div>
          {recent.map((v: PatientVisit) => {
            const vs = (v.status || "").toLowerCase();
            const isCompleted = vs === "completed";
            const isCancelled = vs === "cancelled";
            return (
              <div
                key={v.id}
                className="flex items-center gap-3 border-b border-border px-5 py-2.5 last:border-b-0 hover:bg-muted/60"
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 shrink-0 rounded-full",
                    isCompleted
                      ? "bg-primary"
                      : isCancelled
                        ? "bg-status-danger"
                        : "bg-status-warning",
                  )}
                />
                <div className="w-[72px] shrink-0 text-xs tabular-nums text-muted-foreground">
                  {format(new Date(v.appointment_date), "dd.MM.yy", {
                    locale: ru,
                  })}
                </div>
                <div className="min-w-0 flex-1 truncate text-sm text-foreground">
                  {v.service || t("doctorMedicalRecords.visitFallback")}
                </div>
                <div className="shrink-0 text-xs text-muted-foreground">
                  {v.status}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const ActivePlanCard = ({
  plan,
  onOpen,
}: {
  plan: TreatmentPlanSummary;
  onOpen: (id: string) => void;
}) => {
  const { t } = useLanguage();
  return (
    <div className="overflow-hidden rounded-prodent border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div
        className="px-5 py-4"
        style={{
          background:
            "linear-gradient(180deg, hsl(var(--brand-50)), hsl(var(--card)))",
        }}
      >
        <div className="mb-1 flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">
            {t("doctorMedicalRecords.activePlan")}
          </span>
        </div>
        <div className="mb-3 flex items-baseline justify-between">
          <div>
            <div className="font-heading text-xl font-bold text-foreground">
              {plan.title || t("doctorMedicalRecords.planFallback")}
            </div>
            <div className="text-xs text-muted-foreground">
              {plan.status}
            </div>
          </div>
          <div className="text-right">
            <div className="font-heading text-xl font-bold tabular-nums text-foreground">
              {fmtSum(plan.total_cost)}
            </div>
            <div className="text-xs text-muted-foreground">
              {t("doctorPlanEdit.sumUnit")}
            </div>
          </div>
        </div>
      </div>
      <button
        onClick={() => onOpen(plan.id)}
        className="flex min-h-11 w-full items-center gap-1 border-t border-border px-5 py-2.5 text-xs font-medium text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        {t("doctorMedicalRecords.openTreatmentPlan")}
        <ChevronRight className="ml-auto h-3.5 w-3.5" />
      </button>
    </div>
  );
};

const QuickActions = ({ patientId }: { patientId?: string }) => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const id = patientId || "";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <QuickButton
        icon={<Calendar className="h-3.5 w-3.5" />}
        onClick={() => navigate(`/doctor/calendar?patient=${id}&action=add`)}
      >
        {t("doctorMedicalRecords.assignVisit")}
      </QuickButton>
      <QuickButton
        icon={<ClipboardList className="h-3.5 w-3.5" />}
        onClick={() =>
          navigate(`/doctor/treatment-plans?patient=${id}&action=new`)
        }
      >
        {t("doctorMedicalRecords.newPlan")}
      </QuickButton>
      {/* P3: removed the "Рецепт" quick-button. It only fired a "coming soon"
          toast while implying a working prescriptions feature; nothing writes
          an Rx. Назначения/лечение are captured as free text during the visit
          and surfaced in the visits/Назначения tab. */}
      <QuickButton
        icon={<Upload className="h-3.5 w-3.5" />}
        onClick={() => navigate(`/doctor/medical-records?id=${id}&tab=docs`)}
      >
        {t("doctorMedicalRecords.xray")}
      </QuickButton>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            aria-label={t("doctorCalendar.moreActions")}
            className="grid h-11 w-11 place-items-center rounded-prodent-input text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => navigate(`/doctor/messages?patient=${id}`)}
          >
            <MessageCircle className="mr-2 h-4 w-4" />{" "}
            {t("doctorMedicalRecords.writeToPatient")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => toast.info(t("doctorMedicalRecords.printSoon"))}
          >
            <Download className="mr-2 h-4 w-4" />{" "}
            {t("doctorMedicalRecords.downloadCard")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => toast.info(t("doctorMedicalRecords.shareCardSoon"))}
          >
            <Upload className="mr-2 h-4 w-4" />{" "}
            {t("doctorMedicalRecords.shareCard")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

const QuickButton = ({
  icon,
  children,
  onClick,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
}) => (
  <button
    onClick={onClick}
    className="inline-flex min-h-11 items-center gap-1.5 rounded-prodent-input bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  >
    {icon}
    {children}
  </button>
);

const PassportDetails = ({ patient }: { patient: PatientSummary }) => {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-prodent border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 w-full items-center gap-3 px-5 py-3 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <FileText className="h-4 w-4 text-muted-foreground" />
        <div className="font-heading text-base font-bold text-foreground">
          {t("doctorMedicalRecords.passportData")}
        </div>
        <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          {!open && <span>{t("doctorMedicalRecords.show")}</span>}
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
          />
        </div>
      </button>
      {open && (
        <div className="grid grid-cols-1 gap-x-4 gap-y-2.5 border-t border-border px-5 pb-4 pt-4 text-xs sm:grid-cols-2">
          <Cell label={t("doctorMedicalRecords.nameField")}>
            {patient.full_name || "—"}
          </Cell>
          <Cell label={t("doctorVisit.phone")} tabular>
            {patient.phone || "—"}
          </Cell>
          <Cell label={t("doctorVisit.email")}>{patient.email || "—"}</Cell>
          <Cell label={t("doctorMedicalRecords.cardField")} tabular>
            #P-{formatPatientCardId(patient.account_number, patient.id)}
          </Cell>
        </div>
      )}
    </div>
  );
};

const Cell = ({
  label,
  children,
  tabular,
}: {
  label: string;
  children: React.ReactNode;
  tabular?: boolean;
}) => (
  <div>
    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {label}
    </div>
    <div className={cn("mt-0.5 text-foreground", tabular && "tabular-nums")}>
      {children}
    </div>
  </div>
);

const TabVisits = ({
  visits,
  recordByAppointment,
}: {
  visits: PatientVisit[];
  recordByAppointment: Map<string, MedicalRecordRow>;
}) => {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return visits;
    return visits.filter(
      (v: PatientVisit) =>
        v.service?.toLowerCase().includes(q) ||
        v.status?.toLowerCase().includes(q),
    );
  }, [visits, search]);

  return (
    <div className="space-y-4">
      <div className="rounded-prodent border border-border bg-card p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("doctorMedicalRecords.searchVisits")}
              className="h-11 w-full rounded-prodent-input border border-border bg-background pl-9 pr-12 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                aria-label={t("doctorMedicalRecords.searchVisits")}
                className="absolute right-0 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <button
            onClick={() => toast.info(t("doctorMedicalRecords.exportSoon"))}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-prodent-input border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Download className="h-3.5 w-3.5" />
            {t("doctorMedicalRecords.export")}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-prodent border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        {filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">
            {visits.length === 0
              ? t("doctorMedicalRecords.noVisitsYet")
              : t("doctorMedicalRecords.noResultsFound")}
          </div>
        ) : (
          <>
            <div className="hidden grid-cols-[110px_1fr_140px_140px] border-b border-border bg-muted/50 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground md:grid">
              <div>{t("doctorMedicalRecords.colDate")}</div>
              <div>{t("doctorMedicalRecords.colProcedure")}</div>
              <div>{t("doctorMedicalRecords.colStatus")}</div>
              <div className="text-right">
                {t("doctorMedicalRecords.colId")}
              </div>
            </div>
            {filtered.map((v: PatientVisit) => {
              const rec = recordByAppointment.get(v.id);
              const hasRecord =
                rec &&
                (rec.diagnosis?.trim() ||
                  rec.treatment?.trim() ||
                  rec.anesthesia?.trim() ||
                  rec.notes?.trim());
              const isOpen = expanded.has(v.id);
              return (
                <div
                  key={v.id}
                  className="border-b border-border last:border-b-0"
                >
                  <div
                    role={hasRecord ? "button" : undefined}
                    tabIndex={hasRecord ? 0 : undefined}
                    onClick={hasRecord ? () => toggle(v.id) : undefined}
                    onKeyDown={
                      hasRecord
                        ? (event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              toggle(v.id);
                            }
                          }
                        : undefined
                    }
                    className={cn(
                      "grid grid-cols-1 items-center gap-1 px-5 py-3 md:grid-cols-[110px_1fr_140px_140px]",
                      hasRecord
                        ? "cursor-pointer hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                        : "hover:bg-muted/60",
                    )}
                  >
                    <div className="text-sm tabular-nums text-muted-foreground">
                      {format(new Date(v.appointment_date), "d MMM yyyy", {
                        locale: ru,
                      })}
                    </div>
                    <div className="flex min-w-0 items-center gap-1.5 truncate text-sm font-medium text-foreground">
                      {hasRecord && (
                        <ChevronDown
                          className={cn(
                            "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
                            isOpen && "rotate-180",
                          )}
                        />
                      )}
                      <span className="truncate">
                        {v.service || t("doctorMedicalRecords.visitFallback")}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {v.status}
                    </div>
                    <div className="text-xs tabular-nums text-muted-foreground md:text-right">
                      {v.id.slice(0, 6)}
                    </div>
                  </div>
                  {hasRecord && isOpen && (
                    <div className="space-y-2 bg-muted/40 px-5 pb-3 pt-1 md:pl-[135px]">
                      {rec.diagnosis?.trim() && (
                        <RecordField
                          label={t("doctorVisit.diagnosis") || "Диагноз"}
                          value={rec.diagnosis}
                        />
                      )}
                      {rec.treatment?.trim() && (
                        <RecordField
                          label="Лечение / назначения"
                          value={rec.treatment}
                        />
                      )}
                      {rec.anesthesia?.trim() && (
                        <RecordField label="Анестезия" value={rec.anesthesia} />
                      )}
                      {rec.notes?.trim() && (
                        <RecordField
                          label={t("doctorVisit.notes") || "Заметки"}
                          value={rec.notes}
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
};

const EmptyTab = ({
  icon,
  title,
  subtitle,
  cta,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  cta?: { label: string; icon?: React.ReactNode; onClick: () => void };
}) => (
  <div className="rounded-prodent border border-border bg-card p-10 text-center shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
    <div className="mx-auto grid h-14 w-14 place-items-center rounded-prodent bg-primary/10">
      {icon}
    </div>
    <div className="mt-3 font-heading text-lg font-bold text-foreground">
      {title}
    </div>
    {subtitle && (
      <div className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        {subtitle}
      </div>
    )}
    {cta && (
      <button
        onClick={cta.onClick}
        className="mt-5 inline-flex min-h-11 items-center gap-1.5 rounded-prodent-input bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {cta.icon}
        {cta.label}
      </button>
    )}
  </div>
);

// D4: a single captured field (diagnosis / treatment / notes) from a saved
// medical_records row, rendered read-only with the original line breaks.
const RecordField = ({ label, value }: { label: string; value: string }) => (
  <div>
    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {label}
    </div>
    <div className="mt-0.5 whitespace-pre-wrap text-sm text-foreground">
      {value}
    </div>
  </div>
);

// D4: the Назначения/Rx tab now lists the real saved medical_records that carry
// any treatment/notes content (free-text "назначения" captured during a visit)
// instead of a fake "coming soon" placeholder. This does NOT claim to write a
// structured prescription — it surfaces what was actually recorded.
const TabRx = ({ records }: { records: MedicalRecordRow[] }) => {
  const { t } = useLanguage();
  const withContent = (records || []).filter(
    (r) => r.treatment?.trim() || r.notes?.trim(),
  );

  if (withContent.length === 0) {
    return (
      <EmptyTab
        icon={<Edit2 className="h-7 w-7 text-muted-foreground" />}
        title={t("doctorMedicalRecords.noRx") || "Назначений пока нет"}
        subtitle={
          t("doctorMedicalRecords.rxSubtitle") ||
          "Назначения и лечение фиксируются во время приёма."
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      {withContent.map((r) => (
        <div
          key={r.id}
          className="rounded-prodent border border-border bg-card p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
        >
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("doctorMedicalRecords.tabRx") || "Назначения"}
            </div>
            {r.created_at && (
              <div className="text-xs tabular-nums text-muted-foreground">
                {format(new Date(r.created_at), "d MMM yyyy", { locale: ru })}
              </div>
            )}
          </div>
          <div className="space-y-2">
            {r.treatment?.trim() && (
              <RecordField label="Лечение / назначения" value={r.treatment} />
            )}
            {r.notes?.trim() && (
              <RecordField
                label={t("doctorVisit.notes") || "Заметки"}
                value={r.notes}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

// Pilot honesty: these tabs (X-ray, documents) are not yet
// wired to storage. Previously each rendered an
// inviting CTA ("Загрузить") that only fired a "soon"
// toast — looking actionable while doing nothing. They now render an honest
// "in development" empty state with a non-interactive "Скоро" badge instead of
// a fake action button, so nothing implies the feature works.
const TabPlaceholder = ({ type }: { type: "xray" | "docs" | "rx" }) => {
  const { t } = useLanguage();
  const meta = {
    xray: {
      icon: <Camera className="h-7 w-7 text-primary" />,
      title: t("doctorMedicalRecords.noXrays"),
      sub: t("doctorMedicalRecords.uploadXraySubtitle"),
    },
    docs: {
      icon: <FileText className="h-7 w-7 text-primary" />,
      title: t("doctorMedicalRecords.noDocs"),
      sub: t("doctorMedicalRecords.docsSubtitle"),
    },
    rx: {
      icon: <Edit2 className="h-7 w-7 text-primary" />,
      title: t("doctorMedicalRecords.noRx"),
      sub: t("doctorMedicalRecords.rxSubtitle"),
    },
  }[type];

  return (
    <div className="rounded-prodent border border-border bg-card p-10 text-center shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-prodent bg-primary/10">
        {meta.icon}
      </div>
      <div className="mt-3 font-heading text-lg font-bold text-foreground">
        {meta.title}
      </div>
      <div className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        {meta.sub}
      </div>
      <div className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />В разработке
      </div>
    </div>
  );
};
