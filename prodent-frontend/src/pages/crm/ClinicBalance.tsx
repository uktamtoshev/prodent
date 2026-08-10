import { useState } from 'react';
import { cn } from '@/lib/utils';
import { formatAmount } from '@/lib/localization';
import { useVirtualAccount } from '@/hooks/useVirtualAccount';
import { BalanceOperations } from '@/components/finance/BalanceOperations';
import { CRMLayout } from '@/components/crm/CRMLayout';
import { VirtualAccountCard } from '@/components/finance/VirtualAccountCard';
import { useClinic } from '@/contexts/ClinicContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, CreditCard, History, ShieldCheck, TrendingUp, Wallet } from 'lucide-react';
import paymeLogo from '@/assets/payments/payme-logo.png';
import clickLogo from '@/assets/payments/click-logo.png';
import uzumLogo from '@/assets/payments/uzum-logo.png';

const safeLabel = (value: string, fallback: string) =>
  value && !/[ÐÑÂâ]/.test(value) ? value : fallback;

export default function ClinicBalance() {
  const [balanceTab, setBalanceTab] = useState<'overview' | 'operations'>('overview');
  const { t, language } = useLanguage();
  const tr = (key: string, fallback: string) => safeLabel(t(key), fallback);
  const { currentClinic } = useClinic();
  // Тот же кеш, что у карточки счёта ниже: ключ 'wallet' общий.
  const {
    account,
    transactions,
    transactionsError,
    transactionsLoading,
    transactionsLoaded,
    refetchTransactions,
  } = useVirtualAccount('clinic', currentClinic?.id ?? '');

  return (
    <CRMLayout>
      <div className="space-y-section p-4 lg:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <Badge variant="outline" className="w-fit bg-background/70">
              <Wallet className="mr-1.5 h-3.5 w-3.5" />
              Balance
            </Badge>
            <div>
              <h1 className="cabinet-page-title font-heading text-xl font-bold tracking-tight text-foreground">{tr('crmBalance.title', 'Лицевой счёт клиники')}</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                {tr('crmBalance.description', 'Управление балансом и пополнение счёта')}
              </p>
            </div>
          </div>
          {currentClinic && (
            <div className="rounded-2xl border bg-background/70 p-4">
              <p className="text-xs text-muted-foreground">Текущая клиника</p>
              <p className="text-base font-bold">{currentClinic.name}</p>
            </div>
          )}
        </div>

        {/* Показатель и срезы. Баланс и операции приходят одним хуком
            (useVirtualAccount, ключ 'wallet'), тем же, что питает карточку
            счёта ниже, — числа не разойдутся. «Списание в день» и «Хватит на»
            из макета не выводятся: ставки тарификации в ответе нет. */}
        {currentClinic && (
          <div className="flex flex-wrap items-end justify-between gap-section">
            <div className="rounded-panel border border-border bg-card px-card-x py-3">
              <p className="text-meta font-medium text-muted-foreground">
                {tr('crmBalance.title', 'Лицевой счёт клиники')}
              </p>
              <p className="text-kpi tabular-nums font-heading">
                {account ? formatAmount(Number(account.balance ?? 0), language) : '—'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-0.5">
              {([
                { key: 'overview' as const, label: tr('doctorBalance.tabOverview', 'Обзор'), n: 0 },
                { key: 'operations' as const, label: tr('doctorBalance.tabOperations', 'Операции'), n: transactions?.length ?? 0 },
              ]).map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setBalanceTab(item.key)}
                  aria-pressed={balanceTab === item.key}
                  className={cn(
                    'cabinet-control inline-flex items-center gap-1.5 rounded-t-field px-3 py-2 text-cell transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    balanceTab === item.key
                      ? 'border border-b-0 border-border bg-card font-semibold text-primary shadow-soft'
                      : 'font-medium text-muted-foreground hover:text-foreground',
                  )}
                >
                  {item.label}
                  {item.n > 0 && (
                    <span className="rounded-full bg-status-neutral-bg px-1.5 text-xs font-bold tabular-nums text-status-neutral">
                      {item.n}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Настоящее переключение: вкладка «Операции» показывает список
            операций, а не тот же обзор с другим цветом кнопки. */}
        {!currentClinic ? (
          <Card className="border-dashed">
            <CardContent className="py-14 text-center">
              <ShieldCheck className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">{tr('crmBalance.selectClinic', 'Выберите клинику для просмотра баланса')}</p>
            </CardContent>
          </Card>
        ) : balanceTab === 'operations' ? (
          <BalanceOperations
            transactions={transactions}
            language={language}
            isError={!!transactionsError}
            isLoading={transactionsLoading}
            isLoaded={transactionsLoaded}
            onRetry={() => void refetchTransactions()}
            labels={{
              date: tr('crmBalance.opDate', 'Дата'),
              operation: tr('crmBalance.opName', 'Операция'),
              amount: tr('crmBalance.opAmount', 'Сумма'),
              balance: tr('crmBalance.opBalance', 'Остаток'),
              status: tr('crmBalance.opStatus', 'Статус'),
              empty: tr('crmBalance.opEmpty', 'Операций пока нет'),
              error: tr('crmBalance.opError', 'Не удалось загрузить операции'),
              retry: tr('crmBalance.opRetry', 'Повторить'),
              loading: tr('crmBalance.opLoading', 'Загружаем операции'),
            }}
          />
        ) : (
          <div className="grid gap-section lg:grid-cols-2">
            <VirtualAccountCard type="clinic" entityId={currentClinic.id} entityName={currentClinic.name} />

            <div className="space-y-section">
              <Card className="border-border/60">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base font-bold">
                    <CreditCard className="h-5 w-5 text-primary" />
                    {tr('crmBalance.paymentMethods', 'Способы пополнения')}
                  </CardTitle>
                  <CardDescription>{tr('crmBalance.paymentMethodsDesc', 'Доступные платёжные системы')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { name: 'Payme', logo: paymeLogo, desc: tr('crmBalance.paymeDesc', 'Оплата картой или через приложение') },
                    { name: 'Click', logo: clickLogo, desc: tr('crmBalance.clickDesc', 'Быстрая оплата через Click') },
                    { name: 'Uzum Bank', logo: uzumLogo, desc: tr('crmBalance.uzumDesc', 'Оплата через Uzum Bank') },
                  ].map((provider) => (
                    <div key={provider.name} className="flex items-center gap-4 rounded-xl border bg-muted/30 p-3">
                      <img src={provider.logo} alt={provider.name} className="h-12 w-12 object-contain" />
                      <div>
                        <p className="font-medium">{provider.name}</p>
                        <p className="text-sm text-muted-foreground">{provider.desc}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-border/60">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base font-bold">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    {tr('crmBalance.whyBalance', 'Для чего нужен баланс?')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <Building2 className="mt-0.5 h-4 w-4 text-primary" />
                    <p>{tr('crmBalance.whyBalance1', 'Оплата рекламных кампаний для продвижения клиники')}</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <History className="mt-0.5 h-4 w-4 text-primary" />
                    <p>{tr('crmBalance.whyBalance2', 'Продление подписки и премиум-функций CRM')}</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Wallet className="mt-0.5 h-4 w-4 text-primary" />
                    <p>{tr('crmBalance.whyBalance3', 'Покупка значков и бейджей для профиля клиники')}</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <CreditCard className="mt-0.5 h-4 w-4 text-primary" />
                    <p>{tr('crmBalance.whyBalance4', 'Оплата дополнительных модулей и интеграций')}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </CRMLayout>
  );
}
