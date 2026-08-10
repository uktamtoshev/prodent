import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tag, Calendar, ArrowRight, MapPin, User } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/contexts/LanguageContext";
import { getPublicPromotionTarget, isPublicPromotionCurrent } from "@/lib/publicPromotion";

type PromotionRow = {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  discount?: number | null;
  original_price?: number | null;
  discounted_price?: number | null;
  valid_until?: string | null;
  clinic_id?: string | null;
  doctor_id?: string | null;
  clinics?: { name?: string | null; city?: string | null } | null;
  doctors?: {
    specialty?: string | null;
    profiles?: { full_name?: string | null } | null;
  } | null;
};

type DoctorLookupRow = {
  id: string;
  specialty?: string | null;
  user_id?: string | null;
};

type ProfileLookupRow = {
  id: string;
  full_name?: string | null;
};

const Promotions = () => {
  const { t } = useLanguage();
  const [selectedCategory, setSelectedCategory] = useState("all");

  const categories = [
    { key: "all", label: t('promotions.categories.all') },
    { key: "hygiene", label: t('promotions.categories.hygiene') },
    { key: "orthodontics", label: t('promotions.categories.orthodontics') },
    { key: "aesthetics", label: t('promotions.categories.aesthetics') },
    { key: "implants", label: t('promotions.categories.implants') },
    { key: "treatment", label: t('promotions.categories.treatment') },
    { key: "pediatric", label: t('promotions.categories.pediatric') },
    { key: "surgery", label: t('promotions.categories.surgery') },
    { key: "periodontics", label: t('promotions.categories.periodontics') },
    { key: "prosthetics", label: t('promotions.categories.prosthetics') },
  ];

  const { data: promotions = [], isLoading } = useQuery({
    queryKey: ['promotions-home'],
    queryFn: async () => {
      // Keep only the flat, reliable clinic embed. The previous query nested
      // promotions -> doctors -> profiles, but `profiles` is a VIEW and that
      // deep two-level embed can 500; the shim swallows the error and the whole
      // promo block silently goes empty. We pull the doctor name in a second,
      // separate query instead (same pattern as TopDoctors).
      const { data, error } = await supabase
        .from('promotions')
        .select(`
          *,
          clinics:clinic_id (name, city)
        `)
        .eq('active', true)
        .gte('valid_until', new Date().toISOString().slice(0, 10))
        .order('discount', { ascending: false })
        .limit(6);

      if (error) throw error;
      const promos = (data || []) as PromotionRow[];
      if (promos.length === 0) return promos;

      // Resolve doctor specialty + display name separately, guarded so a failure
      // here never empties the promo grid (promos still render without the name).
      try {
        const doctorIds = Array.from(
          new Set(promos.map((p) => p.doctor_id).filter((id): id is string => Boolean(id)))
        );
        if (doctorIds.length === 0) return promos;

        const { data: doctorRows } = await supabase
          .from('doctors')
          .select('id, specialty, user_id')
          .in('id', doctorIds);
        const doctors = (doctorRows || []) as DoctorLookupRow[];

        const userIds = Array.from(
          new Set(doctors.map((d) => d.user_id).filter((id): id is string => Boolean(id)))
        );
        let profiles: ProfileLookupRow[] = [];
        if (userIds.length > 0) {
          const { data: profileRows } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', userIds);
          profiles = (profileRows || []) as ProfileLookupRow[];
        }

        return promos.map((p) => {
          const doctor = doctors.find((d) => d.id === p.doctor_id);
          if (!doctor) return p;
          const profile = profiles.find((pr) => pr.id === doctor.user_id);
          return {
            ...p,
            doctors: { specialty: doctor.specialty, profiles: profile ? { full_name: profile.full_name } : null },
          };
        });
      } catch {
        return promos;
      }
    }
  });

  const filteredPromotions =
    selectedCategory === "all"
      ? promotions.filter((promo) => isPublicPromotionCurrent(promo))
      : promotions.filter(
          (promo) =>
            isPublicPromotionCurrent(promo) && promo.category === selectedCategory,
        );

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ru-RU').format(price) + ' ' + t('search.sum');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <section className="py-20 bg-gradient-hero">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12 animate-fade-in">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            {t('promotions.title')}{" "}
            <span className="bg-gradient-primary bg-clip-text text-transparent">
              {t('promotions.titleHighlight')}
            </span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {t('promotions.subtitle')}
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {categories.map((category) => (
            <Button
              key={category.key}
              variant={selectedCategory === category.key ? "default" : "outline"}
              onClick={() => setSelectedCategory(category.key)}
              className="transition-all duration-300"
            >
              {category.label}
            </Button>
          ))}
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="h-48 w-full" />
                <CardContent className="p-6">
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-full mb-4" />
                  <Skeleton className="h-8 w-1/2 mb-4" />
                  <Skeleton className="h-10 w-full" />
                </CardContent>
              </Card>
            ))
          ) : filteredPromotions.length > 0 ? (
            filteredPromotions.map((promo, index) => (
            <Card 
              key={promo.id}
              className="group overflow-hidden border-2 hover:border-primary/50 transition-all duration-300 hover:shadow-strong hover:-translate-y-1 cursor-pointer animate-scale-in"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <CardContent className="p-0">
                <div className="relative h-48 overflow-hidden">
                  <img 
                    src={promo.image_url || '/promotions/cleaning.jpg'} 
                    alt={promo.title}
                    loading="lazy"
                    decoding="async"
                    width={640}
                    height={384}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                  <Badge className="absolute top-4 right-4 border-0 bg-red-700 text-lg font-bold text-white hover:bg-red-800">
                    -{promo.discount}%
                  </Badge>
                  <div className="absolute top-4 left-4">
                    <Badge variant="secondary" className="bg-background/90 backdrop-blur-sm">
                      <Tag className="w-3 h-3 mr-1" />
                      {promo.category}
                    </Badge>
                  </div>
                </div>

                <div className="p-6">
                  <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">
                    {promo.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                    {promo.description}
                  </p>

                  <div className="mb-4">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-2xl font-bold text-primary">{formatPrice(promo.price)}</span>
                      <span className="text-sm text-muted-foreground line-through">{formatPrice(promo.old_price)}</span>
                    </div>
                  </div>

                  <div className="mb-3 text-sm">
                    {promo.clinics && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="w-4 h-4" />
                        <span className="truncate">{promo.clinics.name}</span>
                      </div>
                    )}
                    {promo.doctors && promo.doctors.profiles && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <User className="w-4 h-4" />
                        <span className="truncate">{promo.doctors.profiles.full_name}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                    <Calendar className="w-4 h-4" />
                    <span>{t('promotions.validUntil')} {formatDate(promo.valid_until)}</span>
                  </div>

                  <Link to={getPublicPromotionTarget(promo)}>
                    <Button className="w-full group/btn bg-teal-800 text-white hover:bg-teal-900">
                      {t('promotions.book')}
                      <ArrowRight className="w-4 h-4 ml-2 group-hover/btn:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
            ))
          ) : (
            <div className="col-span-full text-center py-12">
              <p className="text-xl text-muted-foreground">{t('promotions.noPromotions')}</p>
            </div>
          )}
        </div>

        <div className="text-center mt-12">
          <Link to="/promotions" className="inline-block max-w-full">
            <Button variant="outline" size="lg" className="group h-auto min-h-11 max-w-full whitespace-normal px-4 py-3">
              {t('promotions.viewAll')}
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default Promotions;
