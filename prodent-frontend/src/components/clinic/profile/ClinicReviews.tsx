import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Star, User, MessageSquare, TrendingUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';

interface ClinicReviewsProps {
  clinicId: string;
}

interface ClinicReview {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  patient?: { full_name?: string | null; avatar_url?: string | null } | null;
}

export function ClinicReviews({ clinicId }: ClinicReviewsProps) {
  const { data: reviews, isLoading } = useQuery({
    queryKey: ['clinic-reviews', clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinic_reviews')
        .select(`
          *,
          patient:profiles!clinic_reviews_patient_id_fkey(full_name, avatar_url)
        `)
        .eq('clinic_id', clinicId)
        .eq('is_approved', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as ClinicReview[];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['clinic-reviews-stats', clinicId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinic_reviews')
        .select('rating')
        .eq('clinic_id', clinicId)
        .eq('is_approved', true);

      if (error) throw error;

      const total = data.length;
      const avg = total > 0 ? data.reduce((sum, r) => sum + r.rating, 0) / total : 0;
      const distribution = [5, 4, 3, 2, 1].map(r => ({
        rating: r,
        count: data.filter(d => d.rating === r).length,
        percent: total > 0 ? (data.filter(d => d.rating === r).length / total) * 100 : 0,
      }));

      return { total, avg, distribution };
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Card */}
      {stats && stats.total > 0 && (
        <Card className="border-border/50 bg-gradient-to-br from-card via-card to-primary/5 backdrop-blur-sm overflow-hidden">
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col md:flex-row gap-8">
              <div className="text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  <span className="text-sm font-medium text-muted-foreground">Общий рейтинг</span>
                </div>
                <div className="text-6xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                  {stats.avg.toFixed(1)}
                </div>
                <div className="flex items-center justify-center md:justify-start gap-1 mt-3">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-6 h-6 ${
                        star <= Math.round(stats.avg)
                          ? 'fill-amber-500 text-amber-500'
                          : 'fill-muted text-muted'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  На основе {stats.total} отзывов
                </p>
              </div>
              <div className="flex-1 space-y-3">
                {stats.distribution.map((d) => (
                  <div key={d.rating} className="flex items-center gap-3">
                    <div className="flex items-center gap-1 w-12">
                      <span className="text-sm font-medium">{d.rating}</span>
                      <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
                    </div>
                    <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-500"
                        style={{ width: `${d.percent}%` }}
                      />
                    </div>
                    <span className="w-10 text-sm text-muted-foreground text-right">{d.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reviews List */}
      {reviews?.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
            <MessageSquare className="w-10 h-10 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Нет отзывов</h3>
          <p className="text-muted-foreground">
            Пока нет отзывов о клинике
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews?.map((review, index) => (
            <Card 
              key={review.id} 
              className="border-border/50 bg-card/50 backdrop-blur-sm hover:shadow-lg transition-all duration-300"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <Avatar className="w-12 h-12 ring-2 ring-border">
                    <AvatarImage src={review.patient?.avatar_url} />
                    <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10">
                      <User className="w-5 h-5 text-primary" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="font-semibold text-foreground">
                        {review.patient?.full_name || 'Пациент'}
                      </h4>
                      <span className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(review.created_at), {
                          addSuffix: true,
                          locale: ru,
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mt-1.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-4 h-4 ${
                            star <= review.rating
                              ? 'fill-amber-500 text-amber-500'
                              : 'fill-muted text-muted'
                          }`}
                        />
                      ))}
                    </div>
                    {review.comment && (
                      <p className="mt-3 text-muted-foreground leading-relaxed">{review.comment}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
