import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, MapPin, Award, ArrowRight, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/api/client";
import { useLanguage } from "@/contexts/LanguageContext";

const TopDoctors = () => {
  const { t } = useLanguage();

  const { data: doctors, isLoading } = useQuery({
    queryKey: ['top-doctors-landing'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('doctors')
        .select(`
          id,
          specialty,
          experience_years,
          price_from,
          rating,
          reviews_count,
          verified,
          images,
          user_id,
          clinic_id,
          clinics(name, city, district)
        `)
        .eq('verified', true)
        .order('rating', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(9);

      if (error) throw error;
      
      if (!data) return [];

      const userIds = data.map(d => d.user_id).filter(Boolean);
      let profiles: any[] = [];
      
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', userIds);
        profiles = profilesData || [];
      }

      return data.map(doctor => ({
        ...doctor,
        profile: profiles.find(p => p.id === doctor.user_id)
      }));
    },
  });

  const getDoctorImage = (doctor: any) => {
    if (doctor.profile?.avatar_url) return doctor.profile.avatar_url;
    if (doctor.images && doctor.images.length > 0) return doctor.images[0];
    return `https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400&h=400&fit=crop`;
  };

  const getDoctorName = (doctor: any) => {
    if (doctor.profile?.full_name) return `${doctor.profile.full_name}`;
    return `${doctor.specialty}`;
  };

  const getLocation = (doctor: any) => {
    if (doctor.clinics) {
      const parts = [doctor.clinics.city, doctor.clinics.district].filter(Boolean);
      return parts.length > 0 ? parts.join(', ') : t('hero.cities.tashkent');
    }
    return t('hero.cities.tashkent');
  };

  if (isLoading) {
    return (
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </section>
    );
  }

  if (!doctors || doctors.length === 0) {
    return null;
  }

  return (
    <section className="py-24 bg-muted/30 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-12">
          <div>
            <span 
              className="inline-block text-sm font-semibold text-primary mb-2 opacity-0 animate-fade-in"
              style={{ animationDelay: "0.1s" }}
            >
              {t('doctors.badge')}
            </span>
            <h2 
              className="text-4xl md:text-5xl font-bold opacity-0 animate-fade-in"
              style={{ animationDelay: "0.2s" }}
            >
              {t('doctors.title')}
            </h2>
          </div>
          <Link to="/search">
            <Button 
              variant="outline" 
              size="lg"
              className="rounded-full px-6 gap-2 opacity-0 animate-fade-in"
              style={{ animationDelay: "0.3s" }}
            >
              {t('doctors.viewAll')}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {doctors.map((doctor, index) => (
            <Link 
              key={doctor.id} 
              to={`/doctor/${doctor.id}`}
              className="group opacity-0 animate-fade-in-up"
              style={{ animationDelay: `${0.1 * (index + 1)}s` }}
            >
              <div className="bg-card rounded-3xl overflow-hidden border border-border/50 hover:border-primary/30 transition-all duration-500 hover:shadow-strong hover:-translate-y-2">
                <div className="relative h-64 overflow-hidden">
                  <img 
                    src={getDoctorImage(doctor)} 
                    alt={getDoctorName(doctor)}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  
{/* Badges managed via badge_assignments */}

                  <div className="absolute bottom-4 left-4 flex items-center gap-2 glass px-3 py-1.5 rounded-full">
                    <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                    <span className="font-bold text-sm">{Number(doctor.rating || 0).toFixed(1)}</span>
                    <span className="text-xs text-muted-foreground">
                      ({doctor.reviews_count || 0})
                    </span>
                  </div>
                </div>

                <div className="p-6">
                  <h3 className="text-xl font-bold mb-1 group-hover:text-primary transition-colors">
                    {getDoctorName(doctor)}
                  </h3>
                  <p className="text-primary font-medium mb-3">{doctor.specialty}</p>
                  
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                    <span>{doctor.experience_years} {t('doctors.experience')}</span>
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>{getLocation(doctor)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end pt-4 border-t border-border/50">
                    <Button 
                      size="sm" 
                      className="rounded-full bg-gradient-primary hover:opacity-90"
                    >
                      {t('doctors.book')}
                    </Button>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TopDoctors;
