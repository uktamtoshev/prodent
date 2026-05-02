import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/api/client";
import { useClinic } from "@/contexts/ClinicContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ru } from "date-fns/locale";
import { 
  TrendingUp, 
  Users, 
  Percent, 
  Building2,
  ArrowRight,
  DollarSign
} from "lucide-react";
import { useState } from "react";

export function StaffDoctorReport() {
  const { currentClinic } = useClinic();
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));

  const periodStart = startOfMonth(new Date(selectedMonth + "-01"));
  const periodEnd = endOfMonth(new Date(selectedMonth + "-01"));

  // Get staff doctors with their appointments
  const { data: reportData, isLoading } = useQuery({
    queryKey: ["staff-doctor-report", currentClinic?.id, selectedMonth],
    queryFn: async () => {
      // Get staff doctors
      const { data: staffDoctors } = await supabase
        .from("doctors")
        .select(`
          id,
          salary_percent,
          cooperation_type,
          profiles:user_id(full_name)
        `)
        .eq("clinic_id", currentClinic?.id)
        .eq("cooperation_type", "staff_doctor");

      if (!staffDoctors?.length) return { doctors: [], totals: null };

      // Get clinic patients (not personal patients of chair_rental doctors)
      const { data: clinicPatients } = await supabase
        .from("clinic_members")
        .select("user_id")
        .eq("clinic_id", currentClinic?.id)
        .eq("role", "patient")
        .is("assigned_doctor_id", null);
      
      const clinicPatientIds = clinicPatients?.map(p => p.user_id) || [];

      // Get appointments for staff doctors with clinic patients only
      const { data: appointments } = await supabase
        .from("appointments")
        .select("doctor_id, price, patient_id")
        .eq("clinic_id", currentClinic?.id)
        .eq("status", "completed")
        .in("doctor_id", staffDoctors.map(d => d.id))
        .in("patient_id", clinicPatientIds.length > 0 ? clinicPatientIds : ['no-patients'])
        .gte("appointment_date", periodStart.toISOString())
        .lte("appointment_date", periodEnd.toISOString());

      // Calculate per-doctor stats
      const doctorStats = staffDoctors.map(doctor => {
        const doctorAppointments = appointments?.filter(a => a.doctor_id === doctor.id) || [];
        const revenue = doctorAppointments.reduce((sum, a) => sum + (a.price || 0), 0);
        const salaryPercent = doctor.salary_percent || 30;
        const doctorShare = Math.round(revenue * (salaryPercent / 100));
        const clinicProfit = revenue - doctorShare;
        const patientsCount = new Set(doctorAppointments.map(a => a.patient_id)).size;

        return {
          id: doctor.id,
          name: (doctor.profiles as any)?.full_name || "Врач",
          salaryPercent,
          revenue,
          doctorShare,
          clinicProfit,
          appointmentsCount: doctorAppointments.length,
          patientsCount,
        };
      });

      // Calculate totals
      const totals = {
        revenue: doctorStats.reduce((sum, d) => sum + d.revenue, 0),
        doctorShare: doctorStats.reduce((sum, d) => sum + d.doctorShare, 0),
        clinicProfit: doctorStats.reduce((sum, d) => sum + d.clinicProfit, 0),
        appointmentsCount: doctorStats.reduce((sum, d) => sum + d.appointmentsCount, 0),
        patientsCount: new Set(appointments?.map(a => a.patient_id)).size,
      };

      return { doctors: doctorStats, totals };
    },
    enabled: !!currentClinic?.id,
  });

  const months = Array.from({ length: 12 }, (_, i) => {
    const date = subMonths(new Date(), i);
    return {
      value: format(date, "yyyy-MM"),
      label: format(date, "LLLL yyyy", { locale: ru }),
    };
  });

  if (isLoading) {
    return <Skeleton className="h-96 w-full bg-muted" />;
  }

  const { doctors, totals } = reportData || { doctors: [], totals: null };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[200px] bg-background border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      {totals && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Общая выручка</p>
                  <p className="text-2xl font-bold text-foreground">{totals.revenue.toLocaleString()} UZS</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                  <Users className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Доля врачей</p>
                  <p className="text-2xl font-bold text-amber-400">{totals.doctorShare.toLocaleString()} UZS</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Прибыль клиники</p>
                  <p className="text-2xl font-bold text-emerald-400">{totals.clinicProfit.toLocaleString()} UZS</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Revenue Flow Visualization */}
      {totals && totals.revenue > 0 && (
        <Card className="bg-card/80 border-border/50">
          <CardHeader>
            <CardTitle className="text-foreground">Распределение выручки</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-4 p-4 bg-muted/30 rounded-lg">
              <div className="text-center flex-1">
                <DollarSign className="w-8 h-8 mx-auto mb-2 text-primary" />
                <p className="text-2xl font-bold text-foreground">{totals.revenue.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Выручка</p>
              </div>
              <ArrowRight className="w-6 h-6 text-muted-foreground" />
              <div className="text-center flex-1">
                <Users className="w-8 h-8 mx-auto mb-2 text-amber-500" />
                <p className="text-2xl font-bold text-amber-400">{totals.doctorShare.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Врачам ({Math.round(totals.doctorShare / totals.revenue * 100)}%)</p>
              </div>
              <ArrowRight className="w-6 h-6 text-muted-foreground" />
              <div className="text-center flex-1">
                <Building2 className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                <p className="text-2xl font-bold text-emerald-400">{totals.clinicProfit.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Клинике ({Math.round(totals.clinicProfit / totals.revenue * 100)}%)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Per-doctor breakdown */}
      <Card className="bg-card/80 border-border/50">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Users className="w-5 h-5" />
            Отчёт по штатным врачам за {format(periodStart, "LLLL yyyy", { locale: ru })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {doctors.length > 0 ? (
            <div className="space-y-4">
              {doctors.map((doctor) => (
                <div key={doctor.id} className="p-4 bg-muted/30 rounded-lg">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="font-medium text-foreground">{doctor.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Ставка: {doctor.salaryPercent}% • {doctor.appointmentsCount} приёмов • {doctor.patientsCount} пациентов
                      </p>
                    </div>
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                      Штатный врач
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-3 bg-background/50 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">Выручка</p>
                      <p className="text-lg font-bold text-foreground">
                        {doctor.revenue.toLocaleString()} UZS
                      </p>
                    </div>
                    <div className="p-3 bg-amber-500/10 rounded-lg">
                      <p className="text-xs text-amber-400 mb-1">Доля врача ({doctor.salaryPercent}%)</p>
                      <p className="text-lg font-bold text-amber-400">
                        {doctor.doctorShare.toLocaleString()} UZS
                      </p>
                    </div>
                    <div className="p-3 bg-emerald-500/10 rounded-lg">
                      <p className="text-xs text-emerald-400 mb-1">Прибыль клиники</p>
                      <p className="text-lg font-bold text-emerald-400">
                        {doctor.clinicProfit.toLocaleString()} UZS
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Штатных врачей нет</p>
              <p className="text-sm mt-1">Добавьте врачей с типом "Штатный врач"</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}