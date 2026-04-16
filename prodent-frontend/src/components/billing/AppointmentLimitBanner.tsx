import { AlertTriangle, Crown, TrendingUp } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useNavigate } from 'react-router-dom';
import type { AppointmentLimitInfo } from '@/hooks/useSubscriptionPlan';

interface AppointmentLimitBannerProps {
  limitInfo: AppointmentLimitInfo | null;
  entityType: 'doctor' | 'clinic';
  compact?: boolean;
}

export function AppointmentLimitBanner({ limitInfo, entityType, compact }: AppointmentLimitBannerProps) {
  const navigate = useNavigate();

  if (!limitInfo || limitInfo.limit === null) {
    // Unlimited plan, no banner needed
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
          {count}/{limit} записей
        </span>
        {isAtLimit && (
          <Button 
            size="sm" 
            variant="outline" 
            className="h-6 text-xs"
            onClick={() => navigate(entityType === 'doctor' ? '/doctor/billing' : '/crm/billing')}
          >
            <Crown className="w-3 h-3 mr-1" />
            Улучшить
          </Button>
        )}
      </div>
    );
  }

  if (isAtLimit) {
    return (
      <Alert variant="destructive" className="mb-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Лимит записей исчерпан</AlertTitle>
        <AlertDescription className="flex flex-col gap-3">
          <p>
            Вы использовали все {limit} записей в этом месяце. 
            Для создания новых записей перейдите на платный план.
          </p>
          <Button 
            variant="default" 
            size="sm" 
            className="w-fit"
            onClick={() => navigate(entityType === 'doctor' ? '/doctor/billing' : '/crm/billing')}
          >
            <Crown className="w-4 h-4 mr-2" />
            Улучшить план
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (isNearLimit) {
    return (
      <Alert className="mb-4 border-amber-500 bg-amber-500/10">
        <TrendingUp className="h-4 w-4 text-amber-600" />
        <AlertTitle className="text-amber-700">Приближается лимит записей</AlertTitle>
        <AlertDescription className="space-y-3">
          <div>
            <p className="text-sm text-amber-700 mb-2">
              Использовано {count} из {limit} записей. Осталось: {remaining}
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
            Перейти на безлимит
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}
