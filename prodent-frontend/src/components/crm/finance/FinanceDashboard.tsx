import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/contexts/ClinicContext";
import { format, subDays, subMonths, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FinanceDashboardStats } from "./FinanceDashboardStats";
import { FinanceRevenueChart } from "./FinanceRevenueChart";
import { FinanceTopServices } from "./FinanceTopServices";
import { FinanceTopDoctors } from "./FinanceTopDoctors";
import { FinanceAppointmentsTable } from "./FinanceAppointmentsTable";
import { Skeleton } from "@/components/ui/skeleton";

type PeriodType = "7days" | "30days" | "3months" | "year";

interface FinanceDashboardProps {
  currency?: string;
}

export function FinanceDashboard({ currency = "UZS" }: FinanceDashboardProps) {
  const { currentClinic } = useClinic();
  const [period, setPeriod] = useState<PeriodType>("30days");

  const getDateRange = () => {
    const now = new Date();
    switch (period) {
      case "7days":
        return { start: subDays(now, 7), end: now };
      case "30days":
        return { start: subDays(now, 30), end: now };
      case "3months":
        return { start: subMonths(now, 3), end: now };
      case "year":
        return { start: subMonths(now, 12), end: now };
      default:
        return { start: subDays(now, 30), end: now };
    }
  };

  const getPreviousDateRange = () => {
    const now = new Date();
    switch (period) {
      case "7days":
        return { start: subDays(now, 14), end: subDays(now, 7) };
      case "30days":
        return { start: subDays(now, 60), end: subDays(now, 30) };
      case "3months":
        return { start: subMonths(now, 6), end: subMonths(now, 3) };
      case "year":
        return { start: subMonths(now, 24), end: subMonths(now, 12) };
      default:
        return { start: subDays(now, 60), end: subDays(now, 30) };
    }
  };

  const { start, end } = getDateRange();
  const { start: prevStart, end: prevEnd } = getPreviousDateRange();

  // Load staff doctor IDs
  const { data: staffDoctorIds } = useQuery({
    queryKey: ["staff-doctor-ids", currentClinic?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("doctors")
        .select("id")
        .eq("clinic_id", currentClinic?.id)
        .eq("cooperation_type", "staff_doctor");
      return data?.map(d => d.id) || [];
    },
    enabled: !!currentClinic?.id,
  });

  // Load clinic patient IDs
  const { data: clinicPatientIds } = useQuery({
    queryKey: ["clinic-patient-ids", currentClinic?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("clinic_members")
        .select("user_id")
        .eq("clinic_id", currentClinic?.id)
        .eq("role", "patient")
        .is("assigned_doctor_id", null);
      return data?.map(p => p.user_id) || [];
    },
    enabled: !!currentClinic?.id,
  });

  // Load appointments for current period
  const { data: appointments, isLoading } = useQuery({
    queryKey: ["finance-dashboard-appointments", currentClinic?.id, period, staffDoctorIds, clinicPatientIds],
    queryFn: async () => {
      if (!staffDoctorIds?.length) return [];
      if (!clinicPatientIds?.length) return [];
      
      const { data } = await supabase
        .from("appointments")
        .select(`
          *,
          doctor:doctors(id, user_id, profiles:profiles!doctors_user_id_fkey(first_name, last_name)),
          patient:profiles!appointments_patient_id_fkey(id, first_name, last_name, phone)
        `)
        .eq("clinic_id", currentClinic?.id)
        .in("doctor_id", staffDoctorIds)
        .in("patient_id", clinicPatientIds)
        .gte("appointment_date", start.toISOString())
        .lte("appointment_date", end.toISOString())
        .order("appointment_date", { ascending: false });

      return data || [];
    },
    enabled: !!currentClinic?.id && !!staffDoctorIds && !!clinicPatientIds,
  });

  // Load previous period appointments for comparison
  const { data: prevAppointments } = useQuery({
    queryKey: ["finance-dashboard-prev-appointments", currentClinic?.id, period, staffDoctorIds, clinicPatientIds],
    queryFn: async () => {
      if (!staffDoctorIds?.length) return [];
      if (!clinicPatientIds?.length) return [];
      
      const { data } = await supabase
        .from("appointments")
        .select("id, status, price, patient_id")
        .eq("clinic_id", currentClinic?.id)
        .in("doctor_id", staffDoctorIds)
        .in("patient_id", clinicPatientIds)
        .gte("appointment_date", prevStart.toISOString())
        .lte("appointment_date", prevEnd.toISOString());

      return data || [];
    },
    enabled: !!currentClinic?.id && !!staffDoctorIds && !!clinicPatientIds,
  });

  // Load debts from invoices
  const { data: debtsData } = useQuery({
    queryKey: ["finance-dashboard-debts", currentClinic?.id],
    queryFn: async () => {
      // Get unpaid invoices
      const { data: invoices } = await supabase
        .from("invoices")
        .select("id, patient_id, final_amount")
        .eq("clinic_id", currentClinic?.id)
        .neq("status", "paid")
        .neq("status", "cancelled");

      if (!invoices?.length) return { totalDebt: 0, debtorsCount: 0 };

      // Get payments for these invoices
      const invoiceIds = invoices.map(i => i.id);
      const { data: payments } = await supabase
        .from("payments")
        .select("invoice_id, amount")
        .in("invoice_id", invoiceIds)
        .eq("status", "completed");

      const paymentsMap: Record<string, number> = {};
      payments?.forEach(p => {
        if (p.invoice_id) {
          paymentsMap[p.invoice_id] = (paymentsMap[p.invoice_id] || 0) + p.amount;
        }
      });

      // Calculate debts
      const debts = invoices.map(inv => ({
        patient_id: inv.patient_id,
        debt_amount: inv.final_amount - (paymentsMap[inv.id] || 0),
      })).filter(d => d.debt_amount > 0);

      const totalDebt = debts.reduce((sum, d) => sum + d.debt_amount, 0);
      const debtorsCount = new Set(debts.map(d => d.patient_id)).size;

      return { totalDebt, debtorsCount };
    },
    enabled: !!currentClinic?.id,
  });

  // Calculate stats
  const stats = useMemo(() => {
    const completed = appointments?.filter(a => a.status === "completed") || [];
    const prevCompleted = prevAppointments?.filter(a => a.status === "completed") || [];

    const totalRevenue = completed.reduce((sum, a) => sum + (a.price || 0), 0);
    const prevRevenue = prevCompleted.reduce((sum, a) => sum + (a.price || 0), 0);
    
    const uniquePatients = new Set(completed.map(a => a.patient_id)).size;
    const prevUniquePatients = new Set(prevCompleted.map(a => a.patient_id)).size;

    const completedCount = completed.length;
    const prevCompletedCount = prevCompleted.length;

    const averageCheck = completedCount > 0 ? totalRevenue / completedCount : 0;
    const prevAverageCheck = prevCompletedCount > 0 ? prevRevenue / prevCompletedCount : 0;

    const conversionRate = appointments?.length ? (completedCount / appointments.length) * 100 : 0;
    const prevConversionRate = prevAppointments?.length ? (prevCompletedCount / prevAppointments.length) * 100 : 0;

    const totalDebt = debtsData?.totalDebt || 0;
    const debtorsCount = debtsData?.debtorsCount || 0;

    const calcTrend = (current: number, prev: number) => {
      if (prev === 0) return current > 0 ? 100 : 0;
      return ((current - prev) / prev) * 100;
    };

    return {
      totalRevenue,
      revenueTrend: calcTrend(totalRevenue, prevRevenue),
      uniquePatients,
      patientsTrend: calcTrend(uniquePatients, prevUniquePatients),
      completedAppointments: completedCount,
      appointmentsTrend: calcTrend(completedCount, prevCompletedCount),
      averageCheck,
      averageCheckTrend: calcTrend(averageCheck, prevAverageCheck),
      conversionRate,
      conversionTrend: conversionRate - prevConversionRate,
      totalDebt,
      debtorsCount,
    };
  }, [appointments, prevAppointments, debtsData]);

  // Revenue chart data
  const revenueChartData = useMemo(() => {
    const dataMap = new Map<string, number>();
    
    appointments
      ?.filter(a => a.status === "completed")
      .forEach(a => {
        const dateFormat = period === "7days" || period === "30days" ? "dd MMM" : "MMM yyyy";
        const date = format(parseISO(a.appointment_date), dateFormat, { locale: ru });
        dataMap.set(date, (dataMap.get(date) || 0) + (a.price || 0));
      });

    return Array.from(dataMap.entries())
      .map(([date, revenue]) => ({ date, revenue }))
      .slice(-30);
  }, [appointments, period]);

  // Top services
  const topServices = useMemo(() => {
    const serviceMap = new Map<string, { count: number; revenue: number }>();
    
    appointments
      ?.filter(a => a.status === "completed")
      .forEach(a => {
        const service = a.service || "Консультация";
        const current = serviceMap.get(service) || { count: 0, revenue: 0 };
        serviceMap.set(service, {
          count: current.count + 1,
          revenue: current.revenue + (a.price || 0),
        });
      });

    return Array.from(serviceMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [appointments]);

  // Top doctors
  const topDoctors = useMemo(() => {
    const doctorMap = new Map<string, { name: string; count: number; revenue: number }>();
    
    appointments
      ?.filter(a => a.status === "completed")
      .forEach(a => {
        const doctorName = a.doctor?.profiles 
          ? `${a.doctor.profiles.first_name || ''} ${a.doctor.profiles.last_name || ''}`.trim()
          : "Врач";
        const doctorId = a.doctor_id;
        const current = doctorMap.get(doctorId) || { name: doctorName, count: 0, revenue: 0 };
        doctorMap.set(doctorId, {
          name: doctorName,
          count: current.count + 1,
          revenue: current.revenue + (a.price || 0),
        });
      });

    return Array.from(doctorMap.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [appointments]);

  // Completed appointments for table
  const completedAppointments = useMemo(() => {
    return appointments?.filter(a => a.status === "completed") || [];
  }, [appointments]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-28 bg-muted" />
          ))}
        </div>
        <Skeleton className="h-80 bg-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Обзор финансов</h2>
        <Tabs value={period} onValueChange={v => setPeriod(v as PeriodType)}>
          <TabsList className="bg-muted/50 border border-border/30">
            <TabsTrigger value="7days" className="text-sm">7 дней</TabsTrigger>
            <TabsTrigger value="30days" className="text-sm">30 дней</TabsTrigger>
            <TabsTrigger value="3months" className="text-sm">3 мес</TabsTrigger>
            <TabsTrigger value="year" className="text-sm">Год</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Stats Cards */}
      <FinanceDashboardStats stats={stats} currency={currency} />

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <FinanceRevenueChart data={revenueChartData} currency={currency} />
        </div>
        <div className="space-y-6">
          <FinanceTopServices services={topServices} currency={currency} />
          <FinanceTopDoctors doctors={topDoctors} currency={currency} />
        </div>
      </div>

      {/* Appointments Table */}
      <FinanceAppointmentsTable 
        appointments={completedAppointments} 
        currency={currency}
      />
    </div>
  );
}
