import { Check, Crown, Star, Zap } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { SubscriptionPlan } from '@/hooks/useSubscriptionPlan';

interface PlanCardProps {
  plan: SubscriptionPlan;
  isCurrentPlan: boolean;
  canAfford: boolean;
  onSelect: () => void;
  isLoading?: boolean;
}

const planIcons = {
  basic: <Star className="w-6 h-6" />,
  standard: <Zap className="w-6 h-6" />,
  gold: <Crown className="w-6 h-6" />,
};

const planColors = {
  basic: 'border-border bg-muted/20 text-muted-foreground',
  standard: 'border-blue-500 bg-blue-500/10 text-blue-500',
  gold: 'border-amber-500 bg-amber-500/10 text-amber-500',
};

const planBorderColors = {
  basic: 'border-border',
  standard: 'border-blue-500',
  gold: 'border-amber-500 border-2 shadow-lg',
};

export function PlanCard({ plan, isCurrentPlan, canAfford, onSelect, isLoading }: PlanCardProps) {
  const planKey = plan.name.toLowerCase() as 'basic' | 'standard' | 'gold';
  const isGold = planKey === 'gold';

  const formatPrice = (price: number) => {
    if (price === 0) return 'Бесплатно';
    return new Intl.NumberFormat('ru-RU').format(price) + ' UZS';
  };

  // Parse features from JSONB
  const features = Array.isArray(plan.features) 
    ? plan.features 
    : typeof plan.features === 'string' 
      ? JSON.parse(plan.features) 
      : [];

  return (
    <Card className={cn(
      'relative transition-all hover:shadow-md',
      planBorderColors[planKey],
      isCurrentPlan && 'ring-2 ring-primary ring-offset-2'
    )}>
      {isGold && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-white">
          Рекомендуем
        </Badge>
      )}
      {isCurrentPlan && (
        <Badge className="absolute -top-3 right-4 bg-green-500 text-white">
          Текущий план
        </Badge>
      )}
      
      <CardHeader className="text-center pb-2">
        <div className={cn(
          'w-12 h-12 mx-auto rounded-xl flex items-center justify-center mb-2',
          planColors[planKey]
        )}>
          {planIcons[planKey]}
        </div>
        <CardTitle className="text-lg">{plan.name_ru}</CardTitle>
        <CardDescription>
          <span className="text-2xl font-bold text-foreground">
            {formatPrice(plan.price)}
          </span>
          {plan.price > 0 && (
            <span className="text-sm text-muted-foreground"> / месяц</span>
          )}
        </CardDescription>
        {plan.appointment_limit && (
          <p className="text-xs text-muted-foreground mt-1">
            до {plan.appointment_limit} записей в месяц
          </p>
        )}
        {!plan.appointment_limit && plan.price > 0 && (
          <p className="text-xs text-green-600 mt-1">
            Безлимитные записи
          </p>
        )}
      </CardHeader>
      
      <CardContent className="space-y-4">
        <ul className="space-y-2 text-sm">
          {features.map((feature: string, idx: number) => (
            <li key={idx} className="flex items-start gap-2">
              <Check className="w-4 h-4 mt-0.5 text-green-500 shrink-0" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
        
        <Button
          className="w-full"
          variant={isCurrentPlan ? 'outline' : isGold ? 'default' : 'secondary'}
          disabled={isCurrentPlan || isLoading || (!canAfford && plan.price > 0)}
          onClick={onSelect}
        >
          {isCurrentPlan 
            ? 'Текущий план' 
            : !canAfford && plan.price > 0 
              ? 'Недостаточно средств' 
              : plan.price === 0 
                ? 'Текущий' 
                : 'Подписаться'}
        </Button>
      </CardContent>
    </Card>
  );
}
