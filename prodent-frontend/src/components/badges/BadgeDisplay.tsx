import React from "react";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
import { ActiveBadge } from "@/hooks/useBadgeAssignments";
import { useLanguage } from "@/contexts/LanguageContext";

const iconMap: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
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
};

interface BadgeDisplayProps {
  badges: ActiveBadge[];
  size?: "sm" | "md";
  maxBadges?: number;
  className?: string;
}

export const BadgeDisplay: React.FC<BadgeDisplayProps> = ({ 
  badges, 
  size = "sm", 
  maxBadges = 2,
  className = "" 
}) => {
  const { language } = useLanguage();
  
  if (!badges || badges.length === 0) return null;

  const displayBadges = badges.slice(0, maxBadges);
  const remaining = badges.length - maxBadges;

  const getBadgeName = (badge: ActiveBadge) => {
    if (language === "uz" && badge.name_uz) return badge.name_uz;
    if (language === "en" && badge.name_en) return badge.name_en;
    return badge.name;
  };

  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {displayBadges.map((badge) => {
        const IconComponent = iconMap[badge.icon] || Award;
        const isSmall = size === "sm";
        
        return (
          <Badge
            key={badge.id}
            style={{
              backgroundColor: badge.bg_color,
              color: badge.color,
              borderColor: badge.color,
              boxShadow: `0 2px 8px ${badge.color}40`,
            }}
            className={`gap-1 border-2 font-semibold ${isSmall ? "text-[11px] px-2 py-1" : "text-xs px-2.5 py-1.5"}`}
          >
            <IconComponent 
              className={isSmall ? "w-3.5 h-3.5" : "w-4 h-4"} 
              style={{ color: badge.color }} 
            />
            <span className="truncate max-w-[100px]">{getBadgeName(badge)}</span>
          </Badge>
        );
      })}
      {remaining > 0 && (
        <Badge variant="secondary" className={`font-semibold ${size === "sm" ? "text-[11px] px-2 py-1" : "text-xs px-2.5 py-1.5"}`}>
          +{remaining}
        </Badge>
      )}
    </div>
  );
};

interface SingleBadgeProps {
  badge: ActiveBadge;
  size?: "sm" | "md" | "lg";
}

export const SingleBadge: React.FC<SingleBadgeProps> = ({ badge, size = "md" }) => {
  const { language } = useLanguage();
  const IconComponent = iconMap[badge.icon] || Award;

  const getBadgeName = () => {
    if (language === "uz" && badge.name_uz) return badge.name_uz;
    if (language === "en" && badge.name_en) return badge.name_en;
    return badge.name;
  };

  const sizeClasses = {
    sm: "text-[10px] px-1.5 py-0.5",
    md: "text-xs px-2 py-1",
    lg: "text-sm px-3 py-1.5",
  };

  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-3.5 h-3.5",
    lg: "w-4 h-4",
  };

  return (
    <Badge
      style={{
        backgroundColor: badge.bg_color,
        color: badge.color,
        borderColor: badge.color,
      }}
      className={`gap-1 border ${sizeClasses[size]}`}
    >
      <IconComponent className={iconSizes[size]} style={{ color: badge.color }} />
      {getBadgeName()}
    </Badge>
  );
};
