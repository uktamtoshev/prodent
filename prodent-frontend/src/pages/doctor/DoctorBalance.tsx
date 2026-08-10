import { DoctorLayout } from '@/components/doctor/DoctorLayout';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { formatAmount } from '@/lib/localization';
import { useVirtualAccount } from '@/hooks/useVirtualAccount';
import { BalanceOperations } from '@/components/finance/BalanceOperations';
import { VirtualAccountCard } from '@/components/finance/VirtualAccountCard';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CreditCard, TrendingUp, Wallet, History } from 'lucide-react';

export default function DoctorBalance() {
  const [balanceTab, setBalanceTab] = useState<'overview' | 'operations'>('overview');
  const { user } = useAuth();
  const { t, language } = useLanguage();

  // Get doctor ID for current user
  const { data: doctor, isLoading } = useQuery({
    queryKey: ['doctor-by-user', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('doctors')
        .select('id, specialty')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Get profile name
  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Тот же кеш, что у карточки счёта ниже: ключ 'wallet' общий.
  const {
    account,
    transactions,
    transactionsError,
    transactionsLoading,
    transactionsLoaded,
    refetchTransactions,
  } = useVirtualAccount('doctor', doctor?.id ?? '');

  return (
    <DoctorLayout>
      <div className="p-6 space-y-section">
        {/* Показатель и срезы. Баланс и список операций приходят одним хуком
            (useVirtualAccount, ключ 'wallet') — здесь он берётся из того же
            кеша, что и карточка счёта ниже, поэтому числа не разойдутся.
            Двух эталонных показателей нет: «Списание в день» и «Хватит на»
            требуют ставки тарификации, а её в ответе не приходит. */}
        <div className="flex flex-wrap items-end justify-between gap-section">
          <div className="rounded-panel border border-border bg-card px-card-x py-3">
            <p className="text-meta font-medium text-muted-foreground">{t("doctorBalance.title")}</p>
            <p className="text-kpi tabular-nums font-heading">
              {account ? formatAmount(Number(account.balance ?? 0), language) : "—"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-0.5">
            {([
              { key: "overview" as const, label: t("doctorBalance.tabOverview"), n: 0 },
              { key: "operations" as const, label: t("doctorBalance.tabOperations"), n: transactions?.length ?? 0 },
            ]).map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setBalanceTab(item.key)}
                aria-pressed={balanceTab === item.key}
                className={cn(
                  "cabinet-control inline-flex items-center gap-1.5 rounded-t-field px-3 py-2 text-cell transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  balanceTab === item.key
                    ? "border border-b-0 border-border bg-card font-semibold text-primary shadow-soft"
                    : "font-medium text-muted-foreground hover:text-foreground",
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

        {/* Header */}
        <div>
          <h1 className="cabinet-page-title font-heading text-xl font-bold tracking-tight text-foreground">{t("doctorBalance.title")}</h1>
          <p className="text-muted-foreground">{t("doctorBalance.subtitle")}</p>
        </div>

        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2">
            <Skeleton className="h-[500px]" />
            <Skeleton className="h-[500px]" />
          </div>
        ) : doctor && balanceTab === 'operations' ? (
          /* Настоящее переключение: список операций вместо того же обзора. */
          <BalanceOperations
            transactions={transactions}
            language={language}
            isError={!!transactionsError}
            isLoading={transactionsLoading}
            isLoaded={transactionsLoaded}
            onRetry={() => void refetchTransactions()}
            labels={{
              date: t("doctorBalance.opDate"),
              operation: t("doctorBalance.opName"),
              amount: t("doctorBalance.opAmount"),
              balance: t("doctorBalance.opBalance"),
              status: t("doctorBalance.opStatus"),
              empty: t("doctorBalance.opEmpty"),
              error: t("doctorBalance.opError"),
              retry: t("doctorBalance.opRetry"),
              loading: t("doctorBalance.opLoading"),
            }}
          />
        ) : doctor ? (
          <div className="grid gap-section lg:grid-cols-2">
            {/* Virtual Account Card */}
            <VirtualAccountCard
              type="doctor"
              entityId={doctor.id}
              entityName={profile?.full_name || t("doctor.doctor")}
            />

            {/* Info Cards */}
            <div className="space-y-section">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base font-bold">
                    <CreditCard className="w-5 h-5 text-primary" />
                    {t("doctorBalance.methods")}
                  </CardTitle>
                  <CardDescription>
                    {t("doctorBalance.methodsAvail")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4 p-3 rounded-lg bg-[#00CCCC]/10">
                    <div className="w-12 h-12 rounded-lg bg-[#00CCCC] flex items-center justify-center text-white font-bold">
                      P
                    </div>
                    <div>
                      <p className="font-medium">Payme</p>
                      <p className="text-sm text-muted-foreground">{t("doctorBalance.paymeDesc")}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-3 rounded-lg bg-[#009FE3]/10">
                    <div className="w-12 h-12 rounded-lg bg-[#009FE3] flex items-center justify-center text-white font-bold">
                      C
                    </div>
                    <div>
                      <p className="font-medium">Click</p>
                      <p className="text-sm text-muted-foreground">{t("doctorBalance.clickDesc")}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-3 rounded-lg bg-[#7B2D8E]/10">
                    <div className="w-12 h-12 rounded-lg bg-[#7B2D8E] flex items-center justify-center text-white font-bold">
                      U
                    </div>
                    <div>
                      <p className="font-medium">Uzum Bank</p>
                      <p className="text-sm text-muted-foreground">{t("doctorBalance.uzumDesc")}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base font-bold">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    {t("doctorBalance.whyBalance")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <Wallet className="w-4 h-4 mt-0.5 text-primary" />
                    <p>{t("doctorBalance.whyAds")}</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <History className="w-4 h-4 mt-0.5 text-primary" />
                    <p>{t("doctorBalance.whySub")}</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <CreditCard className="w-4 h-4 mt-0.5 text-primary" />
                    <p>{t("doctorBalance.whyBadges")}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <Wallet className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">{t("doctor.profileNotFound")}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DoctorLayout>
  );
}
