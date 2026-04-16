import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface ReviewFormProps {
  doctorId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const ReviewForm = ({ doctorId, onSuccess, onCancel }: ReviewFormProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (rating === 0) {
      toast({
        title: "Выберите оценку",
        description: "Пожалуйста, поставьте оценку от 1 до 5 звезд",
        variant: "destructive",
      });
      return;
    }

    if (!user) return;

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from("reviews").insert({
        doctor_id: doctorId,
        patient_id: user.id,
        rating,
        comment: comment.trim() || null,
        verified: false, // Will be verified by admin
      });

      if (error) throw error;

      toast({
        title: "Отзыв отправлен",
        description: "Ваш отзыв будет опубликован после проверки",
      });

      // Refresh reviews
      queryClient.invalidateQueries({ queryKey: ["doctor-reviews", doctorId] });

      onSuccess();
    } catch (error: any) {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="border-2 border-primary/50">
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Ваша оценка</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="transition-transform hover:scale-110"
                >
                  <Star
                    className={`w-8 h-8 ${
                      star <= (hoveredRating || rating)
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-gray-300"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">
              Комментарий (необязательно)
            </label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Расскажите о вашем опыте..."
              rows={4}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {comment.length}/500 символов
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              type="submit"
              variant="hero"
              disabled={isSubmitting || rating === 0}
              className="flex-1"
            >
              {isSubmitting ? "Отправка..." : "Отправить отзыв"}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Отмена
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default ReviewForm;
