import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PatientLayout } from "@/components/patient/PatientLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  Star, 
  Calendar, 
  MessageCircle, 
  MapPin,
  Loader2,
  Stethoscope
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface DoctorVisit {
  doctor_id: string;
  doctor: {
    id: string;
    specialty: string;
    rating: number;
    experience_years: number;
    user_id: string;
    clinic: {
      name: string;
    } | null;
  };
  visit_count: number;
  last_visit: string;
}

const PatientDoctorsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [doctors, setDoctors] = useState<DoctorVisit[]>([]);
  const [doctorProfiles, setDoctorProfiles] = useState<Record<string, { full_name: string; avatar_url: string }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      fetchDoctors();
    }
  }, [user?.id]);

  const fetchDoctors = async () => {
    setLoading(true);
    try {
      // Get unique doctors from appointments
      const { data: appointments } = await supabase
        .from('appointments')
        .select(`
          doctor_id,
          appointment_date,
          doctor:doctors(
            id,
            specialty,
            rating,
            experience_years,
            user_id,
            clinic:clinics(name)
          )
        `)
        .eq('patient_id', user?.id)
        .eq('status', 'completed')
        .order('appointment_date', { ascending: false });

      if (appointments) {
        // Group by doctor
        const doctorMap = new Map<string, DoctorVisit>();
        
        appointments.forEach((apt: any) => {
          if (apt.doctor) {
            const existing = doctorMap.get(apt.doctor_id);
            if (existing) {
              existing.visit_count++;
            } else {
              doctorMap.set(apt.doctor_id, {
                doctor_id: apt.doctor_id,
                doctor: apt.doctor,
                visit_count: 1,
                last_visit: apt.appointment_date
              });
            }
          }
        });

        const doctorsList = Array.from(doctorMap.values());
        setDoctors(doctorsList);

        // Fetch doctor profiles
        const userIds = doctorsList.map(d => d.doctor.user_id).filter(Boolean);
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url')
            .in('id', userIds);

          if (profiles) {
            const profileMap: Record<string, { full_name: string; avatar_url: string }> = {};
            profiles.forEach(p => {
              profileMap[p.id] = { full_name: p.full_name || '', avatar_url: p.avatar_url || '' };
            });
            setDoctorProfiles(profileMap);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching doctors:', error);
    } finally {
      setLoading(false);
    }
  };

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
        <div>
          <h1 className="font-heading text-foreground">Мои врачи</h1>
          <p className="text-muted-foreground mt-1">Врачи, у которых вы были на приёме</p>
        </div>

        {/* Doctors Grid */}
        {doctors.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {doctors.map(item => {
              const profile = doctorProfiles[item.doctor.user_id];
              return (
                <Card 
                  key={item.doctor_id} 
                  className="border-border/50 hover:border-primary/20 transition-all hover:shadow-lg group"
                >
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4 mb-4">
                      <Avatar className="w-14 h-14 border-2 border-primary/10">
                        <AvatarImage src={profile?.avatar_url} alt={profile?.full_name} />
                        <AvatarFallback className="bg-primary/10 text-primary text-lg">
                          {profile?.full_name?.charAt(0) || 'D'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground truncate">
                          {profile?.full_name || 'Врач'}
                        </h3>
                        <p className="text-sm text-primary">{item.doctor.specialty}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                            <span className="text-sm font-medium">{item.doctor.rating || '—'}</span>
                          </div>
                          <span className="text-muted-foreground">•</span>
                          <span className="text-sm text-muted-foreground">
                            {item.doctor.experience_years} лет опыта
                          </span>
                        </div>
                      </div>
                    </div>

                    {item.doctor.clinic && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                        <MapPin className="w-4 h-4" />
                        <span className="truncate">{item.doctor.clinic.name}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between mb-4 p-3 rounded-xl bg-muted/30">
                      <div className="text-center">
                        <p className="text-lg font-bold text-foreground">{item.visit_count}</p>
                        <p className="text-xs text-muted-foreground">визитов</p>
                      </div>
                      <div className="h-8 w-px bg-border" />
                      <div className="text-center">
                        <p className="text-sm font-medium text-foreground">
                          {new Date(item.last_visit).toLocaleDateString('ru-RU', { 
                            day: 'numeric', 
                            month: 'short' 
                          })}
                        </p>
                        <p className="text-xs text-muted-foreground">последний</p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        className="flex-1" 
                        size="sm"
                        onClick={() => navigate(`/book/${item.doctor_id}`)}
                      >
                        <Calendar className="w-4 h-4 mr-2" />
                        Записаться
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => navigate(`/doctor/${item.doctor_id}`)}
                      >
                        <MessageCircle className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="border-border/50">
            <CardContent className="text-center py-12">
              <Stethoscope className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="font-medium text-foreground mb-2">Нет врачей</h3>
              <p className="text-muted-foreground mb-4">
                Здесь появятся врачи после вашего первого визита
              </p>
              <Button onClick={() => navigate('/patient/book')}>
                Записаться на приём
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </PatientLayout>
  );
};

export default PatientDoctorsPage;
