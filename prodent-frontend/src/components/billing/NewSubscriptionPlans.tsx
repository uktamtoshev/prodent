import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PlanCard } from './PlanCard';
import { useSubscriptionPlans, type EntityType, type SubscriptionPlan } from '@/hooks/useSubscriptionPlan';
import { useLanguage } from '@/contexts/LanguageContext';

interface NewSubscriptionPlansProps {
  entityType: EntityType;
  currentPlanId: string | null;
  balance: number;
  onSubscribe: (planId: string, price: number) => void;
  isLoading?: boolean;
}

export function NewSubscriptionPlans({
  entityType,
  currentPlanId,
  balance,
  onSubscribe,
  isLoading,
}: NewSubscriptionPlansProps) {
  const { t } = useLanguage();
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const { data: plans, isLoading: plansLoading } = useSubscriptionPlans(entityType);

  const formatAmount = (value: number) => {
    return new Intl.NumberFormat('ru-RU').format(value);
  };

  // Current plan is the entity's subscription_plan slug (FREE/BASIC/PREMIUM/ENTERPRISE).
  const currentSlug = (currentPlanId || 'FREE').toUpperCase();

  const handleSelectPlan = (plan: SubscriptionPlan) => {
    if (plan.slug === currentSlug) return;
    if (plan.price > balance) return;
    setSelectedPlan(plan);
    setIsConfirmOpen(true);
  };

  const handleConfirm = () => {
    if (!selectedPlan) return;
    onSubscribe(selectedPlan.slug, selectedPlan.price);
    setIsConfirmOpen(false);
    setSelectedPlan(null);
  };

  if (plansLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[350px]" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        {plans?.map((plan) => {
          const isCurrent = plan.slug === currentSlug;
          const canAfford = balance >= plan.price;

          return (
            <PlanCard
              key={plan.slug}
              plan={plan}
              isCurrentPlan={isCurrent}
              canAfford={canAfford}
              onSelect={() => handleSelectPlan(plan)}
              isLoading={isLoading}
            />
          );
        })}
      </div>

      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('billingDialogs.confirmSubscriptionTitle')}</DialogTitle>
            <DialogDescription>
              {t('billingDialogs.youSelectedPlan')} "{selectedPlan?.name_ru}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 rounded-lg bg-muted">
              <div className="flex justify-between mb-2">
                <span>{t('billingDialogs.cost')}</span>
                <span className="font-bold">
                  {formatAmount(selectedPlan?.price || 0)} UZS / {t('billingDialogs.perMonth')}
                </span>
              </div>
              <div className="flex justify-between mb-2">
                <span>{t('billingDialogs.currentBalance')}</span>
                <span className="font-bold text-green-600">{formatAmount(balance)} UZS</span>
              </div>
              <div className="flex justify-between pt-2 border-t">
                <span>{t('billingDialogs.afterPayment')}</span>
                <span className="font-bold">
                  {formatAmount(balance - (selectedPlan?.price || 0))} UZS
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setIsConfirmOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button className="flex-1" onClick={handleConfirm} disabled={isLoading}>
                {t('billingDialogs.confirmBtn')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
