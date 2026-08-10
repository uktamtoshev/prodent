import { Crown, Star, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useLanguage } from '@/contexts/LanguageContext';

interface PlanStatusBadgeProps {
  plan: string | null;
  expiresAt: string | null;
  showExpiry?: boolean;
  size?: 'sm' | 'default';
}

export function PlanStatusBadge({ plan, expiresAt, showExpiry = true, size = 'default' }: PlanStatusBadgeProps) {
  const { t } = useLanguage();

  const planConfig = {
    basic: {
      label: t('billingDialogs.planBasicLabel'),
      icon: Star,
      className: 'bg-muted text-muted-foreground',
    },
    free: {
      label: t('billingDialogs.planBasicLabel'),
      icon: Star,
      className: 'bg-muted text-muted-foreground',
    },
    standard: {
      label: t('billingDialogs.planStandardLabel'),
      icon: Zap,
      className: 'bg-blue-500/20 text-blue-600 border-blue-500/50',
    },
    premium: {
      label: t('billingDialogs.planStandardLabel'),
      icon: Zap,
      className: 'bg-blue-500/20 text-blue-600 border-blue-500/50',
    },
    gold: {
      label: t('billingDialogs.planGoldLabel'),
      icon: Crown,
      className: 'bg-amber-500/20 text-amber-600 border-amber-500/50',
    },
    top: {
      label: t('billingDialogs.planGoldLabel'),
      icon: Crown,
      className: 'bg-amber-500/20 text-amber-600 border-amber-500/50',
    },
    enterprise: {
      label: t('billingDialogs.planEnterpriseLabel'),
      icon: Crown,
      className: 'bg-purple-500/20 text-purple-600 border-purple-500/50',
    },
  };

  const normalizedPlan = plan?.toLowerCase() || 'free';
  const config = planConfig[normalizedPlan as keyof typeof planConfig] || planConfig.free;
  const Icon = config.icon;

  const isExpired = expiresAt && new Date(expiresAt) < new Date();

  return (
    <Badge
      variant="outline"
      className={cn(
        config.className,
        size === 'sm' && 'text-xs px-2 py-0.5',
        isExpired && 'opacity-50'
      )}
    >
      <Icon className={cn('mr-1', size === 'sm' ? 'w-3 h-3' : 'w-4 h-4')} />
      {config.label}
      {showExpiry && expiresAt && !isExpired && normalizedPlan !== 'free' && (
        <span className="ml-1 text-muted-foreground">
          {t('billingDialogs.until')} {format(new Date(expiresAt), 'd MMM', { locale: ru })}
        </span>
      )}
      {isExpired && <span className="ml-1">{t('billingDialogs.expiredSuffix')}</span>}
    </Badge>
  );
}
