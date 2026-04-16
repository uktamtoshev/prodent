import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Star } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import ReviewForm from "./ReviewForm";
import { useAuth } from "@/contexts/AuthContext";

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  patient: {
    full_name: string;
    avatar_url: string | null;
  };
}

interface ReviewsListProps {
  reviews: Review[];
  doctorId: string;
}

const ReviewsList = ({ reviews, doctorId }: ReviewsListProps) => {
  const { user } = useAuth();
  const [showReviewForm, setShowReviewForm] = useState(false);

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= rating
                ? "fill-yellow-400 text-yellow-400"
                : "text-gray-300"
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Add Review Button */}
      {user && !showReviewForm && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setShowReviewForm(true)}
        >
          Оставить отзыв
        </Button>
      )}

      {/* Review Form */}
      {showReviewForm && (
        <ReviewForm
          doctorId={doctorId}
          onSuccess={() => setShowReviewForm(false)}
          onCancel={() => setShowReviewForm(false)}
        />
      )}

      {/* Reviews List */}
      {reviews.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground">Пока нет отзывов</p>
          <p className="text-sm text-muted-foreground mt-2">
            Станьте первым, кто оставит отзыв!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <Card key={review.id} className="border-2">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={review.patient.avatar_url || undefined} />
                    <AvatarFallback>
                      {review.patient.full_name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  {/* Review Content */}
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-semibold">{review.patient.full_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(review.created_at), {
                            addSuffix: true,
                            locale: ru,
                          })}
                        </p>
                      </div>
                      {renderStars(review.rating)}
                    </div>

                    {review.comment && (
                      <p className="text-sm text-foreground mt-2">{review.comment}</p>
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
};

export default ReviewsList;
