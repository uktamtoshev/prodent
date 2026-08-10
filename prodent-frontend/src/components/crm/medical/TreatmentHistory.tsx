import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/contexts/ClinicContext";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, CheckCircle2, Clock, Calendar } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface TreatmentHistoryProps {
  patientId: string;
}

interface AppointmentHistoryRow {
  id: string;
  appointment_date: string;
  start_time: string;
  notes: string | null;
  total_price: number | null;
  currency: string | null;
  doctor?: { profiles?: { full_name?: string | null } | null } | null;
  service?: { name?: string | null } | null;
}

interface DentalHistoryRow {
  id: string;
  tooth_number: number;
  condition: string;
  diagnosis: string | null;
  updated_at: string;
}

interface CompletedPlanItemRow {
  id: string;
  treatment_plan_id: string;
  tooth_number: number | null;
  description: string;
  total_price: number;
  completed_at: string | null;
  plan?: { title?: string | null; currency?: string | null } | null;
}

export function TreatmentHistory({ patientId }: TreatmentHistoryProps) {
  const { t } = useLanguage();
  const { currentClinic } = useClinic();

  // Загружаем завершённые визиты
  const { data: appointments, isLoading: loadingAppts } = useQuery({
    queryKey: ["patient-appointments-history", patientId, currentClinic?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select(`
          id, appointment_date, start_time, notes, total_price, currency,
          doctor:doctors(id, user_id, profiles:user_id(full_name)),
          service:services(name)
        `)
        .eq("patient_id", patientId)
        .eq("clinic_id", currentClinic?.id)
        .eq("status", "COMPLETED")
        .order("appointment_date", { ascending: false })
        .limit(20);
      if (error) throw new Error(error.message);
      return (data || []) as AppointmentHistoryRow[];
    },
    enabled: !!currentClinic?.id && !!patientId,
  });

  // Загружаем историю изменений зубов
  const { data: dentalHistory, isLoading: loadingDental } = useQuery({
    queryKey: ["dental-history", patientId, currentClinic?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dental_chart")
        .select("id,tooth_number,condition,diagnosis,updated_at")
        .eq("patient_id", patientId)
        .eq("clinic_id", currentClinic?.id)
        .not("condition", "eq", "HEALTHY")
        .order("updated_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data || []) as DentalHistoryRow[];
    },
    enabled: !!currentClinic?.id,
  });

  // Загружаем выполненные процедуры из планов лечения
  const { data: completedItems, isLoading: loadingItems } = useQuery({
    queryKey: ["completed-plan-items", patientId, currentClinic?.id],
    queryFn: async () => {
      // Сначала получаем планы пациента
      const { data: plans, error: plansError } = await supabase
        .from("treatment_plans")
        .select("id")
        .eq("patient_id", patientId)
        .eq("clinic_id", currentClinic?.id);
      if (plansError) throw new Error(plansError.message);

      if (!plans || plans.length === 0) return [];

      const planIds = plans.map(p => p.id);

      const { data, error } = await supabase
        .from("treatment_plan_items")
        .select(`
          id, treatment_plan_id, tooth_number, description, total_price, completed_at,
          plan:treatment_plans(title,currency)
        `)
        .in("treatment_plan_id", planIds)
        .eq("status", "COMPLETED")
        .order("completed_at", { ascending: false });

      if (error) throw new Error(error.message);
      return (data || []) as CompletedPlanItemRow[];
    },
    enabled: !!currentClinic?.id && !!patientId,
  });

  const isLoading = loadingAppts || loadingDental || loadingItems;

  const getToothStatusLabel = (status: string) => {
    const labels: Record<string, { label: string; className: string }> = {
      CARIES: { label: t('crmTreatmentHistory.cariesLabel'), className: "bg-tooth-caries-bg text-tooth-caries border-tooth-caries/50" },
      FILLING: { label: t('crmTreatmentHistory.fillingLabel'), className: "bg-tooth-filling-bg text-tooth-filling border-tooth-filling/50" },
      CROWN: { label: t('crmTreatmentHistory.crownLabel'), className: "bg-tooth-crown-bg text-tooth-crown border-tooth-crown/50" },
      IMPLANT: { label: t('crmTreatmentHistory.implantLabel'), className: "bg-tooth-implant-bg text-tooth-implant border-tooth-implant/50" },
      MISSING: { label: t('crmTreatmentHistory.removedLabel'), className: "bg-tooth-removed-bg text-tooth-removed border-tooth-removed/50 line-through" },
    };
    const normalized = status.toUpperCase();
    return labels[normalized] || { label: normalized.replace("_", " "), className: "bg-muted" };
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full bg-muted" />
        <Skeleton className="h-24 w-full bg-muted" />
      </div>
    );
  }

  const hasData = (appointments && appointments.length > 0) ||
                  (dentalHistory && dentalHistory.length > 0) ||
                  (completedItems && completedItems.length > 0);

  if (!hasData) {
    return (
      <Card className="bg-card/80 border-border/50">
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>{t('crmTreatmentHistory.historyEmpty')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Завершённые визиты */}
      {appointments && appointments.length > 0 && (
        <Card className="bg-card/80 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <Calendar className="w-5 h-5" />
              {t('crmTreatmentHistory.completedVisits')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {appointments.map((apt) => {
              const doctorName = apt.doctor?.profiles?.full_name || t('crmTreatmentHistory.doctorNotSpecified');
              const appointmentDate = new Date(`${apt.appointment_date}T${apt.start_time}`);
              return (
                <div
                  key={apt.id}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-status-success" />
                      <span className="font-medium text-foreground">
                        {apt.service?.name || apt.notes || t('crmTreatmentHistory.completedVisits')}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {doctorName} • {format(appointmentDate, "dd MMMM yyyy, HH:mm", { locale: ru })}
                    </div>
                  </div>
                  {apt.total_price != null && (
                    <span className="text-sm font-medium text-foreground">
                      {apt.total_price.toLocaleString()} {apt.currency || "UZS"}
                    </span>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* История изменений зубов */}
      {dentalHistory && dentalHistory.length > 0 && (
        <Card className="bg-card/80 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <Clock className="w-5 h-5" />
              {t('crmTreatmentHistory.teethChangesHistory')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {dentalHistory.map((tooth) => {
              const statusInfo = getToothStatusLabel(tooth.condition || "HEALTHY");
              return (
                <div
                  key={tooth.id}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold">
                      {tooth.tooth_number}
                    </div>
                    <div className="space-y-1">
                      <Badge variant="outline" className={statusInfo.className}>
                        {statusInfo.label}
                      </Badge>
                      {tooth.diagnosis && (
                        <p className="text-sm text-muted-foreground">{tooth.diagnosis}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(tooth.updated_at), "dd.MM.yyyy", { locale: ru })}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Выполненные процедуры из планов */}
      {completedItems && completedItems.length > 0 && (
        <Card className="bg-card/80 border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <CheckCircle2 className="w-5 h-5" />
              {t('crmTreatmentHistory.completedFromPlans')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {completedItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
              >
              <div className="space-y-1">
                  <span className="font-medium text-foreground">{item.description}</span>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {item.tooth_number && <span>{t('crmTreatmentHistory.tooth')} #{item.tooth_number}</span>}
                    <span>•</span>
                    <span>{item.plan?.title}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-medium text-foreground">
                    {item.total_price.toLocaleString()} {item.plan?.currency || "UZS"}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
