import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, MapPin, Star } from "lucide-react";
import { BookingForm } from "@/components/booking/BookingForm";
import { BookingAuth } from "@/components/booking/BookingAuth";
import { useState, useEffect } from "react";
import type { User } from "@/integrations/api/client";

export default function PublicBooking() {
  const { doctorId } = useParams();
  const navigate = useNavigate();
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

  const { data: doctor, isLoading } = useQuery({
    queryKey: ["doctor", doctorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doctors")
        .select(`
          *,
          profile:profiles(full_name, avatar_url),
          clinic:clinics(name, address, city)
        `)
        .eq("id", doctorId)
        .single();

      if (error) throw error;
      return data;
    },
  });

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

  if (!doctor) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <Card className="bg-slate-800/50 border-slate-700 max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-slate-300 mb-4">Врач не найден</p>
            <Button onClick={() => navigate("/")} variant="outline">
              Вернуться на главную
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="max-w-4xl mx-auto pt-8">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-6 text-slate-300 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Назад
        </Button>

        <Card className="bg-slate-800/50 border-slate-700 mb-6">
          <CardHeader>
            <div className="flex items-start gap-4">
              <Avatar className="w-24 h-24">
                <AvatarImage src={doctor.profile?.avatar_url} />
                <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                  {doctor.profile?.full_name?.charAt(0) || "Д"}
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
                    <span>({doctor.reviews_count} отзывов)</span>
                  </div>
                  <div>Опыт: {doctor.experience_years} лет</div>
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
            <CardTitle className="text-white">Запись на прием</CardTitle>
          </CardHeader>
          <CardContent>
            {!user ? (
              <BookingAuth />
            ) : (
              <BookingForm doctor={doctor} userId={user.id} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
