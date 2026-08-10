import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { marketplace, type MarketplaceSupplier } from '@/lib/marketplace';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Store, CheckCircle2, Ban, Loader2, Download } from 'lucide-react';
import { exportToCsv } from '@/lib/csv';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useLanguage } from '@/contexts/LanguageContext';
import { MarketplaceDecisionDialog } from '@/components/admin/MarketplaceDecisionDialog';

type AdminMarketSupplier = MarketplaceSupplier & {
  owner_name?: string | null;
  product_count?: number;
};

export default function MarketSellers() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  const { data: suppliers, isLoading, isError } = useQuery({
    queryKey: ['admin-market-suppliers'],
    queryFn: async () => (await marketplace.adminListSuppliers()) as AdminMarketSupplier[],
  });

  const mutate = useMutation({
    mutationFn: ({ id, decision, reason }: {
      id: string;
      decision: 'approved' | 'rejected';
      reason: string;
    }) => marketplace.adminDecideSupplier(id, decision, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-market-suppliers'] });
      toast.success(t('adminMarketSellers.saved'));
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : t('admin.actionError')),
  });

  const filtered = useMemo(() => {
    const list = suppliers || [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((s) =>
      [s.name, s.owner_name].filter(Boolean).some((f: string) => f.toLowerCase().includes(q)),
    );
  }, [suppliers, search]);

  const kpi = useMemo(() => {
    const list = suppliers || [];
    return {
      total: list.length,
      verified: list.filter((s) => s.is_verified).length,
      inactive: list.filter((s) => !s.is_active).length,
    };
  }, [suppliers]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Store className="h-7 w-7" /> {t('adminMarketSellers.title')}
            </h1>
            <p className="text-muted-foreground mt-2">{t('adminMarketSellers.subtitle')}</p>
          </div>
          <Button
            variant="outline"
            className="gap-2 shrink-0"
            disabled={!filtered.length}
            onClick={() =>
              exportToCsv(
                'market-sellers',
                [t('adminMarketSellers.colName'), t('adminMarketSellers.colOwner'), t('adminMarketSellers.colProducts'), t('adminMarketSellers.verified'), t('adminMarketSellers.inactive')],
                filtered.map((s) => [s.name, s.owner_name, s.product_count ?? 0, s.is_verified ? '+' : '', s.is_active ? '' : '+']),
              )
            }
          >
            <Download className="h-4 w-4" /> {t('admin.exportCsv')}
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: t('adminMarketSellers.kpiTotal'), value: kpi.total },
            { label: t('adminMarketSellers.kpiVerified'), value: kpi.verified },
            { label: t('adminMarketSellers.kpiInactive'), value: kpi.inactive },
          ].map((c) => (
            <div key={c.label} className="bg-card border border-border rounded-lg p-4">
              <p className="text-sm text-muted-foreground">{c.label}</p>
              <p className="text-2xl font-bold text-foreground">{c.value}</p>
            </div>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('adminMarketSellers.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-card border-border text-foreground"
          />
        </div>

        <div className="bg-card border border-border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-accent/50">
                <TableHead className="text-muted-foreground">{t('adminMarketSellers.colName')}</TableHead>
                <TableHead className="text-muted-foreground">{t('adminMarketSellers.colOwner')}</TableHead>
                <TableHead className="text-muted-foreground">{t('adminMarketSellers.colProducts')}</TableHead>
                <TableHead className="text-muted-foreground">{t('adminMarketSellers.colStatus')}</TableHead>
                <TableHead className="text-muted-foreground text-right">{t('admin.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    {t('admin.loading')}
                  </TableCell>
                </TableRow>
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    {t('adminMarketSellers.loadError')}
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    {t('adminMarketSellers.notFound')}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((s) => (
                  <TableRow key={s.id} className="border-border hover:bg-accent/50">
                    <TableCell className="text-foreground font-medium">
                      {s.name}
                      {s.moderation_reason && (
                        <div className="mt-1 max-w-sm text-xs font-normal text-muted-foreground">
                          Последнее решение: {s.moderation_reason}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{s.owner_name || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{s.product_count ?? 0}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Badge variant={s.moderation_status === 'rejected' ? 'destructive' : s.is_verified ? 'default' : 'secondary'}>
                          {s.moderation_status === 'rejected'
                            ? 'Отклонён'
                            : s.is_verified
                              ? t('adminMarketSellers.verified')
                              : 'На проверке'}
                        </Badge>
                        {!s.is_active && (
                          <Badge variant="destructive">{t('adminMarketSellers.inactive')}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <MarketplaceDecisionDialog
                          title={`Одобрить витрину «${s.name}»?`}
                          description="После подтверждения товары одобренной витрины смогут пройти публикацию."
                          confirmLabel="Одобрить"
                          pending={mutate.isPending}
                          onConfirm={(reason) => mutate.mutate({ id: s.id, decision: 'approved', reason })}
                          trigger={(
                            <Button variant="outline" size="sm" className="gap-1" disabled={mutate.isPending}>
                              {mutate.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                              Одобрить
                            </Button>
                          )}
                        />
                        <MarketplaceDecisionDialog
                          title={`Отклонить витрину «${s.name}»?`}
                          description="Витрина и её товары не будут доступны покупателям. Причина будет видна в истории решения."
                          confirmLabel="Отклонить"
                          destructive
                          pending={mutate.isPending}
                          onConfirm={(reason) => mutate.mutate({ id: s.id, decision: 'rejected', reason })}
                          trigger={(
                            <Button variant="outline" size="sm" className="gap-1" disabled={mutate.isPending}>
                              <Ban className="h-3.5 w-3.5" /> Отклонить
                            </Button>
                          )}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AdminLayout>
  );
}
