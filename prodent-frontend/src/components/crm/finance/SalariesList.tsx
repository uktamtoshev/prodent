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

export function SalariesList() {
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
        .select("doctor_id, price")
        .eq("clinic_id", currentClinic?.id)
        .eq("status", "completed")
        .gte("appointment_date", periodStart.toISOString())
        .lte("appointment_date", periodEnd.toISOString());

      const revenueMap: Record<string, number> = {};
      data?.forEach((apt) => {
        revenueMap[apt.doctor_id] = (revenueMap[apt.doctor_id] || 0) + (apt.price || 0);
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

      const map: Record<string, any> = {};
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
      toast.success("Зарплата рассчитана");
    },
    onError: () => {
      toast.error("Ошибка расчёта");
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
      toast.success("Зарплата утверждена");
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
      toast.success("Зарплата выплачена");
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

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      pending: { label: "Ожидает", className: "bg-amber-500/20 text-amber-400 border-amber-500/50" },
      approved: { label: "Утверждено", className: "bg-blue-500/20 text-blue-400 border-blue-500/50" },
      paid: { label: "Выплачено", className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/50" },
    };
    return variants[status] || variants.pending;
  };

  if (isLoading) {
    return <Skeleton className="h-96 w-full bg-muted" />;
  }

  return (
    <div className="space-y-4">
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

      <Card className="bg-card/80 border-border/50">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Users className="w-5 h-5" />
            Зарплаты штатных врачей за {format(periodStart, "LLLL yyyy", { locale: ru })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {doctors && doctors.length > 0 ? (
            <div className="space-y-4">
              {doctors.map((doctor) => {
                const revenue = appointmentsByDoctor?.[doctor.id] || 0;
                const salary = existingSalaries?.[doctor.id];
                const calculatedSalary = Math.round(revenue * ((doctor.salary_percent || 30) / 100));
                const statusBadge = salary ? getStatusBadge(salary.status) : null;

                return (
                  <div key={doctor.id} className="p-4 bg-muted/30 rounded-lg">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-foreground">
                          {(doctor.profiles as any)?.full_name || "Врач"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Ставка: {doctor.salary_percent || 30}% от выручки
                        </p>
                      </div>
                      {statusBadge && (
                        <Badge variant="outline" className={statusBadge.className}>
                          {statusBadge.label}
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-4 mt-4">
                      <div className="p-3 bg-background/50 rounded">
                        <p className="text-xs text-muted-foreground">Выручка</p>
                        <p className="text-lg font-bold text-foreground">
                          {revenue.toLocaleString()} UZS
                        </p>
                      </div>
                      <div className="p-3 bg-background/50 rounded">
                        <p className="text-xs text-muted-foreground">Расчётная ЗП</p>
                        <p className="text-lg font-bold text-primary">
                          {(salary?.calculated_salary || calculatedSalary).toLocaleString()} UZS
                        </p>
                      </div>
                      <div className="p-3 bg-background/50 rounded">
                        <p className="text-xs text-muted-foreground">К выплате</p>
                        <p className="text-lg font-bold text-emerald-400">
                          {(salary?.final_salary || calculatedSalary).toLocaleString()} UZS
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-4">
                      {!salary && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => calculateSalaryMutation.mutate(doctor.id)}
                          disabled={calculateSalaryMutation.isPending}
                        >
                          <Calculator className="w-4 h-4 mr-1" />
                          Рассчитать
                        </Button>
                      )}
                      {salary?.status === "pending" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => approveSalaryMutation.mutate(salary.id)}
                        >
                          <Check className="w-4 h-4 mr-1" />
                          Утвердить
                        </Button>
                      )}
                      {salary?.status === "approved" && (
                        <Button
                          size="sm"
                          onClick={() => paySalaryMutation.mutate(salary.id)}
                        >
                          <DollarSign className="w-4 h-4 mr-1" />
                          Выплатить
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
              <p>Штатных врачей нет</p>
              <p className="text-sm mt-1">Добавьте врачей с типом "Штатный врач"</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
