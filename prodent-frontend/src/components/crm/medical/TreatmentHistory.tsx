import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/api/client";
import { useClinic } from "@/contexts/ClinicContext";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, CheckCircle2, Clock, Calendar } from "lucide-react";

interface TreatmentHistoryProps {
  patientId: string;
}

export function TreatmentHistory({ patientId }: TreatmentHistoryProps) {
  const { currentClinic } = useClinic();

  // Загружаем завершённые визиты
  const { data: appointments, isLoading: loadingAppts } = useQuery({
    queryKey: ["patient-appointments-history", patientId, currentClinic?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select(`
          *,
          doctor:doctors(id, user_id, profiles:user_id(full_name))
        `)
        .eq("patient_id", patientId)
        .eq("clinic_id", currentClinic?.id)
        .eq("status", "completed")
        .order("appointment_date", { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!currentClinic?.id && !!patientId,
  });

  // Загружаем историю изменений зубов
  const { data: dentalHistory, isLoading: loadingDental } = useQuery({
    queryKey: ["dental-history", patientId, currentClinic?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("dental_chart")
        .select("*")
        .eq("patient_id", patientId)
        .eq("clinic_id", currentClinic?.id)
        .not("status", "eq", "healthy")
        .order("updated_at", { ascending: false });
      return data || [];
    },
    enabled: !!currentClinic?.id,
  });

  // Загружаем выполненные процедуры из планов лечения
  const { data: completedItems, isLoading: loadingItems } = useQuery({
    queryKey: ["completed-plan-items", patientId, currentClinic?.id],
    queryFn: async () => {
      // Сначала получаем планы пациента
      const { data: plans } = await supabase
        .from("treatment_plans")
        .select("id")
        .eq("patient_id", patientId)
        .eq("clinic_id", currentClinic?.id);

      if (!plans || plans.length === 0) return [];

      const planIds = plans.map(p => p.id);
      
      const { data } = await supabase
        .from("treatment_plan_items")
        .select(`
          *,
          plan:treatment_plans(name)
        `)
        .in("plan_id", planIds)
        .eq("status", "completed")
        .order("completed_at", { ascending: false });
      
      return data || [];
    },
    enabled: !!currentClinic?.id && !!patientId,
  });

  const isLoading = loadingAppts || loadingDental || loadingItems;

  const getToothStatusLabel = (status: string) => {
    const labels: Record<string, { label: string; className: string }> = {
      caries: { label: "Кариес", className: "bg-red-500/20 text-red-400 border-red-500/50" },
      filling: { label: "Пломба", className: "bg-blue-500/20 text-blue-400 border-blue-500/50" },
      crown: { label: "Коронка", className: "bg-amber-500/20 text-amber-400 border-amber-500/50" },
      implant: { label: "Имплант", className: "bg-purple-500/20 text-purple-400 border-purple-500/50" },
      removed: { label: "Удален", className: "bg-muted text-muted-foreground border-muted-foreground/50" },
    };
    return labels[status] || { label: status, className: "bg-muted" };
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
            <p>История процедур пуста</p>
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
            <CardTitle className="text-foreground flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Завершённые визиты
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {appointments.map((apt) => {
              const doctorName = (apt.doctor as any)?.profiles?.full_name || "Врач не указан";
              return (
                <div
                  key={apt.id}
                  className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <span className="font-medium text-foreground">{apt.service}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {doctorName} • {format(new Date(apt.appointment_date), "dd MMMM yyyy, HH:mm", { locale: ru })}
                    </div>
                  </div>
                  {apt.price && (
                    <span className="text-sm font-medium text-foreground">
                      {apt.price.toLocaleString()} UZS
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
            <CardTitle className="text-foreground flex items-center gap-2">
              <Clock className="w-5 h-5" />
              История изменений зубов
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {dentalHistory.map((tooth) => {
              const statusInfo = getToothStatusLabel(tooth.status || "healthy");
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
            <CardTitle className="text-foreground flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              Выполненные процедуры из планов
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {completedItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
              >
              <div className="space-y-1">
                  <span className="font-medium text-foreground">{item.procedure}</span>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {item.tooth_number && <span>Зуб #{item.tooth_number}</span>}
                    <span>•</span>
                    <span>{(item.plan as any)?.name}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-medium text-foreground">
                    {item.price?.toLocaleString()} UZS
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
