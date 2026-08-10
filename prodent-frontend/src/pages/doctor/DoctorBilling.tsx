import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CreditCard, Crown, Wallet, History, TrendingUp, Sparkles, Calendar } from 'lucide-react';
import { DoctorLayout } from '@/components/doctor/DoctorLayout';
import { VirtualAccountCard } from '@/components/finance/VirtualAccountCard';
import { NewSubscriptionPlans } from '@/components/billing/NewSubscriptionPlans';
import { AddOnServicesList } from '@/components/billing/AddOnServicesList';
import { AppointmentLimitBanner } from '@/components/billing/AppointmentLimitBanner';
import { PlanStatusBadge } from '@/components/billing/PlanStatusBadge';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { useSubscribeToPlan, useAppointmentLimit, usePlanFeatures, useSubscriptionStatus } from '@/hooks/useSubscriptionPlan';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import paymeLogo from '@/assets/payments/payme-logo.png';
import clickLogo from '@/assets/payments/click-logo.png';
import uzumLogo from '@/assets/payments/uzum-logo.png';

export default function DoctorBilling() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('balance');

  // Get doctor profile
  const { data: doctor, isLoading: doctorLoading } = useQuery({
    queryKey: ['doctor-by-user', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('doctors')
        .select('id, specialty, subscription_plan, subscription_expires_at')
        .eq('user_id', user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Get user profile name
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

  // Wallet + subscription status (USER-scoped wallet, server-authoritative)
  const { data: status, isLoading: accountLoading } = useSubscriptionStatus();
  const virtualAccount = status
    ? { id: status.account_id, balance: status.balance }
    : null;

  // Get appointment limit info
  const { data: limitInfo } = useAppointmentLimit('doctor', doctor?.id);

  // Get plan features
  const { data: planFeatures } = usePlanFeatures('doctor', doctor?.id);

  // Subscribe mutation
  const subscribeMutation = useSubscribeToPlan();

  const handleSubscribe = (planSlug: string, _price: number) => {
    if (!doctor) {
      toast.error(t("doctorBilling.accountNotFound"));
      return;
    }
    subscribeMutation.mutate({ planSlug, entityType: 'doctor' });
  };

  if (doctorLoading) {
    return (
      <DoctorLayout>
        <div className="p-card-x">
          <Skeleton className="h-[400px]" />
        </div>
      </DoctorLayout>
    );
  }

  if (!doctor) {
    return (
      <DoctorLayout>
        <div className="p-card-x">
          <Card>
            <CardContent className="py-12 text-center">
              <CreditCard className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">{t("doctor.profileNotFound")}</p>
            </CardContent>
          </Card>
        </div>
      </DoctorLayout>
    );
  }

  return (
    <DoctorLayout>
      <div className="p-6 space-y-6">
        {/* Appointment Limit Banner */}
        <AppointmentLimitBanner limitInfo={limitInfo} entityType="doctor" />

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="cabinet-page-title font-heading text-xl font-bold tracking-tight text-foreground">{t("doctorBilling.title")}</h1>
            <p className="text-muted-foreground">
              {t("doctorBilling.subtitle")}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <PlanStatusBadge 
              plan={doctor.subscription_plan} 
              expiresAt={doctor.subscription_expires_at} 
            />
            {limitInfo && limitInfo.limit && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span>{limitInfo.count}/{limitInfo.limit} {t("doctorBilling.bookings")}</span>
                <Progress value={(limitInfo.count / limitInfo.limit) * 100} className="w-20 h-2" />
              </div>
            )}
            {virtualAccount && (
              <div className="text-right">
                <p className="text-sm text-muted-foreground">{t("doctorBilling.balanceLabel")}</p>
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
              {t("doctorBilling.tabBalance")}
            </TabsTrigger>
            <TabsTrigger value="subscription" className="gap-2">
              <Crown className="w-4 h-4" />
              {t("doctorBilling.tabSubscription")}
            </TabsTrigger>
            <TabsTrigger value="addons" className="gap-2">
              <Sparkles className="w-4 h-4" />
              {t("doctorBilling.tabAddons")}
            </TabsTrigger>
          </TabsList>

          {/* Balance Tab */}
          <TabsContent value="balance" className="space-y-6 mt-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <VirtualAccountCard
                type="doctor"
                entityId={doctor.id}
                entityName={profile?.full_name || t("doctor.doctor")}
              />

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base font-bold">
                      <CreditCard className="w-5 h-5 text-primary" />
                      {t("doctorBilling.methods")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                      <img src={paymeLogo} alt="Payme" className="w-12 h-12 object-contain" />
                      <div>
                        <p className="font-medium">Payme</p>
                        <p className="text-sm text-muted-foreground">{t("doctorBilling.paymeFast")}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                      <img src={clickLogo} alt="Click" className="w-12 h-12 object-contain" />
                      <div>
                        <p className="font-medium">Click</p>
                        <p className="text-sm text-muted-foreground">{t("doctorBilling.clickFast")}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                      <img src={uzumLogo} alt="Uzum Bank" className="w-12 h-12 object-contain" />
                      <div>
                        <p className="font-medium">Uzum Bank</p>
                        <p className="text-sm text-muted-foreground">{t("doctorBilling.uzumFast")}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base font-bold">
                      <TrendingUp className="w-5 h-5 text-primary" />
                      {t("doctorBilling.whyBalance")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <div className="flex items-start gap-2">
                      <Crown className="w-4 h-4 mt-0.5 text-primary" />
                      <p>{t("doctorBilling.whyPlans")}</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <Sparkles className="w-4 h-4 mt-0.5 text-primary" />
                      <p>{t("doctorBilling.whyBadges")}</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <History className="w-4 h-4 mt-0.5 text-primary" />
                      <p>{t("doctorBilling.whyShop")}</p>
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
                <CardTitle>{t("doctorBilling.choosePlan")}</CardTitle>
                <CardDescription>
                  {t("doctorBilling.choosePlanDesc")}
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
                    entityType="doctor"
                    currentPlanId={doctor.subscription_plan}
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
                <CardTitle className="flex items-center gap-2 text-base font-bold">
                  <Sparkles className="w-5 h-5 text-primary" />
                  {t("doctorBilling.addonsTitle")}
                </CardTitle>
                <CardDescription>
                  {t("doctorBilling.addonsDesc")}
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
                    targetType="doctor"
                    entityId={doctor.id}
                    balance={virtualAccount.balance || 0}
                    virtualAccountId={virtualAccount.id}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DoctorLayout>
  );
}
