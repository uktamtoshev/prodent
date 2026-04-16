import { useEffect, useState } from "react";
import { PatientLayout } from "@/components/patient/PatientLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { History, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

interface Appointment {
  id: string;
  appointment_date: string;
  service: string;
  status: string;
  notes: string | null;
  price: number | null;
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
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadAppointments();
    }
  }, [user]);

  const loadAppointments = async () => {
    setLoading(true);
    
    const { data } = await supabase
      .from("appointments")
      .select(`
        id,
        appointment_date,
        service,
        status,
        notes,
        price,
        doctors (
          id,
          specialty,
          user_id
        ),
        clinics (
          name
        )
      `)
      .eq("patient_id", user!.id)
      .order("appointment_date", { ascending: false });

    if (data) {
      const doctorUserIds = data
        .map(a => a.doctors?.user_id)
        .filter(Boolean);

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", doctorUserIds);

      const appointmentsWithNames = data.map(apt => ({
        ...apt,
        doctor_name: profiles?.find(p => p.id === apt.doctors?.user_id)?.full_name || "Врач"
      }));

      setAppointments(appointmentsWithNames);
    }

    setLoading(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed": return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
      case "pending": return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      case "completed": return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "cancelled": return "bg-destructive/10 text-destructive border-destructive/20";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "confirmed": return "Подтверждён";
      case "pending": return "Ожидает";
      case "completed": return "Завершён";
      case "cancelled": return "Отменён";
      default: return status;
    }
  };

  return (
    <PatientLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <div>
          <h1 className="font-heading text-foreground flex items-center gap-3">
            <History className="w-8 h-8" />
            История посещений
          </h1>
          <p className="text-muted-foreground mt-1">Ваши прошлые и предстоящие визиты</p>
        </div>

        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-foreground">Все записи</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <>
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </>
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
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(apt.appointment_date), "HH:mm")}
                      </p>
                      {apt.price && (
                        <p className="text-sm font-bold text-primary mt-1">
                          {apt.price.toLocaleString()} сум
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <History className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">История посещений пуста</p>
                <p className="text-sm">Запишитесь на первый приём</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PatientLayout>
  );
}
