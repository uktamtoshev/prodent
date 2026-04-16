import { useState } from 'react';
import { Crown, Check, Star, Zap, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

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

const subscriptionPlans: SubscriptionPlan[] = [
  {
    id: 'free',
    name: 'Бесплатный',
    price: 0,
    currency: 'UZS',
    period: 'месяц',
    icon: <Star className="w-6 h-6" />,
    features: [
      'Базовый профиль',
      'До 5 записей в месяц',
      'Стандартная поддержка',
    ],
    color: 'border-border',
  },
  {
    id: 'basic',
    name: 'Базовый',
    price: 200000,
    currency: 'UZS',
    period: 'месяц',
    icon: <Zap className="w-6 h-6" />,
    features: [
      'Расширенный профиль',
      'Неограниченные записи',
      'Статистика посещений',
      'Приоритетная поддержка',
    ],
    color: 'border-blue-500',
  },
  {
    id: 'premium',
    name: 'Премиум',
    price: 500000,
    currency: 'UZS',
    period: 'месяц',
    icon: <Crown className="w-6 h-6" />,
    features: [
      'Всё из Базового',
      'Продвижение в поиске',
      'Аналитика профиля',
      'Верифицированный бейдж',
      'CRM интеграции',
    ],
    popular: true,
    color: 'border-primary',
  },
  {
    id: 'top',
    name: 'ТОП',
    price: 1000000,
    currency: 'UZS',
    period: 'месяц',
    icon: <Sparkles className="w-6 h-6" />,
    features: [
      'Всё из Премиум',
      'ТОП позиция в поиске',
      'Персональный менеджер',
      'Эксклюзивные рекламы',
      'API доступ',
      'Белый лейбл',
    ],
    color: 'border-amber-500',
  },
];

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
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const formatAmount = (value: number) => {
    return new Intl.NumberFormat('ru-RU').format(value);
  };

  const handleSelectPlan = (plan: SubscriptionPlan) => {
    if (plan.id === currentPlan) return;
    if (plan.price > balance) {
      toast.error('Недостаточно средств на балансе. Пополните счёт.');
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
                  Популярный
                </Badge>
              )}
              {isCurrent && (
                <Badge className="absolute -top-3 right-4 bg-green-500">
                  Текущий план
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
                    {plan.price === 0 ? 'Бесплатно' : formatAmount(plan.price)}
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
                  {isCurrent ? 'Текущий план' : 
                   !canAfford && plan.price > 0 ? 'Недостаточно средств' :
                   plan.price === 0 ? 'Выбрать' : 'Подписаться'}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Подтверждение подписки</DialogTitle>
            <DialogDescription>
              Вы выбрали план "{selectedPlan?.name}"
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
