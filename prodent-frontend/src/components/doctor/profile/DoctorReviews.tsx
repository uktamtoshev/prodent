import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { 
  Star, 
  ThumbsUp,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

interface DoctorReviewsProps {
  doctorId: string;
}

export function DoctorReviews({ doctorId }: DoctorReviewsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [sortBy, setSortBy] = useState('newest');
  const [filterRating, setFilterRating] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [hoverRating, setHoverRating] = useState(0);

  // Check if user can leave a review (has completed appointments with this doctor)
  const { data: canReview } = useQuery({
    queryKey: ['can-review-doctor', doctorId, user?.id],
    queryFn: async () => {
      if (!user?.id) return { canReview: false, hasReviewed: false };
      
      // Check for completed appointments
      const { data: appointments } = await supabase
        .from('appointments')
        .select('id')
        .eq('patient_id', user.id)
        .eq('doctor_id', doctorId)
        .eq('status', 'completed')
        .limit(1);
      
      // Check if already reviewed
      const { data: existingReview } = await supabase
        .from('reviews')
        .select('id')
        .eq('patient_id', user.id)
        .eq('doctor_id', doctorId)
        .limit(1);
      
      return {
        canReview: (appointments?.length || 0) > 0,
        hasReviewed: (existingReview?.length || 0) > 0
      };
    },
    enabled: !!user?.id,
  });

  const { data: reviews, isLoading } = useQuery({
    queryKey: ['doctor-reviews', doctorId, sortBy, filterRating],
    queryFn: async () => {
      let query = supabase
        .from('reviews')
        .select(`
          *,
          patient:profiles!reviews_patient_id_fkey(full_name, avatar_url)
        `)
        .eq('doctor_id', doctorId);

      if (filterRating !== 'all') {
        query = query.eq('rating', parseInt(filterRating));
      }

      if (sortBy === 'newest') {
        query = query.order('created_at', { ascending: false });
      } else if (sortBy === 'oldest') {
        query = query.order('created_at', { ascending: true });
      } else if (sortBy === 'highest') {
        query = query.order('rating', { ascending: false });
      } else if (sortBy === 'lowest') {
        query = query.order('rating', { ascending: true });
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
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

      const total = data.length;
      const sum = data.reduce((acc, r) => acc + r.rating, 0);
      const average = total > 0 ? sum / total : 0;

      const distribution = [5, 4, 3, 2, 1].map((rating) => ({
        rating,
        count: data.filter((r) => r.rating === rating).length,
        percentage: total > 0 ? (data.filter((r) => r.rating === rating).length / total) * 100 : 0,
      }));

      return { total, average, distribution };
    },
  });

  const submitReview = useMutation({
    mutationFn: async () => {
      if (!user?.id || rating === 0) return;
      
      const { error } = await supabase
        .from('reviews')
        .insert({
          doctor_id: doctorId,
          patient_id: user.id,
          rating,
          comment: comment.trim() || null,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Отзыв отправлен', description: 'Спасибо за ваш отзыв!' });
      setShowForm(false);
      setRating(0);
      setComment('');
      queryClient.invalidateQueries({ queryKey: ['doctor-reviews', doctorId] });
      queryClient.invalidateQueries({ queryKey: ['doctor-review-stats', doctorId] });
      queryClient.invalidateQueries({ queryKey: ['can-review-doctor', doctorId] });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Ошибка', 
        description: error.message || 'Не удалось отправить отзыв', 
        variant: 'destructive' 
      });
    },
  });

  const renderStars = (rating: number, size = 'sm') => {
    const sizeClass = size === 'lg' ? 'w-6 h-6' : 'w-4 h-4';
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${sizeClass} ${
              star <= rating
                ? 'fill-amber-400 text-amber-400'
                : 'fill-muted text-muted'
            }`}
          />
        ))}
      </div>
    );
  };

  const ratingFilters = [
    { id: 'all', label: 'Все оценки' },
    { id: '5', label: '5 звёзд' },
    { id: '4', label: '4 звезды' },
    { id: '3', label: '3 звезды' },
    { id: '2', label: '2 звезды' },
    { id: '1', label: '1 звезда' },
  ];

  const sortOptions = [
    { id: 'newest', label: 'Сначала новые' },
    { id: 'oldest', label: 'Сначала старые' },
    { id: 'highest', label: 'Высокий рейтинг' },
    { id: 'lowest', label: 'Низкий рейтинг' },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Card */}
      {stats && (
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-8">
              {/* Overall Rating */}
              <div className="text-center md:text-left">
                <div className="text-5xl font-bold text-foreground">
                  {stats.average.toFixed(1)}
                </div>
                <div className="mt-2">{renderStars(Math.round(stats.average), 'lg')}</div>
                <p className="text-sm text-muted-foreground mt-1">
                  {stats.total} отзывов
                </p>
              </div>

              {/* Distribution */}
              <div className="flex-1 space-y-2">
                {stats.distribution.map((item) => (
                  <div key={item.rating} className="flex items-center gap-3">
                    <span className="w-3 text-sm text-muted-foreground">
                      {item.rating}
                    </span>
                    <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                    <Progress value={item.percentage} className="flex-1 h-2" />
                    <span className="w-8 text-sm text-muted-foreground text-right">
                      {item.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Review Form / Access Message */}
      {user && (
        <Card>
          <CardContent className="p-6">
            {canReview?.hasReviewed ? (
              <div className="flex items-center gap-3 text-muted-foreground">
                <AlertCircle className="w-5 h-5" />
                <span>Вы уже оставили отзыв об этом враче</span>
              </div>
            ) : canReview?.canReview ? (
              showForm ? (
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Оставить отзыв</h3>
                  
                  {/* Star Rating Input */}
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Ваша оценка</p>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRating(star)}
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(0)}
                          className="p-1 hover:scale-110 transition-transform"
                        >
                          <Star
                            className={`w-8 h-8 transition-colors ${
                              star <= (hoverRating || rating)
                                ? 'fill-amber-400 text-amber-400'
                                : 'fill-muted text-muted-foreground'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Comment */}
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Комментарий (необязательно)</p>
                    <Textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Расскажите о вашем опыте..."
                      rows={4}
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      onClick={() => submitReview.mutate()}
                      disabled={rating === 0 || submitReview.isPending}
                    >
                      {submitReview.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Отправка...
                        </>
                      ) : (
                        'Отправить отзыв'
                      )}
                    </Button>
                    <Button variant="outline" onClick={() => setShowForm(false)}>
                      Отмена
                    </Button>
                  </div>
                </div>
              ) : (
                <Button onClick={() => setShowForm(true)}>
                  <Star className="w-4 h-4 mr-2" />
                  Оставить отзыв
                </Button>
              )
            ) : (
              <div className="flex items-center gap-3 text-muted-foreground">
                <AlertCircle className="w-5 h-5" />
                <span>Оставить отзыв могут только пациенты, прошедшие лечение у этого врача</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Filters - Facebook Style */}
      <div className="flex items-center justify-between flex-wrap gap-4 pb-4 border-b border-border">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {ratingFilters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilterRating(f.id)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap
                transition-all duration-200
                ${filterRating === f.id 
                  ? 'bg-primary/10 text-primary border-2 border-primary' 
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted border-2 border-transparent'
                }
              `}
            >
              {f.id !== 'all' && <Star className="w-4 h-4 fill-amber-400 text-amber-400" />}
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {sortOptions.map((s) => (
            <button
              key={s.id}
              onClick={() => setSortBy(s.id)}
              className={`
                px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap
                transition-all duration-200
                ${sortBy === s.id 
                  ? 'bg-muted text-foreground' 
                  : 'text-muted-foreground hover:bg-muted/50'
                }
              `}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Reviews List */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Загрузка...</div>
      ) : reviews?.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Пока нет отзывов
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {reviews?.map((review) => (
            <Card key={review.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={review.patient?.avatar_url} />
                    <AvatarFallback>
                      {review.patient?.full_name?.charAt(0) || 'P'}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-foreground">
                          {review.patient?.full_name || 'Пациент'}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {renderStars(review.rating)}
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(review.created_at), 'd MMMM yyyy', {
                              locale: ru,
                            })}
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className="mt-3 text-foreground">{review.comment}</p>

                    <div className="flex items-center gap-4 mt-4">
                      <Button variant="ghost" size="sm" className="text-muted-foreground">
                        <ThumbsUp className="w-4 h-4 mr-2" />
                        Полезно
                      </Button>
                    </div>
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
