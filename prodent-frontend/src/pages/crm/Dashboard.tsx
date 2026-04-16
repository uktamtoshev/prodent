import { CRMLayout } from "@/components/crm/CRMLayout";
import { Users, DollarSign, UserPlus, TrendingUp, Plus, Calendar } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { GuestAppointmentModal } from "@/components/crm/appointments/GuestAppointmentModal";
import { cn, formatPrice } from "@/lib/utils";
import { useClinic } from "@/contexts/ClinicContext";
import { DashboardStatCard } from "@/components/crm/dashboard/DashboardStatCard";
import { TimelineSchedule } from "@/components/crm/dashboard/TimelineSchedule";
import { EnhancedLiveQueue } from "@/components/crm/dashboard/EnhancedLiveQueue";
import { DashboardTasksWidget } from "@/components/crm/tasks/DashboardTasksWidget";
import { OnboardingWizard } from "@/components/crm/onboarding/OnboardingWizard";

export default function CRMDashboard() {
  const [quickAppointmentOpen, setQuickAppointmentOpen] = useState(false);
  const { currentClinic, loading: clinicLoading } = useClinic();
  const queryClient = useQueryClient();

  // Check onboarding status
  const { data: onboardingCompleted, isLoading: onboardingLoading } = useQuery({
    queryKey: ["onboarding-status", currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return true; // no clinic = skip
      const { data } = await supabase
        .from("clinic_settings")
        .select("value")
        .eq("clinic_id", currentClinic.id)
        .eq("key", "onboarding_completed")
        .maybeSingle();
      return data?.value === true;
    },
    enabled: !clinicLoading && !!currentClinic?.id,
  });

  // Получаем ID текущего врача
  const { data: currentDoctor } = useQuery({
    queryKey: ["current-doctor", currentClinic?.id],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data } = await supabase
        .from("doctors")
        .select("id, clinic_id")
        .eq("user_id", user.id)
        .maybeSingle();

      return data;
    },
  });

  // Статистика по клинике (tenant-aware)
  const { data: todayStats, isLoading: statsLoading } = useQuery({
    queryKey: ["today-stats", currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return null;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data: appointments } = await supabase
        .from("appointments")
        .select("id, status, price")
        .eq("clinic_id", currentClinic.id)
        .gte("appointment_date", today.toISOString())
        .lt("appointment_date", tomorrow.toISOString());

      return {
        todayCount: appointments?.length || 0,
        todayRevenue: appointments?.reduce((sum, a) => sum + (a.price || 0), 0) || 0,
      };
    },
    enabled: !clinicLoading && !!currentClinic?.id,
  });

  // Новые пациенты за неделю (tenant-aware)
  const { data: newPatients } = useQuery({
    queryKey: ["new-patients", currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return 0;

      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const { data } = await supabase
        .from("appointments")
        .select("patient_id")
        .eq("clinic_id", currentClinic.id)
        .gte("created_at", weekAgo.toISOString());

      const uniquePatients = new Set(data?.map(a => a.patient_id));
      return uniquePatients.size;
    },
    enabled: !clinicLoading && !!currentClinic?.id,
  });

  // Конверсия записей (tenant-aware)
  const { data: conversion } = useQuery({
    queryKey: ["conversion", currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return 0;

      const monthAgo = new Date();
      monthAgo.setDate(monthAgo.getDate() - 30);

      const { data: appointments } = await supabase
        .from("appointments")
        .select("status")
        .eq("clinic_id", currentClinic.id)
        .gte("created_at", monthAgo.toISOString());

      const total = appointments?.length || 0;
      const completed = appointments?.filter(a => a.status === "completed").length || 0;

      return total > 0 ? Math.round((completed / total) * 100) : 0;
    },
    enabled: !clinicLoading && !!currentClinic?.id,
  });

  // Show onboarding wizard if not completed
  if (!onboardingLoading && onboardingCompleted === false) {
    return (
      <CRMLayout>
        <OnboardingWizard
          onComplete={() => {
            queryClient.invalidateQueries({ queryKey: ["onboarding-status"] });
          }}
        />
      </CRMLayout>
    );
  }

  return (
    <CRMLayout>
      <div className="p-4 lg:p-6 xl:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground">
              Дашборд
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {currentClinic ? currentClinic.name : 'Выберите клинику'} • {new Date().toLocaleDateString('ru-RU', { 
                weekday: 'long', 
                day: 'numeric', 
                month: 'long' 
              })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              className="gap-2 border-border hover:bg-muted"
            >
              <Calendar className="w-4 h-4" />
              Сегодня
            </Button>
            <Button 
              onClick={() => setQuickAppointmentOpen(true)}
              className="gap-2 bg-primary hover:bg-primary/90 shadow-soft"
              disabled={!currentClinic}
            >
              <Plus className="w-4 h-4" />
              Новая запись
            </Button>
          </div>
        </div>

        {/* Статистика */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <DashboardStatCard
            title="Пациенты сегодня"
            value={todayStats?.todayCount || 0}
            subtitle="Записей на сегодня"
            icon={Users}
            loading={statsLoading || clinicLoading}
            accentColor="blue"
          />
          <DashboardStatCard
            title="Выручка сегодня"
            value={formatPrice(todayStats?.todayRevenue || 0, 'сум', false)}
            subtitle="За текущий день"
            icon={DollarSign}
            loading={statsLoading || clinicLoading}
            accentColor="emerald"
          />
          <DashboardStatCard
            title="Новые пациенты"
            value={newPatients || 0}
            subtitle="За последнюю неделю"
            icon={UserPlus}
            loading={statsLoading || clinicLoading}
            accentColor="violet"
          />
          <DashboardStatCard
            title="Конверсия"
            value={`${conversion ?? 0}%`}
            subtitle="Записей завершено"
            icon={TrendingUp}
            loading={statsLoading || clinicLoading}
            trend={{ value: 5, positive: true }}
            accentColor="amber"
          />
        </div>

        {/* Основной контент: Временная шкала + Очередь */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Временная шкала календаря */}
          <div className="xl:col-span-2">
            <TimelineSchedule 
              doctorId={currentDoctor?.id} 
              clinicId={currentClinic?.id} 
            />
          </div>

          {/* Расширенная живая очередь */}
          <div className="xl:col-span-1 space-y-6">
            <EnhancedLiveQueue 
              doctorId={currentDoctor?.id} 
              clinicId={currentClinic?.id} 
            />
            <DashboardTasksWidget />
          </div>
        </div>

        {/* Плавающая кнопка быстрой записи (mobile) */}
        <Button
          onClick={() => setQuickAppointmentOpen(true)}
          disabled={!currentClinic}
          className={cn(
            "fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-strong z-40",
            "bg-primary hover:bg-primary/90 lg:hidden",
            "hover:scale-110 active:scale-95 transition-transform"
          )}
          size="icon"
        >
          <Plus className="w-6 h-6" />
        </Button>

        {/* Диалог быстрой записи */}
        <GuestAppointmentModal
          open={quickAppointmentOpen}
          onOpenChange={setQuickAppointmentOpen}
          selectedDate={new Date()}
        />
      </div>
    </CRMLayout>
  );
}
