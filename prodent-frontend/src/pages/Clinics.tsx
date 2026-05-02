import { useState } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { PageMeta } from "@/components/PageMeta";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Search as SearchIcon, MapPin, Phone, Globe, Mail, SlidersHorizontal, CheckCircle2, Users, Building2, Star, ChevronRight, X, Map, Crown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/api/client";
import { Skeleton } from "@/components/ui/skeleton";

import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/contexts/LanguageContext";
import { ClinicsMapDialog } from "@/components/search/ClinicsMapDialog";
import { useActiveBadges } from "@/hooks/useBadgeAssignments";
import { BadgeDisplay } from "@/components/badges/BadgeDisplay";

const Clinics = () => {
  const { t } = useLanguage();
  const [showFilters, setShowFilters] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState("all");
  const [selectedDistrict, setSelectedDistrict] = useState("all");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const { data: activeBadges = [] } = useActiveBadges();

  // Fetch all active search promotion add-ons for clinics
  const { data: promotedClinicIds } = useQuery({
    queryKey: ['promoted-clinics'],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('add_on_purchases')
        .select(`
          clinic_id,
          add_on_services!inner(service_type)
        `)
        .eq('is_active', true)
        .lte('start_date', now)
        .gte('end_date', now)
        .not('clinic_id', 'is', null);
      
      if (error) throw error;
      
      const clinicIds = new Set<string>();
      data?.forEach(purchase => {
        const serviceType = (purchase.add_on_services as any)?.service_type;
        if (serviceType === 'search_promotion' && purchase.clinic_id) {
          clinicIds.add(purchase.clinic_id);
        }
      });
      return clinicIds;
    },
    staleTime: 60000,
  });

  const { data: clinics = [], isLoading } = useQuery({
    queryKey: ['clinics', searchQuery, selectedCity, selectedDistrict, verifiedOnly],
    queryFn: async () => {
      let query = supabase
        .from('clinics')
        .select(`
          id,
          name,
          city,
          district,
          address,
          phone,
          email,
          website,
          description,
          verified,
          images,
          latitude,
          longitude,
          subscription_plan,
          doctors(id)
        `);

      if (searchQuery) {
        query = query.ilike('name', `%${searchQuery}%`);
      }
      if (selectedCity !== 'all') {
        query = query.eq('city', selectedCity);
      }
      if (selectedDistrict !== 'all') {
        query = query.eq('district', selectedDistrict);
      }
      if (verifiedOnly) {
        query = query.eq('verified', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      return (data || []).map(clinic => ({
        ...clinic,
        doctorCount: clinic.doctors?.length || 0
      }));
    }
  });

  // Sort clinics: First by active add-on promotion, then by Gold plan, then verified, then name
  const sortedClinics = [...clinics].sort((a, b) => {
    const aHasPromo = promotedClinicIds?.has(a.id) ? 0 : 1;
    const bHasPromo = promotedClinicIds?.has(b.id) ? 0 : 1;
    if (aHasPromo !== bHasPromo) return aHasPromo - bHasPromo;
    
    const planPriority = (plan: string | null) => {
      if (plan === 'top' || plan === 'gold') return 0;
      if (plan === 'premium' || plan === 'standard') return 1;
      return 2;
    };
    
    const priorityDiff = planPriority(a.subscription_plan) - planPriority(b.subscription_plan);
    if (priorityDiff !== 0) return priorityDiff;
    if (a.verified !== b.verified) return a.verified ? -1 : 1;
    return (a.name || '').localeCompare(b.name || '');
  });

  const cities = Array.from(new Set(clinics.map(c => c.city))).filter(Boolean);
  const districts = Array.from(new Set(clinics.map(c => c.district))).filter(Boolean);

  const clearFilters = () => {
    setSelectedCity("all");
    setSelectedDistrict("all");
    setVerifiedOnly(false);
    setSearchQuery("");
  };

  const hasActiveFilters = selectedCity !== "all" || selectedDistrict !== "all" || verifiedOnly || searchQuery;

  return (
    <div className="min-h-screen bg-gradient-hero">
      <PageMeta
        title="Стоматологические клиники — PRODENT"
        description="Лучшие стоматологические клиники Узбекистана. Рейтинги, отзывы, адреса и онлайн-запись."
        canonical="https://prodent.uz/clinics"
      />
      <Header />

      <main className="pt-24 pb-12">
        <div className="container mx-auto px-4">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-4">{t('clinics.title')}</h1>
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input 
                  placeholder={t('clinics.searchPlaceholder')} 
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
                {t('clinics.onMap')}
              </Button>
              <Button 
                variant="outline" 
                size="lg"
                onClick={() => setShowFilters(!showFilters)}
              >
                <SlidersHorizontal className="w-5 h-5" />
                {t('clinics.filters')}
              </Button>
            </div>

            {/* Active Filters Tags */}
            {hasActiveFilters && (
              <div className="flex flex-wrap items-center gap-2 mt-4">
                <span className="text-sm text-muted-foreground">{t('clinics.activeFilters')}</span>
                {searchQuery && (
                  <Badge variant="secondary" className="gap-1 pr-1">
                    {t('clinics.search')}: {searchQuery}
                    <button onClick={() => setSearchQuery("")} className="ml-1 hover:bg-muted rounded-full p-0.5">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                )}
                {selectedCity !== "all" && (
                  <Badge variant="secondary" className="gap-1 pr-1">
                    {selectedCity}
                    <button onClick={() => setSelectedCity("all")} className="ml-1 hover:bg-muted rounded-full p-0.5">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                )}
                {selectedDistrict !== "all" && (
                  <Badge variant="secondary" className="gap-1 pr-1">
                    {selectedDistrict}
                    <button onClick={() => setSelectedDistrict("all")} className="ml-1 hover:bg-muted rounded-full p-0.5">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                )}
                {verifiedOnly && (
                  <Badge variant="secondary" className="gap-1 pr-1">
                    {t('clinics.verified')}
                    <button onClick={() => setVerifiedOnly(false)} className="ml-1 hover:bg-muted rounded-full p-0.5">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                )}
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs text-muted-foreground">
                  {t('clinics.resetAll')}
                </Button>
              </div>
            )}
          </div>

          <div className="flex gap-8">
            {/* Filters Sidebar */}
            {showFilters && (
              <aside className="w-72 flex-shrink-0 hidden lg:block">
                <Card className="sticky top-24 overflow-hidden border-2 border-border/50">
                  <div className="bg-gradient-to-r from-primary/10 to-primary/5 px-6 py-4 border-b border-border/50">
                    <h3 className="font-bold text-lg">{t('clinics.searchFilters')}</h3>
                  </div>
                  <CardContent className="p-6 space-y-6">
                    <div>
                      <label className="text-sm font-medium mb-2 block">{t('clinics.city')}</label>
                      <Select value={selectedCity} onValueChange={setSelectedCity}>
                        <SelectTrigger className="h-11 rounded-xl">
                          <SelectValue placeholder={t('clinics.allCities')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t('clinics.allCities')}</SelectItem>
                          {cities.map(city => (
                            <SelectItem key={city} value={city}>{city}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">{t('clinics.district')}</label>
                      <Select value={selectedDistrict} onValueChange={setSelectedDistrict}>
                        <SelectTrigger className="h-11 rounded-xl">
                          <SelectValue placeholder={t('clinics.allDistricts')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">{t('clinics.allDistricts')}</SelectItem>
                          {districts.map(district => (
                            <SelectItem key={district} value={district}>{district}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="pt-2">
                      <div className="flex items-center justify-between p-4 bg-primary/5 rounded-xl">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5 text-primary" />
                          <span className="text-sm font-medium">{t('clinics.verifiedOnly')}</span>
                        </div>
                        <Switch
                          checked={verifiedOnly}
                          onCheckedChange={setVerifiedOnly}
                        />
                      </div>
                    </div>

                    {hasActiveFilters && (
                      <Button variant="outline" className="w-full rounded-xl" onClick={clearFilters}>
                        {t('clinics.resetFilters')}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </aside>
            )}

            {/* Results */}
            <div className="flex-1 min-w-0">
              {/* Results Count */}
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-primary">{clinics.length}</span>
                  <span className="text-muted-foreground">
                    {clinics.length === 1 ? t('clinics.clinicFound') : clinics.length < 5 ? t('clinics.clinicsFound2to4') : t('clinics.clinicsFound5plus')}
                  </span>
                </div>
              </div>

              {/* Clinic Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <Card key={i} className="overflow-hidden">
                      <Skeleton className="aspect-[4/3] w-full" />
                      <CardContent className="p-4 space-y-2">
                        <Skeleton className="h-5 w-3/4" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-8 w-full mt-2" />
                      </CardContent>
                    </Card>
                  ))
                ) : clinics.length === 0 ? (
                  <div className="col-span-full text-center py-16">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-muted/50 flex items-center justify-center">
                      <Building2 className="w-10 h-10 text-muted-foreground/50" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">{t('clinics.notFound')}</h3>
                    <p className="text-muted-foreground mb-4">{t('clinics.notFoundHint')}</p>
                    {hasActiveFilters && (
                      <Button variant="outline" onClick={clearFilters}>
                        {t('clinics.resetFilters')}
                      </Button>
                    )}
                  </div>
                ) : (
                  sortedClinics.map((clinic) => {
                    const clinicBadges = activeBadges.filter(b => b.clinic_id === clinic.id);
                    const isGoldPlan = clinic.subscription_plan === 'top' || clinic.subscription_plan === 'gold';
                    return (
                    <Link key={clinic.id} to={`/clinic/${clinic.id}`}>
                      <Card className={`group hover:shadow-strong transition-all duration-300 hover:-translate-y-1 cursor-pointer border hover:border-primary/50 h-full ${isGoldPlan ? 'ring-2 ring-amber-500/50 border-amber-500/30' : ''}`}>
                        <CardContent className="p-0">
                          <div className="relative aspect-[4/3] overflow-hidden rounded-t-prodent">
                            {clinic.images?.[0] ? (
                              <img 
                                src={clinic.images[0]} 
                                alt={clinic.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                                <Building2 className="w-12 h-12 text-primary/30" />
                              </div>
                            )}
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
                            {clinicBadges.length > 0 && !isGoldPlan && (
                              <div className="absolute top-2 left-2">
                                <BadgeDisplay badges={clinicBadges} size="sm" maxBadges={1} />
                              </div>
                            )}
                            <div className="absolute top-2 right-2">
                              <Badge variant="secondary" className="bg-background/90 backdrop-blur-sm text-xs gap-1">
                                <Users className="w-3 h-3" />
                                {clinic.doctorCount}
                              </Badge>
                            </div>
                          </div>

                          <div className="p-4">
                            <h3 className="font-bold text-base group-hover:text-primary transition-colors line-clamp-1 mb-1">
                              {clinic.name}
                            </h3>
                            
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
                              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                              <span className="line-clamp-1">
                                {clinic.city}{clinic.district && `, ${clinic.district}`}
                              </span>
                            </div>

                            <div className="pt-3 border-t border-border">
                              <Button size="sm" variant="hero" className="w-full h-8 text-xs">
                                {t('clinics.details')}
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  )})
                )}
              </div>
            </div>

          </div>
        </div>
      </main>

      <Footer />

      <ClinicsMapDialog 
        open={showMap} 
        onOpenChange={setShowMap} 
        clinics={clinics as any} 
      />
    </div>
  );
};

export default Clinics;
