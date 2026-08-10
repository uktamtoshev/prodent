import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { InitialsAvatar as Avatar } from "@/components/shared/InitialsAvatar";
import { cn } from "@/lib/utils";
import {
  Activity,
  Calendar,
  Check,
  ChevronRight,
  ClipboardList,
  Clock,
  CreditCard,
  FileText,
  MapPin,
  Plus,
  Shield,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { getTashkentCalendarDate, toCalendarDateKey } from "@/lib/tashkentTime";

interface Appointment {
  id: string;
  appointment_date: string;
  start_time?: string | null;
  end_time?: string | null;
  service: string;
  status: string;
  doctor: { id: string; specialty: string; user_id: string } | null;
  clinic: { name: string } | null;
}

interface HealthIndex {
  overall_score: number;
  gum_health: number;
  teeth_condition: number;
  hygiene_score: number;
}

interface Recommendation {
  id: string;
  title: string;
  description: string;
  recommendation_type: string;
  priority: string;
  is_completed: boolean;
  created_at?: string;
}

type FamilyMember = Database["public"]["Tables"]["patient_family_members"]["Row"];
type TreatmentPlanRow = Database["public"]["Tables"]["treatment_plans"]["Row"];

type DashboardTreatmentPlan = TreatmentPlanRow & {
  name?: string | null;
  total_amount?: number | null;
  total_price?: number | null;
};

export const PatientDashboard = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [upcomingAppointment, setUpcomingAppointment] = useState<Appointment | null>(null);
  const [healthIndex, setHealthIndex] = useState<HealthIndex | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [doctorName, setDoctorName] = useState<string>("");
  const [family, setFamily] = useState<FamilyMember[]>([]);
  const [plan, setPlan] = useState<DashboardTreatmentPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const { data: appointments } = await supabase
        .from("appointments")
        .select(
          `id, appointment_date, start_time, end_time, service, status,
           doctor:doctors(id, specialty, user_id),
           clinic:clinics(name)`
        )
        .eq("patient_id", user?.id)
        .or("status.eq.PENDING,status.eq.CONFIRMED")
        .gte("appointment_date", toCalendarDateKey(getTashkentCalendarDate()))
        .order("appointment_date", { ascending: true })
        .limit(1);

      if (appointments && appointments.length > 0) {
        const apt = appointments[0] as unknown as Appointment;
        setUpcomingAppointment(apt);
        if (apt.doctor?.user_id) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", apt.doctor.user_id)
            .maybeSingle();
          if (profile) setDoctorName(profile.full_name || "");
        }
      }

      const { data: healthData } = await supabase
        .from("patient_health_index")
        .select("overall_score, gum_health, teeth_condition, hygiene_score")
        .eq("patient_id", user?.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (healthData) setHealthIndex(healthData);

      const { data: recsData } = await supabase
        .from("patient_recommendations")
        .select("*")
        .eq("patient_id", user?.id)
        .eq("is_completed", false)
        .order("priority", { ascending: false })
        .limit(5);
      if (recsData) setRecommendations(recsData as Recommendation[]);

      // Real family members (no more hardcoded Yuldashev demo data)
      const { data: familyData } = await supabase
        .from("patient_family_members")
        .select("*")
        .eq("main_patient_id", user?.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (familyData) setFamily(familyData);

      // Real treatment plan (latest), instead of the hardcoded 2/8 demo plan
      const { data: planData } = await supabase
        .from("treatment_plans")
        .select("*")
        .eq("patient_id", user?.id)
        .order("created_at", { ascending: false })
        .limit(1);
      if (planData && planData.length > 0) setPlan(planData[0]);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      void fetchDashboardData();
    } else {
      setLoading(false);
    }
  }, [user?.id, fetchDashboardData]);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return t("patientCabinet.goodMorning");
    if (h < 18) return t("patientCabinet.goodAfternoon");
    return t("patientCabinet.goodEvening");
  }, [t]);

  const firstName = useMemo(() => {
    // Prefer explicit first_name fields from the cached profile, then fall
    // back to splitting full_name. Only use email as a very last resort and
    // strip the domain so we never render "patient@prodent.uz" as a name.
    const direct =
      user?.firstName ||
      user?.user_metadata?.first_name ||
      "";
    if (direct) return String(direct).trim();
    const full =
      user?.user_metadata?.full_name ||
      user?.user_metadata?.name ||
      user?.full_name ||
      "";
    if (full) return String(full).trim().split(" ")[0] || "";
    const email = user?.email ?? "";
    if (email && email.includes("@")) return email.split("@")[0];
    return "";
  }, [user]);

  if (loading) {
    return (
      <div
        className="mx-auto flex min-h-[320px] max-w-[1280px] items-center justify-center p-4 text-sm text-muted-foreground sm:p-6"
        role="status"
        aria-live="polite"
      >
        {t("common.loading")}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1280px] p-4 sm:p-6">
      {loadError && (
        <div
          className="mb-4 rounded-xl border border-[hsl(var(--destructive)/0.3)] bg-[hsl(var(--destructive)/0.1)] px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {t("common.error")}
        </div>
      )}
      <div className="mb-5">
        <div className="text-[12.5px] text-muted-foreground">{greeting},</div>
        <h2 className="font-heading text-[26px] font-bold tracking-tight text-foreground">
          {firstName ? `${firstName} 👋` : `${t("patientCabinet.patientGreeting")} 👋`}
        </h2>
      </div>

      <div className="space-y-5">
        <NextVisitHero
          appointment={upcomingAppointment}
          doctorName={doctorName}
          onBook={() => navigate("/patient/book")}
          onOpenAppointments={() => navigate("/patient/appointments")}
        />

        <QuickTiles onNavigate={navigate} />

        <div className="grid grid-cols-12 gap-5">
          <div className="col-span-12 lg:col-span-7 space-y-5">
            <HealthIndexCard health={healthIndex} />
            <RecommendationsFeed
              items={recommendations}
              onAll={() => navigate("/patient/medical")}
            />
          </div>
          <div className="col-span-12 lg:col-span-5 space-y-5">
            <PlanProgress plan={plan} onOpen={() => navigate("/patient/medical")} />
            <HygieneReminders />
            <FamilyWidget members={family} onManage={() => navigate("/patient/family")} />
          </div>
        </div>
      </div>
    </div>
  );
};

// ───────────────────────── NextVisitHero ─────────────────────────
interface HeroProps {
  appointment: Appointment | null;
  doctorName: string;
  onBook: () => void;
  onOpenAppointments: () => void;
}

const NextVisitHero = ({ appointment, doctorName, onBook, onOpenAppointments }: HeroProps) => {
  const { t } = useLanguage();

  if (!appointment) {
    return (
      <div className="rounded-[18px] border border-border bg-card px-6 py-10 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-10px_rgba(15,23,42,0.08)]">
        <Calendar className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
        <div className="font-heading text-[18px] font-semibold text-foreground">{t("patientCabinet.noUpcomingVisits")}</div>
        <div className="mt-1 text-[13px] text-muted-foreground">{t("patientCabinet.noUpcomingVisitsDesc")}</div>
        <button
          onClick={onBook}
          className="mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-[10px] bg-[hsl(var(--brand))] px-4 py-2 text-[13px] font-medium text-primary-foreground hover:bg-[hsl(var(--brand-700))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Plus className="h-4 w-4" />
          {t("patientCabinet.bookAppointment")}
        </button>
      </div>
    );
  }

  const WEEKDAYS = t("patientCabinet.weekdaysShort").split(",");
  const MONTHS_SHORT = t("patientCabinet.monthsShort").split(",");
  const date = new Date(appointment.appointment_date);
  const dd = String(date.getDate()).padStart(2, "0");
  const monthShort = MONTHS_SHORT[date.getMonth()];
  const weekday = WEEKDAYS[date.getDay()];
  // Time lives in start_time/end_time (TIME columns); appointment_date is a
  // pure DATE, so deriving the time from it would always show midnight.
  const timeStart = appointment.start_time
    ? appointment.start_time.slice(0, 5)
    : format(date, "HH:mm");
  const timeEnd = appointment.end_time
    ? appointment.end_time.slice(0, 5)
    : format(new Date(date.getTime() + 60 * 60 * 1000), "HH:mm");
  const diffDays = Math.max(0, Math.round((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
  const whenLabel =
    diffDays === 0
      ? t("patientCabinet.whenToday")
      : diffDays === 1
        ? t("patientCabinet.whenTomorrow")
        : t("patientCabinet.whenInDays").replace("{count}", String(diffDays));

  const prep = [
    { t: t("patientCabinet.prep1Title"), d: t("patientCabinet.prep1Desc") },
    { t: t("patientCabinet.prep2Title"), d: t("patientCabinet.prep2Desc") },
    { t: t("patientCabinet.prep3Title"), d: t("patientCabinet.prep3Desc") },
  ];

  return (
    <div className="overflow-hidden rounded-[18px] border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-10px_rgba(15,23,42,0.08)]">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px]">
        <div className="relative p-6">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--brand-50))] px-2 py-0.5 text-xs font-medium text-[hsl(var(--brand-700))] ring-1 ring-[hsl(var(--brand)_/_0.2)]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[hsl(var(--brand))]" />
              {t("patientCabinet.nextVisit")}
            </span>
            <span className="text-xs text-muted-foreground">{whenLabel}</span>
          </div>

          <div className="mt-3 flex items-end gap-5">
            <div
              className="w-[84px] shrink-0 overflow-hidden rounded-[14px] border border-border text-center"
              style={{ background: "linear-gradient(180deg, hsl(var(--card)), hsl(var(--brand-50)))" }}
            >
              <div className="bg-[hsl(var(--brand))] py-1 text-xs font-bold uppercase tracking-wider text-primary-foreground">
                {weekday}
              </div>
              <div className="py-2">
                <div className="font-heading text-[30px] font-bold leading-none tabular-nums text-foreground">
                  {dd}
                </div>
                <div className="mt-0.5 text-xs uppercase text-muted-foreground">{monthShort}</div>
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <div className="font-heading text-[22px] font-bold leading-tight tracking-tight text-foreground">
                  {appointment.service || t("patientCabinet.visit")}
                </div>
              </div>
              <div className="mt-1.5 text-[13.5px] text-muted-foreground">
                {appointment.status.toLowerCase() === "confirmed"
                  ? t("patientCabinet.confirmedByClinic")
                  : t("patientCabinet.pendingConfirmation")}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13px] text-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  {timeStart} — {timeEnd}
                </span>
                {doctorName && (
                  <span className="inline-flex items-center gap-1.5">
                    <Stethoscope className="h-4 w-4 text-muted-foreground" />
                    {doctorName}
                  </span>
                )}
                {appointment.clinic?.name && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    {appointment.clinic.name}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button
              onClick={onOpenAppointments}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-[10px] bg-[hsl(var(--brand))] px-3.5 py-2 text-[13px] font-medium text-primary-foreground hover:bg-[hsl(var(--brand-700))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Calendar className="h-4 w-4" />
              {t("patientCabinet.reschedule")}
            </button>
          </div>
        </div>

        <div className="border-t border-border bg-muted/40 p-5 lg:border-l lg:border-t-0">
          <div className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("patientCabinet.howToPrepare")}
          </div>
          <div className="space-y-2">
            {prep.map((s, i) => (
              <div key={i} className="flex items-start gap-2.5 text-[12.5px]">
                <div
                  className="mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full border-[1.5px] bg-card"
                  style={{ borderColor: "hsl(var(--brand))", color: "hsl(var(--brand-700))" }}
                >
                  <span className="font-heading text-xs font-bold">{i + 1}</span>
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-foreground">{s.t}</div>
                  <div className="text-xs text-muted-foreground">{s.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ───────────────────────── QuickTiles ─────────────────────────
const QuickTiles = ({ onNavigate }: { onNavigate: (to: string) => void }) => {
  const { t } = useLanguage();
  const tiles = [
    {
      to: "/patient/book",
      label: t("patientCabinet.tileBook"),
      desc: t("patientCabinet.tileBookDesc"),
      Icon: Plus,
      tone: {
        bg: "hsl(var(--brand-50))",
        fg: "hsl(var(--brand-700))",
        ring: "hsl(var(--brand) / 0.3)",
      },
    },
    {
      to: "/patient/medical",
      label: t("patientCabinet.tileTreatmentPlan"),
      desc: t("patientCabinet.tileTreatmentPlanDesc"),
      Icon: ClipboardList,
      tone: {
        bg: "hsl(var(--accent) / 0.12)",
        fg: "hsl(var(--foreground))",
        ring: "hsl(var(--accent) / 0.3)",
      },
    },
    {
      to: "/patient/medical",
      label: t("patientCabinet.tileMedicalCard"),
      desc: t("patientCabinet.tileMedicalCardDesc"),
      Icon: FileText,
      tone: {
        bg: "hsl(var(--warning-amber) / 0.1)",
        fg: "hsl(var(--warning-amber))",
        ring: "hsl(var(--warning-amber) / 0.3)",
      },
    },
    {
      to: "/patient/billing",
      label: t("patientCabinet.tilePayments"),
      desc: t("patientCabinet.tilePaymentsDesc"),
      Icon: CreditCard,
      tone: {
        bg: "hsl(var(--destructive) / 0.1)",
        fg: "hsl(var(--destructive))",
        ring: "hsl(var(--destructive) / 0.3)",
      },
    },
  ] as const;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {tiles.map((t) => (
        <button
          key={t.label}
          onClick={() => onNavigate(t.to)}
          className="group min-h-11 rounded-[14px] border border-border bg-card p-4 text-left shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-all hover:-translate-y-[1px] hover:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <div
            className="mb-3 grid h-10 w-10 place-items-center rounded-[10px]"
            style={{ background: t.tone.bg, color: t.tone.fg, boxShadow: `inset 0 0 0 1px ${t.tone.ring}` }}
          >
            <t.Icon className="h-[18px] w-[18px]" />
          </div>
          <div className="font-heading text-[14px] font-semibold text-foreground">{t.label}</div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">{t.desc}</div>
        </button>
      ))}
    </div>
  );
};

// ───────────────────────── RingGauge ─────────────────────────
const RingGauge = ({ value = 72, size = 112, stroke = 10 }: { value?: number; size?: number; stroke?: number }) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (value / 100) * c;
  const color =
    value >= 80
      ? "hsl(var(--success-green))"
      : value >= 60
        ? "hsl(var(--warning-amber))"
        : "hsl(var(--destructive))";
  return (
    <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} stroke="hsl(var(--muted))" strokeWidth={stroke} fill="none" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={color}
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={off}
        style={{ transition: "stroke-dashoffset 600ms ease" }}
      />
    </svg>
  );
};

// ───────────────────────── HealthIndexCard ─────────────────────────
const HealthIndexCard = ({ health }: { health: HealthIndex | null }) => {
  const { t } = useLanguage();
  const overall = health?.overall_score ?? 0;
  const metrics = [
    { k: t("patientCabinet.gums"), v: health?.gum_health ?? 0 },
    { k: t("patientCabinet.teeth"), v: health?.teeth_condition ?? 0 },
    { k: t("patientCabinet.hygiene"), v: health?.hygiene_score ?? 0 },
  ];
  const barColor = (v: number) =>
    v >= 80
      ? "hsl(var(--success-green))"
      : v >= 60
        ? "hsl(var(--warning-amber))"
        : "hsl(var(--destructive))";

  if (!health) {
    return (
      <div className="rounded-[14px] border border-border bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4 text-[hsl(var(--brand-700))]" />
          <div className="font-heading text-[13px] font-semibold text-foreground">{t("patientCabinet.oralHealthIndex")}</div>
        </div>
        <div className="py-4 text-center text-[13px] text-muted-foreground">
          {t("patientCabinet.indexAfterCheckup")}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[14px] border border-border bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="mb-3 flex items-center gap-2">
        <Activity className="h-4 w-4 text-[hsl(var(--brand-700))]" />
        <div className="font-heading text-[13px] font-semibold text-foreground">{t("patientCabinet.oralHealthIndex")}</div>
      </div>

      <div className="flex items-center gap-5">
        <div className="relative" style={{ width: 112, height: 112 }}>
          <RingGauge value={overall} />
          <div className="absolute inset-0 grid place-items-center">
            <div className="text-center">
              <div className="font-heading text-[26px] font-bold leading-none tabular-nums text-foreground">
                {overall}
              </div>
              <div className="mt-0.5 text-xs uppercase tracking-wider text-muted-foreground">{t("patientCabinet.outOf100")}</div>
            </div>
          </div>
        </div>
        <div className="flex-1 space-y-2.5">
          {metrics.map((m) => (
            <div key={m.k}>
              <div className="flex items-center justify-between text-[12.5px]">
                <span className="text-foreground">{m.k}</span>
                <span className="tabular-nums font-semibold" style={{ color: barColor(m.v) }}>
                  {m.v}%
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full" style={{ width: `${m.v}%`, background: barColor(m.v) }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ───────────────────────── PlanProgress ─────────────────────────
const PlanProgress = ({ plan, onOpen }: { plan: DashboardTreatmentPlan | null; onOpen: () => void }) => {
  const { t } = useLanguage();

  if (!plan) {
    return (
      <div className="rounded-[14px] border border-border bg-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="mb-1 flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-[hsl(var(--brand-700))]" />
          <div className="font-heading text-[13px] font-semibold text-foreground">
            {t("patientCabinet.treatmentPlan")}
          </div>
        </div>
        <div className="py-4 text-center text-[13px] text-muted-foreground">
          {t("patientCabinet.noTreatmentPlanYet")}
        </div>
      </div>
    );
  }

  const title = plan.title || plan.name || t("patientCabinet.treatmentPlan");
  const total = plan.total_cost ?? plan.total_amount ?? plan.total_price ?? null;

  return (
    <div className="overflow-hidden rounded-[14px] border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div
        className="px-5 py-4"
        style={{ background: "linear-gradient(180deg, hsl(var(--brand-50)), hsl(var(--card)))" }}
      >
        <span className="text-xs font-bold uppercase tracking-wider text-[hsl(var(--brand-700))]">
          {t("patientCabinet.treatmentPlan")}
        </span>
        <div className="mt-2 font-heading text-[17px] font-bold leading-tight text-foreground">{title}</div>
        {total != null && (
          <div className="mt-1 font-heading text-[20px] font-bold tabular-nums text-foreground">
            {Number(total).toLocaleString("ru-RU")} <span className="text-xs font-normal text-muted-foreground">{t("patientCabinet.remainderSum")}</span>
          </div>
        )}
      </div>

      <button
        onClick={onOpen}
        className="flex min-h-11 w-full items-center gap-1 border-t border-border px-5 py-2.5 text-[12.5px] font-medium text-[hsl(var(--brand-700))] hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        {t("patientCabinet.moreAboutPlan")} <ChevronRight className="ml-auto h-3.5 w-3.5" />
      </button>
    </div>
  );
};

// ───────────────────────── HygieneReminders ─────────────────────────
const HygieneReminders = () => {
  const { t } = useLanguage();
  const [ticks, setTicks] = useState<Record<string, boolean>>({ morning: true, floss: false, evening: false });
  const items = [
    { k: "morning", t: t("patientCabinet.morningCleaning"), time: t("patientCabinet.morningCleaningTime"), note: t("patientCabinet.morningCleaningNote") },
    { k: "floss", t: t("patientCabinet.dentalFloss"), time: t("patientCabinet.dentalFlossTime"), note: t("patientCabinet.dentalFlossNote") },
    { k: "evening", t: t("patientCabinet.eveningCleaning"), time: t("patientCabinet.eveningCleaningTime"), note: t("patientCabinet.eveningCleaningNote") },
  ];

  return (
    <div className="overflow-hidden rounded-[14px] border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="flex items-center border-b border-border px-5 py-3">
        <div className="font-heading text-[13px] font-semibold text-foreground">{t("patientCabinet.remindersToday")}</div>
      </div>
      <div className="space-y-2 p-4">
        {items.map((it) => {
          const done = ticks[it.k];
          return (
            <button
              key={it.k}
              onClick={() => setTicks((t) => ({ ...t, [it.k]: !t[it.k] }))}
              className={cn(
                "flex min-h-11 w-full items-center gap-3 rounded-[10px] border p-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                done
                  ? "border-[hsl(var(--success-green)/0.3)] bg-[hsl(var(--success-green)/0.1)]"
                  : "border-border hover:bg-muted"
              )}
            >
              <span
                className={cn(
                  "grid h-6 w-6 shrink-0 place-items-center rounded-full transition",
                  done
                    ? "bg-[hsl(var(--success-green))] text-card"
                    : "border border-border bg-card"
                )}
              >
                {done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
              </span>
              <div className="min-w-0 flex-1">
                <div
                  className={cn(
                    "text-[13px] font-medium",
                    done ? "text-muted-foreground line-through" : "text-foreground"
                  )}
                >
                  {it.t}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {it.time} · {it.note}
                </div>
              </div>
              <Sparkles className="h-4 w-4 text-muted-foreground" />
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ───────────────────────── RecommendationsFeed ─────────────────────────
interface RecsProps {
  items: Recommendation[];
  onAll: () => void;
}

const priorityTone = (p: string, t: (k: string) => string) => {
  if (p === "urgent") {
    return {
      bg: "hsl(var(--destructive) / 0.1)",
      fg: "hsl(var(--destructive))",
      ring: "hsl(var(--destructive) / 0.3)",
      label: t("patientCabinet.priorityUrgent"),
    };
  }
  if (p === "high") {
    return {
      bg: "hsl(var(--warning-amber) / 0.1)",
      fg: "hsl(var(--warning-amber))",
      ring: "hsl(var(--warning-amber) / 0.3)",
      label: t("patientCabinet.priorityHigh"),
    };
  }
  return {
    bg: "hsl(var(--brand-50))",
    fg: "hsl(var(--brand-700))",
    ring: "hsl(var(--brand) / 0.3)",
    label: t("patientCabinet.priorityNormal"),
  };
};

const RecommendationsFeed = ({ items, onAll }: RecsProps) => {
  const { t } = useLanguage();
  return (
    <div className="overflow-hidden rounded-[14px] border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="flex items-center border-b border-border px-5 py-3">
        <Shield className="mr-2 h-4 w-4 text-muted-foreground" />
        <div className="font-heading text-[13px] font-semibold text-foreground">{t("patientCabinet.doctorRecommendations")}</div>
        {items.length > 0 && (
          <button
            onClick={onAll}
            className="ml-auto min-h-11 px-2 text-xs text-[hsl(var(--brand-700))] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("patientCabinet.allRecommendations")} {items.length}
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <div className="py-8 text-center text-[13px] text-muted-foreground">{t("patientCabinet.noRecommendations")}</div>
      ) : (
        <div>
          {items.map((r) => {
            const tone = priorityTone(r.priority, t);
            const dateLabel = r.created_at
              ? format(new Date(r.created_at), "dd.MM.yy", { locale: ru })
              : "";
            return (
              <div
                key={r.id}
                className="flex items-start gap-3 border-b border-border px-5 py-3 last:border-b-0 hover:bg-muted/60"
              >
                <div className="pt-0.5">
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1"
                    style={{ background: tone.bg, color: tone.fg, boxShadow: `inset 0 0 0 1px ${tone.ring}` }}
                  >
                    {tone.label}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium text-foreground">{r.title}</div>
                  {r.description && (
                    <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{r.description}</div>
                  )}
                  {dateLabel && (
                    <div className="mt-0.5 text-xs tabular-nums text-muted-foreground">{dateLabel}</div>
                  )}
                </div>
                <span className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground" aria-hidden="true">
                  <ChevronRight className="h-4 w-4" />
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ───────────────────────── FamilyWidget ─────────────────────────
const FamilyWidget = ({ members, onManage }: { members: FamilyMember[]; onManage: () => void }) => {
  const { t } = useLanguage();
  return (
    <div className="overflow-hidden rounded-[14px] border border-border bg-card shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="flex items-center border-b border-border px-5 py-3">
        <div className="font-heading text-[13px] font-semibold text-foreground">{t("patientCabinet.family")}</div>
        <button
          onClick={onManage}
          className="ml-auto min-h-11 px-2 text-xs text-[hsl(var(--brand-700))] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t("patientCabinet.manage")}
        </button>
      </div>
      {members.length === 0 ? (
        <div className="py-6 text-center text-[13px] text-muted-foreground">
          {t("patientCabinet.noFamilyYet")}
        </div>
      ) : (
        <div>
          {members.map((m, i) => (
            <div
              key={m.id ?? i}
              className="flex items-center gap-3 border-b border-border px-5 py-2.5 last:border-b-0 hover:bg-muted/60"
            >
              <Avatar name={m.full_name || "?"} size={36} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium text-foreground">{m.full_name}</div>
                <div className="truncate text-xs text-muted-foreground">{m.relationship || "—"}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
