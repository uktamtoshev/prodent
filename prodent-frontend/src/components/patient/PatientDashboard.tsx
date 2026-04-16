import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Calendar, 
  Clock, 
  Heart, 
  Sun,
  RefreshCw,
  Bell,
  ChevronRight,
  Smile,
  Shield,
  Activity,
  Droplets
} from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

interface Appointment {
  id: string;
  appointment_date: string;
  service: string;
  status: string;
  doctor: {
    id: string;
    specialty: string;
    user_id: string;
  };
  clinic: {
    name: string;
  };
}

interface HealthIndex {
  overall_score: number;
  gum_health: number;
  teeth_condition: number;
  hygiene_score: number;
}

interface Recommendation {
  id: string;
  title: string;
  description: string;
  recommendation_type: string;
  priority: string;
  is_completed: boolean;
}

export const PatientDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [upcomingAppointment, setUpcomingAppointment] = useState<Appointment | null>(null);
  const [healthIndex, setHealthIndex] = useState<HealthIndex | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [doctorName, setDoctorName] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      fetchDashboardData();
    }
  }, [user?.id]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch upcoming appointment
      const { data: appointments } = await supabase
        .from('appointments')
        .select(`
          id,
          appointment_date,
          service,
          status,
          doctor:doctors(id, specialty, user_id),
          clinic:clinics(name)
        `)
        .eq('patient_id', user?.id)
        .or('status.eq.pending,status.eq.confirmed')
        .gte('appointment_date', new Date().toISOString())
        .order('appointment_date', { ascending: true })
        .limit(1);

      if (appointments && appointments.length > 0) {
        const apt = appointments[0] as any;
        setUpcomingAppointment(apt);
        
        // Fetch doctor name
        if (apt.doctor?.user_id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', apt.doctor.user_id)
            .maybeSingle();
          if (profile) {
            setDoctorName(profile.full_name || '');
          }
        }
      }

      // Fetch health index
      const { data: healthData } = await supabase
        .from('patient_health_index')
        .select('overall_score, gum_health, teeth_condition, hygiene_score')
        .eq('patient_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (healthData) {
        setHealthIndex(healthData);
      }

      // Fetch recommendations
      const { data: recsData } = await supabase
        .from('patient_recommendations')
        .select('*')
        .eq('patient_id', user?.id)
        .eq('is_completed', false)
        .order('priority', { ascending: false })
        .limit(3);

      if (recsData) {
        setRecommendations(recsData);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return "text-emerald-500";
    if (score >= 60) return "text-amber-500";
    return "text-rose-500";
  };

  const getHealthBg = (score: number) => {
    if (score >= 80) return "bg-emerald-500";
    if (score >= 60) return "bg-amber-500";
    return "bg-rose-500";
  };

  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? "Доброе утро" : currentHour < 18 ? "Добрый день" : "Добрый вечер";

  return (
    <div className="space-y-6">
      {/* Greeting Section */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/10 via-primary/5 to-accent/10 p-6 md:p-8">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent/5 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <Sun className="w-5 h-5 text-primary" />
            <span className="text-[15px] text-muted-foreground">{greeting}</span>
          </div>
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-foreground mb-4">
            Добро пожаловать в PRODENT
          </h1>
          <p className="text-[15px] text-muted-foreground max-w-lg">
            Ваше здоровье — наш приоритет. Следите за визитами, рекомендациями и здоровьем полости рта.
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Button 
          variant="outline" 
          className="h-auto py-4 flex-col gap-2 bg-card hover:bg-primary/5 border-border/50 hover:border-primary/30 transition-all"
          onClick={() => navigate('/patient/book')}
        >
          <Calendar className="w-5 h-5 text-primary" />
          <span className="text-[15px] font-medium">Записаться</span>
        </Button>
        <Button 
          variant="outline" 
          className="h-auto py-4 flex-col gap-2 bg-card hover:bg-emerald-500/5 border-border/50 hover:border-emerald-500/30 transition-all"
          onClick={() => navigate('/patient/appointments')}
        >
          <RefreshCw className="w-5 h-5 text-emerald-500" />
          <span className="text-[15px] font-medium">Повторить визит</span>
        </Button>
        <Button 
          variant="outline" 
          className="h-auto py-4 flex-col gap-2 bg-card hover:bg-violet-500/5 border-border/50 hover:border-violet-500/30 transition-all"
          onClick={() => navigate('/patient/my-doctors')}
        >
          <Heart className="w-5 h-5 text-violet-500" />
          <span className="text-[15px] font-medium">Мои врачи</span>
        </Button>
        <Button 
          variant="outline" 
          className="h-auto py-4 flex-col gap-2 bg-card hover:bg-amber-500/5 border-border/50 hover:border-amber-500/30 transition-all"
          onClick={() => navigate('/patient/messages')}
        >
          <Bell className="w-5 h-5 text-amber-500" />
          <span className="text-[15px] font-medium">Сообщения</span>
        </Button>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming Appointment */}
        <Card className="lg:col-span-2 border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg font-heading">
              <Calendar className="w-5 h-5 text-primary" />
              Ближайшая запись
            </CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingAppointment ? (
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-gradient-to-br from-primary/5 to-accent/5 border border-primary/10">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                      {upcomingAppointment.status === 'confirmed' ? 'Подтверждено' : 'Ожидает'}
                    </Badge>
                  </div>
                  <h3 className="font-semibold text-foreground">{upcomingAppointment.service}</h3>
                  <p className="text-sm text-muted-foreground">
                    Врач: {doctorName || 'Не указан'}
                  </p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {format(new Date(upcomingAppointment.appointment_date), 'd MMMM yyyy', { locale: ru })}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {format(new Date(upcomingAppointment.appointment_date), 'HH:mm')}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">Перенести</Button>
                  <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">Отменить</Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground mb-4">У вас нет предстоящих записей</p>
                <Button onClick={() => navigate('/patient/book')}>
                  Записаться на приём
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Health Index */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg font-heading">
              <Activity className="w-5 h-5 text-emerald-500" />
              Индекс здоровья
            </CardTitle>
          </CardHeader>
          <CardContent>
            {healthIndex ? (
              <div className="space-y-4">
                <div className="text-center">
                  <div className={`text-4xl font-bold font-heading ${getHealthColor(healthIndex.overall_score)}`}>
                    {healthIndex.overall_score}%
                  </div>
                  <p className="text-[15px] text-muted-foreground">Общий показатель</p>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-[15px] mb-1">
                      <span>Дёсны</span>
                      <span className={getHealthColor(healthIndex.gum_health || 0)}>{healthIndex.gum_health || 0}%</span>
                    </div>
                    <Progress value={healthIndex.gum_health || 0} className={`h-2 ${getHealthBg(healthIndex.gum_health || 0)}`} />
                  </div>
                  <div>
                    <div className="flex justify-between text-[15px] mb-1">
                      <span>Зубы</span>
                      <span className={getHealthColor(healthIndex.teeth_condition || 0)}>{healthIndex.teeth_condition || 0}%</span>
                    </div>
                    <Progress value={healthIndex.teeth_condition || 0} className={`h-2`} />
                  </div>
                  <div>
                    <div className="flex justify-between text-[15px] mb-1">
                      <span>Гигиена</span>
                      <span className={getHealthColor(healthIndex.hygiene_score || 0)}>{healthIndex.hygiene_score || 0}%</span>
                    </div>
                    <Progress value={healthIndex.hygiene_score || 0} className={`h-2`} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <Smile className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-[15px] text-muted-foreground">
                  Индекс здоровья будет доступен после первого визита
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recommendations & Reminders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Doctor Recommendations */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg font-heading">
              <Shield className="w-5 h-5 text-violet-500" />
              Рекомендации врача
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/patient/medical')}>
                Все <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {recommendations.length > 0 ? (
              <div className="space-y-3">
                {recommendations.map((rec) => (
                  <div 
                    key={rec.id} 
                    className="p-3 rounded-xl bg-muted/30 border border-border/50 hover:border-primary/20 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-medium text-[15px]">{rec.title}</h4>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{rec.description}</p>
                      </div>
                      <Badge 
                        variant="outline"
                        className={
                          rec.priority === 'urgent' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' :
                          rec.priority === 'high' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                          'bg-muted text-muted-foreground'
                        }
                      >
                        {rec.priority === 'urgent' ? 'Срочно' : rec.priority === 'high' ? 'Важно' : 'Обычно'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <Shield className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-[15px] text-muted-foreground">Нет активных рекомендаций</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Brush Teeth Reminder */}
        <Card className="border-border/50 bg-gradient-to-br from-sky-500/5 to-cyan-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg font-heading">
              <Droplets className="w-5 h-5 text-sky-500" />
              Напоминания о гигиене
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-card/80 border border-sky-500/20">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-sky-500/20 flex items-center justify-center">
                    <span className="text-xl">🪥</span>
                  </div>
                    <div>
                      <h4 className="font-medium text-[15px]">Утренняя чистка</h4>
                      <p className="text-sm text-muted-foreground">Каждый день в 08:00</p>
                    </div>
                  </div>
                  <p className="text-[15px] text-muted-foreground">
                    Чистите зубы минимум 2 минуты, используя мягкую щётку и фторсодержащую пасту.
                </p>
              </div>
              
              <div className="p-4 rounded-2xl bg-card/80 border border-violet-500/20">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center">
                    <span className="text-xl">🦷</span>
                  </div>
                    <div>
                      <h4 className="font-medium text-[15px]">Вечерняя чистка</h4>
                      <p className="text-sm text-muted-foreground">Каждый день в 21:00</p>
                    </div>
                  </div>
                  <p className="text-[15px] text-muted-foreground">
                    Не забывайте использовать зубную нить и ополаскиватель перед сном.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
