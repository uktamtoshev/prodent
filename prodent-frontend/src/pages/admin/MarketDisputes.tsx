import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Loader2, RotateCcw, Scale } from 'lucide-react';
import { toast } from 'sonner';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { MarketplaceDecisionDialog } from '@/components/admin/MarketplaceDecisionDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useUserRole } from '@/hooks/useUserRole';
import { marketplace, type MarketplaceDispute } from '@/lib/marketplace';

const money = (amount?: number, currency = 'UZS') =>
  `${Number(amount || 0).toLocaleString('ru-RU')} ${currency === 'UZS' ? 'сум' : currency}`;

export default function MarketDisputes() {
  const queryClient = useQueryClient();
  const { isModerator } = useUserRole();
  const [status, setStatus] = useState('open');
  const disputes = useQuery({
    queryKey: ['admin-market-disputes', status, isModerator ? 'redacted' : 'full'],
    queryFn: () => marketplace.adminListDisputes(status),
  });
  const resolve = useMutation({
    mutationFn: ({ id, decision, reason }: {
      id: string;
      decision: 'refund' | 'reject';
      reason: string;
    }) => marketplace.adminResolveDispute(id, {
      decision,
      reason,
      request_id: crypto.randomUUID(),
      confirm: true,
    }),
    onSuccess: () => {
      toast.success('Решение сохранено в истории');
      queryClient.invalidateQueries({ queryKey: ['admin-market-disputes'] });
      queryClient.invalidateQueries({ queryKey: ['admin-market-orders'] });
    },
    onError: (error: unknown) =>
      toast.error(error instanceof Error ? error.message : 'Не удалось закрыть спор'),
  });

  return (
    <AdminLayout>
      <div className="space-y-5">
        <header>
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            <Scale className="h-7 w-7" /> {isModerator ? 'Споры' : 'Споры и возвраты'}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {isModerator
              ? 'Здесь нет личных и платёжных данных. Модератор может только отклонить жалобу с обязательной причиной.'
              : 'Полная история заказа, оплаты и решения. Возврат требует причины и отдельного подтверждения.'}
          </p>
        </header>

        <div className="flex flex-wrap gap-2">
          {[
            ['open', 'Открытые'],
            ['resolved_refund', 'Возвраты'],
            ['resolved_reject', 'Отклонённые'],
          ].map(([key, label]) => (
            <Button key={key} variant={status === key ? 'default' : 'outline'} onClick={() => setStatus(key)}>
              {label}
            </Button>
          ))}
        </div>

        {disputes.isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin" /></div>
        ) : disputes.isError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-5 text-destructive">
            Не удалось загрузить споры.
          </div>
        ) : disputes.data?.length === 0 ? (
          <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
            Споров с таким статусом нет.
          </div>
        ) : (
          <div className="space-y-4">
            {disputes.data?.map((item) => (
              <DisputeCard
                key={item.id}
                dispute={item}
                redacted={isModerator}
                pending={resolve.isPending}
                onResolve={(decision, reason) => resolve.mutate({ id: item.id, decision, reason })}
              />
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

function DisputeCard({
  dispute,
  redacted,
  pending,
  onResolve,
}: {
  dispute: MarketplaceDispute;
  redacted: boolean;
  pending: boolean;
  onResolve: (decision: 'refund' | 'reject', reason: string) => void;
}) {
  const order = dispute.order;
  const payments = order?.payments || [];
  const refunds = order?.refunds || [];
  const reservations = order?.reservations || [];
  const stockEvents = order?.stock_events || [];
  const orderNumber = dispute.order_number || order?.order_number || '—';
  const paymentStatus = dispute.payment_status || order?.payment_status;
  const totalAmount = dispute.total_amount ?? order?.total_amount;
  const currency = dispute.currency || order?.currency;

  return (
    <article className="rounded-xl border bg-card">
      <div className="flex flex-wrap items-center gap-3 border-b p-4">
        <span className="font-bold">Заказ № {orderNumber}</span>
        <Badge variant={dispute.status === 'open' ? 'destructive' : 'secondary'}>
          {dispute.status === 'open' ? 'Открыт' : dispute.status === 'resolved_refund' ? 'Возврат' : 'Отклонён'}
        </Badge>
        {dispute.supplier_name && <span className="text-sm text-muted-foreground">{dispute.supplier_name}</span>}
        {!redacted && <span className="ml-auto font-semibold">{money(totalAmount, currency)}</span>}
      </div>

      <div className={`grid gap-4 p-4 ${redacted ? 'lg:grid-cols-2' : 'lg:grid-cols-3'}`}>
        <section>
          <div className="text-xs font-semibold uppercase text-muted-foreground">Жалоба покупателя</div>
          <p className="mt-2 text-sm">{dispute.reason}</p>
          <div className="mt-2 text-xs text-muted-foreground">
            {dispute.opened_at ? new Date(dispute.opened_at).toLocaleString('ru-RU') : '—'}
          </div>
        </section>

        {!redacted && (
          <section>
            <div className="text-xs font-semibold uppercase text-muted-foreground">Оплата и склад</div>
            <div className="mt-2 space-y-1 text-sm">
              <p>Оплата: {paymentStatus || 'нет'}</p>
              {payments.map((payment) => (
                <p key={payment.id}>
                  {payment.provider}: {payment.status} · {money(payment.amount, payment.currency)}
                </p>
              ))}
              {refunds.map((refund) => (
                <p key={refund.id} className="text-emerald-700">
                  Возврат: {money(refund.amount, currency)} · {refund.status}
                </p>
              ))}
              {reservations.map((reservation) => (
                <p key={reservation.id}>
                  Резерв: {reservation.quantity} шт. · {reservation.status}
                </p>
              ))}
              {stockEvents.map((event) => (
                <p key={event.id}>
                  Склад: {event.type} {event.quantity} · остаток {event.balance_after}
                </p>
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="text-xs font-semibold uppercase text-muted-foreground">История решений</div>
          {dispute.events?.length ? (
            <ol className="mt-2 space-y-2 text-sm">
              {dispute.events.map((event) => (
                <li key={event.id} className="border-l-2 pl-3">
                  <div className="font-medium">{event.event_type}</div>
                  <div>{event.reason}</div>
                  <div className="text-xs text-muted-foreground">{new Date(event.created_at).toLocaleString('ru-RU')}</div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Решений пока нет.</p>
          )}
        </section>
      </div>

      {dispute.status === 'open' && (
        <div className="flex justify-end gap-2 border-t p-4">
          <MarketplaceDecisionDialog
            title="Отклонить спор?"
            description="Заказ и оплата не изменятся. Причина сохранится в журнале."
            confirmLabel="Отклонить"
            pending={pending}
            onConfirm={(reason) => onResolve('reject', reason)}
            trigger={<Button variant="outline"><CheckCircle2 className="mr-2 h-4 w-4" /> Отклонить спор</Button>}
          />
          {!redacted && (
            <MarketplaceDecisionDialog
              title="Подтвердить полный возврат?"
              description="Это финансовое действие. Сервер вернёт деньги один раз и запишет результат в историю."
              confirmLabel="Вернуть деньги"
              destructive
              pending={pending}
              onConfirm={(reason) => onResolve('refund', reason)}
              trigger={<Button variant="destructive"><RotateCcw className="mr-2 h-4 w-4" /> Вернуть деньги</Button>}
            />
          )}
        </div>
      )}
      {dispute.resolution_reason && (
        <div className="flex items-start gap-2 border-t bg-muted/40 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4" />
          Решение: {dispute.resolution_reason}
        </div>
      )}
    </article>
  );
}
