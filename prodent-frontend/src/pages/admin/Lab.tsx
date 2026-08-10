import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { lab, LabMessage, LabOrderEvent, LabOrderWithEvents } from '@/lib/lab';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Download, FlaskConical, Loader2, MessageSquare } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatPrice } from '@/lib/utils';

// Lab order status slugs (chk_lab_order_status). Labels are translated (adminLab.st_*).
const STATUS_KEYS = ['new', 'queued', 'model', 'wax', 'milling', 'frame', 'glaze', 'ready', 'delivered', 'cancelled', 'declined'] as const;

const STATUS_TONE: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  ready: 'default',
  delivered: 'default',
  cancelled: 'destructive',
  declined: 'destructive',
};

export default function Lab() {
  const { t, language } = useLanguage();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [detailId, setDetailId] = useState<string | null>(null);
  const dateLocale = language === 'uz' ? 'uz-UZ' : 'ru-RU';
  const STATUS_LABEL = useMemo(
    () => Object.fromEntries(STATUS_KEYS.map((k) => [k, t(`adminLab.st_${k}`)])) as Record<string, string>,
    [t],
  );
  const queryClient = useQueryClient();
  const disputes = useQuery({
    queryKey: ['admin-lab-disputes'],
    queryFn: () => lab.listDisputes('OPEN', '100'),
  });
  const resolveDispute = useMutation({
    mutationFn: async ({ id, accepted }: { id: string; accepted: boolean }) => {
      const resolution = window.prompt(
        language === 'uz' ? 'Yechim izohi:' : 'Комментарий к решению:',
      );
      if (!resolution?.trim()) throw new Error(language === 'uz' ? 'Izoh kerak' : 'Нужен комментарий');
      return lab.resolveDispute(id, accepted, resolution.trim());
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin-lab-disputes'] }),
  });

  const { data: orders, isLoading, isError } = useQuery({
    // Admin read of the whole lab domain off the secure LabController — the
    // lab_* tables left the generic proxy. Names come pre-joined by the server.
    queryKey: ['admin-lab-orders'],
    queryFn: async () => {
      const rows = await lab.listOrders({ limit: '1000' });
      return rows.map((r) => ({
        ...r,
        clinicName: r.clinic_name,
        techName: r.technician_name,
      }));
    },
  });

  const filtered = useMemo(() => {
    let list = orders || [];
    if (status !== 'all') list = list.filter((order) => order.status === status);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((order) =>
        [order.work_type, order.patient_name, order.clinicName, order.techName, String(order.order_number)]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q)),
      );
    }
    return list;
  }, [orders, status, search]);

  const kpi = useMemo(() => {
    const list = orders || [];
    return {
      total: list.length,
      active: list.filter((order) => !['delivered', 'cancelled'].includes(order.status)).length,
      urgent: list.filter((order) => order.priority === 'urgent').length,
    };
  }, [orders]);

  const exportToCSV = () => {
    if (!filtered.length) return;
    const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['№', t('adminLab.colWork'), t('adminLab.colStatus'), t('adminLab.colClinic'), t('adminLab.colTech'), t('adminLab.colDue'), t('adminLab.colPrice')]
      .map(escape)
      .join(',');
    const rows = filtered.map((o) =>
      [o.order_number, o.work_type, STATUS_LABEL[o.status] || o.status, o.clinicName, o.techName, o.due_date, o.price]
        .map(escape)
        .join(','),
    );
    const blob = new Blob(['﻿' + [header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lab-orders.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <FlaskConical className="h-7 w-7" /> {t('adminLab.title')}
            </h1>
            <p className="text-muted-foreground mt-2">{t('adminLab.subtitle')}</p>
          </div>
          <Button onClick={exportToCSV} disabled={!filtered.length} variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            {t('admin.exportCsv')}
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: t('adminLab.kpiTotal'), value: kpi.total },
            { label: t('adminLab.kpiActive'), value: kpi.active },
            { label: t('adminLab.kpiUrgent'), value: kpi.urgent },
          ].map((c) => (
            <div key={c.label} className="bg-card border border-border rounded-lg p-4">
              <p className="text-sm text-muted-foreground">{c.label}</p>
              <p className="text-2xl font-bold text-foreground">{c.value}</p>
            </div>
          ))}
        </div>

        {disputes.data && disputes.data.length > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
            <h2 className="font-semibold">
              {language === 'uz' ? 'Ochiq nizolar' : 'Открытые споры'} · {disputes.data.length}
            </h2>
            {disputes.data.map((dispute) => (
              <div key={dispute.id} className="flex flex-col gap-3 rounded-md border bg-card p-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{dispute.reason}</p>
                  <p className="text-xs text-muted-foreground">#{dispute.order_id}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" disabled={resolveDispute.isPending} onClick={() => resolveDispute.mutate({ id: dispute.id, accepted: true })}>
                    {language === 'uz' ? 'Qabul qilish' : 'Принять'}
                  </Button>
                  <Button size="sm" variant="outline" disabled={resolveDispute.isPending} onClick={() => resolveDispute.mutate({ id: dispute.id, accepted: false })}>
                    {language === 'uz' ? 'Rad etish' : 'Отклонить'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('adminLab.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-card border-border text-foreground"
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('adminLab.allStatuses')}</SelectItem>
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
                <TableHead className="text-muted-foreground">{t('adminLab.colWork')}</TableHead>
                <TableHead className="text-muted-foreground">{t('adminLab.colStatus')}</TableHead>
                <TableHead className="text-muted-foreground">{t('adminLab.colClinic')}</TableHead>
                <TableHead className="text-muted-foreground">{t('adminLab.colTech')}</TableHead>
                <TableHead className="text-muted-foreground">{t('adminLab.colDue')}</TableHead>
                <TableHead className="text-muted-foreground text-right">{t('adminLab.colPrice')}</TableHead>
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
                    {t('adminLab.loadError')}
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    {t('adminLab.notFound')}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((o) => (
                  <TableRow
                    key={o.id}
                    className="border-border hover:bg-accent/50 cursor-pointer"
                    onClick={() => setDetailId(o.id)}
                  >
                    <TableCell className="text-foreground font-mono">#{o.order_number}</TableCell>
                    <TableCell className="text-foreground">
                      {o.work_type}
                      {o.priority === 'urgent' && (
                        <Badge variant="destructive" className="ml-2">{t('adminLab.urgent')}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_TONE[o.status] || 'secondary'}>
                        {STATUS_LABEL[o.status] || o.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{o.clinicName || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{o.techName || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {o.due_date ? new Date(o.due_date).toLocaleDateString(dateLocale) : '—'}
                    </TableCell>
                    <TableCell className="text-right text-foreground">
                      {o.price != null ? formatPrice(o.price) : '—'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <AdminLabOrderDetail
        orderId={detailId}
        onClose={() => setDetailId(null)}
        statusLabel={STATUS_LABEL}
        dateLocale={dateLocale}
        t={t}
      />
    </AdminLayout>
  );
}

// Read-only dispute view: an admin opens any lab order to see its full stage
// timeline (lab_order_events) + the clinic↔technician chat (lab_order_messages),
// so a delivery/quality dispute can be adjudicated. Admin caller bypasses scope
// in LabController, so getOrder + listMessages return any order.
const ROLE_LABELS: Record<string, string> = {
  technician: 'Техник', clinic: 'Клиника', doctor: 'Врач', admin: 'Администратор',
};

function AdminLabOrderDetail({
  orderId,
  onClose,
  statusLabel,
  dateLocale,
  t,
}: {
  orderId: string | null;
  onClose: () => void;
  statusLabel: Record<string, string>;
  dateLocale: string;
  t: (k: string) => string;
}) {
  const [order, setOrder] = useState<LabOrderWithEvents | null>(null);
  const [messages, setMessages] = useState<LabMessage[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!orderId) {
      setOrder(null);
      setMessages([]);
      return;
    }
    let active = true;
    setLoading(true);
    Promise.all([lab.getOrder(orderId), lab.listMessages(orderId)])
      .then(([o, m]) => {
        if (!active) return;
        setOrder(o);
        setMessages(m);
      })
      .catch(() => {
        if (active) {
          setOrder(null);
          setMessages([]);
        }
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [orderId]);

  const dt = (v: string | null | undefined) => {
    if (!v) return '—';
    const d = new Date(v);
    return isNaN(d.getTime())
      ? '—'
      : d.toLocaleString(dateLocale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };
  const sl = (s: string | null | undefined) => (s ? statusLabel[s] || s : '—');

  return (
    <Dialog open={!!orderId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {loading || !order ? (
          <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> {t('admin.loading')}
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 flex-wrap">
                {order.work_type}
                {order.priority === 'urgent' && <Badge variant="destructive">{t('adminLab.urgent')}</Badge>}
                <Badge variant={STATUS_TONE[order.status] || 'secondary'}>{sl(order.status)}</Badge>
              </DialogTitle>
              <DialogDescription>
                {order.order_number != null ? `№${order.order_number}` : ''} · {order.clinic_name || '—'} ·{' '}
                {t('adminLab.colTech')}: {order.technician_name || '—'}
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-5 gap-y-2 text-sm">
              <Field label={t('adminLab.colClinic')} value={order.clinic_name} />
              <Field label="Пациент" value={order.patient_name} />
              <Field label="Материал" value={order.material} />
              <Field label={t('adminLab.colDue')} value={order.due_date ? new Date(order.due_date).toLocaleDateString(dateLocale) : '—'} />
              <Field label={t('adminLab.colPrice')} value={order.price != null ? formatPrice(order.price) : '—'} />
              <Field label="Оплата" value={order.paid_at ? `Оплачен ${dt(order.paid_at)}` : 'Не оплачен'} />
            </div>
            {order.status === 'declined' && order.declined_reason && (
              <div className="rounded-md bg-destructive/10 text-destructive text-sm px-3 py-2">
                Отклонён: {order.declined_reason}
              </div>
            )}

            {/* Event timeline */}
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
                Движение по этапам
              </div>
              <ol className="relative ml-1.5 border-l border-border">
                {(order.events || []).length === 0 ? (
                  <li className="ml-4 text-sm text-muted-foreground">Событий нет.</li>
                ) : (
                  order.events.map((e: LabOrderEvent, i: number) => (
                    <li key={i} className="ml-4 pb-3 last:pb-0 relative">
                      <span
                        className={`absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full ${
                          e.to_status === 'cancelled' || e.to_status === 'declined' ? 'bg-destructive' : 'bg-primary'
                        }`}
                      />
                      <div className="text-sm text-foreground">
                        {e.from_status ? `${sl(e.from_status)} → ` : ''}
                        <span className="font-semibold">{sl(e.to_status)}</span>
                      </div>
                      <div className="text-[11.5px] text-muted-foreground">
                        {dt(e.created_at)}
                        {e.actor_role ? ` · ${ROLE_LABELS[e.actor_role] ?? e.actor_role}` : ''}
                      </div>
                      {e.note && <div className="text-xs text-muted-foreground">{e.note}</div>}
                    </li>
                  ))
                )}
              </ol>
            </div>

            {/* Chat (read-only) */}
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-2 inline-flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" /> Переписка клиника ↔ техник
              </div>
              <div className="max-h-56 overflow-y-auto rounded-md border border-border bg-muted/30 p-3 space-y-2">
                {messages.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-3">Сообщений нет.</div>
                ) : (
                  messages.map((m) => (
                    <div key={m.id} className="rounded-md bg-card border border-border px-3 py-1.5 text-sm">
                      <div className="text-[10px] text-muted-foreground mb-0.5">
                        {ROLE_LABELS[m.sender_role || ''] ?? m.sender_role} · {dt(m.created_at)}
                      </div>
                      {m.body}
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
      <div className="mt-0.5 text-sm text-foreground">{value || '—'}</div>
    </div>
  );
}
