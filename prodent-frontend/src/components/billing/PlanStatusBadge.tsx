import { Crown, Star, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface PlanStatusBadgeProps {
  plan: string | null;
  expiresAt: string | null;
  showExpiry?: boolean;
  size?: 'sm' | 'default';
}

const planConfig = {
  basic: {
    label: 'Базовый',
    icon: Star,
    className: 'bg-muted text-muted-foreground',
  },
  free: {
    label: 'Базовый',
    icon: Star,
    className: 'bg-muted text-muted-foreground',
  },
  standard: {
    label: 'Стандарт',
    icon: Zap,
    className: 'bg-blue-500/20 text-blue-600 border-blue-500/50',
  },
  premium: {
    label: 'Стандарт',
    icon: Zap,
    className: 'bg-blue-500/20 text-blue-600 border-blue-500/50',
  },
  gold: {
    label: 'Голд',
    icon: Crown,
    className: 'bg-amber-500/20 text-amber-600 border-amber-500/50',
  },
  top: {
    label: 'Голд',
    icon: Crown,
    className: 'bg-amber-500/20 text-amber-600 border-amber-500/50',
  },
};

export function PlanStatusBadge({ plan, expiresAt, showExpiry = true, size = 'default' }: PlanStatusBadgeProps) {
  const normalizedPlan = plan?.toLowerCase() || 'basic';
  const config = planConfig[normalizedPlan as keyof typeof planConfig] || planConfig.basic;
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
      {showExpiry && expiresAt && !isExpired && normalizedPlan !== 'basic' && normalizedPlan !== 'free' && (
        <span className="ml-1 text-muted-foreground">
          до {format(new Date(expiresAt), 'd MMM', { locale: ru })}
        </span>
      )}
      {isExpired && <span className="ml-1">(истёк)</span>}
    </Badge>
  );
}
