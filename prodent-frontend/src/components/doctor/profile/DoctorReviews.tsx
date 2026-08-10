import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import {
  AlertCircle,
  Edit2,
  Loader2,
  Shield,
  Star,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

interface DoctorReviewsProps {
  doctorId: string;
}

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  verified: boolean | null;
  created_at: string | null;
  patient_id: string;
  appointment_id: string | null;
  patient: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

interface ReviewRatingRow {
  rating: number;
}

type ReviewSort = "newest" | "oldest" | "highest" | "lowest";

const AVATAR_PALETTE = [
  "bg-teal-100 text-teal-800",
  "bg-amber-100 text-amber-800",
  "bg-rose-100 text-rose-800",
  "bg-indigo-100 text-indigo-800",
  "bg-emerald-100 text-emerald-800",
  "bg-sky-100 text-sky-800",
];

function initialsFor(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .map((s) => s[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "П"
  );
}

function paletteFor(name: string) {
  const sum = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_PALETTE[sum % AVATAR_PALETTE.length];
}

export function DoctorReviews({ doctorId }: DoctorReviewsProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "highest" | "lowest">("newest");
  const [filterRating, setFilterRating] = useState<"all" | "5" | "4" | "3" | "2" | "1">("all");
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [hoverRating, setHoverRating] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Existing review by current user
  const { data: myReview } = useQuery({
    queryKey: ["my-review", doctorId, user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("reviews")
        .select("id, rating, comment, verified")
        .eq("doctor_id", doctorId)
        .eq("patient_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  // Whether user has any completed appointment with this doctor (used for "verified" flag)
  const { data: hasCompletedVisit } = useQuery({
    queryKey: ["has-completed-visit", doctorId, user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("appointments")
        .select("id")
        .eq("patient_id", user.id)
        .eq("doctor_id", doctorId)
        .eq("status", "completed")
        .limit(1)
        .maybeSingle();
      return data?.id ?? null;
    },
    enabled: !!user?.id,
  });

  const { data: reviews, isLoading } = useQuery({
    queryKey: ["doctor-reviews", doctorId, sortBy, filterRating],
    queryFn: async () => {
      let query = supabase
        .from("reviews")
        .select(
          `id, rating, comment, verified, created_at, patient_id, appointment_id,
           patient:profiles!reviews_patient_id_fkey(full_name, avatar_url)`
        )
        .eq("doctor_id", doctorId);

      if (filterRating !== "all") {
        query = query.eq("rating", parseInt(filterRating));
      }
      const ascending = sortBy === "oldest" || sortBy === "lowest";
      const sortField = sortBy === "highest" || sortBy === "lowest" ? "rating" : "created_at";
      query = query.order(sortField, { ascending });

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as Review[];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["doctor-review-stats", doctorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("rating")
        .eq("doctor_id", doctorId);
      if (error) throw error;
      const rows = data || [];
      const total = rows.length;
      const ratingRows = rows as ReviewRatingRow[];
      const sum = ratingRows.reduce((a, r) => a + r.rating, 0);
      const average = total > 0 ? sum / total : 0;
      const distribution = [5, 4, 3, 2, 1].map((r) => {
        const count = ratingRows.filter((x) => x.rating === r).length;
        return { rating: r, count, percentage: total > 0 ? (count / total) * 100 : 0 };
      });
      return { total, average, distribution };
    },
  });

  // When entering edit mode, prefill form
  useEffect(() => {
    if (editingId && myReview) {
      setRating(myReview.rating);
      setComment(myReview.comment || "");
      setShowForm(true);
    }
  }, [editingId, myReview]);

  const submitReview = useMutation({
    mutationFn: async () => {
      if (!user?.id || rating === 0) throw new Error(t('doctorReviews.mustRate'));

      if (editingId) {
        const { error } = await supabase
          .from("reviews")
          .update({
            rating,
            comment: comment.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("reviews").insert({
          doctor_id: doctorId,
          patient_id: user.id,
          appointment_id: hasCompletedVisit || null,
          rating,
          comment: comment.trim() || null,
          verified: !!hasCompletedVisit,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast({
        title: editingId ? t('doctorReviews.reviewUpdated') : t('doctorReviews.reviewSubmitted'),
        description: t('doctorReviews.thanksFeedback'),
      });
      setShowForm(false);
      setRating(0);
      setComment("");
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["doctor-reviews", doctorId] });
      queryClient.invalidateQueries({ queryKey: ["doctor-review-stats", doctorId] });
      queryClient.invalidateQueries({ queryKey: ["my-review", doctorId, user?.id] });
    },
    onError: (err: unknown) => {
      toast({
        title: t('doctorReviews.error'),
        description: (err instanceof Error ? err.message : undefined) || t('doctorReviews.errSave'),
        variant: "destructive",
      });
    },
  });

  const deleteReview = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("reviews").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: t('doctorReviews.reviewDeleted') });
      queryClient.invalidateQueries({ queryKey: ["doctor-reviews", doctorId] });
      queryClient.invalidateQueries({ queryKey: ["doctor-review-stats", doctorId] });
      queryClient.invalidateQueries({ queryKey: ["my-review", doctorId, user?.id] });
    },
    onError: (err: unknown) => {
      toast({
        title: t('doctorReviews.error'),
        description: (err instanceof Error ? err.message : undefined) || t('doctorReviews.errDelete'),
        variant: "destructive",
      });
    },
  });

  const renderStars = (val: number, size: "sm" | "lg" = "sm") => {
    const sz = size === "lg" ? "w-6 h-6" : "w-4 h-4";
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              sz,
              star <= val
                ? "fill-rating text-rating"
                : "fill-rating-muted text-rating-muted"
            )}
          />
        ))}
      </div>
    );
  };

  const ratingFilters = [
    { id: "all" as const, label: t('doctorReviews.filterAll') },
    { id: "5" as const, label: "5" },
    { id: "4" as const, label: "4" },
    { id: "3" as const, label: "3" },
    { id: "2" as const, label: "2" },
    { id: "1" as const, label: "1" },
  ];

  const sortOptions = [
    { id: "newest" as const, label: t('doctorReviews.sortNewest') },
    { id: "oldest" as const, label: t('doctorReviews.sortOldest') },
    { id: "highest" as const, label: t('doctorReviews.sortHighest') },
    { id: "lowest" as const, label: t('doctorReviews.sortLowest') },
  ];

  return (
    <div className="space-y-5">
      {/* Stats Card */}
      {stats && stats.total > 0 && (
        <div className="rounded-prodent border border-border bg-card p-6 shadow-design-card">
          <div className="flex flex-col md:flex-row gap-8">
            <div className="text-center md:text-left">
              <div className="text-[48px] font-bold tabular-nums leading-none font-display text-foreground">
                {stats.average.toFixed(1)}
              </div>
              <div className="mt-2">{renderStars(Math.round(stats.average), "lg")}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.total} {stats.total === 1 ? t('doctorReviews.reviewSingular') : t('doctorReviews.reviews')}
              </p>
            </div>
            <div className="flex-1 space-y-2">
              {stats.distribution.map((item) => (
                <div key={item.rating} className="flex items-center gap-3">
                  <span className="w-3 text-xs text-muted-foreground tabular-nums">
                    {item.rating}
                  </span>
                  <Star className="w-3.5 h-3.5 fill-rating text-rating shrink-0" />
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-rating"
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                  <span className="w-8 text-xs text-muted-foreground tabular-nums text-right">
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Review form */}
      <div className="rounded-prodent border border-border bg-card p-5 shadow-design-card">
        {!user ? (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 text-muted-foreground text-sm">
              <AlertCircle className="w-5 h-5 text-muted-foreground" />
              <span>{t('doctorReviews.loginPrompt')}</span>
            </div>
            <button
              onClick={() => navigate("/auth")}
              className="h-9 px-4 inline-flex items-center justify-center gap-2 rounded-prodent-input text-primary-foreground font-semibold text-sm"
              style={{ background: "hsl(var(--brand))" }}
            >
              {t('doctorReviews.loginBtn')}
            </button>
          </div>
        ) : showForm ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold font-display">
                {editingId ? t('doctorReviews.editReview') : t('doctorReviews.leaveReview')}
              </h3>
              {hasCompletedVisit ? (
                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-status-success-bg text-status-success">
                  <Shield className="w-3 h-3" /> {t('doctorReviews.verifiedFlag')}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-status-neutral-bg text-status-neutral">
                  {t('doctorReviews.noVerifiedVisit')}
                </span>
              )}
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-2">{t('doctorReviews.yourRating')}</p>
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
                      className={cn(
                        "w-8 h-8 transition-colors",
                        star <= (hoverRating || rating)
                          ? "fill-rating text-rating"
                          : "fill-rating-muted text-rating-muted"
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-2">
                {t('doctorReviews.commentLabel')}
              </p>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t('doctorReviews.commentPlaceholder')}
                rows={4}
                className="w-full px-3 py-2 rounded-prodent-input border border-border bg-card text-base focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary resize-y"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => submitReview.mutate()}
                disabled={rating === 0 || submitReview.isPending}
                className="h-10 px-4 inline-flex items-center justify-center gap-2 rounded-prodent-btn text-primary-foreground font-semibold text-base disabled:opacity-50 disabled:pointer-events-none"
                style={{
                  background: "hsl(var(--brand))",
                  boxShadow:
                    "0 1px 2px rgba(13,148,136,0.25), 0 4px 12px -2px rgba(13,148,136,0.35)",
                }}
              >
                {submitReview.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('doctorReviews.submitting')}
                  </>
                ) : editingId ? (
                  t('doctorReviews.saveChanges')
                ) : (
                  t('doctorReviews.submitReview')
                )}
              </button>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                  setRating(0);
                  setComment("");
                }}
                className="h-10 px-4 inline-flex items-center justify-center gap-2 font-medium text-base rounded-prodent-btn border border-border bg-card text-foreground hover:bg-muted/50"
              >
                {t('doctorReviews.cancel')}
              </button>
            </div>
          </div>
        ) : myReview ? (
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="text-sm text-foreground">
                {t('doctorReviews.yourReview')} {renderStars(myReview.rating)}
              </div>
              {myReview.verified && (
                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-status-success-bg text-status-success">
                  <Shield className="w-3 h-3" /> {t('doctorReviews.verified')}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEditingId(myReview.id)}
                className="h-9 px-3 inline-flex items-center justify-center gap-1.5 font-medium text-sm rounded-prodent-input border border-border bg-card text-foreground hover:bg-muted/50"
              >
                <Edit2 className="w-3.5 h-3.5" /> {t('doctorReviews.edit')}
              </button>
              <button
                onClick={() => {
                  if (confirm(t('doctorReviews.deleteConfirm'))) deleteReview.mutate(myReview.id);
                }}
                className="h-9 px-3 inline-flex items-center justify-center gap-1.5 font-medium text-sm rounded-prodent-input text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="w-3.5 h-3.5" /> {t('doctorReviews.delete')}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowForm(true)}
            className="h-10 px-4 inline-flex items-center justify-center gap-2 rounded-prodent-btn text-primary-foreground font-semibold text-base"
            style={{
              background: "hsl(var(--brand))",
              boxShadow:
                "0 1px 2px rgba(13,148,136,0.25), 0 4px 12px -2px rgba(13,148,136,0.35)",
            }}
          >
            <Star className="w-4 h-4" /> {t('doctorReviews.leaveReview')}
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {ratingFilters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilterRating(f.id)}
              className={cn(
                "h-8 px-3 inline-flex items-center gap-1 rounded-full text-xs font-semibold ring-1 ring-inset transition-colors whitespace-nowrap",
                filterRating === f.id
                  ? "bg-primary/10 text-primary ring-primary"
                  : "bg-card text-foreground ring-border hover:bg-muted/50"
              )}
            >
              {f.id !== "all" && <Star className="w-3 h-3 fill-rating text-rating" />}
              {f.label}
            </button>
          ))}
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as ReviewSort)}
          className="h-9 px-3 rounded-prodent-input bg-card border border-border text-sm text-foreground cursor-pointer"
        >
          {sortOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="rounded-prodent border border-border bg-card py-12 text-center text-muted-foreground shadow-design-card">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
          {t('doctorReviews.loading')}
        </div>
      ) : !reviews || reviews.length === 0 ? (
        <div className="rounded-prodent border border-border bg-card py-12 text-center text-muted-foreground shadow-design-card">
          <Star className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          <div className="text-base font-medium text-foreground font-display">
            {t('doctorReviews.noReviews')}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {user
              ? t('doctorReviews.beFirst')
              : t('doctorReviews.loginToBeFirst')}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => {
            const name = r.patient?.full_name || t('doctorReviews.patientFallback');
            const isMine = r.patient_id === user?.id;
            return (
              <div
                key={r.id}
                className="rounded-prodent border border-border bg-card p-5 shadow-design-card"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "inline-flex items-center justify-center rounded-full font-semibold shrink-0 font-display",
                      r.patient?.avatar_url ? "" : paletteFor(name)
                    )}
                    style={{ width: 40, height: 40, fontSize: 14 }}
                  >
                    {r.patient?.avatar_url ? (
                      <img
                        src={r.patient.avatar_url}
                        alt={name}
                        className="w-full h-full object-cover rounded-full"
                      />
                    ) : (
                      initialsFor(name)
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground">
                        {name}
                      </span>
                      {r.verified && (
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-status-success-bg text-status-success">
                          <Shield className="w-2.5 h-2.5" /> {t('doctorReviews.verifiedShort')}
                        </span>
                      )}
                      {isMine && (
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-secondary text-secondary-foreground">
                          {t('doctorReviews.yours')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {renderStars(r.rating)}
                      <span className="text-xs text-muted-foreground">
                        {r.created_at &&
                          format(new Date(r.created_at), "d MMMM yyyy", { locale: ru })}
                      </span>
                    </div>
                    {r.comment && (
                      <p className="mt-3 text-base leading-relaxed text-foreground">
                        {r.comment}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
