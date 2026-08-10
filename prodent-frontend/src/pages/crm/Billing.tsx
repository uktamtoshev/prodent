import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, CreditCard, Crown, History, Megaphone, Sparkles, TrendingUp, Wallet } from 'lucide-react';
import { CRMLayout } from '@/components/crm/CRMLayout';
import { VirtualAccountCard } from '@/components/finance/VirtualAccountCard';
import { NewSubscriptionPlans } from '@/components/billing/NewSubscriptionPlans';
import { AddOnServicesList } from '@/components/billing/AddOnServicesList';
import { AppointmentLimitBanner } from '@/components/billing/AppointmentLimitBanner';
import { PlanStatusBadge } from '@/components/billing/PlanStatusBadge';
import { useClinic } from '@/contexts/ClinicContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useSubscribeToPlan, useAppointmentLimit, useSubscriptionStatus } from '@/hooks/useSubscriptionPlan';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import paymeLogo from '@/assets/payments/payme-logo.png';
import clickLogo from '@/assets/payments/click-logo.png';
import uzumLogo from '@/assets/payments/uzum-logo.png';

const safeLabel = (value: string, fallback: string) =>
  value && !/[ÐÑÂâ]/.test(value) ? value : fallback;

export default function CRMBilling() {
  const { t } = useLanguage();
  const tr = (key: string, fallback: string) => safeLabel(t(key), fallback);
  const { currentClinic } = useClinic();
  const [activeTab, setActiveTab] = useState('balance');

  const { data: clinicInfo } = useQuery({
    queryKey: ['clinic-subscription', currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return null;
      const { data, error } = await supabase
        .from('clinics')
        .select('*')
        .eq('id', currentClinic.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!currentClinic?.id,
  });

  const { data: status, isLoading: accountLoading, isError: accountError } = useSubscriptionStatus();
  const virtualAccount = status ? { id: status.account_id, balance: status.balance } : null;
  const { data: limitInfo } = useAppointmentLimit('clinic', currentClinic?.id);
  const subscribeMutation = useSubscribeToPlan();

  const handleSubscribe = (planSlug: string, _price: number) => {
    if (!currentClinic) {
      toast.error(tr('crmBilling.accountNotFound', 'Аккаунт не найден'));
      return;
    }
    subscribeMutation.mutate({ planSlug, entityType: 'clinic' });
  };

  if (!currentClinic) {
    return (
      <CRMLayout>
        <div className="p-4 lg:p-6">
          <Card className="border-dashed">
            <CardContent className="py-14 text-center">
              <CreditCard className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">{tr('crmBilling.selectClinic', 'Выберите клинику для управления оплатой')}</p>
            </CardContent>
          </Card>
        </div>
      </CRMLayout>
    );
  }

  return (
    <CRMLayout>
      <div className="space-y-section p-4 lg:p-6">
        <AppointmentLimitBanner limitInfo={limitInfo} entityType="clinic" />

        {/* Заголовок на холсте, без карточки-героя и без бейджа «Billing»:
            латиницей посреди русского интерфейса он ничего не сообщал, а
            карточка занимала первый экран. */}
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-3">
                <div>
                  <h1 className="cabinet-page-title font-heading text-xl font-bold tracking-tight text-foreground">{tr('crmBilling.title', 'Оплата и подписки')}</h1>
                  <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                    {tr('crmBilling.description', 'Управление балансом, подписками и рекламой клиники')}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[420px]">
                <div className="rounded-2xl border bg-background/70 p-3">
                  <p className="text-xs text-muted-foreground">{tr('crmBilling.balance', 'Баланс')}</p>
                  <p className="text-2xl font-bold text-primary">
                    {new Intl.NumberFormat('ru-RU').format(virtualAccount?.balance || 0)} UZS
                  </p>
                </div>
                <div className="rounded-2xl border bg-background/70 p-3">
                  <p className="text-xs text-muted-foreground">Статус плана</p>
                  <PlanStatusBadge
                    plan={clinicInfo?.subscription_plan}
                    expiresAt={clinicInfo?.subscription_expires_at}
                  />
                </div>
              </div>
            </div>

            {limitInfo && limitInfo.limit && (
              <div className="mt-5 rounded-2xl border bg-background/70 p-3">
                <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {limitInfo.count}/{limitInfo.limit} {tr('crmBilling.records', 'записей')}
                  </span>
                  <span className="text-xs text-muted-foreground">Лимит текущего плана</span>
                </div>
                <Progress value={(limitInfo.count / limitInfo.limit) * 100} className="h-2" />
              </div>
            )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 lg:w-[430px]">
            <TabsTrigger value="balance" className="gap-2">
              <Wallet className="h-4 w-4" />
              {tr('crmBilling.tabBalance', 'Баланс')}
            </TabsTrigger>
            <TabsTrigger value="subscription" className="gap-2">
              <Crown className="h-4 w-4" />
              {tr('crmBilling.tabSubscription', 'Подписка')}
            </TabsTrigger>
            <TabsTrigger value="addons" className="gap-2">
              <Sparkles className="h-4 w-4" />
              {tr('crmBilling.tabAddons', 'Услуги')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="balance" className="mt-6 space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <VirtualAccountCard
                type="clinic"
                entityId={currentClinic.id}
                entityName={`${currentClinic.name} · единый счёт пользователя`}
              />

              <div className="space-y-6">
                <Card className="border-border/60">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base font-bold">
                      <CreditCard className="h-5 w-5 text-primary" />
                      {tr('crmBilling.paymentMethods', 'Способы пополнения')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {[
                      { name: 'Payme', logo: paymeLogo, desc: tr('crmBilling.payByCard', 'Оплата картой') },
                      { name: 'Click', logo: clickLogo, desc: tr('crmBilling.fastPayment', 'Быстрая оплата') },
                      { name: 'Uzum Bank', logo: uzumLogo, desc: tr('crmBilling.uzumApp', 'Uzum приложение') },
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
                      {tr('crmBilling.whyBalance', 'Для чего нужен баланс?')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <div className="flex items-start gap-2"><Crown className="mt-0.5 h-4 w-4 text-primary" /><p>{tr('crmBilling.whyBalance1', 'Оплата подписок и премиум-функций')}</p></div>
                    <div className="flex items-start gap-2"><Megaphone className="mt-0.5 h-4 w-4 text-primary" /><p>{tr('crmBilling.whyBalance2', 'Рекламные кампании для продвижения')}</p></div>
                    <div className="flex items-start gap-2"><History className="mt-0.5 h-4 w-4 text-primary" /><p>{tr('crmBilling.whyBalance3', 'Покупка бейджей и значков')}</p></div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="subscription" className="mt-6 space-y-6">
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle>{tr('crmBilling.choosePlan', 'Выберите план подписки')}</CardTitle>
                <CardDescription>{tr('crmBilling.choosePlanDesc', 'Расширьте возможности вашей клиники с премиум-функциями')}</CardDescription>
              </CardHeader>
              <CardContent>
                {accountLoading ? (
                  <div className="grid gap-4 md:grid-cols-3">
                    {[1, 2, 3].map((item) => <Skeleton key={item} className="h-[350px]" />)}
                  </div>
                ) : (
                  <NewSubscriptionPlans
                    entityType="clinic"
                    currentPlanId={clinicInfo?.subscription_plan || null}
                    balance={virtualAccount?.balance || 0}
                    onSubscribe={handleSubscribe}
                    isLoading={subscribeMutation.isPending}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="addons" className="mt-6 space-y-6">
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <Sparkles className="h-5 w-5 text-primary" />
                  {tr('crmBilling.addons', 'Дополнительные услуги')}
                </CardTitle>
                <CardDescription>{tr('crmBilling.addonsDesc', 'Бейджи, продвижение в поиске и особые рамки профиля')}</CardDescription>
              </CardHeader>
              <CardContent>
                {accountLoading ? (
                  <div className="grid gap-4 md:grid-cols-3">
                    {[1, 2, 3, 4, 5, 6].map((item) => <Skeleton key={item} className="h-[180px]" />)}
                  </div>
                ) : accountError || !virtualAccount ? (
                  <Card className="border-dashed">
                    <CardContent className="py-10 text-center text-muted-foreground">
                      Не удалось загрузить баланс. Обновите страницу и попробуйте ещё раз.
                    </CardContent>
                  </Card>
                ) : (
                  <AddOnServicesList
                    targetType="clinic"
                    entityId={currentClinic.id}
                    balance={virtualAccount.balance || 0}
                    virtualAccountId={virtualAccount.id}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </CRMLayout>
  );
}
