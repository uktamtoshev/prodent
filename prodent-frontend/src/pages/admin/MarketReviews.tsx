import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Search, Star, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { MarketplaceDecisionDialog } from '@/components/admin/MarketplaceDecisionDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useLanguage } from '@/contexts/LanguageContext';
import { marketplace, type MarketplaceReview } from '@/lib/marketplace';

type AdminMarketReview = MarketplaceReview & { supplier_name?: string | null };

export default function MarketReviews() {
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const dateLocale = language === 'uz' ? 'uz-UZ' : 'ru-RU';

  const { data: reviews, isLoading, isError } = useQuery({
    queryKey: ['admin-market-reviews'],
    queryFn: async () => (await marketplace.adminListReviews()) as AdminMarketReview[],
  });

  const decide = useMutation({
    mutationFn: ({ id, decision, reason }: {
      id: string;
      decision: 'approved' | 'rejected';
      reason: string;
    }) => marketplace.adminDecideReview(id, decision, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-market-reviews'] });
      toast.success('Решение сохранено');
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : t('admin.actionError')),
  });

  const filtered = useMemo(() => {
    const list = reviews || [];
    const query = search.trim().toLowerCase();
    if (!query) return list;
    return list.filter((review) =>
      [review.supplier_name, review.buyer_name, review.comment]
        .filter(Boolean)
        .some((field: string) => field.toLowerCase().includes(query)),
    );
  }, [reviews, search]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold text-foreground">
            <Star className="h-7 w-7" /> {t('adminMarketReviews.title')}
          </h1>
          <p className="mt-2 text-muted-foreground">{t('adminMarketReviews.subtitle')}</p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('adminMarketReviews.searchPlaceholder')}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="border-border bg-card pl-10 text-foreground"
          />
        </div>

        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-accent/50">
                <TableHead>{t('adminMarketReviews.colSupplier')}</TableHead>
                <TableHead>{t('adminMarketReviews.colBuyer')}</TableHead>
                <TableHead>{t('adminMarketReviews.colRating')}</TableHead>
                <TableHead>{t('adminMarketReviews.colComment')}</TableHead>
                <TableHead>{t('adminMarketReviews.colDate')}</TableHead>
                <TableHead className="text-right">{t('admin.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center">{t('admin.loading')}</TableCell></TableRow>
              ) : isError ? (
                <TableRow><TableCell colSpan={6} className="text-center">{t('adminMarketReviews.loadError')}</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center">{t('adminMarketReviews.notFound')}</TableCell></TableRow>
              ) : filtered.map((review) => (
                <TableRow key={review.id}>
                  <TableCell className="font-medium">{review.supplier_name || '—'}</TableCell>
                  <TableCell>{review.buyer_name || '—'}</TableCell>
                  <TableCell><span className="text-yellow-500">★</span> {review.rating}</TableCell>
                  <TableCell className="max-w-md truncate">{review.comment || '—'}</TableCell>
                  <TableCell>
                    <div>{review.created_at ? new Date(review.created_at).toLocaleDateString(dateLocale) : '—'}</div>
                    <Badge
                      variant={review.moderation_status === 'rejected' ? 'destructive' : 'secondary'}
                      className="mt-1"
                    >
                      {review.moderation_status || 'pending'}
                    </Badge>
                    {review.moderation_reason && (
                      <div className="mt-1 max-w-xs text-xs text-muted-foreground">{review.moderation_reason}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <MarketplaceDecisionDialog
                        title="Одобрить отзыв?"
                        description="Причина решения сохранится в журнале модерации."
                        confirmLabel="Одобрить"
                        pending={decide.isPending}
                        onConfirm={(reason) => decide.mutate({ id: review.id, decision: 'approved', reason })}
                        trigger={<Button size="sm" variant="ghost" aria-label="Одобрить отзыв"><CheckCircle2 className="h-4 w-4" /></Button>}
                      />
                      <MarketplaceDecisionDialog
                        title="Отклонить отзыв?"
                        description="Отзыв будет скрыт. Причина обязательна и сохранится в журнале."
                        confirmLabel="Отклонить"
                        destructive
                        pending={decide.isPending}
                        onConfirm={(reason) => decide.mutate({ id: review.id, decision: 'rejected', reason })}
                        trigger={<Button size="sm" variant="ghost" className="text-destructive" aria-label="Отклонить отзыв"><XCircle className="h-4 w-4" /></Button>}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </AdminLayout>
  );
}
