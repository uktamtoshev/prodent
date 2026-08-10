import { CRMLayout } from "@/components/crm/CRMLayout";
import { AlertCircle, DollarSign, Plus, TrendingUp, UserPlus, Users } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { lazy, Suspense, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn, formatPrice } from "@/lib/utils";
import { useClinic } from "@/contexts/ClinicContext";
import { DashboardStatCard } from "@/components/crm/dashboard/DashboardStatCard";
import { TimelineSchedule } from "@/components/crm/dashboard/TimelineSchedule";
import { Link } from "react-router-dom";
import { useTodayAppointments } from "@/hooks/useTodayAppointments";
import { EnhancedLiveQueue } from "@/components/crm/dashboard/EnhancedLiveQueue";
import { DashboardTasksWidget } from "@/components/crm/tasks/DashboardTasksWidget";
import { OnboardingWizard } from "@/components/crm/onboarding/OnboardingWizard";
import { fetchClinicSetting } from "@/lib/clinic-settings";
import { Card, CardContent } from "@/components/ui/card";
import { getReportSummary } from "@/lib/crm-operations-api";
import { useModulePermissions } from "@/hooks/useModulePermissions";
import { useUserRole } from "@/hooks/useUserRole";

const GuestAppointmentModal = lazy(() =>
  import("@/components/crm/appointments/GuestAppointmentModal").then(
    (module) => ({ default: module.GuestAppointmentModal }),
  ),
);

const safeLabel = (value: string, fallback: string) =>
  value && !/[ÐÑÂâ]/.test(value) ? value : fallback;

export default function CRMDashboard() {
  const [quickAppointmentOpen, setQuickAppointmentOpen] = useState(false);
  const { currentClinic, loading: clinicLoading } = useClinic();
  const {
    canView,
    isLoading: permissionsLoading,
    permissions,
  } = useModulePermissions();
  const { isAdmin, isSuperAdmin } = useUserRole();
  const queryClient = useQueryClient();
  const { t, language } = useLanguage();
  const tr = (key: string, fallback: string) => safeLabel(t(key), fallback);
  const localeMap: Record<string, string> = {
    ru: "ru-RU",
    uz: "uz-Latn-UZ",
    uz_cyrl: "uz-Cyrl-UZ",
    kz: "kk-KZ",
    kg: "ky-KG",
    tj: "tg-TJ",
  };
  const dateLocale = localeMap[language] || "ru-RU";

  const { data: onboardingCompleted, isLoading: onboardingLoading } = useQuery({
    queryKey: ["onboarding-status", currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return true;
      return (await fetchClinicSetting(currentClinic.id, "onboarding_completed")) === true;
    },
    enabled: !clinicLoading && !!currentClinic?.id,
  });

  const todayKey = new Date().toLocaleDateString("en-CA");
  // Те же записи, что рисует сетка дня ниже: числа над ней обязаны совпадать
  // с её содержимым, поэтому берутся из одного кеша, а не считаются отдельно.
  const {
    counts: todayCounts,
    isError: appointmentsError,
    isLoading: appointmentsLoading,
  } = useTodayAppointments(currentClinic?.id);
  const clinicRole = currentClinic?.role?.toLowerCase();
  const isPlatformAdmin = isAdmin || isSuperAdmin;
  const hasReportRole = isPlatformAdmin || [
    "clinic_admin",
    "clinic_manager",
    "accountant",
  ].includes(clinicRole ?? "");
  const explicitReportPermission = permissions.find(
    (permission) => permission.module === "reports",
  );
  const reportsPermissionGranted = explicitReportPermission
    ? explicitReportPermission.can_view
    : canView("reports");
  const canViewReports = hasReportRole && (
    isPlatformAdmin || (!permissionsLoading && reportsPermissionGranted)
  );
  const { data: todayStats, isLoading: statsLoading, isError: statsError } = useQuery({
    queryKey: ["today-stats", currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return null;

      return getReportSummary(currentClinic.id, todayKey, todayKey);
    },
    enabled: !clinicLoading && !!currentClinic?.id && canViewReports,
  });

  if (!onboardingLoading && onboardingCompleted === false) {
    return (
      <CRMLayout>
        <OnboardingWizard onComplete={() => queryClient.invalidateQueries({ queryKey: ["onboarding-status"] })} />
      </CRMLayout>
    );
  }

  // Ошибка любого из двух источников: сводка отчётов или записи на сегодня.
  // Без второго условия упавший запрос записей показывал бы нули как факт.
  const hasKpiError = (canViewReports && statsError) || appointmentsError;
  const operations = (todayStats?.appointments ?? {}) as Record<string, number>;

  return (
    <CRMLayout>
      <div className="mx-auto w-full max-w-[1440px] space-y-section p-4 md:p-6">
        {/*
          The clinic name and date used to sit inside a gradient hero card that
          consumed the whole first screen of a work tool to say "Dashboard" and
          hold two buttons. The section name now lives in the cabinet top bar, so
          this is a single compact row: context on the left, the primary action on
          the right, and the numbers start immediately below the fold line.
        */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {currentClinic ? currentClinic.name : tr("crmDashboard.selectClinic", "Выберите клинику")}
            {" · "}
            {new Date().toLocaleDateString(dateLocale, { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <Button
            size="cabinet"
            onClick={() => setQuickAppointmentOpen(true)}
            className="gap-2"
            disabled={!currentClinic}
          >
            <Plus aria-hidden="true" className="h-4 w-4" />
            {tr("crmDashboard.newAppointment", "Новая запись")}
          </Button>
        </div>

        {/* Быстрые срезы дня, как в макете. Это НЕ переключатели содержимого
            этой страницы: каждый ведёт туда, где его список — источник истины.
            «Ждут подтверждения» и «Завершено» открывают расписание за сегодня
            с фильтром по статусу (страница читает его из адреса), «Долги
            пациентов» — вкладку долгов в финансах. Так же ведут себя и числа
            выше, поэтому переход всегда показывает ровно то, что обещано. */}
        <nav aria-label={tr("crmDashboard.tabToday", "Сегодня")} className="flex flex-wrap items-center gap-0.5">
          <span className="cabinet-control inline-flex items-center rounded-t-field border border-b-0 border-border bg-card px-3 py-2 text-cell font-semibold text-primary shadow-soft">
            {tr("crmDashboard.tabToday", "Сегодня")}
          </span>
          {[
            { key: "tabPending", fallback: "Ждут подтверждения", to: `/crm/schedule?from=${todayKey}&to=${todayKey}&status=pending`, count: todayCounts.pending },
            { key: "tabDone", fallback: "Завершено", to: `/crm/schedule?from=${todayKey}&to=${todayKey}&status=completed`, count: todayCounts.completed },
            { key: "tabDebts", fallback: "Долги пациентов", to: "/crm/finance?tab=debts", count: 0 },
          ].map((tab) => (
            <Link
              key={tab.key}
              to={tab.to}
              className="cabinet-control inline-flex items-center gap-1.5 rounded-t-field px-3 py-2 text-cell font-medium text-muted-foreground transition-colors hover:bg-card/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {tr(`crmDashboard.${tab.key}`, tab.fallback)}
              {tab.count > 0 && (
                <span className="rounded-full bg-status-neutral-bg px-1.5 text-xs font-bold tabular-nums text-status-neutral">
                  {tab.count}
                </span>
              )}
            </Link>
          ))}
        </nav>

        {hasKpiError && (
          <Card className="border-status-warning/30 bg-status-warning-bg">
            <CardContent
              className="flex items-start gap-3 p-4 text-sm text-status-warning"
              role="alert"
            >
              <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{tr("crmDashboard.kpiPartialError", "Часть показателей не загрузилась. Основные блоки ниже продолжают работать.")}</p>
            </CardContent>
          </Card>
        )}

        {canViewReports && (
          <div className="grid grid-cols-1 gap-section sm:grid-cols-2 lg:grid-cols-4">
            {/* Четыре показателя дня по макету: сколько приёмов, сколько из них
                состоялось, сколько денег и кому надо позвонить. «Завершено» и
                «Не подтвердили» считаются из тех же записей, что показывает
                сетка дня ниже, — общий хук, один запрос, числа не разойдутся.
                Возвраты и общий долг ушли отсюда: это не показатели дня, они
                живут в «Финансах», куда и ведёт ссылка с долга. */}
            <DashboardStatCard
              title={tr("crmDashboard.apptsToday", "Приёмов сегодня")}
              value={appointmentsError ? "—" : todayCounts.total || operations.appointment_count || 0}
              subtitle={tr("crmDashboard.scheduledToday", "записей в расписании")}
              icon={Users}
              loading={statsLoading || clinicLoading || appointmentsLoading}
              tone="neutral"
              href={`/crm/schedule?from=${todayKey}&to=${todayKey}`}
            />
            <DashboardStatCard
              title={tr("crmDashboard.completedToday", "Завершено")}
              value={appointmentsError ? "—" : todayCounts.completed}
              subtitle={tr("crmDashboard.ofTotalToday", "из них состоялось")}
              icon={TrendingUp}
              loading={statsLoading || clinicLoading || appointmentsLoading}
              tone="success"
              href={`/crm/schedule?from=${todayKey}&to=${todayKey}&status=completed`}
            />
            <DashboardStatCard
              title={tr("crmDashboard.incomeToday", "Доход за день")}
              value={formatPrice(Number(todayStats?.payments || 0), "UZS", false)}
              subtitle={tr("crmDashboard.forCurrentDay", "за текущий день")}
              icon={DollarSign}
              loading={statsLoading || clinicLoading || appointmentsLoading}
              tone="neutral"
              href={`/crm/reports?from=${todayKey}&to=${todayKey}&type=PAYMENT`}
            />
            <DashboardStatCard
              title={tr("crmDashboard.unconfirmedToday", "Не подтвердили")}
              value={appointmentsError ? "—" : todayCounts.pending}
              subtitle={tr("crmDashboard.needCall", "нужно позвонить")}
              icon={UserPlus}
              loading={statsLoading || clinicLoading || appointmentsLoading}
              tone={!appointmentsError && todayCounts.pending > 0 ? "danger" : "neutral"}
              href={`/crm/schedule?from=${todayKey}&to=${todayKey}&status=pending`}
            />
          </div>
        )}

        <div className="grid grid-cols-1 gap-section xl:grid-cols-3">
          <div className="xl:col-span-2">
            <TimelineSchedule clinicId={currentClinic?.id} />
          </div>

          <div className="space-y-section xl:col-span-1">
            <EnhancedLiveQueue clinicId={currentClinic?.id} />
            <DashboardTasksWidget />
          </div>
        </div>

        <Button
          onClick={() => setQuickAppointmentOpen(true)}
          disabled={!currentClinic}
          aria-label={tr("crmDashboard.newAppointment", "Новая запись")}
          className={cn(
            "fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full shadow-strong",
            "bg-primary hover:bg-primary/90 lg:hidden",
            "transition-transform hover:scale-110 active:scale-95",
          )}
          size="icon"
        >
          <Plus className="h-6 w-6" />
        </Button>

        {quickAppointmentOpen && (
          <Suspense fallback={null}>
            <GuestAppointmentModal open={quickAppointmentOpen} onOpenChange={setQuickAppointmentOpen} selectedDate={new Date()} />
          </Suspense>
        )}
      </div>
    </CRMLayout>
  );
}
