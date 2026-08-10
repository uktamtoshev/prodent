import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useClinic } from "@/contexts/ClinicContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { DoctorLayout } from "@/components/doctor/DoctorLayout";
import { DoctorTopbar } from "@/components/doctor/DoctorTopbar";
import {
  Archive,
  Calendar as CalendarIcon,
  Clock,
  FileText,
  MessageCircle,
  MoreHorizontal,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  ShieldX,
  Users,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { InitialsAvatar as Avatar } from "@/components/shared/InitialsAvatar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AddNewPatientDialog } from "@/components/crm/AddNewPatientDialog";
import { useDoctorAccessRequests } from "@/hooks/useMedicalAccess";
import {
  EmptyState,
  ErrorState,
  PageHeader,
  SkeletonComposition,
  StatCard,
} from "@/components/system";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { a11yLabel } from "@/lib/a11y-labels";

type AccessStatus = "all" | "approved" | "pending" | "none";
type PatientProfile = {
  id: string;
  full_name?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
};
type PatientIdRow = { patient_id?: string | null };
type ClinicMemberPatientRow = { user_id?: string | null };
type PatientAppointmentRow = {
  patient_id?: string | null;
  appointment_date: string;
  service?: string | null;
  status?: string | null;
};
type PatientAppointmentStats = {
  count: number;
  lastVisit: string;
  nextVisit?: string;
  nextService?: string;
};

export default function DoctorPatients() {
  const { user } = useAuth();
  const { currentClinic } = useClinic();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [accessFilter, setAccessFilter] = useState<AccessStatus>("all");
  const [addPatientOpen, setAddPatientOpen] = useState(false);

  const {
    data: doctor,
    isLoading: doctorLoading,
    isError: doctorError,
    refetch: refetchDoctor,
  } = useQuery({
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

  const {
    data: patients,
    isLoading: patientsLoading,
    isError: patientsError,
    refetch: refetchPatients,
  } = useQuery({
    queryKey: ["doctor-patients", doctor?.id, currentClinic?.id],
    queryFn: async () => {
      // Patients shown to a doctor are the union of:
      //  1. Anyone the doctor has had an appointment with (existing behavior).
      //  2. Anyone added to the current clinic with role='patient'
      //     — so manually added patients show up before any appointment exists.
      const ids = new Set<string>();

      const { data: appointments } = await supabase
        .from("appointments")
        .select("patient_id")
        .eq("doctor_id", doctor!.id);
      (appointments as PatientIdRow[] | null)?.forEach((a) => a.patient_id && ids.add(a.patient_id));

      if (currentClinic?.id) {
        const { data: members } = await supabase
          .from("clinic_members")
          .select("user_id")
          .eq("clinic_id", currentClinic.id)
          .eq("role", "patient");
        (members as ClinicMemberPatientRow[] | null)?.forEach((m) => m.user_id && ids.add(m.user_id));
      }

      if (ids.size === 0) return [];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("*")
        .in("id", [...ids]);

      return profiles || [];
    },
    enabled: !!doctor?.id,
  });

  const { data: accessRequests } = useDoctorAccessRequests(doctor?.id);

  const { data: appointmentStats } = useQuery({
    queryKey: ["patient-appointment-stats", doctor?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select("patient_id, appointment_date, service, status")
        .eq("doctor_id", doctor!.id);

      const stats: Record<string, PatientAppointmentStats> = {};
      const now = Date.now();
      (data as PatientAppointmentRow[] | null)?.forEach((apt) => {
        if (!apt.patient_id) return;
        const t = new Date(apt.appointment_date).getTime();
        const s: PatientAppointmentStats =
          stats[apt.patient_id] ||
          (stats[apt.patient_id] = { count: 0, lastVisit: apt.appointment_date });
        s.count++;
        if (apt.appointment_date > s.lastVisit) s.lastVisit = apt.appointment_date;
        // capture earliest upcoming non-completed
        const apptStatus = (apt.status || "").toLowerCase();
        if (
          t >= now &&
          apptStatus !== "completed" &&
          apptStatus !== "cancelled" &&
          (!s.nextVisit || t < new Date(s.nextVisit).getTime())
        ) {
          s.nextVisit = apt.appointment_date;
          s.nextService = apt.service;
        }
      });
      return stats;
    },
    enabled: !!doctor?.id,
  });

  const getAccessStatus = useCallback((patientId: string): "approved" | "pending" | "none" => {
    const request = accessRequests?.find(
      (row) => row.patient_id === patientId && row.status !== "revoked"
    );
    if (!request) return "none";
    if (request.status === "active" && request.patient_consent) return "approved";
    if (request.status === "pending") return "pending";
    return "none";
  }, [accessRequests]);

  const filteredPatients = useMemo(() => {
    if (!patients) return [];
    return (patients as PatientProfile[]).filter((patient) => {
      const q = searchQuery.toLowerCase();
      const searchMatch =
        !q ||
        patient.full_name?.toLowerCase().includes(q) ||
        patient.phone?.includes(searchQuery);

      const status = getAccessStatus(patient.id);
      const accessMatch = accessFilter === "all" || status === accessFilter;
      return searchMatch && accessMatch;
    });
  }, [patients, searchQuery, accessFilter, getAccessStatus]);

  const counts = useMemo(() => {
    const c = { all: 0, approved: 0, pending: 0, none: 0 };
    (patients as PatientProfile[] | undefined)?.forEach((p) => {
      c.all++;
      const st = getAccessStatus(p.id);
      c[st]++;
    });
    return c;
  }, [patients, getAccessStatus]);

  const hasActiveFilters = searchQuery.length > 0 || accessFilter !== "all";
  const isPageLoading = doctorLoading || patientsLoading;
  const isPageError = doctorError || patientsError;

  const retryPatients = () => {
    void (doctorError ? refetchDoctor() : refetchPatients());
  };

  return (
    <DoctorLayout>
      <DoctorTopbar
        title={t("doctorPatients.title")}
        subtitle={`${counts.all} ${t("doctorPatients.subtitleSuffix")} ${counts.approved}`}
      />
      <div className="space-y-4 px-6 py-6 lg:px-8">
        <PageHeader
          title={t("doctorPatients.databaseTitle")}
          description={t("doctorPatients.databaseSubtitle")}
          actions={
            <>
            <button
              type="button"
              onClick={() => setAddPatientOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-prodent-input bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              {t("doctorPatients.add")}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="grid h-10 w-10 place-items-center rounded-prodent-input border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                  title={t("doctor.more")}
                 aria-label={a11yLabel("more")}>
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => toast.info(t("doctorPatients.importComingSoon"))}>
                  <Plus className="mr-2 h-4 w-4" /> {t("doctorPatients.importExcel")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => toast.info(t("doctorPatients.exportComingSoon"))}>
                  <FileText className="mr-2 h-4 w-4" /> {t("doctorPatients.exportList")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/crm/patients/legacy")}>
                  <Users className="mr-2 h-4 w-4" /> {t("doctorPatients.legacyDatabase")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            </>
          }
        />

        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard
            label={t("doctorPatients.tabAll")}
            value={<span className="tabular-nums">{counts.all}</span>}
          />
          <StatCard
            label={t("doctorPatients.tabApproved")}
            value={<span className="tabular-nums">{counts.approved}</span>}
          />
          <StatCard
            label={t("doctorPatients.tabPending")}
            value={<span className="tabular-nums">{counts.pending}</span>}
          />
        </div>

        {/* Filter card */}
        <div className="overflow-hidden rounded-prodent border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
            {/* Segments */}
            <div className="flex items-center gap-0.5 rounded-prodent-input bg-muted p-0.5">
              {(
                [
                  { k: "all" as const, label: t("doctorPatients.tabAll"), count: counts.all },
                  {
                    k: "approved" as const,
                    label: t("doctorPatients.tabApproved"),
                    count: counts.approved,
                  },
                  {
                    k: "pending" as const,
                    label: t("doctorPatients.tabPending"),
                    count: counts.pending,
                  },
                  { k: "none" as const, label: t("doctorPatients.tabNone"), count: counts.none },
                ]
              ).map((t) => {
                const a = accessFilter === t.k;
                return (
                  <button
                    type="button"
                    key={t.k}
                    aria-pressed={a}
                    onClick={() => setAccessFilter(t.k)}
                    className={cn(
                      "flex h-8 items-center gap-1.5 rounded-[8px] px-3 text-sm font-medium transition",
                      a
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
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

            {/* Search */}
            <div className="relative min-w-[240px] flex-1">
              <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                aria-label={t("doctorPatients.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("doctorPatients.searchPlaceholder")}
                className="h-9 w-full rounded-[9px] border border-border bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              {searchQuery && (
                <button
                  type="button"
                  aria-label={t("doctor.resetFilters")}
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          {isPageLoading ? (
            <div className="p-card-x">
              <SkeletonComposition
                rows={5}
                cards={0}
                showHeader={false}
                label={t("doctorPatients.title")}
              />
            </div>
          ) : isPageError ? (
            <div className="p-card-x">
              <ErrorState
                title={t("search.loadError")}
                description={t("treatmentPlanPublic.errorText")}
                actionLabel={t("search.retry")}
                onAction={retryPatients}
              />
            </div>
          ) : filteredPatients.length === 0 ? (
            <div className="p-card-x">
              <EmptyState
                title={t("doctorPatients.patientsNotFound")}
                description={
                  hasActiveFilters
                    ? t("doctor.tryDifferentSearch")
                    : t("doctorPatients.patientsAfterAppointments")
                }
                actionLabel={
                  hasActiveFilters
                    ? t("doctor.resetFilters")
                    : t("doctorPatients.add")
                }
                onAction={() => {
                  if (hasActiveFilters) {
                    setSearchQuery("");
                    setAccessFilter("all");
                    return;
                  }
                  setAddPatientOpen(true);
                }}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead className="border-b border-border bg-background">
                  <tr>
                    <th className="py-2 pl-5 pr-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("doctorPatients.colPatient")}
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("doctorPatients.colPhone")}
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("doctorPatients.colNextVisit")}
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("doctorPatients.colVisits")}
                    </th>
                    <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("doctorPatients.colAccess")}
                    </th>
                    <th className="w-20 py-2 pl-2 pr-5" />
                  </tr>
                </thead>
                <tbody>
                  {filteredPatients.map((p: PatientProfile) => {
                    const status = getAccessStatus(p.id);
                    const stats = appointmentStats?.[p.id];
                    return (
                      <PatientRow
                        key={p.id}
                        patient={p}
                        status={status}
                        stats={stats}
                        onOpen={() => navigate(`/doctor/patients/${p.id}`)}
                        labels={{
                          noName: t("doctor.noName"),
                          lastPrefix: t("doctorPatients.lastPrefix"),
                          noVisits: t("doctor.noVisits"),
                          today: t("doctor.todayAt"),
                          accessApproved: t("doctorPatients.accessApproved"),
                          accessPending: t("doctorPatients.accessPending"),
                          accessNone: t("doctorPatients.accessNone"),
                          phoneNotSet: t("doctor.patientPhoneNotSet"),
                          phoneNotSet2: t("doctor.noPhone"),
                          callPrefix: t("doctor.callPatient"),
                          more: t("doctor.more"),
                          openMedicalCard: t("doctor.openMedicalCard"),
                          assignVisit: t("doctor.assignVisit"),
                          writeMessage: t("doctor.writeMessage"),
                          archive: t("doctor.archive"),
                          archiveSoon: t("doctorPatients.archiveComingSoon"),
                        }}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="border-t border-border px-5 py-2.5 text-xs text-muted-foreground">
            {t("doctor.shown")}{" "}
            <b className="tabular-nums text-foreground">{filteredPatients.length}</b>{" "}
            {t("doctor.of")} {patients?.length || 0}
          </div>
        </div>
      </div>

      <AddNewPatientDialog
        open={addPatientOpen}
        onOpenChange={setAddPatientOpen}
      />
    </DoctorLayout>
  );
}

// ───────────────────────── PatientRow ─────────────────────────
const PatientRow = ({
  patient,
  status,
  stats,
  onOpen,
  labels,
}: {
  patient: PatientProfile;
  status: "approved" | "pending" | "none";
  stats?: { count: number; lastVisit: string; nextVisit?: string; nextService?: string };
  onOpen: () => void;
  labels: {
    noName: string;
    lastPrefix: string;
    noVisits: string;
    today: string;
    accessApproved: string;
    accessPending: string;
    accessNone: string;
    phoneNotSet: string;
    phoneNotSet2: string;
    callPrefix: string;
    more: string;
    openMedicalCard: string;
    assignVisit: string;
    writeMessage: string;
    archive: string;
    archiveSoon: string;
  };
}) => {
  const navigate = useNavigate();
  const name = patient.full_name || labels.noName;
  const today = stats?.nextVisit
    ? new Date(stats.nextVisit).toDateString() === new Date().toDateString()
    : false;

  return (
    <tr
      className="group cursor-pointer border-b border-border transition hover:bg-muted/50"
      onClick={onOpen}
    >
      <td className="py-2.5 pl-5 pr-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={name} size={32} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                aria-label={`${labels.openMedicalCard}: ${name}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onOpen();
                }}
                className="truncate text-left text-sm font-semibold text-foreground group-hover:text-primary focus-visible:outline-none focus-visible:underline focus-visible:underline-offset-4"
              >
                {name}
              </button>
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {stats?.lastVisit
                ? `${labels.lastPrefix} ${format(new Date(stats.lastVisit), "d MMM yyyy", {
                    locale: ru,
                  })}`
                : labels.noVisits}
            </div>
          </div>
        </div>
      </td>
      <td className="px-3 py-2.5">
        <div className="text-xs tabular-nums text-foreground">
          {patient.phone || "—"}
        </div>
      </td>
      <td className="px-3 py-2.5">
        {stats?.nextVisit ? (
          <div
            className={cn(
              "text-xs font-medium",
              today ? "text-primary" : "text-foreground"
            )}
          >
            {today
              ? `${labels.today} ${format(new Date(stats.nextVisit), "HH:mm")}`
              : format(new Date(stats.nextVisit), "d MMM HH:mm", { locale: ru })}
            {stats.nextService && (
              <span className="ml-1 text-muted-foreground">· {stats.nextService}</span>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-right">
        <span className="text-xs tabular-nums text-foreground">
          {stats?.count ?? 0}
        </span>
      </td>
      <td className="px-3 py-2.5 text-center">
        {status === "approved" ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-status-success-bg px-2.5 py-0.5 text-xs font-semibold text-status-success">
            <ShieldCheck className="h-3 w-3" />
            {labels.accessApproved}
          </span>
        ) : status === "pending" ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-status-warning-bg px-2.5 py-0.5 text-xs font-semibold text-status-warning">
            <Clock className="h-3 w-3" />
            {labels.accessPending}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
            <ShieldX className="h-3 w-3" />
            {labels.accessNone}
          </span>
        )}
      </td>
      <td
        className="w-20 py-2.5 pl-2 pr-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-end gap-0.5 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
          <a
            href={patient.phone ? `tel:${patient.phone.replace(/\s+/g, "")}` : undefined}
            onClick={(e) => {
              if (!patient.phone) {
                e.preventDefault();
                toast.info(labels.phoneNotSet);
              }
            }}
            title={patient.phone ? `${labels.callPrefix} ${patient.phone}` : labels.phoneNotSet2}
            className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Phone className="h-4 w-4" />
          </a>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                title={labels.more}
                className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
               aria-label={a11yLabel("more")}>
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onOpen}>
                <FileText className="mr-2 h-4 w-4" /> {labels.openMedicalCard}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(`/doctor/calendar?patient=${patient.id}&action=add`)}>
                <CalendarIcon className="mr-2 h-4 w-4" /> {labels.assignVisit}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate(`/doctor/messages?patient=${patient.id}`)}>
                <MessageCircle className="mr-2 h-4 w-4" /> {labels.writeMessage}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toast.info(labels.archiveSoon)}>
                <Archive className="mr-2 h-4 w-4" /> {labels.archive}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </td>
    </tr>
  );
};
