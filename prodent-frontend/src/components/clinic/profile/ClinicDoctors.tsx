import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Star, Award, Users, CheckCircle2, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import type { ClinicDoctor } from './types';

interface ClinicDoctorsProps {
  doctors: ClinicDoctor[];
  promotionId?: string | null;
}

export function ClinicDoctors({ doctors, promotionId }: ClinicDoctorsProps) {
  if (!doctors || doctors.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
          <Users className="w-10 h-10 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Нет врачей</h3>
        <p className="text-muted-foreground">
          В клинике пока нет зарегистрированных врачей
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          Наши специалисты
        </h2>
        <Badge variant="secondary" className="text-sm">
          {doctors.length} врачей
        </Badge>
      </div>
      
      <div className="grid md:grid-cols-2 gap-4">
        {doctors.map((doctor) => (
          <Link
            key={doctor.id}
            to={promotionId
              ? `/book/${doctor.id}?${new URLSearchParams({ promo: promotionId })}`
              : `/doctor/${doctor.id}`}
            className="group"
          >
            <Card className="h-full overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm hover:shadow-xl hover:border-primary/30 transition-all duration-300 hover:-translate-y-1">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className="relative">
                    <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-primary/10 rounded-full blur opacity-0 group-hover:opacity-100 transition-opacity" />
                    <Avatar className="relative w-16 h-16 ring-2 ring-border group-hover:ring-primary/50 transition-all">
                      <AvatarImage src={doctor.profiles?.avatar_url} />
                      <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground text-lg font-semibold">
                        {doctor.profiles?.full_name?.charAt(0) || 'D'}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-lg group-hover:text-primary transition-colors line-clamp-1">
                          {doctor.profiles?.full_name || 'Имя не указано'}
                        </h3>
                        <p className="text-primary font-medium text-sm">{doctor.specialty}</p>
                      </div>
{/* Badges managed via badge_assignments */}
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3 mt-3">
                      {doctor.rating > 0 && (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-500/10">
                          <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
                          <span className="font-semibold text-sm text-amber-600 dark:text-amber-400">{doctor.rating}</span>
                          <span className="text-xs text-muted-foreground">({doctor.reviews_count})</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Award className="w-4 h-4" />
                        <span>{doctor.experience_years} лет</span>
                      </div>
                    </div>

                    {doctor.category && (
                      <Badge variant="secondary" className="mt-3 text-xs">
                        {doctor.category}
                      </Badge>
                    )}
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
