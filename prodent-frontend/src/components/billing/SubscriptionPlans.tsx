import { useState } from 'react';
import { Crown, Check, Star, Zap, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

interface SubscriptionPlan {
  id: 'free' | 'basic' | 'premium' | 'top';
  name: string;
  price: number;
  currency: string;
  period: string;
  icon: React.ReactNode;
  features: string[];
  popular?: boolean;
  color: string;
}

interface SubscriptionPlansProps {
  currentPlan: 'free' | 'basic' | 'premium' | 'top' | null;
  expiresAt: string | null;
  balance: number;
  onSubscribe: (planId: string, price: number) => void;
  isLoading?: boolean;
}

export function SubscriptionPlans({
  currentPlan,
  expiresAt,
  balance,
  onSubscribe,
  isLoading,
}: SubscriptionPlansProps) {
  const { t } = useLanguage();
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const subscriptionPlans: SubscriptionPlan[] = [
    {
      id: 'free',
      name: t('billingDialogs.planFree'),
      price: 0,
      currency: 'UZS',
      period: t('billingDialogs.perMonth'),
      icon: <Star className="w-6 h-6" />,
      features: [
        t('billingDialogs.planFreeFeature1'),
        t('billingDialogs.planFreeFeature2'),
        t('billingDialogs.planFreeFeature3'),
      ],
      color: 'border-border',
    },
    {
      id: 'basic',
      name: t('billingDialogs.planBasic'),
      price: 200000,
      currency: 'UZS',
      period: t('billingDialogs.perMonth'),
      icon: <Zap className="w-6 h-6" />,
      features: [
        t('billingDialogs.planBasicFeature1'),
        t('billingDialogs.planBasicFeature2'),
        t('billingDialogs.planBasicFeature3'),
        t('billingDialogs.planBasicFeature4'),
      ],
      color: 'border-blue-500',
    },
    {
      id: 'premium',
      name: t('billingDialogs.planPremium'),
      price: 500000,
      currency: 'UZS',
      period: t('billingDialogs.perMonth'),
      icon: <Crown className="w-6 h-6" />,
      features: [
        t('billingDialogs.planPremiumFeature1'),
        t('billingDialogs.planPremiumFeature2'),
        t('billingDialogs.planPremiumFeature3'),
        t('billingDialogs.planPremiumFeature4'),
        t('billingDialogs.planPremiumFeature5'),
      ],
      popular: true,
      color: 'border-primary',
    },
    {
      id: 'top',
      name: t('billingDialogs.planTop'),
      price: 1000000,
      currency: 'UZS',
      period: t('billingDialogs.perMonth'),
      icon: <Sparkles className="w-6 h-6" />,
      features: [
        t('billingDialogs.planTopFeature1'),
        t('billingDialogs.planTopFeature2'),
        t('billingDialogs.planTopFeature3'),
        t('billingDialogs.planTopFeature4'),
        t('billingDialogs.planTopFeature5'),
        t('billingDialogs.planTopFeature6'),
      ],
      color: 'border-amber-500',
    },
  ];

  const formatAmount = (value: number) => {
    return new Intl.NumberFormat('ru-RU').format(value);
  };

  const handleSelectPlan = (plan: SubscriptionPlan) => {
    if (plan.id === currentPlan) return;
    if (plan.price > balance) {
      toast.error(t('billingDialogs.insufficientFunds'));
      return;
    }
    setSelectedPlan(plan);
    setIsConfirmOpen(true);
  };

  const handleConfirm = () => {
    if (!selectedPlan) return;
    onSubscribe(selectedPlan.id, selectedPlan.price);
    setIsConfirmOpen(false);
    setSelectedPlan(null);
  };

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {subscriptionPlans.map((plan) => {
          const isCurrent = plan.id === currentPlan;
          const canAfford = balance >= plan.price;

          return (
            <Card
              key={plan.id}
              className={`relative transition-all ${plan.color} ${
                plan.popular ? 'border-2 shadow-lg' : ''
              } ${isCurrent ? 'bg-primary/5' : ''}`}
            >
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary">
                  {t('billingDialogs.popularBadge')}
                </Badge>
              )}
              {isCurrent && (
                <Badge className="absolute -top-3 right-4 bg-green-500">
                  {t('billingDialogs.currentPlanBadge')}
                </Badge>
              )}
              <CardHeader className="text-center pb-2">
                <div className={`w-12 h-12 mx-auto rounded-xl flex items-center justify-center mb-2 ${
                  plan.id === 'free' ? 'bg-muted text-muted-foreground' :
                  plan.id === 'basic' ? 'bg-blue-500/10 text-blue-500' :
                  plan.id === 'premium' ? 'bg-primary/10 text-primary' :
                  'bg-amber-500/10 text-amber-500'
                }`}>
                  {plan.icon}
                </div>
                <CardTitle className="text-lg">{plan.name}</CardTitle>
                <CardDescription>
                  <span className="text-2xl font-bold text-foreground">
                    {plan.price === 0 ? t('billingDialogs.free') : formatAmount(plan.price)}
                  </span>
                  {plan.price > 0 && (
                    <span className="text-sm text-muted-foreground"> / {plan.period}</span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Check className="w-4 h-4 mt-0.5 text-green-500 shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={isCurrent ? 'outline' : plan.popular ? 'default' : 'secondary'}
                  disabled={isCurrent || isLoading || (!canAfford && plan.price > 0)}
                  onClick={() => handleSelectPlan(plan)}
                >
                  {isCurrent ? t('billingDialogs.currentPlanBtn') :
                   !canAfford && plan.price > 0 ? t('billingDialogs.insufficientFundsBtn') :
                   plan.price === 0 ? t('billingDialogs.chooseBtn') : t('billingDialogs.subscribeBtn')}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('billingDialogs.confirmSubscriptionTitle')}</DialogTitle>
            <DialogDescription>
              {t('billingDialogs.youSelectedPlan')} "{selectedPlan?.name}"
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
