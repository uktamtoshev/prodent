import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, MapPin, Star } from "lucide-react";
import { BookingForm } from "@/components/booking/BookingForm";
import { BookingAuth } from "@/components/booking/BookingAuth";
import { useState, useEffect } from "react";
import type { User } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { PageMeta } from "@/components/PageMeta";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  isBookingPromotionApplicable,
  type BookingPromotion,
} from "@/lib/bookingPromotion";

export default function PublicBooking() {
  const { doctorId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const promotionId = searchParams.get("promo");
  const { t } = useLanguage();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const { data: doctor, isLoading, isError, refetch } = useQuery({
    queryKey: ["doctor", doctorId],
    queryFn: async () => {
      const { data: doctorRow, error } = await supabase
        .from("doctors")
        .select("id, user_id, clinic_id, specialty, experience_years, rating, reviews_count")
        .eq("id", doctorId)
        .eq("is_verified", true)
        .eq("is_accepting_patients", true)
        .maybeSingle();

      if (error) throw error;
      if (!doctorRow?.clinic_id || !doctorRow.user_id) return null;

      const [profileResult, clinicResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, avatar_url")
          .eq("id", doctorRow.user_id)
          .eq("is_active", true)
          .maybeSingle(),
        supabase
          .from("clinics")
          .select("name, address, city")
          .eq("id", doctorRow.clinic_id)
          .eq("is_verified", true)
          .eq("is_active", true)
          .maybeSingle(),
      ]);
      if (profileResult.error) throw profileResult.error;
      if (clinicResult.error) throw clinicResult.error;
      if (!profileResult.data || !clinicResult.data) return null;
      return {
        ...doctorRow,
        profile: profileResult.data,
        clinic: clinicResult.data,
      };
    },
  });

  const { data: promotion } = useQuery({
    queryKey: ["public-booking-promotion", promotionId, doctor?.id],
    enabled: Boolean(promotionId && doctor?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("promotions")
        .select("id, title, discount, price, old_price, valid_until, active, doctor_id, clinic_id")
        .eq("id", promotionId!)
        .eq("active", true)
        .maybeSingle();
      if (error) throw error;
      const candidate = data as BookingPromotion | null;
      return candidate &&
        isBookingPromotionApplicable(candidate, doctor!.id, doctor!.clinic_id)
        ? candidate
        : null;
    },
  });

  const goBack = () => {
    const historyIndex = window.history.state?.idx;
    if (typeof historyIndex === "number" && historyIndex > 0) {
      navigate(-1);
    } else {
      navigate(doctorId ? `/doctor/${doctorId}` : "/search");
    }
  };

  if (isLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
        <div className="max-w-4xl mx-auto pt-8">
          <Skeleton className="h-8 w-32 mb-8" />
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <Skeleton className="h-24 w-24 rounded-full" />
              <Skeleton className="h-8 w-64 mt-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-96 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>{t("search.loadError")}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
              {t("search.retry")}
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!doctor) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <Card className="bg-slate-800/50 border-slate-700 max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-slate-300 mb-4">{t("publicBooking.doctorNotFound")}</p>
            <Button onClick={() => navigate("/")} variant="outline">
              {t("publicBooking.backHome")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <PageMeta
        title={`${doctor.profile?.full_name || t("publicBooking.bookingTitle")} — PRODENT`}
        description={`${t("publicBooking.bookingTitle")}: ${doctor.specialty || ""}`}
        canonical={`https://prodent.uz/book/${doctor.id}`}
      />
      <div className="max-w-4xl mx-auto pt-8">
        <Button
          variant="ghost"
          onClick={goBack}
          className="mb-6 text-slate-300 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t("publicBooking.back")}
        </Button>

        <Card className="bg-slate-800/50 border-slate-700 mb-6">
          <CardHeader>
            <div className="flex items-start gap-4">
              <Avatar className="w-24 h-24">
                <AvatarImage src={doctor.profile?.avatar_url} />
                <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                  {doctor.profile?.full_name?.charAt(0) || "D"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <CardTitle className="text-2xl text-white mb-2">
                  {doctor.profile?.full_name}
                </CardTitle>
                <p className="text-primary font-medium mb-2">{doctor.specialty}</p>
                <div className="flex items-center gap-4 text-sm text-slate-400">
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    <span className="text-white">{doctor.rating}</span>
                    <span>({doctor.reviews_count} {t("publicBooking.reviews")})</span>
                  </div>
                  <div>
                    {t("publicBooking.experience")}: {doctor.experience_years} {t("publicBooking.years")}
                  </div>
                </div>
                {doctor.clinic && (
                  <div className="flex items-center gap-2 mt-2 text-slate-400">
                    <MapPin className="w-4 h-4" />
                    <span className="text-sm">
                      {doctor.clinic.name}, {doctor.clinic.address}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">{t("publicBooking.bookingTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            {!user ? (
              <BookingAuth />
            ) : (
              <BookingForm doctor={doctor} userId={user.id} promotion={promotion} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
