import { CRMLayout } from "@/components/crm/CRMLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings, Shield, Save, Bell, Calendar, Globe } from "lucide-react";
import { PermissionsManager } from "@/components/crm/settings/PermissionsManager";
import { useClinic } from "@/contexts/ClinicContext";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/api/client";
import { useEffect, useState } from "react";

interface SettingsForm {
  appointment_duration: number;
  max_advance_booking_days: number;
  auto_confirm_appointments: boolean;
  sms_notifications: boolean;
  email_notifications: boolean;
  queue_enabled: boolean;
  online_booking_enabled: boolean;
}

const DEFAULTS: SettingsForm = {
  appointment_duration: 30,
  max_advance_booking_days: 30,
  auto_confirm_appointments: false,
  sms_notifications: true,
  email_notifications: true,
  queue_enabled: true,
  online_booking_enabled: true,
};

function GeneralSettingsTab() {
  const { currentClinic } = useClinic();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<SettingsForm>(DEFAULTS);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["clinic-settings", currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return null;
      const { data } = await supabase
        .from("clinic_settings")
        .select("*")
        .eq("clinic_id", currentClinic.id)
        .maybeSingle();
      return data;
    },
    enabled: !!currentClinic?.id,
  });

  useEffect(() => {
    if (settings) {
      setForm({
        appointment_duration: settings.appointment_duration ?? 30,
        max_advance_booking_days: settings.max_advance_booking_days ?? 30,
        auto_confirm_appointments: settings.auto_confirm_appointments ?? false,
        sms_notifications: settings.sms_notifications ?? true,
        email_notifications: settings.email_notifications ?? true,
        queue_enabled: settings.queue_enabled ?? true,
        online_booking_enabled: settings.online_booking_enabled ?? true,
      });
    }
  }, [settings]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!currentClinic?.id) throw new Error("Нет выбранной клиники");
      if (settings?.id) {
        const { error } = await supabase
          .from("clinic_settings")
          .update(form)
          .eq("id", settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("clinic_settings")
          .insert({ clinic_id: currentClinic.id, ...form });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clinic-settings"] });
      toast({ title: "Настройки сохранены" });
    },
    onError: (e: any) =>
      toast({ title: "Ошибка сохранения", description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-44" />
        <Skeleton className="h-44" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Расписание и записи
          </CardTitle>
          <CardDescription>Параметры онлайн-записи и слотов</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="duration">Продолжительность приёма (минут)</Label>
              <Input
                id="duration"
                type="number"
                min={5}
                max={240}
                value={form.appointment_duration}
                onChange={(e) =>
                  setForm({ ...form, appointment_duration: Number(e.target.value) || 0 })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="advance">Максимальная глубина бронирования (дней)</Label>
              <Input
                id="advance"
                type="number"
                min={1}
                max={365}
                value={form.max_advance_booking_days}
                onChange={(e) =>
                  setForm({ ...form, max_advance_booking_days: Number(e.target.value) || 0 })
                }
              />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="cursor-pointer">Автоподтверждение записей</Label>
              <p className="text-sm text-muted-foreground">
                Записи через сайт сразу получают статус «Подтверждена»
              </p>
            </div>
            <Switch
              checked={form.auto_confirm_appointments}
              onCheckedChange={(v) => setForm({ ...form, auto_confirm_appointments: v })}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="cursor-pointer">Электронная очередь</Label>
              <p className="text-sm text-muted-foreground">Использовать очередь в день приёма</p>
            </div>
            <Switch
              checked={form.queue_enabled}
              onCheckedChange={(v) => setForm({ ...form, queue_enabled: v })}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="cursor-pointer">Онлайн-запись</Label>
              <p className="text-sm text-muted-foreground">
                Пациенты могут записаться через сайт
              </p>
            </div>
            <Switch
              checked={form.online_booking_enabled}
              onCheckedChange={(v) => setForm({ ...form, online_booking_enabled: v })}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Уведомления
          </CardTitle>
          <CardDescription>Каналы оповещения пациентов</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="cursor-pointer">SMS-уведомления</Label>
              <p className="text-sm text-muted-foreground">
                Напоминания о приёме и подтверждения через SMS
              </p>
            </div>
            <Switch
              checked={form.sms_notifications}
              onCheckedChange={(v) => setForm({ ...form, sms_notifications: v })}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="cursor-pointer">Email-уведомления</Label>
              <p className="text-sm text-muted-foreground">
                Подтверждения и квитанции на email пациента
              </p>
            </div>
            <Switch
              checked={form.email_notifications}
              onCheckedChange={(v) => setForm({ ...form, email_notifications: v })}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
          <Save className="w-4 h-4 mr-2" />
          {saveMut.isPending ? "Сохранение…" : "Сохранить настройки"}
        </Button>
      </div>
    </div>
  );
}

export default function CRMSettings() {
  return (
    <CRMLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <div>
          <h1 className="font-heading text-foreground text-2xl font-bold flex items-center gap-2">
            <Settings className="w-6 h-6 text-primary" />
            Настройки CRM
          </h1>
          <p className="text-muted-foreground mt-1">Параметры клиники, права доступа, уведомления</p>
        </div>

        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="bg-muted/50 border border-border/50">
            <TabsTrigger
              value="general"
              className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
            >
              <Globe className="w-4 h-4" />
              Общие
            </TabsTrigger>
            <TabsTrigger
              value="permissions"
              className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
            >
              <Shield className="w-4 h-4" />
              Права доступа
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <GeneralSettingsTab />
          </TabsContent>

          <TabsContent value="permissions">
            <PermissionsManager />
          </TabsContent>
        </Tabs>
      </div>
    </CRMLayout>
  );
}
