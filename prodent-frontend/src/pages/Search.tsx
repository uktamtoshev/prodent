import { useState } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { PageMeta } from "@/components/PageMeta";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Search as SearchIcon, MapPin, Star, SlidersHorizontal, Video, AlertCircle, Map, Crown } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { DoctorsMapDialog } from "@/components/search/DoctorsMapDialog";

import { useLanguage } from "@/contexts/LanguageContext";
import { useActiveBadges } from "@/hooks/useBadgeAssignments";
import { useActiveAddOns } from "@/hooks/useAddOnServices";
import { BadgeDisplay } from "@/components/badges/BadgeDisplay";

const Search = () => {
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>("all");
  const [selectedCity, setSelectedCity] = useState<string>("all");
  const [selectedDistrict, setSelectedDistrict] = useState<string>("all");
  const [priceRange, setPriceRange] = useState([0, 5000000]);
  const [minRating, setMinRating] = useState<number | null>(null);
  const [hasVideo, setHasVideo] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [sortBy, setSortBy] = useState<string>("rating");
  const { data: activeBadges = [] } = useActiveBadges();

  // Fetch all active search promotion add-ons for doctors
  const { data: promotedDoctorIds } = useQuery({
    queryKey: ['promoted-doctors'],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('add_on_purchases')
        .select(`
          doctor_id,
          add_on_services!inner(service_type)
        `)
        .eq('is_active', true)
        .lte('start_date', now)
        .gte('end_date', now)
        .not('doctor_id', 'is', null);
      
      if (error) throw error;
      
      const doctorIds = new Set<string>();
      data?.forEach(purchase => {
        const serviceType = (purchase.add_on_services as any)?.service_type;
        if (serviceType === 'search_promotion' && purchase.doctor_id) {
          doctorIds.add(purchase.doctor_id);
        }
      });
      return doctorIds;
    },
    staleTime: 60000,
  });

  const { data: doctors = [], isLoading } = useQuery({
    queryKey: ['doctors'],
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
          video_url,
          latitude,
          longitude,
          subscription_plan,
          profiles:user_id (full_name, avatar_url),
          clinics:clinic_id (name, city, district, latitude, longitude)
        `);
      
      if (error) throw error;
      return data || [];
    }
  });

  // Filter doctors based on search criteria
  const filteredDoctors = doctors.filter(doctor => {
    const profile = doctor.profiles as any;
    const clinic = doctor.clinics as any;
    const fullName = profile?.full_name?.toLowerCase() || "";
    const specialty = doctor.specialty?.toLowerCase() || "";
    const query = searchQuery.toLowerCase();

    // Text search
    if (query && !fullName.includes(query) && !specialty.includes(query)) {
      return false;
    }

    // Specialty filter
    if (selectedSpecialty !== "all") {
      const specialtyMap: Record<string, string[]> = {
        therapist: ["терапевт"],
        orthodontist: ["ортодонт"],
        surgeon: ["хирург"],
        orthopedist: ["ортопед"],
        implantologist: ["имплантолог"],
        pediatric: ["детский стоматолог"],
        periodontist: ["пародонтолог"],
        endodontist: ["эндодонтист"],
      };
      const matchingSpecialties = specialtyMap[selectedSpecialty] || [];
      if (!matchingSpecialties.some(s => specialty.includes(s))) {
        return false;
      }
    }

    // City filter
    if (selectedCity !== "all" && clinic?.city) {
      const cityMap: Record<string, string[]> = {
        tashkent: ["ташкент"],
        samarkand: ["самарканд"],
        bukhara: ["бухара"],
        fergana: ["фергана"],
        andijan: ["андижан"],
        navoi: ["навои"],
      };
      const matchingCities = cityMap[selectedCity] || [];
      if (!matchingCities.some(c => clinic.city.toLowerCase().includes(c))) {
        return false;
      }
    }

    // District filter
    if (selectedDistrict !== "all" && clinic?.district) {
      if (!clinic.district.toLowerCase().includes(selectedDistrict.toLowerCase())) {
        return false;
      }
    }

    // Price filter
    if (doctor.price_from) {
      if (doctor.price_from < priceRange[0] || doctor.price_from > priceRange[1]) {
        return false;
      }
    }

    // Rating filter
    if (minRating && (doctor.rating || 0) < minRating) {
      return false;
    }

    // Video filter
    if (hasVideo && !doctor.video_url) {
      return false;
    }

    return true;
  });

  // Sort doctors
  const sortedDoctors = [...filteredDoctors].sort((a, b) => {
    // First priority: promoted doctors
    const aHasPromo = promotedDoctorIds?.has(a.id) ? 0 : 1;
    const bHasPromo = promotedDoctorIds?.has(b.id) ? 0 : 1;
    if (aHasPromo !== bHasPromo) return aHasPromo - bHasPromo;
    
    // Second priority: Gold plan
    const planPriority = (plan: string | null) => {
      if (plan === 'top' || plan === 'gold') return 0;
      if (plan === 'premium' || plan === 'standard') return 1;
      return 2;
    };
    
    const priorityDiff = planPriority(a.subscription_plan) - planPriority(b.subscription_plan);
    if (priorityDiff !== 0) return priorityDiff;

    // User selected sorting
    switch (sortBy) {
      case "price-asc":
        return (a.price_from || 0) - (b.price_from || 0);
      case "price-desc":
        return (b.price_from || 0) - (a.price_from || 0);
      case "experience":
        return (b.experience_years || 0) - (a.experience_years || 0);
      case "rating":
      default:
        return (b.rating || 0) - (a.rating || 0);
    }
  });

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedSpecialty("all");
    setSelectedCity("all");
    setSelectedDistrict("all");
    setPriceRange([0, 5000000]);
    setMinRating(null);
    setHasVideo(false);
  };

  return (
    <div className="min-h-screen bg-gradient-hero">
      <PageMeta
        title="Найти стоматолога — PRODENT"
        description="Поиск стоматолога по специализации, городу и рейтингу. 500+ проверенных врачей в Узбекистане."
        canonical="https://prodent.uz/search"
      />
      <Header />

      <main className="pt-24 pb-12">
        <div className="container mx-auto px-4">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-4">{t('search.title')}</h1>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input 
                  placeholder={t('search.placeholder')} 
                  className="h-12 pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button 
                variant="outline" 
                size="lg"
                onClick={() => setShowMap(true)}
              >
                <Map className="w-5 h-5" />
                {t('search.onMap')}
              </Button>
              <Button 
                variant="outline" 
                size="lg"
                onClick={() => setShowFilters(!showFilters)}
              >
                <SlidersHorizontal className="w-5 h-5" />
                {t('search.filters')}
              </Button>
            </div>
          </div>

          <div className="flex gap-6 items-start">
            <div className="flex-1 min-w-0">
              <div className={`grid ${showFilters ? 'lg:grid-cols-4' : ''} gap-6`}>
                {showFilters && (
                  <aside className="lg:col-span-1">
                    <Card className="sticky top-24">
                      <CardContent className="p-6 space-y-6">
                        <div>
                          <h3 className="font-bold mb-3">{t('search.specialty')}</h3>
                          <Select value={selectedSpecialty} onValueChange={setSelectedSpecialty}>
                            <SelectTrigger>
                              <SelectValue placeholder={t('search.allSpecialties')} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">{t('search.allSpecialties')}</SelectItem>
                              <SelectItem value="therapist">{t('hero.specialties.therapist')}</SelectItem>
                              <SelectItem value="orthodontist">{t('hero.specialties.orthodontist')}</SelectItem>
                              <SelectItem value="surgeon">{t('hero.specialties.surgeon')}</SelectItem>
                              <SelectItem value="orthopedist">{t('hero.specialties.orthopedist')}</SelectItem>
                              <SelectItem value="implantologist">Имплантолог</SelectItem>
                              <SelectItem value="pediatric">Детский стоматолог</SelectItem>
                              <SelectItem value="periodontist">Пародонтолог</SelectItem>
                              <SelectItem value="endodontist">Эндодонтист</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <h3 className="font-bold mb-3">{t('search.city')}</h3>
                          <Select value={selectedCity} onValueChange={setSelectedCity}>
                            <SelectTrigger>
                              <SelectValue placeholder={t('hero.cities.tashkent')} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Все города</SelectItem>
                              <SelectItem value="tashkent">{t('hero.cities.tashkent')}</SelectItem>
                              <SelectItem value="samarkand">{t('hero.cities.samarkand')}</SelectItem>
                              <SelectItem value="bukhara">{t('hero.cities.bukhara')}</SelectItem>
                              <SelectItem value="fergana">Фергана</SelectItem>
                              <SelectItem value="andijan">Андижан</SelectItem>
                              <SelectItem value="navoi">Навои</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <h3 className="font-bold mb-3">{t('search.district')}</h3>
                          <Select value={selectedDistrict} onValueChange={setSelectedDistrict}>
                            <SelectTrigger>
                              <SelectValue placeholder={t('search.allDistricts')} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">{t('search.allDistricts')}</SelectItem>
                              <SelectItem value="Мирзо-Улугбекский">Мирзо-Улугбекский</SelectItem>
                              <SelectItem value="Юнусабадский">Юнусабадский</SelectItem>
                              <SelectItem value="Чиланзарский">Чиланзарский</SelectItem>
                              <SelectItem value="Яккасарайский">Яккасарайский</SelectItem>
                              <SelectItem value="Мирабадский">Мирабадский</SelectItem>
                              <SelectItem value="Алмазарский">Алмазарский</SelectItem>
                              <SelectItem value="Шайхантахурский">Шайхантахурский</SelectItem>
                              <SelectItem value="Учтепинский">Учтепинский</SelectItem>
                              <SelectItem value="Яшнабадский">Яшнабадский</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <h3 className="font-bold mb-3">
                            {t('search.price')}: {priceRange[0].toLocaleString()} - {priceRange[1].toLocaleString()} {t('search.sum')}
                          </h3>
                          <Slider
                            min={0}
                            max={5000000}
                            step={100000}
                            value={priceRange}
                            onValueChange={setPriceRange}
                            className="my-4"
                          />
                        </div>

                        <div>
                          <h3 className="font-bold mb-3">{t('search.rating')}</h3>
                          <div className="space-y-2">
                            {[5, 4, 3].map((rating) => (
                              <label key={rating} className="flex items-center gap-2 cursor-pointer">
                                <input 
                                  type="radio" 
                                  name="rating"
                                  className="rounded" 
                                  checked={minRating === rating}
                                  onChange={() => setMinRating(minRating === rating ? null : rating)}
                                />
                                <div className="flex items-center gap-1">
                                  {Array.from({ length: rating }).map((_, i) => (
                                    <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                                  ))}
                                  <span className="text-sm ml-1">{t('search.andAbove')}</span>
                                </div>
                              </label>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="checkbox" 
                              className="rounded" 
                              checked={hasVideo}
                              onChange={(e) => setHasVideo(e.target.checked)}
                            />
                            <Video className="w-4 h-4 text-primary" />
                            <span className="text-sm">{t('search.withVideo')}</span>
                          </label>
                        </div>

                        <Button className="w-full" variant="outline" onClick={resetFilters}>
                          {t('search.resetFilters')}
                        </Button>
                      </CardContent>
                    </Card>
                  </aside>
                )}

                <div className={showFilters ? "lg:col-span-3" : ""}>
                  <div className="flex items-center justify-between mb-6">
                    <p className="text-muted-foreground">{t('search.found')} {sortedDoctors.length} {t('search.doctorsCount')}</p>
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder={t('search.sort')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="rating">{t('search.byRating')}</SelectItem>
                        <SelectItem value="price-asc">{t('search.byPriceAsc')}</SelectItem>
                        <SelectItem value="price-desc">{t('search.byPriceDesc')}</SelectItem>
                        <SelectItem value="experience">{t('search.byExperience')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {isLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {[1, 2, 3, 4, 5, 6].map((i) => (
                        <Card key={i}>
                          <CardContent className="p-4">
                            <Skeleton className="w-full aspect-square rounded-lg mb-3" />
                            <Skeleton className="h-5 w-3/4 mb-2" />
                            <Skeleton className="h-4 w-1/2 mb-2" />
                            <Skeleton className="h-4 w-2/3" />
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : doctors.length === 0 ? (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{t('search.notFound')}</AlertDescription>
                    </Alert>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {sortedDoctors.map((doctor) => {
                        const profile = doctor.profiles as any;
                        const clinic = doctor.clinics as any;
                        const doctorImage = doctor.images?.[0] || profile?.avatar_url || "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400&h=400&fit=crop";
                        const doctorBadges = activeBadges.filter(b => b.doctor_id === doctor.id);
                        
                        const isGoldPlan = doctor.subscription_plan === 'top' || doctor.subscription_plan === 'gold';
                        
                        return (
                          <Link key={doctor.id} to={`/doctor/${doctor.id}`}>
                            <Card className={`group hover:shadow-strong transition-all duration-300 hover:-translate-y-1 cursor-pointer border hover:border-primary/50 h-full ${isGoldPlan ? 'ring-2 ring-amber-500/50 border-amber-500/30' : ''}`}>
                              <CardContent className="p-0">
                                <div className="relative aspect-[4/3] overflow-hidden rounded-t-prodent">
                                  <img 
                                    src={doctorImage} 
                                    alt={profile?.full_name || `${doctor.specialty}`}
                                    className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300"
                                  />
                                  {/* Gold plan indicator */}
                                  {isGoldPlan && (
                                    <div className="absolute top-2 left-2">
                                      <Badge className="bg-gradient-to-r from-amber-500 to-amber-600 text-white border-0 text-xs gap-1">
                                        <Crown className="w-3 h-3" />
                                        ТОП
                                      </Badge>
                                    </div>
                                  )}
                                  {/* Badge display */}
                                  {doctorBadges.length > 0 && !isGoldPlan && (
                                    <div className="absolute top-2 left-2">
                                      <BadgeDisplay badges={doctorBadges} size="sm" maxBadges={1} />
                                    </div>
                                  )}
                                  {doctor.video_url && (
                                    <Badge className="absolute top-2 right-2 bg-accent/90 text-white border-0 text-xs">
                                      <Video className="w-3 h-3" />
                                    </Badge>
                                  )}
                                  <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-background/90 backdrop-blur-sm rounded-full px-2 py-1">
                                    <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                                    <span className="text-sm font-semibold">{doctor.rating || 5.0}</span>
                                  </div>
                                </div>

                                <div className="p-4">
                                  <h3 className="font-bold text-base group-hover:text-primary transition-colors line-clamp-1 mb-1">
                                    {profile?.full_name || `${doctor.specialty}`}
                                  </h3>
                                  <p className="text-sm text-primary font-medium mb-1">{doctor.specialty}</p>
                                  
                                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
                                    <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                                    <span className="line-clamp-1">{clinic?.city || t('hero.cities.tashkent')}</span>
                                    <span className="text-muted-foreground/50">•</span>
                                    <span>{doctor.experience_years} {t('search.years')}</span>
                                  </div>

                                  <div className="pt-3 border-t border-border">
                                    <Button size="sm" variant="hero" className="w-full h-8 text-xs">
                                      {t('search.book')}
                                    </Button>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>

      <Footer />

      <DoctorsMapDialog 
        open={showMap} 
        onOpenChange={setShowMap} 
        doctors={doctors as any} 
      />
    </div>
  );
};

export default Search;
