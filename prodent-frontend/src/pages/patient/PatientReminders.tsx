import { useEffect, useState } from "react";
import { PatientLayout } from "@/components/patient/PatientLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/api/client";
import { useAuth } from "@/contexts/AuthContext";
import { Bell, Calendar, CheckCircle, Clock } from "lucide-react";
import { format, addDays } from "date-fns";
import { ru } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
  metadata: any;
}

interface UpcomingAppointment {
  id: string;
  appointment_date: string;
  service: string;
  doctor_name?: string;
}

export default function PatientReminders() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState<UpcomingAppointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    setLoading(true);

    const { data: notificationsData } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false });

    if (notificationsData) {
      setNotifications(notificationsData);
    }

    const now = new Date();
    const weekLater = addDays(now, 7);

    const { data: appointmentsData } = await supabase
      .from("appointments")
      .select(`
        id,
        appointment_date,
        service,
        doctors (
          user_id
        )
      `)
      .eq("patient_id", user!.id)
      .gte("appointment_date", now.toISOString())
      .lte("appointment_date", weekLater.toISOString())
      .in("status", ["confirmed", "pending"])
      .order("appointment_date", { ascending: true });

    if (appointmentsData) {
      const doctorUserIds = appointmentsData
        .map(a => a.doctors?.user_id)
        .filter(Boolean);

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", doctorUserIds);

      const appointmentsWithNames = appointmentsData.map(apt => ({
        ...apt,
        doctor_name: profiles?.find(p => p.id === apt.doctors?.user_id)?.full_name
      }));

      setUpcomingAppointments(appointmentsWithNames);
    }

    setLoading(false);
  };

  const markAsRead = async (id: string) => {
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", id);

    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const markAllAsRead = async () => {
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user!.id);

    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "appointment": return <Calendar className="w-5 h-5 text-primary" />;
      case "reminder": return <Bell className="w-5 h-5 text-amber-500" />;
      default: return <Bell className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <PatientLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-foreground flex items-center gap-3">
              <Bell className="w-8 h-8" />
              Напоминания
            </h1>
            <p className="text-muted-foreground mt-1">Уведомления и предстоящие приёмы</p>
          </div>
          {unreadCount > 0 && (
            <Button variant="outline" onClick={markAllAsRead}>
              <CheckCircle className="w-4 h-4 mr-2" />
              Прочитать все ({unreadCount})
            </Button>
          )}
        </div>

        {upcomingAppointments.length > 0 && (
          <Card className="border-amber-500/30 bg-amber-500/5 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-500" />
                Ближайшие записи (7 дней)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {upcomingAppointments.map((apt) => (
                <div
                  key={apt.id}
                  className="p-4 rounded-xl bg-background/50 border border-border/50"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">{apt.service}</p>
                      <p className="text-sm text-muted-foreground">
                        {apt.doctor_name || "Врач"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-foreground">
                        {format(new Date(apt.appointment_date), "d MMMM", { locale: ru })}
                      </p>
                      <p className="text-sm text-amber-500">
                        {format(new Date(apt.appointment_date), "HH:mm")}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-foreground">Уведомления</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <>
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </>
            ) : notifications.length > 0 ? (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 rounded-xl border transition-colors cursor-pointer ${
                    notification.read
                      ? "bg-accent/20 border-border/50"
                      : "bg-primary/5 border-primary/20"
                  }`}
                  onClick={() => !notification.read && markAsRead(notification.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {getTypeIcon(notification.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-foreground">{notification.title}</h3>
                        {!notification.read && (
                          <Badge variant="default" className="text-xs">Новое</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {format(new Date(notification.created_at), "d MMMM yyyy, HH:mm", { locale: ru })}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Bell className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">Уведомлений пока нет</p>
                <p className="text-sm">Здесь будут появляться напоминания о приёмах</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PatientLayout>
  );
}
