import { useCallback, useEffect, useRef, useState } from "react";
import { PatientLayout } from "@/components/patient/PatientLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { History, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Appointment {
  id: string;
  appointment_date: string;
  start_time: string | null;
  service: string;
  status: string;
  notes: string | null;
  total_price: number | null;
  doctors?: {
    id: string;
    specialty: string;
    user_id: string;
  } | null;
  clinics?: {
    name: string;
  } | null;
  doctor_name?: string;
}

export default function PatientHistory() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const loadRequestRef = useRef(0);

  const loadAppointments = useCallback(async () => {
    const userId = user?.id;
    if (!userId) return;
    const requestId = ++loadRequestRef.current;
    setLoading(true);
    setLoadError(null);

    try {
      const { data, error } = await supabase
        .from("appointments")
        .select(`
        id,
        appointment_date,
        start_time,
        service,
        status,
        notes,
        total_price,
        doctors (
          id,
          specialty,
          user_id
        ),
        clinics (
          name
        )
      `)
        .eq("patient_id", userId)
        .order("appointment_date", { ascending: false });
      if (error) throw error;
      if (requestId !== loadRequestRef.current) return;
      const appointmentRows = data || [];

      const doctorUserIds = appointmentRows
        .map(a => a.doctors?.user_id)
        .filter((id): id is string => typeof id === "string");

      const profiles = doctorUserIds.length > 0
        ? await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", doctorUserIds)
        : { data: [], error: null };
      if (profiles.error) throw profiles.error;
      if (requestId !== loadRequestRef.current) return;

      const appointmentsWithNames = appointmentRows.map(apt => ({
        ...apt,
        doctor_name: profiles.data?.find(p => p.id === apt.doctors?.user_id)?.full_name || t("patientCabinet.doctor")
      }));

      setAppointments(appointmentsWithNames);
    } catch (error) {
      if (requestId !== loadRequestRef.current) return;
      setLoadError(error instanceof Error ? error.message : t("common.error"));
    } finally {
      if (requestId === loadRequestRef.current) setLoading(false);
    }
  }, [t, user?.id]);

  useEffect(() => {
    if (user?.id) {
      void loadAppointments();
    } else {
      loadRequestRef.current += 1;
      setAppointments([]);
      setLoading(false);
    }
    return () => {
      loadRequestRef.current += 1;
    };
  }, [user?.id, loadAppointments]);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "confirmed": return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
      case "pending": return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      case "completed": return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "cancelled": return "bg-destructive/10 text-destructive border-destructive/20";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status.toLowerCase()) {
      case "confirmed": return t("patientCabinet.statusConfirmed");
      case "pending": return t("patientCabinet.statusPending");
      case "completed": return t("patientCabinet.statusCompletedM");
      case "cancelled": return t("patientCabinet.statusCancelledM");
      default: return status;
    }
  };

  return (
    <PatientLayout>
      <div className="min-w-0 space-y-6 p-3 sm:p-6 lg:p-8">
        <div>
          <h1 className="font-heading text-foreground flex items-center gap-3">
            <History className="w-8 h-8" />
            {t("patientCabinet.visitHistory")}
          </h1>
          <p className="text-muted-foreground mt-1">{t("patientCabinet.visitHistoryDesc")}</p>
        </div>

        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-foreground">{t("patientCabinet.allRecords")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div role="status" aria-live="polite" className="space-y-3">
                <span className="sr-only">{t("common.loading")}</span>
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : loadError ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center" role="alert">
                <p className="text-sm font-medium text-destructive">{t("common.error")}</p>
                <Button type="button" variant="outline" className="min-h-11" onClick={() => void loadAppointments()}>
                  Повторить
                </Button>
              </div>
            ) : appointments.length > 0 ? (
              appointments.map((apt) => (
                <div
                  key={apt.id}
                  className="p-4 rounded-xl bg-accent/30 border border-border/50 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-foreground">{apt.service}</h3>
                        <Badge variant="outline" className={getStatusColor(apt.status)}>
                          {getStatusLabel(apt.status)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {apt.doctor_name} • {apt.doctors?.specialty}
                      </p>
                      {apt.clinics?.name && (
                        <p className="text-sm text-muted-foreground">{apt.clinics.name}</p>
                      )}
                      {apt.notes && (
                        <p className="text-sm text-muted-foreground mt-2 italic">
                          "{apt.notes}"
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-foreground flex items-center gap-1 justify-end">
                        <Calendar className="w-4 h-4" />
                        {format(new Date(apt.appointment_date), "d MMMM yyyy", { locale: ru })}
                      </p>
                      {apt.start_time && (
                        <p className="text-sm text-muted-foreground">
                          {apt.start_time.slice(0, 5)}
                        </p>
                      )}
                      {apt.total_price && (
                        <p className="text-sm font-bold text-primary mt-1">
                          {apt.total_price.toLocaleString()} {t("patientCabinet.sumCurrency")}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <History className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">{t("patientCabinet.historyEmptyMessage")}</p>
                <p className="text-sm">{t("patientCabinet.historyEmptyMessageDesc")}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PatientLayout>
  );
}
