import {
  Award,
  Crown,
  ThumbsUp,
  Gem,
  Sparkles,
  Heart,
  Zap,
  BadgePercent,
  Building2,
  TrendingUp,
  Star,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ActiveBadge } from '@/hooks/useBadgeAssignments';

/**
 * Admin-assigned badge overlay for the doctor/clinic avatar. Placed in the
 * top-LEFT corner (BoostBadge — the paid-ad indicator — sits in top-RIGHT).
 * Pulls icon/color/bg_color from the admin Badges editor (`badges` table).
 *
 * If the doctor has multiple assigned badges, this renders the FIRST one
 * (the full chip list still lives in `<BadgeDisplay>` on the profile page).
 */
const ICON_MAP: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  Award, Crown, ThumbsUp, Gem, Sparkles, Heart, Zap, BadgePercent, Building2, TrendingUp, Star,
};

interface AwardBadgeOverlayProps {
  badge: ActiveBadge | undefined | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<AwardBadgeOverlayProps['size']>, string> = {
  sm: 'w-4 h-4 -top-0.5 -left-0.5',
  md: 'w-5 h-5 -top-1 -left-1',
  lg: 'w-7 h-7 -top-1.5 -left-1.5',
};

const ICON_SIZE: Record<NonNullable<AwardBadgeOverlayProps['size']>, string> = {
  sm: 'w-2.5 h-2.5',
  md: 'w-3 h-3',
  lg: 'w-4 h-4',
};

export function AwardBadgeOverlay({ badge, size = 'md', className }: AwardBadgeOverlayProps) {
  if (!badge) return null;
  const Icon = ICON_MAP[badge.icon] || Award;
  return (
    <span
      title={badge.name}
      className={cn(
        'absolute rounded-full ring-2 ring-background shadow-md flex items-center justify-center',
        SIZE_CLASSES[size],
        className,
      )}
      style={{ backgroundColor: badge.bg_color, borderColor: badge.color }}
    >
      <Icon className={cn(ICON_SIZE[size])} style={{ color: badge.color }} />
    </span>
  );
}
