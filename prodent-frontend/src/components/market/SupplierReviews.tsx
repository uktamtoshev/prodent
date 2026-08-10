import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import { marketplace } from "@/lib/marketplace";
import { cn } from "@/lib/utils";

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  buyer_user_id: string;
  buyer_name: string;
}
interface ReviewsData {
  reviews: Review[];
  my: Review | null;
  can_review: boolean;
}

const dt = (s: string) => new Date(s).toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" });

function Stars({ value, onChange, size = 16 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  return (
    <div className="inline-flex items-center gap-0.5" role={onChange ? "group" : "img"} aria-label={`Оценка: ${value} из 5`}>
      {[1, 2, 3, 4, 5].map((n) =>
        onChange ? (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-label={`${n} из 5`}
            aria-pressed={n === value}
            className="grid h-11 w-11 place-items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Star aria-hidden="true" style={{ width: size, height: size }} className={cn(n <= value ? "fill-warning-amber text-warning-amber" : "text-muted-foreground/40")} />
          </button>
        ) : (
          <Star key={n} aria-hidden="true" style={{ width: size, height: size }} className={cn(n <= value ? "fill-warning-amber text-warning-amber" : "text-muted-foreground/40")} />
        ),
      )}
    </div>
  );
}

// Supplier reviews block: list + a buyer's own review form (only buyers who have
// ordered from the supplier may review — enforced server-side too).
export function SupplierReviews({ supplierId, onReviewed }: { supplierId: string; onReviewed?: () => void }) {
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery<ReviewsData>({
    queryKey: ["mkt-reviews", supplierId],
    queryFn: () => marketplace.getSupplierReviews(supplierId) as Promise<ReviewsData>,
  });
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [editing, setEditing] = useState(false);

  const post = useMutation({
    mutationFn: () => marketplace.postSupplierReview(supplierId, { rating, comment: comment.trim() || undefined }),
    onSuccess: () => {
      toast.success("Спасибо за отзыв!");
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["mkt-reviews", supplierId] });
      onReviewed?.();
    },
    onError: (e: unknown) => toast.error((e as Error)?.message || "Не удалось отправить отзыв"),
  });

  if (isLoading) {
    return <div className="mt-8 rounded-[14px] border border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground" role="status" aria-live="polite">Загружаем отзывы…</div>;
  }

  if (isError || !data) {
    return (
      <div className="mt-8 rounded-[14px] border border-destructive/30 bg-destructive/10 px-5 py-8 text-center" role="alert">
        <p className="text-sm font-medium text-destructive">Не удалось загрузить отзывы.</p>
        <button type="button" onClick={() => void refetch()} className="mt-3 min-h-11 rounded-[10px] border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Повторить</button>
      </div>
    );
  }

  const my = data.my;
  const startEdit = () => { setRating(my?.rating || 5); setComment(my?.comment || ""); setEditing(true); };

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-[17px] font-bold font-display">
        Отзывы {data.reviews.length > 0 && <span className="text-muted-foreground">({data.reviews.length})</span>}
      </h2>

      {data.can_review && (editing ? (
        <div className="mb-4 rounded-[14px] border border-border bg-card p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Ваша оценка:</span>
            <Stars value={rating} onChange={setRating} size={22} />
          </div>
          <textarea
            aria-label="Комментарий к отзыву"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder="Поделитесь впечатлением (необязательно)"
            className="mt-3 min-h-24 w-full rounded-[10px] border border-border bg-background px-3 py-2 text-cell text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => (rating > 0 ? post.mutate() : toast.error("Поставьте оценку"))}
              disabled={post.isPending}
              aria-busy={post.isPending}
              className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              {post.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {my ? "Обновить отзыв" : "Отправить"}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="inline-flex h-11 items-center rounded-[10px] border border-border px-4 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Отмена
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={startEdit} className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-[10px] border border-border bg-card px-4 text-cell font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Star className="h-4 w-4 text-warning-amber" aria-hidden="true" /> {my ? "Изменить мой отзыв" : "Оставить отзыв"}
        </button>
      ))}

      {data.reviews.length === 0 ? (
        <div className="rounded-[14px] border border-dashed border-border bg-card px-5 py-10 text-center text-cell text-muted-foreground">
          Отзывов пока нет{data.can_review ? " — будьте первым" : ""}.
        </div>
      ) : (
        <div className="space-y-3">
          {data.reviews.map((r) => (
            <article key={r.id} className="rounded-[14px] border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                    {(r.buyer_name || "П").slice(0, 1).toUpperCase()}
                  </div>
                  <span className="text-cell font-medium text-foreground">{r.buyer_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Stars value={r.rating} />
                  <time dateTime={r.created_at} className="hidden text-xs text-muted-foreground sm:inline">{dt(r.created_at)}</time>
                </div>
              </div>
              {r.comment && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{r.comment}</p>}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
