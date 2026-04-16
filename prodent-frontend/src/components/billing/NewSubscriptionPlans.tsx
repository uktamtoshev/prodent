import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PlanCard } from './PlanCard';
import { useSubscriptionPlans, type EntityType, type SubscriptionPlan } from '@/hooks/useSubscriptionPlan';

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
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const { data: plans, isLoading: plansLoading } = useSubscriptionPlans(entityType);

  const formatAmount = (value: number) => {
    return new Intl.NumberFormat('ru-RU').format(value);
  };

  // Map current DB plan value to our plan ID
  const mapDbPlanToId = (dbPlan: string | null): string => {
    if (!dbPlan || dbPlan === 'free') return 'basic';
    if (dbPlan === 'premium' || dbPlan === 'standard') return 'standard';
    if (dbPlan === 'top' || dbPlan === 'gold') return 'gold';
    return 'basic';
  };

  const currentMappedPlanId = mapDbPlanToId(currentPlanId);

  const handleSelectPlan = (plan: SubscriptionPlan) => {
    const planKey = plan.name.toLowerCase();
    if (planKey === currentMappedPlanId) return;
    if (plan.price > balance) return;
    setSelectedPlan(plan);
    setIsConfirmOpen(true);
  };

  const handleConfirm = () => {
    if (!selectedPlan) return;
    const planKey = selectedPlan.name.toLowerCase();
    onSubscribe(planKey, selectedPlan.price);
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
          const planKey = plan.name.toLowerCase();
          const isCurrent = planKey === currentMappedPlanId;
          const canAfford = balance >= plan.price;

          return (
            <PlanCard
              key={plan.id}
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
            <DialogTitle>Подтверждение подписки</DialogTitle>
            <DialogDescription>
              Вы выбрали план "{selectedPlan?.name_ru}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 rounded-lg bg-muted">
              <div className="flex justify-between mb-2">
                <span>Стоимость:</span>
                <span className="font-bold">
                  {formatAmount(selectedPlan?.price || 0)} UZS / месяц
                </span>
              </div>
              <div className="flex justify-between mb-2">
                <span>Текущий баланс:</span>
                <span className="font-bold text-green-600">{formatAmount(balance)} UZS</span>
              </div>
              <div className="flex justify-between pt-2 border-t">
                <span>После оплаты:</span>
                <span className="font-bold">
                  {formatAmount(balance - (selectedPlan?.price || 0))} UZS
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setIsConfirmOpen(false)}>
                Отмена
              </Button>
              <Button className="flex-1" onClick={handleConfirm} disabled={isLoading}>
                Подтвердить
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
