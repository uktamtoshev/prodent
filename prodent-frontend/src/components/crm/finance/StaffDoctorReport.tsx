import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { useLanguage } from "@/contexts/LanguageContext";

type ProfileSummary = { full_name: string | null };
type DoctorProfile = ProfileSummary | ProfileSummary[] | null;

const getProfileName = (profile: DoctorProfile | undefined) =>
  Array.isArray(profile) ? profile[0]?.full_name : profile?.full_name;

export function StaffDoctorReport() {
  const { t } = useLanguage();
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
        .select("doctor_id, total_price, patient_id")
        .eq("clinic_id", currentClinic?.id)
        .eq("status", "completed")
        .in("doctor_id", staffDoctors.map(d => d.id))
        .in("patient_id", clinicPatientIds.length > 0 ? clinicPatientIds : ['no-patients'])
        .gte("appointment_date", periodStart.toISOString())
        .lte("appointment_date", periodEnd.toISOString());

      // Calculate per-doctor stats
      const doctorStats = staffDoctors.map(doctor => {
        const doctorAppointments = appointments?.filter(a => a.doctor_id === doctor.id) || [];
        const revenue = doctorAppointments.reduce((sum, a) => sum + (a.total_price || 0), 0);
        const salaryPercent = doctor.salary_percent || 30;
        const doctorShare = Math.round(revenue * (salaryPercent / 100));
        const clinicProfit = revenue - doctorShare;
        const patientsCount = new Set(doctorAppointments.map(a => a.patient_id)).size;

        return {
          id: doctor.id,
          name: getProfileName(doctor.profiles) || t('crmStaffReport.tableDoctor'),
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
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('crmFinanceDashStats.revenue')}</p>
              <p className="text-2xl font-bold text-foreground">{totals.revenue.toLocaleString()} UZS</p>
            </div>
          </div>

          <Card className="bg-status-warning-bg border-status-warning/20">
            <CardContent className="px-card-x pb-card-x pt-0">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-status-warning/20 flex items-center justify-center">
                  <Users className="w-6 h-6 text-status-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('crmStaffReport.tableShare')}</p>
                  <p className="text-2xl font-bold text-status-warning">{totals.doctorShare.toLocaleString()} UZS</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-status-success/10 to-status-success/5 border-status-success/20">
            <CardContent className="px-card-x pb-card-x pt-0">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-status-success/20 flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-status-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('crmFinanceDashStats.profit')}</p>
                  <p className="text-2xl font-bold text-status-success">{totals.clinicProfit.toLocaleString()} UZS</p>
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
            <CardTitle className="text-foreground">{t('crmStaffReport.doctorRevenue')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-4 p-4 bg-muted/30 rounded-lg">
              <div className="text-center flex-1">
                <DollarSign className="w-8 h-8 mx-auto mb-2 text-primary" />
                <p className="text-2xl font-bold text-foreground">{totals.revenue.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">{t('crmFinanceDashStats.revenue')}</p>
              </div>
              <ArrowRight className="w-6 h-6 text-muted-foreground" />
              <div className="text-center flex-1">
                <Users className="w-8 h-8 mx-auto mb-2 text-status-warning" />
                <p className="text-2xl font-bold text-status-warning">{totals.doctorShare.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">{t('crmStaffReport.tableDoctor')} ({Math.round(totals.doctorShare / totals.revenue * 100)}%)</p>
              </div>
              <ArrowRight className="w-6 h-6 text-muted-foreground" />
              <div className="text-center flex-1">
                <Building2 className="w-8 h-8 mx-auto mb-2 text-status-success" />
                <p className="text-2xl font-bold text-status-success">{totals.clinicProfit.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">{t('crmFinanceDashStats.profit')} ({Math.round(totals.clinicProfit / totals.revenue * 100)}%)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Per-doctor breakdown */}
      <Card className="bg-card/80 border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
            <Users className="w-5 h-5" />
            {t('crmSalaries.staffSalariesFor')} {format(periodStart, "LLLL yyyy", { locale: ru })}
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
                        {t('crmSalaries.rate')}: {doctor.salaryPercent}% • {doctor.appointmentsCount} {t('crmStaffReport.apptsLabel')} • {doctor.patientsCount} {t('crmStaffReport.patientsLabel')}
                      </p>
                    </div>
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                      {t('crmDoctorSalary.staffDoctor')}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-3 bg-background/50 rounded-lg">
                      <p className="text-xs text-muted-foreground mb-1">{t('crmFinanceDashStats.revenue')}</p>
                      <p className="text-lg font-bold text-foreground">
                        {doctor.revenue.toLocaleString()} UZS
                      </p>
                    </div>
                    <div className="p-3 bg-status-warning/10 rounded-lg">
                      <p className="text-xs text-status-warning mb-1">{t('crmStaffReport.tableShare')} ({doctor.salaryPercent}%)</p>
                      <p className="text-lg font-bold text-status-warning">
                        {doctor.doctorShare.toLocaleString()} UZS
                      </p>
                    </div>
                    <div className="p-3 bg-status-success/10 rounded-lg">
                      <p className="text-xs text-status-success mb-1">{t('crmFinanceDashStats.profit')}</p>
                      <p className="text-lg font-bold text-status-success">
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
              <p>{t('crmSalaries.noStaffDoctors')}</p>
              <p className="text-sm mt-1">{t('crmSalaries.addStaffDoctorsHint')}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
