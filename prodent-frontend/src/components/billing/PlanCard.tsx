import { Check, Crown, Star, Zap, Building2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { planAppointmentLimit, type SubscriptionPlan } from '@/hooks/useSubscriptionPlan';
import { useLanguage } from '@/contexts/LanguageContext';

interface PlanCardProps {
  plan: SubscriptionPlan;
  isCurrentPlan: boolean;
  canAfford: boolean;
  onSelect: () => void;
  isLoading?: boolean;
}

type PlanKey = 'FREE' | 'BASIC' | 'PREMIUM' | 'ENTERPRISE';

const planIcons: Record<PlanKey, JSX.Element> = {
  FREE: <Star className="w-6 h-6" />,
  BASIC: <Zap className="w-6 h-6" />,
  PREMIUM: <Crown className="w-6 h-6" />,
  ENTERPRISE: <Building2 className="w-6 h-6" />,
};

const planColors: Record<PlanKey, string> = {
  FREE: 'border-border bg-muted/20 text-muted-foreground',
  BASIC: 'border-blue-500 bg-blue-500/10 text-blue-500',
  PREMIUM: 'border-amber-500 bg-amber-500/10 text-amber-500',
  ENTERPRISE: 'border-purple-500 bg-purple-500/10 text-purple-500',
};

const planBorderColors: Record<PlanKey, string> = {
  FREE: 'border-border',
  BASIC: 'border-blue-500',
  PREMIUM: 'border-amber-500 border-2 shadow-lg',
  ENTERPRISE: 'border-purple-500',
};

export function PlanCard({ plan, isCurrentPlan, canAfford, onSelect, isLoading }: PlanCardProps) {
  const { t } = useLanguage();
  const planKey = (plan.slug?.toUpperCase() as PlanKey) || 'FREE';
  const isRecommended = planKey === 'PREMIUM';

  const formatPrice = (price: number) => {
    if (price === 0) return t('billingDialogs.free');
    return new Intl.NumberFormat('ru-RU').format(price) + ' UZS';
  };

  // Build human-readable feature bullets from the plan's features map + limits.
  const apptLimit = planAppointmentLimit(plan);
  const f = plan.features ?? {};
  const maxPatients =
    typeof plan.max_patients === 'number'
      ? plan.max_patients
      : typeof f.max_patients === 'number'
        ? f.max_patients
        : null;

  const bullets: string[] = [];
  bullets.push(
    apptLimit == null
      ? t('billingDialogs.unlimitedAppts')
      : t('billingDialogs.upToAppointments').replace('{limit}', String(apptLimit)),
  );
  if (maxPatients != null) {
    bullets.push(
      maxPatients < 0
        ? t('billingDialogs.unlimitedPatients')
        : t('billingDialogs.upToPatients').replace('{limit}', String(maxPatients)),
    );
  }
  if (f.analytics) bullets.push(t('billingDialogs.featureAnalytics'));
  if (f.priority_support) bullets.push(t('billingDialogs.featurePrioritySupport'));
  if (f.api_access) bullets.push(t('billingDialogs.featureApiAccess'));

  return (
    <Card className={cn(
      'relative transition-all hover:shadow-md',
      planBorderColors[planKey],
      isCurrentPlan && 'ring-2 ring-primary ring-offset-2'
    )}>
      {isRecommended && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-white">
          {t('billingDialogs.recommended')}
        </Badge>
      )}
      {isCurrentPlan && (
        <Badge className="absolute -top-3 right-4 bg-green-500 text-white">
          {t('billingDialogs.currentPlanBadge')}
        </Badge>
      )}

      <CardHeader className="text-center pb-2">
        <div className={cn(
          'w-12 h-12 mx-auto rounded-xl flex items-center justify-center mb-2',
          planColors[planKey]
        )}>
          {planIcons[planKey]}
        </div>
        <CardTitle className="text-lg">{plan.name_ru || plan.name}</CardTitle>
        <CardDescription>
          <span className="text-2xl font-bold text-foreground">
            {formatPrice(plan.price)}
          </span>
          {plan.price > 0 && (
            <span className="text-sm text-muted-foreground"> / {t('billingDialogs.perMonth')}</span>
          )}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <ul className="space-y-2 text-sm">
          {bullets.map((feature, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <Check className="w-4 h-4 mt-0.5 text-green-500 shrink-0" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        <Button
          className="w-full"
          variant={isCurrentPlan ? 'outline' : isRecommended ? 'default' : 'secondary'}
          disabled={isCurrentPlan || isLoading || (!canAfford && plan.price > 0)}
          onClick={onSelect}
        >
          {isCurrentPlan
            ? t('billingDialogs.currentPlanBtn')
            : !canAfford && plan.price > 0
              ? t('billingDialogs.insufficientFundsBtn')
              : plan.price === 0
                ? t('billingDialogs.currentBtn')
                : t('billingDialogs.subscribeBtn')}
        </Button>
      </CardContent>
    </Card>
  );
}
