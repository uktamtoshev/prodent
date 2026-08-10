import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";

interface ReviewFormProps {
  doctorId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const ReviewForm = ({ doctorId, onSuccess, onCancel }: ReviewFormProps) => {
  const { t } = useLanguage();
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
        title: t('doctorReviewForm.pickRating'),
        description: t('doctorReviewForm.pickRating'),
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
        title: t('doctorReviewForm.reviewSent'),
        description: t('doctorReviewForm.thankYou'),
      });

      // Refresh reviews
      queryClient.invalidateQueries({ queryKey: ["doctor-reviews", doctorId] });

      onSuccess();
    } catch (error: unknown) {
      toast({
        title: t('crmProfilePrivacy.error'),
        description: error instanceof Error ? error.message : t('crmProfilePrivacy.error'),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="border-2 border-primary/50">
      <CardContent className="p-card-x">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">{t('doctorReviewForm.yourRating')}</label>
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
                        ? "fill-status-warning text-status-warning"
                        : "text-muted-foreground/40"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">
              {t('doctorReviewForm.comment')}
            </label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t('doctorReviewForm.commentPlaceholder')}
              rows={4}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {comment.length}/500
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              type="submit"
              variant="hero"
              disabled={isSubmitting || rating === 0}
              className="flex-1"
            >
              {isSubmitting ? t('doctorReviewForm.submitting') : t('doctorReviewForm.submit')}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              {t('doctorReviewForm.cancel')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default ReviewForm;
