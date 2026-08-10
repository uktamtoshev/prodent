import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/contexts/ClinicContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ru } from "date-fns/locale";
import { Calculator, Check, DollarSign, Users } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Database } from "@/integrations/supabase/types";

type DoctorSalary = Database["public"]["Tables"]["doctor_salaries"]["Row"];
type ProfileSummary = { full_name: string | null };
type DoctorProfile = ProfileSummary | ProfileSummary[] | null;

const getProfileName = (profile: DoctorProfile | undefined) =>
  Array.isArray(profile) ? profile[0]?.full_name : profile?.full_name;

export function SalariesList() {
  const { t } = useLanguage();
  const { currentClinic } = useClinic();
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));

  const periodStart = startOfMonth(new Date(selectedMonth + "-01"));
  const periodEnd = endOfMonth(new Date(selectedMonth + "-01"));

  // Get only staff doctors with their salary percent
  const { data: doctors, isLoading: loadingDoctors } = useQuery({
    queryKey: ["clinic-staff-doctors", currentClinic?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("doctors")
        .select(`
          id,
          salary_percent,
          cooperation_type,
          profiles:user_id(full_name)
        `)
        .eq("clinic_id", currentClinic?.id)
        .eq("cooperation_type", "staff_doctor");
      return data || [];
    },
    enabled: !!currentClinic?.id,
  });

  // Get completed appointments for the period
  const { data: appointmentsByDoctor, isLoading: loadingAppts } = useQuery({
    queryKey: ["doctor-revenue", currentClinic?.id, selectedMonth],
    queryFn: async () => {
      const { data } = await supabase
        .from("appointments")
        .select("doctor_id, total_price")
        .eq("clinic_id", currentClinic?.id)
        .eq("status", "completed")
        .gte("appointment_date", periodStart.toISOString())
        .lte("appointment_date", periodEnd.toISOString());

      const revenueMap: Record<string, number> = {};
      data?.forEach((apt) => {
        revenueMap[apt.doctor_id] = (revenueMap[apt.doctor_id] || 0) + (apt.total_price || 0);
      });
      return revenueMap;
    },
    enabled: !!currentClinic?.id,
  });

  // Get existing salaries for the period
  const { data: existingSalaries } = useQuery({
    queryKey: ["doctor-salaries", currentClinic?.id, selectedMonth],
    queryFn: async () => {
      const { data } = await supabase
        .from("doctor_salaries")
        .select("*")
        .eq("clinic_id", currentClinic?.id)
        .eq("period_start", format(periodStart, "yyyy-MM-dd"))
        .eq("period_end", format(periodEnd, "yyyy-MM-dd"));

      const map: Record<string, DoctorSalary> = {};
      data?.forEach((s) => {
        map[s.doctor_id] = s;
      });
      return map;
    },
    enabled: !!currentClinic?.id,
  });

  const calculateSalaryMutation = useMutation({
    mutationFn: async (doctorId: string) => {
      const doctor = doctors?.find((d) => d.id === doctorId);
      if (!doctor) throw new Error("Doctor not found");

      const revenue = appointmentsByDoctor?.[doctorId] || 0;
      const percent = doctor.salary_percent || 30;
      const calculatedSalary = Math.round(revenue * (percent / 100));

      const { error } = await supabase.from("doctor_salaries").upsert({
        doctor_id: doctorId,
        clinic_id: currentClinic?.id,
        period_start: format(periodStart, "yyyy-MM-dd"),
        period_end: format(periodEnd, "yyyy-MM-dd"),
        total_revenue: revenue,
        salary_percent: percent,
        calculated_salary: calculatedSalary,
        final_salary: calculatedSalary,
        status: "pending",
      }, {
        onConflict: "doctor_id,clinic_id,period_start,period_end",
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doctor-salaries"] });
      toast.success(t('crmSalaries.salaryCalculated'));
    },
    onError: () => {
      toast.error(t('crmSalaries.calcError'));
    },
  });

  const approveSalaryMutation = useMutation({
    mutationFn: async (salaryId: string) => {
      const { error } = await supabase
        .from("doctor_salaries")
        .update({ status: "approved" })
        .eq("id", salaryId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doctor-salaries"] });
      toast.success(t('crmSalaries.salaryApproved'));
    },
  });

  const paySalaryMutation = useMutation({
    mutationFn: async (salaryId: string) => {
      const { error } = await supabase
        .from("doctor_salaries")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("id", salaryId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doctor-salaries"] });
      toast.success(t('crmSalaries.salaryPaid'));
    },
  });

  const months = Array.from({ length: 12 }, (_, i) => {
    const date = subMonths(new Date(), i);
    return {
      value: format(date, "yyyy-MM"),
      label: format(date, "LLLL yyyy", { locale: ru }),
    };
  });

  const isLoading = loadingDoctors || loadingAppts;
  const salaryRows = doctors?.map((doctor) => {
    const revenue = appointmentsByDoctor?.[doctor.id] || 0;
    const salary = existingSalaries?.[doctor.id];
    const calculatedSalary = Math.round(revenue * ((doctor.salary_percent || 30) / 100));
    return { doctor, revenue, salary, calculatedSalary };
  }) || [];
  const totalRevenue = salaryRows.reduce((sum, row) => sum + row.revenue, 0);
  const totalToPay = salaryRows.reduce(
    (sum, row) => sum + (row.salary?.final_salary || row.calculatedSalary),
    0,
  );
  const paidCount = salaryRows.filter((row) => row.salary?.status === "paid").length;

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      pending: { label: t('crmSalaries.pending'), className: "bg-status-warning/20 text-status-warning border-status-warning/50" },
      approved: { label: t('crmSalaries.approved'), className: "bg-status-info/20 text-status-info border-status-info/50" },
      paid: { label: t('crmSalaries.paid'), className: "bg-status-success/20 text-status-success border-status-success/50" },
    };
    return variants[status] || variants.pending;
  };

  if (isLoading) {
    return <Skeleton className="h-96 w-full bg-muted" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="bg-card/80 border-border/50">
          <CardContent className="px-card-x pb-card-x pt-0">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('crmSalaries.revenue')}</p>
                <p className="text-xl font-bold text-foreground">{totalRevenue.toLocaleString()} UZS</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/80 border-border/50">
          <CardContent className="px-card-x pb-card-x pt-0">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-status-success/15">
                <Calculator className="h-5 w-5 text-status-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('crmSalaries.toPay')}</p>
                <p className="text-xl font-bold text-status-success">{totalToPay.toLocaleString()} UZS</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/80 border-border/50">
          <CardContent className="px-card-x pb-card-x pt-0">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-status-info/15">
                <Check className="h-5 w-5 text-status-info" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('crmSalaries.paid')}</p>
                <p className="text-xl font-bold text-foreground">{paidCount} / {salaryRows.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card/80 border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-bold text-foreground">
            <Users className="w-5 h-5" />
            {t('crmSalaries.staffSalariesFor')} {format(periodStart, "LLLL yyyy", { locale: ru })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {doctors && doctors.length > 0 ? (
            <div className="space-y-4">
              {salaryRows.map(({ doctor, revenue, salary, calculatedSalary }) => {
                const statusBadge = salary ? getStatusBadge(salary.status) : null;

                return (
                  <div key={doctor.id} className="p-4 bg-muted/30 rounded-2xl">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-medium text-foreground">
                          {getProfileName(doctor.profiles) || t('crmSalaries.doctorFallback')}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {t('crmSalaries.rate')}: {doctor.salary_percent || 30}{t('crmSalaries.rateOfRevenue')}
                        </p>
                      </div>
                      {statusBadge && (
                        <Badge variant="outline" className={statusBadge.className}>
                          {statusBadge.label}
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-3 mt-4 md:grid-cols-3">
                      <div className="p-3 bg-background/50 rounded-xl">
                        <p className="text-xs text-muted-foreground">{t('crmSalaries.revenue')}</p>
                        <p className="text-lg font-bold text-foreground">
                          {revenue.toLocaleString()} UZS
                        </p>
                      </div>
                      <div className="p-3 bg-background/50 rounded-xl">
                        <p className="text-xs text-muted-foreground">{t('crmSalaries.calculatedSalary')}</p>
                        <p className="text-lg font-bold text-primary">
                          {(salary?.calculated_salary || calculatedSalary).toLocaleString()} UZS
                        </p>
                      </div>
                      <div className="p-3 bg-background/50 rounded-xl">
                        <p className="text-xs text-muted-foreground">{t('crmSalaries.toPay')}</p>
                        <p className="text-lg font-bold text-status-success">
                          {(salary?.final_salary || calculatedSalary).toLocaleString()} UZS
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-4">
                      {!salary && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => calculateSalaryMutation.mutate(doctor.id)}
                          disabled={calculateSalaryMutation.isPending}
                        >
                          <Calculator className="w-4 h-4 mr-1" />
                          {t('crmSalaries.calculate')}
                        </Button>
                      )}
                      {salary?.status === "pending" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => approveSalaryMutation.mutate(salary.id)}
                        >
                          <Check className="w-4 h-4 mr-1" />
                          {t('crmSalaries.approve')}
                        </Button>
                      )}
                      {salary?.status === "approved" && (
                        <Button
                          size="sm"
                          onClick={() => paySalaryMutation.mutate(salary.id)}
                        >
                          <DollarSign className="w-4 h-4 mr-1" />
                          {t('crmSalaries.pay')}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
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
