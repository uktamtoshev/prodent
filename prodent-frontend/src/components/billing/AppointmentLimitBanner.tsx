import { AlertTriangle, Crown, TrendingUp } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useNavigate } from 'react-router-dom';
import type { AppointmentLimitInfo } from '@/hooks/useSubscriptionPlan';
import { useLanguage } from '@/contexts/LanguageContext';

interface AppointmentLimitBannerProps {
  limitInfo: AppointmentLimitInfo | null;
  entityType: 'doctor' | 'clinic';
  compact?: boolean;
}

export function AppointmentLimitBanner({ limitInfo, entityType, compact }: AppointmentLimitBannerProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();

  if (!limitInfo || typeof limitInfo.limit !== 'number') {
    // Unlimited plan or no plan data — no banner
    return null;
  }

  const { count, limit, can_create, remaining } = limitInfo;
  const usagePercent = (count / limit) * 100;
  const isNearLimit = usagePercent >= 80;
  const isAtLimit = !can_create;

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className={isAtLimit ? 'text-destructive' : isNearLimit ? 'text-amber-600' : 'text-muted-foreground'}>
          {count}/{limit} {t('billingDialogs.appointmentsLeft')}
        </span>
        {isAtLimit && (
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-xs"
            onClick={() => navigate(entityType === 'doctor' ? '/doctor/billing' : '/crm/billing')}
          >
            <Crown className="w-3 h-3 mr-1" />
            {t('billingDialogs.upgradeShort')}
          </Button>
        )}
      </div>
    );
  }

  if (isAtLimit) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>{t('billingDialogs.limitExhaustedTitle')}</AlertTitle>
        <AlertDescription className="flex flex-col gap-3">
          <p>
            {t('billingDialogs.limitExhaustedText').replace('{limit}', String(limit))}
          </p>
          <Button
            variant="default"
            size="sm"
            className="w-fit"
            onClick={() => navigate(entityType === 'doctor' ? '/doctor/billing' : '/crm/billing')}
          >
            <Crown className="w-4 h-4 mr-2" />
            {t('billingDialogs.upgradePlanBtn')}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (isNearLimit) {
    return (
      <Alert className="mb-4 border-amber-500 bg-amber-500/10">
        <TrendingUp className="h-4 w-4 text-amber-600" />
        <AlertTitle className="text-amber-700">{t('billingDialogs.approachingLimitTitle')}</AlertTitle>
        <AlertDescription className="space-y-3">
          <div>
            <p className="text-sm text-amber-700 mb-2">
              {t('billingDialogs.approachingLimitText').replace('{count}', String(count)).replace('{limit}', String(limit)).replace('{remaining}', String(remaining))}
            </p>
            <Progress value={usagePercent} className="h-2" />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-amber-500 text-amber-700 hover:bg-amber-500/20"
            onClick={() => navigate(entityType === 'doctor' ? '/doctor/billing' : '/crm/billing')}
          >
            <Crown className="w-4 h-4 mr-2" />
            {t('billingDialogs.goUnlimited')}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}
