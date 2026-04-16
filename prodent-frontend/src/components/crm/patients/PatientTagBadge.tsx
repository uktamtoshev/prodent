import { Badge } from "@/components/ui/badge";
import { Crown, Baby, AlertTriangle, Banknote, Heart, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

// Tag configuration with colors and icons
const TAG_CONFIG: Record<string, { 
  color: string; 
  bgColor: string; 
  borderColor: string;
  icon: LucideIcon;
}> = {
  VIP: {
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-50 dark:bg-amber-900/30",
    borderColor: "border-amber-200 dark:border-amber-800",
    icon: Crown,
  },
  Дети: {
    color: "text-sky-600 dark:text-sky-400",
    bgColor: "bg-sky-50 dark:bg-sky-900/30",
    borderColor: "border-sky-200 dark:border-sky-800",
    icon: Baby,
  },
  Аллергия: {
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-50 dark:bg-red-900/30",
    borderColor: "border-red-200 dark:border-red-800",
    icon: AlertTriangle,
  },
  Долг: {
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-50 dark:bg-orange-900/30",
    borderColor: "border-orange-200 dark:border-orange-800",
    icon: Banknote,
  },
  Постоянный: {
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-50 dark:bg-emerald-900/30",
    borderColor: "border-emerald-200 dark:border-emerald-800",
    icon: Heart,
  },
  Новый: {
    color: "text-violet-600 dark:text-violet-400",
    bgColor: "bg-violet-50 dark:bg-violet-900/30",
    borderColor: "border-violet-200 dark:border-violet-800",
    icon: Sparkles,
  },
};

const DEFAULT_CONFIG = {
  color: "text-neutral-600 dark:text-neutral-400",
  bgColor: "bg-neutral-100 dark:bg-neutral-800",
  borderColor: "border-neutral-200 dark:border-neutral-700",
  icon: null as LucideIcon | null,
};

interface PatientTagBadgeProps {
  tag: string;
  count?: number;
  selected?: boolean;
  onClick?: () => void;
  showIcon?: boolean;
  size?: "sm" | "md";
}

export function PatientTagBadge({ 
  tag, 
  count, 
  selected = false, 
  onClick,
  showIcon = true,
  size = "md"
}: PatientTagBadgeProps) {
  const config = TAG_CONFIG[tag] || DEFAULT_CONFIG;
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      onClick={onClick}
      className={cn(
        "cursor-pointer transition-all duration-200 font-medium",
        config.bgColor,
        config.color,
        config.borderColor,
        selected && "ring-2 ring-offset-1 ring-offset-background",
        selected && tag === "VIP" && "ring-amber-400",
        selected && tag === "Дети" && "ring-sky-400",
        selected && tag === "Аллергия" && "ring-red-400",
        selected && tag === "Долг" && "ring-orange-400",
        selected && tag === "Постоянный" && "ring-emerald-400",
        selected && tag === "Новый" && "ring-violet-400",
        selected && !TAG_CONFIG[tag] && "ring-neutral-400",
        onClick && "hover:opacity-80",
        size === "sm" ? "text-[10px] px-1.5 py-0" : "text-xs px-2 py-0.5"
      )}
    >
      {showIcon && Icon && <Icon className={cn("mr-1", size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3")} />}
      {tag}
      {count !== undefined && (
        <span className={cn("ml-1 opacity-70", size === "sm" ? "text-[9px]" : "text-[10px]")}>
          ({count})
        </span>
      )}
    </Badge>
  );
}

// Filter button variant for the tag filters
interface TagFilterButtonProps {
  tag: string;
  label: string;
  count: number;
  selected: boolean;
  onClick: () => void;
}

export function TagFilterButton({ tag, label, count, selected, onClick }: TagFilterButtonProps) {
  const config = tag === "all" ? DEFAULT_CONFIG : (TAG_CONFIG[tag] || DEFAULT_CONFIG);
  const Icon = config.icon;
  const isAll = tag === "all";

  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200",
        "border",
        selected
          ? isAll
            ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border-transparent"
            : cn(config.bgColor, config.color, config.borderColor, "ring-2 ring-offset-1 ring-offset-background")
          : "bg-white dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600"
      )}
    >
      {!isAll && Icon && <Icon className="h-3.5 w-3.5" />}
      {label}
      <span className={cn(
        "text-xs px-1.5 py-0.5 rounded-full",
        selected && isAll 
          ? "bg-white/20 dark:bg-black/20" 
          : "bg-neutral-100 dark:bg-neutral-700"
      )}>
        {count}
      </span>
    </button>
  );
}
