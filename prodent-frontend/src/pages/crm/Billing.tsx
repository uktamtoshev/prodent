import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CreditCard, Crown, Megaphone, Wallet, History, TrendingUp, Sparkles, Calendar } from 'lucide-react';
import { CRMLayout } from '@/components/crm/CRMLayout';
import { VirtualAccountCard } from '@/components/finance/VirtualAccountCard';
import { NewSubscriptionPlans } from '@/components/billing/NewSubscriptionPlans';
import { AddOnServicesList } from '@/components/billing/AddOnServicesList';
import { AppointmentLimitBanner } from '@/components/billing/AppointmentLimitBanner';
import { PlanStatusBadge } from '@/components/billing/PlanStatusBadge';
import { useClinic } from '@/contexts/ClinicContext';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { useSubscribeToPlan, useAppointmentLimit, usePlanFeatures } from '@/hooks/useSubscriptionPlan';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import paymeLogo from '@/assets/payments/payme-logo.png';
import clickLogo from '@/assets/payments/click-logo.png';
import uzumLogo from '@/assets/payments/uzum-logo.png';

export default function CRMBilling() {
  const { currentClinic } = useClinic();
  const { user } = useAuth();
  const { isDoctor, isClinicAdmin, isSuperAdmin, doctorId } = useUserRole();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('balance');

  // Get clinic info with subscription data
  const { data: clinicInfo, isLoading: clinicLoading } = useQuery({
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

  // Get virtual account for clinic
  const { data: virtualAccount, isLoading: accountLoading } = useQuery({
    queryKey: ['virtual-account', 'clinic', currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic?.id) return null;
      const { data, error } = await supabase
        .from('virtual_accounts')
        .select('*')
        .eq('clinic_id', currentClinic.id)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!currentClinic?.id,
  });

  // Get appointment limit info for clinic
  const { data: limitInfo } = useAppointmentLimit('clinic', currentClinic?.id);
  
  // Get plan features for clinic
  const { data: planFeatures } = usePlanFeatures('clinic', currentClinic?.id);

  // Subscribe mutation
  const subscribeMutation = useSubscribeToPlan();

  const handleSubscribe = (planId: string, price: number) => {
    if (!virtualAccount || !currentClinic) {
      toast.error('Аккаунт не найден');
      return;
    }
    
    subscribeMutation.mutate({
      entityType: 'clinic',
      entityId: currentClinic.id,
      planId,
      price,
      virtualAccountId: virtualAccount.id,
      currentBalance: virtualAccount.balance,
    });
  };

  if (!currentClinic) {
    return (
      <CRMLayout>
        <div className="p-6">
          <Card>
            <CardContent className="py-12 text-center">
              <CreditCard className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Выберите клинику для управления оплатой</p>
            </CardContent>
          </Card>
        </div>
      </CRMLayout>
    );
  }

  return (
    <CRMLayout>
      <div className="p-6 space-y-6">
        {/* Appointment Limit Banner */}
        <AppointmentLimitBanner limitInfo={limitInfo} entityType="clinic" />

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold font-heading">Оплата и подписки</h1>
            <p className="text-muted-foreground">
              Управление балансом, подписками и рекламой клиники
            </p>
          </div>
          <div className="flex items-center gap-4">
            <PlanStatusBadge 
              plan={clinicInfo?.subscription_plan} 
              expiresAt={clinicInfo?.subscription_expires_at} 
            />
            {limitInfo && limitInfo.limit && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span>{limitInfo.count}/{limitInfo.limit} записей</span>
                <Progress value={(limitInfo.count / limitInfo.limit) * 100} className="w-20 h-2" />
              </div>
            )}
            {virtualAccount && (
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Баланс</p>
                <p className="text-2xl font-bold text-primary">
                  {new Intl.NumberFormat('ru-RU').format(virtualAccount.balance)} UZS
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
            <TabsTrigger value="balance" className="gap-2">
              <Wallet className="w-4 h-4" />
              Баланс
            </TabsTrigger>
            <TabsTrigger value="subscription" className="gap-2">
              <Crown className="w-4 h-4" />
              Подписка
            </TabsTrigger>
            <TabsTrigger value="addons" className="gap-2">
              <Sparkles className="w-4 h-4" />
              Услуги
            </TabsTrigger>
          </TabsList>

          {/* Balance Tab */}
          <TabsContent value="balance" className="space-y-6 mt-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Doctor's Personal Account (if user is a doctor) */}
              {isDoctor && doctorId && (
                <VirtualAccountCard
                  type="doctor"
                  entityId={doctorId}
                  entityName="Мой личный счёт"
                />
              )}
              
              {/* Clinic Account */}
              <VirtualAccountCard
                type="clinic"
                entityId={currentClinic.id}
                entityName={`${currentClinic.name} (клиника)`}
              />

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-primary" />
                      Способы пополнения
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                      <img src={paymeLogo} alt="Payme" className="w-12 h-12 object-contain" />
                      <div>
                        <p className="font-medium">Payme</p>
                        <p className="text-sm text-muted-foreground">Оплата картой</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                      <img src={clickLogo} alt="Click" className="w-12 h-12 object-contain" />
                      <div>
                        <p className="font-medium">Click</p>
                        <p className="text-sm text-muted-foreground">Быстрая оплата</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                      <img src={uzumLogo} alt="Uzum Bank" className="w-12 h-12 object-contain" />
                      <div>
                        <p className="font-medium">Uzum Bank</p>
                        <p className="text-sm text-muted-foreground">Uzum приложение</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-primary" />
                      Для чего нужен баланс?
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <div className="flex items-start gap-2">
                      <Crown className="w-4 h-4 mt-0.5 text-primary" />
                      <p>Оплата подписок и премиум-функций</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <Megaphone className="w-4 h-4 mt-0.5 text-primary" />
                      <p>Рекламные кампании для продвижения</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <History className="w-4 h-4 mt-0.5 text-primary" />
                      <p>Покупка бейджей и значков</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Subscription Tab */}
          <TabsContent value="subscription" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Выберите план подписки</CardTitle>
                <CardDescription>
                  Расширьте возможности вашей клиники с премиум-функциями
                </CardDescription>
              </CardHeader>
              <CardContent>
                {accountLoading ? (
                  <div className="grid gap-4 md:grid-cols-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-[350px]" />
                    ))}
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

          {/* Add-ons Tab */}
          <TabsContent value="addons" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  Дополнительные услуги
                </CardTitle>
                <CardDescription>
                  Бейджи, продвижение в поиске и особые рамки профиля — покупайте отдельно на любой срок
                </CardDescription>
              </CardHeader>
              <CardContent>
                {accountLoading || !virtualAccount ? (
                  <div className="grid gap-4 md:grid-cols-3">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <Skeleton key={i} className="h-[180px]" />
                    ))}
                  </div>
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
