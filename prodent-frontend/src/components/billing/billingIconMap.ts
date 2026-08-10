import {
  Award,
  BadgePercent,
  Building2,
  Crown,
  Gem,
  Heart,
  Sparkles,
  Star,
  ThumbsUp,
  TrendingUp,
  Zap,
  type LucideIcon,
} from "lucide-react";

export const BILLING_ICON_MAP = {
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
} satisfies Record<string, LucideIcon>;

export function resolveBillingIcon(iconName: string | null | undefined): LucideIcon {
  if (iconName && iconName in BILLING_ICON_MAP) {
    return BILLING_ICON_MAP[iconName as keyof typeof BILLING_ICON_MAP];
  }
  return Award;
}
