import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/api/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Star, 
  MessageSquare,
  Calendar
} from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface ProfileReviewsProps {
  doctorId: string;
}

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  patient: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

interface ReviewStats {
  total: number;
  average: number;
  distribution: {
    rating: number;
    count: number;
    percentage: number;
  }[];
}

export function ProfileReviews({ doctorId }: ProfileReviewsProps) {
  const { data: reviews, isLoading } = useQuery({
    queryKey: ['doctor-reviews', doctorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reviews')
        .select(`
          id,
          rating,
          comment,
          created_at,
          patient:profiles!reviews_patient_id_fkey(full_name, avatar_url)
        `)
        .eq('doctor_id', doctorId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as unknown as Review[];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['doctor-review-stats', doctorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reviews')
        .select('rating')
        .eq('doctor_id', doctorId);

      if (error) throw error;

      // Calculate stats
      const total = data.length;
      const sum = data.reduce((acc, r) => acc + (r.rating || 0), 0);
      const average = total > 0 ? sum / total : 0;
      
      // Rating distribution
      const distribution = [5, 4, 3, 2, 1].map(rating => ({
        rating,
        count: data.filter(r => r.rating === rating).length,
        percentage: total > 0 ? (data.filter(r => r.rating === rating).length / total) * 100 : 0
      }));

      return { total, average, distribution } as ReviewStats;
    },
  });

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${
          i < rating 
            ? 'text-amber-500 fill-amber-500' 
            : 'text-muted-foreground/30'
        }`}
      />
    ));
  };

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary" />
          Отзывы пациентов
          {stats && stats.total > 0 && (
            <Badge variant="secondary" className="ml-2">
              {stats.total}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Rating Summary */}
        {stats && stats.total > 0 && (
          <div className="grid md:grid-cols-[200px_1fr] gap-6 p-4 rounded-lg bg-muted/30">
            {/* Average Rating */}
            <div className="text-center">
              <div className="text-5xl font-bold text-foreground">
                {stats.average.toFixed(1)}
              </div>
              <div className="flex justify-center gap-0.5 mt-2">
                {renderStars(Math.round(stats.average))}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {stats.total} {stats.total === 1 ? 'отзыв' : 'отзывов'}
              </p>
            </div>

            {/* Rating Distribution */}
            <div className="space-y-2">
              {stats.distribution.map(({ rating, count, percentage }) => (
                <div key={rating} className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground w-16 flex items-center gap-1">
                    {rating} <Star className="w-3 h-3 fill-primary text-primary" />
                  </span>
                  <Progress value={percentage} className="h-2 flex-1" />
                  <span className="text-sm text-muted-foreground w-8 text-right">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reviews List */}
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Загрузка отзывов...
          </div>
        ) : !reviews || reviews.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">Пока нет отзывов</p>
            <p className="text-sm text-muted-foreground/60 mt-1">
              Отзывы появятся после приёма пациентов
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <div 
                key={review.id}
                className="p-4 rounded-lg bg-muted/20 border border-border/50 space-y-3"
              >
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={review.patient?.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {review.patient?.full_name?.charAt(0) || 'П'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-foreground">
                        {review.patient?.full_name || 'Пациент'}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(review.created_at), 'd MMMM yyyy', { locale: ru })}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-0.5">
                    {renderStars(review.rating)}
                  </div>
                </div>

                {/* Comment */}
                {review.comment && (
                  <p className="text-foreground leading-relaxed">
                    {review.comment}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
