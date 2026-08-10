import { PatientLayout } from "@/components/patient/PatientLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Search, MapPin, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useLanguage } from "@/contexts/LanguageContext";
import { defaultDoctorAvatar } from "@/lib/defaultAvatar";

interface Doctor {
  id: string;
  specialty: string;
  rating: number;
  price_from: number;
  user_id: string;
  profile?: {
    full_name: string;
    avatar_url: string | null;
    gender: string | null;
  };
  clinic?: {
    name: string;
    address: string;
  };
}

export default function PatientBook() {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDoctors();
  }, []);

  const loadDoctors = async () => {
    setLoading(true);

    const { data } = await supabase
      .from("doctors")
      .select(`
        id,
        specialty,
        rating,
        price_from,
        user_id,
        clinics (
          name,
          address
        )
      `)
      .eq("is_verified", true)
      .order("rating", { ascending: false })
      .limit(20);

    if (data) {
      const userIds = data.map(d => d.user_id).filter(Boolean);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, gender")
        .in("id", userIds);

      const doctorsWithProfiles = data.map(doc => ({
        ...doc,
        profile: profiles?.find(p => p.id === doc.user_id),
        clinic: doc.clinics
      }));

      setDoctors(doctorsWithProfiles as Doctor[]);
    }

    setLoading(false);
  };

  const filteredDoctors = doctors.filter(doc => {
    const searchLower = search.toLowerCase();
    return (
      doc.profile?.full_name?.toLowerCase().includes(searchLower) ||
      doc.specialty?.toLowerCase().includes(searchLower) ||
      doc.clinic?.name?.toLowerCase().includes(searchLower)
    );
  });

  const getInitials = (name: string | undefined) => {
    if (!name) return "??";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <PatientLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <div>
          <h1 className="font-heading text-foreground flex items-center gap-3">
            <Calendar className="w-8 h-8" />
            {t("patientCabinet.bookOnPortal")}
          </h1>
          <p className="text-muted-foreground mt-1">{t("patientCabinet.bookSubtitle")}</p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder={t("patientCabinet.searchByDoctorEtc")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-card/80 border-border/50"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link to="/search">
            <Card className="border-border/50 bg-card/80 backdrop-blur-sm hover:bg-accent/50 transition-colors cursor-pointer h-full">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Search className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground">{t("patientCabinet.advancedSearch")}</p>
                  <p className="text-xs text-muted-foreground">{t("patientCabinet.filtersAndSort")}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link to="/clinics">
            <Card className="border-border/50 bg-card/80 backdrop-blur-sm hover:bg-accent/50 transition-colors cursor-pointer h-full">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <p className="font-medium text-foreground">{t("patientCabinet.allClinics")}</p>
                  <p className="text-xs text-muted-foreground">{t("patientCabinet.onMapAndList")}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link to="/promotions">
            <Card className="border-border/50 bg-card/80 backdrop-blur-sm hover:bg-accent/50 transition-colors cursor-pointer h-full">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Star className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <p className="font-medium text-foreground">{t("patientCabinet.promotions")}</p>
                  <p className="text-xs text-muted-foreground">{t("patientCabinet.specialOffers")}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-foreground">{t("patientCabinet.availableDoctors")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {loading ? (
                <>
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-32 w-full" />
                </>
              ) : filteredDoctors.length > 0 ? (
                filteredDoctors.map((doctor) => (
                  <div
                    key={doctor.id}
                    className="p-4 rounded-xl bg-accent/30 border border-border/50 hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      <Avatar className="w-14 h-14 border-2 border-primary/20">
                        <AvatarImage
                          src={defaultDoctorAvatar(doctor.profile?.avatar_url, doctor.profile?.gender)}
                          className="bg-white object-cover"
                        />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {getInitials(doctor.profile?.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground truncate">
                          {doctor.profile?.full_name || t("patientCabinet.doctor")}
                        </h3>
                        <p className="text-sm text-primary">{doctor.specialty}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                          <span className="text-sm text-foreground">{doctor.rating || 0}</span>
                        </div>
                        {doctor.clinic && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {doctor.clinic.name}
                          </p>
                        )}
                      </div>
                      <Link to={`/book/${doctor.id}`}>
                        <Button size="sm">{t("patientCabinet.bookShort")}</Button>
                      </Link>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  <Search className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">{t("patientCabinet.doctorsNotFound")}</p>
                  <p className="text-sm">{t("patientCabinet.tryDifferentSearch")}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </PatientLayout>
  );
}
