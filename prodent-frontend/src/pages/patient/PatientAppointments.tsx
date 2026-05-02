import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/api/client";
import { PatientLayout } from "@/components/patient/PatientLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Clock, MapPin, User, ChevronRight, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
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

interface Appointment {
  id: string;
  appointment_date: string;
  service: string;
  status: string;
  notes: string | null;
  doctor: {
    id: string;
    specialty: string;
    user_id: string;
  } | null;
  clinic: {
    name: string;
    address: string;
  } | null;
}

const PatientAppointments = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctorNames, setDoctorNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    if (user?.id) {
      fetchAppointments();
    }
  }, [user?.id]);

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          id,
          appointment_date,
          service,
          status,
          notes,
          doctor:doctors(id, specialty, user_id),
          clinic:clinics(name, address)
        `)
        .eq('patient_id', user?.id)
        .order('appointment_date', { ascending: false });

      if (error) throw error;

      if (data) {
        setAppointments(data as any);
        
        // Fetch doctor names
        const doctorUserIds = data
          .filter((apt: any) => apt.doctor?.user_id)
          .map((apt: any) => apt.doctor.user_id);
        
        if (doctorUserIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', doctorUserIds);
          
          if (profiles) {
            const names: Record<string, string> = {};
            profiles.forEach(p => {
              names[p.id] = p.full_name || '';
            });
            setDoctorNames(names);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelAppointment = async (id: string) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', id)
        .eq('patient_id', user?.id);
      if (error) throw error;
      toast.success('Запись отменена');
      fetchAppointments();
    } catch {
      toast.error('Ошибка при отмене записи');
    } finally {
      setCancelDialogOpen(false);
      setCancellingId(null);
    }
  };

  const upcomingAppointments = appointments.filter(
    apt => new Date(apt.appointment_date) >= new Date() && 
    (apt.status === 'pending' || apt.status === 'confirmed')
  );

  const pastAppointments = appointments.filter(
    apt => new Date(apt.appointment_date) < new Date() || 
    apt.status === 'completed' || apt.status === 'cancelled'
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Подтверждено</Badge>;
      case 'pending':
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">Ожидает</Badge>;
      case 'completed':
        return <Badge className="bg-sky-500/10 text-sky-600 border-sky-500/20">Завершено</Badge>;
      case 'cancelled':
        return <Badge className="bg-rose-500/10 text-rose-600 border-rose-500/20">Отменено</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const AppointmentCard = ({ appointment, showActions = false }: { appointment: Appointment, showActions?: boolean }) => (
    <div className="p-4 rounded-2xl bg-card border border-border/50 hover:border-primary/20 transition-all hover:shadow-md">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {getStatusBadge(appointment.status)}
          </div>
          <h3 className="font-semibold text-foreground">{appointment.service}</h3>
          {appointment.doctor && (
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <User className="w-4 h-4" />
              {doctorNames[appointment.doctor.user_id] || 'Врач'} • {appointment.doctor.specialty}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {format(new Date(appointment.appointment_date), 'd MMMM yyyy', { locale: ru })}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {format(new Date(appointment.appointment_date), 'HH:mm')}
            </span>
            {appointment.clinic && (
              <span className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {appointment.clinic.name}
              </span>
            )}
          </div>
        </div>
        {showActions && (appointment.status === 'pending' || appointment.status === 'confirmed') && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate(`/patient/book`)}>Перенести</Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="text-destructive hover:text-destructive"
              onClick={() => { setCancellingId(appointment.id); setCancelDialogOpen(true); }}
            >
              Отменить
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <PatientLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </PatientLayout>
    );
  }

  return (
    <PatientLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-heading text-foreground">Мои записи</h1>
            <p className="text-muted-foreground mt-1">История и предстоящие визиты</p>
          </div>
          <Button onClick={() => navigate('/patient/book')}>
            <Calendar className="w-4 h-4 mr-2" />
            Записаться
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="upcoming" className="space-y-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="upcoming" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Предстоящие ({upcomingAppointments.length})
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              История ({pastAppointments.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="space-y-4">
            {upcomingAppointments.length > 0 ? (
              upcomingAppointments.map(apt => (
                <AppointmentCard key={apt.id} appointment={apt} showActions />
              ))
            ) : (
              <Card className="border-border/50">
                <CardContent className="text-center py-12">
                  <Calendar className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="font-medium text-foreground mb-2">Нет предстоящих записей</h3>
                  <p className="text-muted-foreground mb-4">Запишитесь на приём к врачу</p>
                  <Button onClick={() => navigate('/patient/book')}>
                    Записаться на приём
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            {pastAppointments.length > 0 ? (
              pastAppointments.map(apt => (
                <AppointmentCard key={apt.id} appointment={apt} />
              ))
            ) : (
              <Card className="border-border/50">
                <CardContent className="text-center py-12">
                  <Clock className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="font-medium text-foreground mb-2">История пуста</h3>
                  <p className="text-muted-foreground">Здесь будут отображаться ваши прошлые визиты</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Отменить запись?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите отменить эту запись? Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Нет</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => cancellingId && handleCancelAppointment(cancellingId)}
            >
              Да, отменить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PatientLayout>
  );
};

export default PatientAppointments;
