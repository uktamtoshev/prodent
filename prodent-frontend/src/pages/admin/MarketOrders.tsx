import { Fragment, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { marketplace, type MarketplaceOrder } from '@/lib/marketplace';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, Search, ShoppingCart, Download } from 'lucide-react';
import { exportToCsv } from '@/lib/csv';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatPrice } from '@/lib/utils';

// Extended order lifecycle (V58). Labels are translated (adminMarketOrders.st_*); tone is local.
const STATUS_KEYS = ['new', 'accepted', 'awaiting_payment', 'preparing', 'shipped', 'received', 'completed', 'cancelled'] as const;
const STATUS_TONE: Record<string, 'default' | 'secondary' | 'destructive'> = {
  completed: 'default',
  received: 'default',
  cancelled: 'destructive',
};

type AdminMarketOrder = MarketplaceOrder & { buyer_name?: string | null };

export default function MarketOrders() {
  const { t, language } = useLanguage();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const dateLocale = language === 'uz' ? 'uz-UZ' : 'ru-RU';
  const STATUS_LABEL = useMemo(
    () => Object.fromEntries(STATUS_KEYS.map((k) => [k, t(`adminMarketOrders.st_${k}`)])) as Record<string, string>,
    [t],
  );

  const { data: orders, isLoading, isError } = useQuery({
    queryKey: ['admin-market-orders', status],
    queryFn: async () => (await marketplace.adminListOrders(status)) as AdminMarketOrder[],
  });

  const filtered = useMemo(() => {
    let list = orders || [];
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((o) =>
        [o.buyer_name, o.contact_name, o.supplier_name, String(o.order_number)]
          .filter(Boolean)
          .some((f: string) => f.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [orders, search]);

  const kpi = useMemo(() => {
    const list = orders || [];
    return {
      total: list.length,
      revenue: list
        .filter((o) => o.status === 'completed')
        .reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0),
      active: list.filter((o) => !['completed', 'cancelled'].includes(o.status)).length,
    };
  }, [orders]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <ShoppingCart className="h-7 w-7" /> {t('adminMarketOrders.title')}
            </h1>
            <p className="text-muted-foreground mt-2">{t('adminMarketOrders.subtitle')}</p>
          </div>
          <Button
            variant="outline"
            className="gap-2 shrink-0"
            disabled={!filtered.length}
            onClick={() =>
              exportToCsv(
                'market-orders',
                ['№', t('adminMarketOrders.colBuyer'), t('adminMarketOrders.colSupplier'), t('adminMarketOrders.colStatus'), t('adminMarketOrders.colTotal'), t('adminMarketOrders.colDate')],
                filtered.map((o) => [o.order_number, o.buyer_name || o.contact_name, o.supplier_name, STATUS_LABEL[o.status] || o.status, o.total_amount, o.created_at]),
              )
            }
          >
            <Download className="h-4 w-4" /> {t('admin.exportCsv')}
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: t('adminMarketOrders.kpiTotal'), value: kpi.total },
            { label: t('adminMarketOrders.kpiActive'), value: kpi.active },
            { label: t('adminMarketOrders.kpiRevenue'), value: formatPrice(kpi.revenue) },
          ].map((c) => (
            <div key={c.label} className="bg-card border border-border rounded-lg p-4">
              <p className="text-sm text-muted-foreground">{c.label}</p>
              <p className="text-2xl font-bold text-foreground">{c.value}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('adminMarketOrders.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-card border-border text-foreground"
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('adminMarketOrders.allStatuses')}</SelectItem>
              {Object.entries(STATUS_LABEL).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="bg-card border border-border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-accent/50">
                <TableHead className="text-muted-foreground">№</TableHead>
                <TableHead className="text-muted-foreground">{t('adminMarketOrders.colBuyer')}</TableHead>
                <TableHead className="text-muted-foreground">{t('adminMarketOrders.colSupplier')}</TableHead>
                <TableHead className="text-muted-foreground">{t('adminMarketOrders.colStatus')}</TableHead>
                <TableHead className="text-muted-foreground text-right">{t('adminMarketOrders.colTotal')}</TableHead>
                <TableHead className="text-muted-foreground">{t('adminMarketOrders.colDate')}</TableHead>
                <TableHead className="text-muted-foreground text-right">{t('admin.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    {t('admin.loading')}
                  </TableCell>
                </TableRow>
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    {t('adminMarketOrders.loadError')}
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    {t('adminMarketOrders.notFound')}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((o) => (
                  <Fragment key={o.id}>
                  <TableRow className="border-border hover:bg-accent/50">
                    <TableCell className="text-foreground font-mono">#{o.order_number}</TableCell>
                    <TableCell className="text-foreground">{o.buyer_name || o.contact_name || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{o.supplier_name || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_TONE[o.status] || 'secondary'}>
                        {STATUS_LABEL[o.status] || o.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-foreground">
                      {formatPrice(Number(o.total_amount) || 0)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {o.created_at ? new Date(o.created_at).toLocaleDateString(dateLocale) : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setExpanded((current) => {
                          const next = new Set(current);
                          if (next.has(o.id)) next.delete(o.id);
                          else next.add(o.id);
                          return next;
                        })}
                      >
                        История <ChevronDown className={`ml-1 h-4 w-4 transition ${expanded.has(o.id) ? 'rotate-180' : ''}`} />
                      </Button>
                    </TableCell>
                  </TableRow>
                  {expanded.has(o.id) && (
                    <TableRow className="bg-muted/30">
                      <TableCell colSpan={7}>
                        <div className="grid gap-5 py-3 lg:grid-cols-3">
                          <section>
                            <div className="text-xs font-semibold uppercase text-muted-foreground">Заказ и склад</div>
                            <div className="mt-2 space-y-1 text-sm">
                              {o.items?.map((item) => (
                                <p key={item.id}>{item.name}: {item.quantity} × {formatPrice(Number(item.price))}</p>
                              ))}
                              {o.reservations?.map((reservation) => (
                                <p key={reservation.id}>
                                  Резерв: {reservation.quantity} шт. · {reservation.status}
                                </p>
                              ))}
                              {o.stock_events?.map((event) => (
                                <p key={event.id}>
                                  Склад: {event.type} {event.quantity} · остаток {event.balance_after}
                                </p>
                              ))}
                            </div>
                          </section>
                          <section>
                            <div className="text-xs font-semibold uppercase text-muted-foreground">Оплата</div>
                            <div className="mt-2 space-y-1 text-sm">
                              <p>Статус заказа: {o.payment_status || 'не оплачено'}</p>
                              {o.payments?.map((payment) => (
                                <p key={payment.id}>
                                  {payment.provider}: {payment.status} · {formatPrice(Number(payment.amount))}
                                </p>
                              ))}
                              {o.refunds?.map((refund) => (
                                <p key={refund.id} className="text-emerald-700">
                                  Возврат: {refund.status} · {formatPrice(Number(refund.amount))}
                                </p>
                              ))}
                              {o.disputes?.map((dispute) => (
                                <p key={dispute.id} className="text-amber-700">
                                  Спор: {dispute.status} · {dispute.reason}
                                </p>
                              ))}
                            </div>
                          </section>
                          <section>
                            <div className="text-xs font-semibold uppercase text-muted-foreground">История действий</div>
                            <ol className="mt-2 space-y-2 text-sm">
                              <li className="border-l-2 pl-3">
                                Создан · {new Date(o.created_at).toLocaleString(dateLocale)}
                              </li>
                              {o.events?.map((event) => (
                                <li key={event.id} className="border-l-2 pl-3">
                                  <div>{event.from_status || '—'} → {event.to_status}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {event.actor_role || 'system'} · {new Date(event.created_at).toLocaleString(dateLocale)}
                                  </div>
                                  {event.reason && <div className="text-xs">{event.reason}</div>}
                                </li>
                              ))}
                            </ol>
                          </section>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  </Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AdminLayout>
  );
}
