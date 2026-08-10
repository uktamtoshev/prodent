import { Crown, Sparkles, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BoostInfo } from '@/hooks/useAdCampaigns';

/**
 * Avatar overlay badge for actively-promoted doctors/clinics. Place inside
 * a `relative` parent (e.g. wrap around an Avatar). The badge sits in the
 * top-right corner and changes appearance per package type:
 *   top_day   → gold ★    (single day premium spot)
 *   top_week  → silver ✨ (weekly featured)
 *   top_month → bronze 👑 (monthly highlight)
 *   banner    → no avatar badge (banner shows on its own slot)
 */
interface BoostBadgeProps {
  boost: BoostInfo | undefined | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const STYLES: Record<BoostInfo['package_type'], {
  icon: React.ComponentType<{ className?: string }>;
  bg: string;
  ring: string;
  label: string;
}> = {
  top_day: {
    icon: Star,
    bg: 'bg-gradient-to-br from-amber-400 to-yellow-500',
    ring: 'ring-amber-300',
    label: 'TOP DAY',
  },
  top_week: {
    icon: Sparkles,
    bg: 'bg-gradient-to-br from-sky-400 to-cyan-500',
    ring: 'ring-sky-300',
    label: 'TOP WEEK',
  },
  top_month: {
    icon: Crown,
    bg: 'bg-gradient-to-br from-violet-500 to-purple-600',
    ring: 'ring-violet-300',
    label: 'TOP MONTH',
  },
  banner: {
    icon: Star,
    bg: 'bg-gradient-to-br from-emerald-400 to-teal-500',
    ring: 'ring-emerald-300',
    label: 'BANNER',
  },
};

const SIZE_CLASSES: Record<NonNullable<BoostBadgeProps['size']>, string> = {
  sm: 'w-4 h-4 -top-0.5 -right-0.5',
  md: 'w-5 h-5 -top-1 -right-1',
  lg: 'w-7 h-7 -top-1.5 -right-1.5',
};

const ICON_SIZE: Record<NonNullable<BoostBadgeProps['size']>, string> = {
  sm: 'w-2.5 h-2.5',
  md: 'w-3 h-3',
  lg: 'w-4 h-4',
};

export function BoostBadge({ boost, size = 'md', className }: BoostBadgeProps) {
  // Banner-type boost is the rotating-banner-slot package, not an avatar
  // award. Hide for avatars (it has its own placement on the home page).
  if (!boost || boost.package_type === 'banner') return null;
  const style = STYLES[boost.package_type];
  const Icon = style.icon;
  return (
    <span
      title={style.label}
      className={cn(
        'absolute rounded-full ring-2 ring-background shadow-md flex items-center justify-center',
        SIZE_CLASSES[size],
        style.bg,
        style.ring,
        className,
      )}
    >
      <Icon className={cn('text-white drop-shadow', ICON_SIZE[size])} />
    </span>
  );
}
