import { CRMLayout } from "@/components/crm/CRMLayout";
import { Card, CardContent } from "@/components/ui/card";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Calendar,
  CreditCard,
  FileText,
  Image as ImageIcon,
  Phone,
  ShieldCheck,
  Stethoscope,
  User,
} from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { UltraRealisticDentalChart } from "@/components/patient/dental/UltraRealisticDentalChart";
import { VisitHistory } from "@/components/crm/VisitHistory";
import { PatientFiles } from "@/components/crm/PatientFiles";
import { PatientTags } from "@/components/crm/PatientTags";
import { PatientProfile } from "@/components/crm/patients/PatientProfile";
import { PatientPaymentHistory } from "@/components/crm/patients/PatientPaymentHistory";
import { PatientFinanceTab } from "@/components/crm/patients/PatientFinanceTab";
import { useClinic } from "@/contexts/ClinicContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { getPatientTreatmentPlans } from "@/lib/treatment-plans-api";
import { listClinicDebts } from "@/lib/crm-operations-api";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/utils";

interface PatientTag {
  id: string;
  tag: string;
  clinic_id: string;
}

const safeLabel = (value: string, fallback: string) =>
  value && !/[ÃÐÑÂâ]/.test(value) ? value : fallback;

export default function PatientDetail() {
  const { t, language } = useLanguage();
  const tr = (key: string, fallback: string) => safeLabel(t(key), fallback);
  const { id } = useParams();
  const { currentClinic } = useClinic();

  const { data: patient, isLoading, isError } = useQuery({
    queryKey: ["patient-detail", id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, full_name, phone, email, avatar_url, created_at, date_of_birth, gender, address, notes",
        )
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        ...data,
        birth_date: data.date_of_birth ?? null,
        patient_tags: [] as PatientTag[],
      };
    },
    enabled: !!id,
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["patient-stats", id, currentClinic?.id],
    queryFn: async () => {
      if (!id) return null;

      let query = supabase
        .from("appointments")
        .select("id, total_price, status")
        .eq("patient_id", id)
        .eq("status", "completed");

      if (currentClinic?.id) query = query.eq("clinic_id", currentClinic.id);

      const { data: visits } = await query;

      return {
        visitCount: visits?.length || 0,
        totalSpent:
          visits?.reduce((sum, visit) => sum + (visit.total_price || 0), 0) ||
          0,
      };
    },
    enabled: !!id,
  });
  const plans = useQuery({
    queryKey: ["patient-treatment-plans-secure", id],
    queryFn: () => getPatientTreatmentPlans(id!),
    enabled: !!id,
  });
  const debts = useQuery({
    queryKey: ["patient-debts-secure", currentClinic?.id, id],
    queryFn: async () => {
      const rows = await listClinicDebts(currentClinic!.id);
      return rows.filter((row) => String(row.patient_id) === id);
    },
    enabled: !!currentClinic?.id && !!id,
  });

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (isLoading) {
    return (
      <CRMLayout>
        <div className="space-y-section p-4 lg:p-6">
          <Skeleton className="h-10 w-48 rounded-2xl" />
          <Skeleton className="h-56 w-full rounded-2xl" />
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      </CRMLayout>
    );
  }

  if (isError || !patient) {
    return (
      <CRMLayout>
        <div className="p-4 lg:p-6">
          <Card className="border-dashed border-border/70 bg-card/80 shadow-soft">
            <CardContent className="py-14 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <User className="h-7 w-7" />
              </div>
              <p className="font-medium">
                {isError
                  ? "Не удалось загрузить карточку пациента"
                  : tr("crmPatientDetail.notFound", "Пациент не найден")}
              </p>
              <Link to="/crm/patients">
                <Button variant="outline" className="mt-4 rounded-xl">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  {tr("crmPatientDetail.backToList", "Вернуться к списку")}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </CRMLayout>
    );
  }

  return (
    <CRMLayout>
      <div className="space-y-section p-4 pb-24 lg:p-6">
        <Link to="/crm/patients">
          <Button
            variant="ghost"
            className="rounded-xl text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {tr("crmPatientDetail.backToPatients", "Назад к списку пациентов")}
          </Button>
        </Link>

        <Card className="overflow-hidden">
          <CardContent className="p-card-x">
            <div className="flex flex-col gap-6 md:flex-row md:items-center">
              <Avatar className="h-24 w-24 border-4 border-background shadow-soft">
                <AvatarImage src={patient.avatar_url || undefined} />
                <AvatarFallback className="bg-primary/10 text-2xl font-semibold text-primary">
                  {getInitials(patient.full_name)}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <h1 className="truncate cabinet-page-title font-heading text-xl font-bold tracking-tight text-foreground">
                    {patient.full_name ||
                      tr("crmPatientDetail.noName", "Без имени")}
                  </h1>
                  <ShieldCheck className="h-5 w-5 text-status-success" />
                </div>
                <div className="mb-3 flex flex-wrap gap-3 text-sm text-muted-foreground">
                  {patient.phone && (
                    <div className="flex items-center gap-2 rounded-full bg-background/70 px-3 py-1 ring-1 ring-border/60">
                      <Phone className="h-4 w-4" />
                      <span>{patient.phone}</span>
                    </div>
                  )}
                  {patient.created_at && (
                    <div className="flex items-center gap-2 rounded-full bg-background/70 px-3 py-1 ring-1 ring-border/60">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {tr("crmPatientDetail.patientSince", "Пациент с")}{" "}
                        {format(new Date(patient.created_at), "dd.MM.yyyy", {
                          locale: ru,
                        })}
                      </span>
                    </div>
                  )}
                </div>
                <PatientTags
                  patientId={patient.id}
                  tags={patient.patient_tags}
                />
              </div>

              <div className="grid w-full grid-cols-2 gap-3 md:w-auto md:min-w-[260px]">
                <div className="rounded-panel border border-border/60 bg-background/70 p-4">
                  <p className="text-xs text-muted-foreground">
                    {tr("crmPatientDetail.totalVisits", "Всего визитов")}
                  </p>
                  <p className="text-kpi tabular-nums font-heading">
                    {statsLoading ? "…" : stats?.visitCount || 0}
                  </p>
                </div>
                <div className="rounded-2xl border border-primary/20 bg-primary/10 p-4">
                  <p className="text-xs text-muted-foreground">
                    {tr("crmPatientDetail.totalSpent", "Потрачено")}
                  </p>
                  <p className="text-base font-bold text-primary">
                    {statsLoading
                      ? "…"
                      : (stats?.totalSpent || 0).toLocaleString()}{" "}
                    UZS
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card><CardContent className="space-y-3 p-4">
            <h2 className="text-base font-bold">{t("crmPatientDetail.plansAndConsents")}</h2>
            {plans.isLoading ? <Skeleton className="h-24" /> : plans.data?.length ? plans.data.map((plan) => (
              <div key={plan.id} className="flex flex-wrap items-center gap-2 rounded-xl border p-3">
                <div className="min-w-0 flex-1"><p className="truncate font-medium">{plan.title}</p><p className="text-sm text-muted-foreground">{formatPrice(plan.totalCost, plan.currency, false)}</p></div>
                <Badge variant="outline">{plan.status}</Badge>
                <Badge variant={plan.patientConsentConfirmedAt ? "default" : "secondary"}>
                  {plan.patientConsentConfirmedAt ? (language === "uz" ? "Rozilik bor" : "Согласие получено") : (language === "uz" ? "Rozilik yo‘q" : "Нет согласия")}
                </Badge>
              </div>
            )) : <p className="py-6 text-center text-sm text-muted-foreground">{language === "uz" ? "Rejalar yo‘q" : "Планов лечения нет"}</p>}
          </CardContent></Card>
          <Card><CardContent className="space-y-3 p-4">
            <h2 className="text-base font-bold">{t("crmPatientDetail.debts")}</h2>
            {debts.isLoading ? <Skeleton className="h-24" /> : debts.data?.length ? debts.data.map((row) => (
              <div key={String(row.invoice_id || row.id)} className="flex items-center justify-between gap-3 rounded-xl border p-3">
                <span>{String(row.invoice_number || "—")}</span>
                <b>{formatPrice(Number(row.balance_due || 0), String(row.currency || "UZS"), false)}</b>
              </div>
            )) : <p className="py-6 text-center text-sm text-muted-foreground">{language === "uz" ? "Qarzlar yo‘q" : "Долгов нет"}</p>}
          </CardContent></Card>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="h-auto flex-wrap gap-1 rounded-panel border border-border/50 bg-card/80 p-1 shadow-sm">
            <TabsTrigger
              value="profile"
              className="gap-2 rounded-xl"
            >
              <User className="h-4 w-4" />
              {tr("crmPatientDetail.tabProfile", "Профиль")}
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="gap-2 rounded-xl"
            >
              <FileText className="h-4 w-4" />
              {tr("crmPatientDetail.tabHistory", "История визитов")}
            </TabsTrigger>
            <TabsTrigger
              value="payments"
              className="gap-2 rounded-xl"
            >
              <CreditCard className="h-4 w-4" />
              {tr("crmPatientDetail.tabPayments", "История оплат")}
            </TabsTrigger>
            <TabsTrigger
              value="finance"
              className="gap-2 rounded-xl"
            >
              <CreditCard className="h-4 w-4" />
              {tr("crmPatientDetail.tabFinance", "Финансы")}
            </TabsTrigger>
            <TabsTrigger
              value="chart"
              className="gap-2 rounded-xl"
            >
              <Stethoscope className="h-4 w-4" />
              {tr("crmPatientDetail.tabChart", "Медкарта")}
            </TabsTrigger>
            <TabsTrigger
              value="files"
              className="gap-2 rounded-xl"
            >
              <ImageIcon className="h-4 w-4" />
              {tr("crmPatientDetail.tabFiles", "Файлы и снимки")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <PatientProfile patient={patient} />
          </TabsContent>
          <TabsContent value="history">
            <VisitHistory patientId={patient.id} />
          </TabsContent>
          <TabsContent value="payments">
            <PatientPaymentHistory patientId={patient.id} />
          </TabsContent>
          <TabsContent value="finance">
            <PatientFinanceTab patientId={patient.id} />
          </TabsContent>
          <TabsContent value="chart">
            <UltraRealisticDentalChart
              patientId={patient.id}
              birthDate={patient.birth_date}
            />
          </TabsContent>
          <TabsContent value="files">
            <PatientFiles patientId={patient.id} />
          </TabsContent>
        </Tabs>
      </div>
    </CRMLayout>
  );
}
