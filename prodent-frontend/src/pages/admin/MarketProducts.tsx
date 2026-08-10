import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { marketplace } from '@/lib/marketplace';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Package, EyeOff, Eye, Loader2, Download } from 'lucide-react';
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
import { formatPrice } from '@/lib/utils';
import { MarketplaceDecisionDialog } from '@/components/admin/MarketplaceDecisionDialog';

interface AdminMarketProduct {
  id: string;
  name: string;
  category?: string | null;
  supplier_name?: string | null;
  price: number;
  currency?: string;
  image_url?: string | null;
  is_active: boolean;
  moderation_status?: 'pending' | 'approved' | 'rejected';
  moderation_reason?: string | null;
}

export default function MarketProducts() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  const { data: products, isLoading, isError } = useQuery({
    queryKey: ['admin-market-products'],
    queryFn: async () => (await marketplace.adminListProducts()) as unknown as AdminMarketProduct[],
  });

  const mutate = useMutation({
    mutationFn: ({ id, decision, reason }: {
      id: string;
      decision: 'approved' | 'rejected';
      reason: string;
    }) => marketplace.adminDecideProduct(id, decision, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-market-products'] });
      toast.success(t('adminMarketProducts.saved'));
    },
    onError: (error: unknown) => toast.error(error instanceof Error ? error.message : t('admin.actionError')),
  });

  const filtered = useMemo(() => {
    const list = products || [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((p) =>
      [p.name, p.category, p.supplier_name].filter(Boolean).some((f: string) => f.toLowerCase().includes(q)),
    );
  }, [products, search]);

  const kpi = useMemo(() => {
    const list = products || [];
    return { total: list.length, hidden: list.filter((p) => !p.is_active).length };
  }, [products]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Package className="h-7 w-7" /> {t('adminMarketProducts.title')}
            </h1>
            <p className="text-muted-foreground mt-2">{t('adminMarketProducts.subtitle')}</p>
          </div>
          <Button
            variant="outline"
            className="gap-2 shrink-0"
            disabled={!filtered.length}
            onClick={() =>
              exportToCsv(
                'market-products',
                [t('adminMarketProducts.colName'), t('adminMarketProducts.colSupplier'), t('adminMarketProducts.colPrice'), t('adminMarketProducts.colStatus')],
                filtered.map((p) => [p.name, p.supplier_name, p.price, p.is_active ? t('adminMarketProducts.active') : t('adminMarketProducts.hidden')]),
              )
            }
          >
            <Download className="h-4 w-4" /> {t('admin.exportCsv')}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">{t('adminMarketProducts.kpiTotal')}</p>
            <p className="text-2xl font-bold text-foreground">{kpi.total}</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-sm text-muted-foreground">{t('adminMarketProducts.kpiHidden')}</p>
            <p className="text-2xl font-bold text-foreground">{kpi.hidden}</p>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('adminMarketProducts.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-card border-border text-foreground"
          />
        </div>

        <div className="bg-card border border-border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-accent/50">
                <TableHead className="text-muted-foreground">{t('adminMarketProducts.colName')}</TableHead>
                <TableHead className="text-muted-foreground">{t('adminMarketProducts.colSupplier')}</TableHead>
                <TableHead className="text-muted-foreground text-right">{t('adminMarketProducts.colPrice')}</TableHead>
                <TableHead className="text-muted-foreground">{t('adminMarketProducts.colStatus')}</TableHead>
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
                    {t('adminMarketProducts.loadError')}
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    {t('adminMarketProducts.notFound')}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((p) => (
                  <TableRow key={p.id} className="border-border hover:bg-accent/50">
                    <TableCell className="text-foreground font-medium">
                      {p.name}
                      {p.category && <span className="text-xs text-muted-foreground ml-2">{p.category}</span>}
                      {p.moderation_reason && (
                        <div className="mt-1 max-w-sm text-xs font-normal text-muted-foreground">
                          Последнее решение: {p.moderation_reason}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{p.supplier_name || '—'}</TableCell>
                    <TableCell className="text-right text-foreground">{formatPrice(Number(p.price) || 0)}</TableCell>
                    <TableCell>
                      <Badge variant={p.moderation_status === 'rejected' ? 'destructive' : p.moderation_status === 'approved' ? 'default' : 'secondary'}>
                        {p.moderation_status === 'approved'
                          ? 'Опубликован'
                          : p.moderation_status === 'rejected'
                            ? 'Отклонён'
                            : 'На проверке'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <MarketplaceDecisionDialog
                          title={`Опубликовать «${p.name}»?`}
                          description="Товар станет доступен покупателям только после этого решения."
                          confirmLabel="Опубликовать"
                          pending={mutate.isPending}
                          onConfirm={(reason) => mutate.mutate({ id: p.id, decision: 'approved', reason })}
                          trigger={(
                            <Button variant="outline" size="sm" className="gap-1" disabled={mutate.isPending}>
                              {mutate.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                              Опубликовать
                            </Button>
                          )}
                        />
                        <MarketplaceDecisionDialog
                          title={`Отклонить «${p.name}»?`}
                          description="Товар будет скрыт. Укажите понятную причину для продавца."
                          confirmLabel="Отклонить"
                          destructive
                          pending={mutate.isPending}
                          onConfirm={(reason) => mutate.mutate({ id: p.id, decision: 'rejected', reason })}
                          trigger={(
                            <Button variant="outline" size="sm" className="gap-1" disabled={mutate.isPending}>
                              <EyeOff className="h-3.5 w-3.5" /> Отклонить
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
