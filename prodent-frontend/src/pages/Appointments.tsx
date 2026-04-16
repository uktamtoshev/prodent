import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Calendar, Clock, MapPin, User, X, CheckCircle, AlertCircle } from "lucide-react";
import { format, isPast, isFuture } from "date-fns";
import { ru } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

interface Appointment {
  id: string;
  appointment_date: string;
  service: string;
  status: string;
  notes: string | null;
  price: number;
  doctor: {
    id: string;
    specialty: string;
    profile: {
      full_name: string;
      avatar_url: string | null;
    };
  };
  clinic: {
    name: string;
    address: string;
    city: string;
    phone: string;
  } | null;
}

const Appointments = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  // Fetch appointments
  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["appointments", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("appointments")
        .select(`
          *,
          doctor:doctors(
            id,
            specialty,
            profile:profiles(full_name, avatar_url)
          ),
          clinic:clinics(name, address, city, phone)
        `)
        .eq("patient_id", user.id)
        .order("appointment_date", { ascending: false });

      if (error) throw error;
      return data as Appointment[];
    },
    enabled: !!user,
  });

  // Cancel appointment mutation
  const cancelMutation = useMutation({
    mutationFn: async (appointmentId: string) => {
      const { error } = await supabase
        .from("appointments")
        .update({ status: "cancelled" })
        .eq("id", appointmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast({
        title: "Запись отменена",
        description: "Вы можете создать новую запись в любое время",
      });
      setCancellingId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка отмены",
        description: error.message,
        variant: "destructive",
      });
      setCancellingId(null);
    },
  });

  const upcomingAppointments = appointments.filter((apt) => 
    isFuture(new Date(apt.appointment_date)) && apt.status !== "cancelled"
  );

  const pastAppointments = appointments.filter((apt) => 
    isPast(new Date(apt.appointment_date)) || apt.status === "cancelled"
  );

  const getStatusBadge = (status: string, date: string) => {
    if (status === "cancelled") {
      return <Badge variant="destructive">Отменено</Badge>;
    }
    if (status === "completed") {
      return <Badge className="bg-green-500">Завершено</Badge>;
    }
    if (isPast(new Date(date))) {
      return <Badge variant="secondary">Прошедшая</Badge>;
    }
    if (status === "confirmed") {
      return <Badge className="bg-accent">Подтверждено</Badge>;
    }
    return <Badge variant="secondary">Ожидание</Badge>;
  };

  const canCancel = (appointment: Appointment) => {
    return (
      isFuture(new Date(appointment.appointment_date)) &&
      appointment.status !== "cancelled" &&
      appointment.status !== "completed"
    );
  };

  const renderAppointmentCard = (appointment: Appointment) => (
    <Card key={appointment.id} className="shadow-medium border-2 hover:shadow-strong transition-shadow">
      <CardContent className="p-6">
        <div className="flex gap-6">
          {/* Doctor Avatar */}
          <Avatar className="w-20 h-20 border-2 border-primary/20">
            <AvatarImage src={appointment.doctor.profile?.avatar_url || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary text-lg font-bold">
              {appointment.doctor.profile?.full_name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          {/* Appointment Details */}
          <div className="flex-1">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-xl font-bold mb-1">
                  {appointment.doctor.profile?.full_name}
                </h3>
                <p className="text-primary font-medium">{appointment.doctor.specialty}</p>
              </div>
              {getStatusBadge(appointment.status, appointment.appointment_date)}
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">
                  {format(new Date(appointment.appointment_date), "d MMMM yyyy", { locale: ru })}
                </span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span>{format(new Date(appointment.appointment_date), "HH:mm", { locale: ru })}</span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{appointment.service}</span>
              </div>

              {appointment.clinic && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">{appointment.clinic.name}</p>
                    <p className="text-muted-foreground">
                      {appointment.clinic.city}, {appointment.clinic.address}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {appointment.notes && (
              <div className="p-3 bg-muted rounded-lg mb-4">
                <p className="text-sm text-muted-foreground">Пожелания:</p>
                <p className="text-sm">{appointment.notes}</p>
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-border">
              <div>
                <span className="text-sm text-muted-foreground">Стоимость: </span>
                <span className="text-lg font-bold text-primary">
                  {appointment.price.toLocaleString()} сум
                </span>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/doctor/${appointment.doctor.id}`)}
                >
                  <User className="w-4 h-4" />
                  Профиль врача
                </Button>

                {canCancel(appointment) && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setCancellingId(appointment.id)}
                  >
                    <X className="w-4 h-4" />
                    Отменить
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-hero">
        <Header />
        <div className="container mx-auto px-4 pt-32 pb-12 text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Загрузка записей...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-hero">
      <Header />

      <main className="pt-24 pb-12">
        <div className="container mx-auto px-4 max-w-5xl">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">Мои записи</h1>
            <p className="text-muted-foreground">
              Управляйте своими записями к врачам
            </p>
          </div>

          {/* Empty State */}
          {appointments.length === 0 ? (
            <Card className="shadow-strong border-2">
              <CardContent className="p-12 text-center">
                <Calendar className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h2 className="text-2xl font-bold mb-2">У вас пока нет записей</h2>
                <p className="text-muted-foreground mb-6">
                  Найдите подходящего врача и запишитесь на прием
                </p>
                <Button variant="hero" size="lg" onClick={() => navigate("/")}>
                  Найти врача
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Tabs defaultValue="upcoming" className="space-y-6">
              <TabsList className="grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="upcoming" className="gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Предстоящие ({upcomingAppointments.length})
                </TabsTrigger>
                <TabsTrigger value="past" className="gap-2">
                  <CheckCircle className="w-4 h-4" />
                  История ({pastAppointments.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="upcoming" className="space-y-4">
                {upcomingAppointments.length === 0 ? (
                  <Card className="shadow-medium border-2">
                    <CardContent className="p-8 text-center">
                      <p className="text-muted-foreground">
                        Нет предстоящих записей
                      </p>
                      <Button
                        variant="outline"
                        className="mt-4"
                        onClick={() => navigate("/")}
                      >
                        Записаться к врачу
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  upcomingAppointments.map(renderAppointmentCard)
                )}
              </TabsContent>

              <TabsContent value="past" className="space-y-4">
                {pastAppointments.length === 0 ? (
                  <Card className="shadow-medium border-2">
                    <CardContent className="p-8 text-center">
                      <p className="text-muted-foreground">
                        История записей пуста
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  pastAppointments.map(renderAppointmentCard)
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      </main>

      <Footer />

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={!!cancellingId} onOpenChange={() => setCancellingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Отменить запись?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите отменить эту запись? Это действие нельзя будет отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Нет, оставить</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancellingId && cancelMutation.mutate(cancellingId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Да, отменить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Appointments;
