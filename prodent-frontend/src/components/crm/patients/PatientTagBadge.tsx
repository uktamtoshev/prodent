import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  Baby,
  Banknote,
  Crown,
  Heart,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

const TAG_CONFIG: Record<
  string,
  {
    classes: string;
    ring: string;
    icon: LucideIcon | null;
  }
> = {
  VIP: {
    classes:
      "border-warning-amber/35 bg-warning-amber/10 text-foreground",
    ring: "ring-warning-amber",
    icon: Crown,
  },
  Дети: {
    classes: "border-primary/30 bg-primary/10 text-foreground",
    ring: "ring-primary",
    icon: Baby,
  },
  Аллергия: {
    classes: "border-destructive/30 bg-destructive/10 text-foreground",
    ring: "ring-destructive",
    icon: AlertTriangle,
  },
  Долг: {
    classes:
      "border-warning-amber/35 bg-warning-amber/10 text-foreground",
    ring: "ring-warning-amber",
    icon: Banknote,
  },
  Постоянный: {
    classes:
      "border-success-green/30 bg-success-green/10 text-foreground",
    ring: "ring-success-green",
    icon: Heart,
  },
  Новый: {
    classes: "border-primary/30 bg-primary/10 text-foreground",
    ring: "ring-primary",
    icon: Sparkles,
  },
};

const DEFAULT_CONFIG: {
  classes: string;
  ring: string;
  icon: LucideIcon | null;
} = {
  classes: "border-border bg-muted text-muted-foreground",
  ring: "ring-ring",
  icon: Sparkles,
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
  const content = (
    <>
      {showIcon && Icon && (
        <Icon
          aria-hidden="true"
          className={cn("mr-1", size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5")}
        />
      )}
      {tag}
      {count !== undefined && (
        <span className="ml-1 text-xs opacity-70">({count})</span>
      )}
    </>
  );
  const classes = cn(
    "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold transition-all duration-200",
    config.classes,
    selected && "ring-2 ring-offset-1 ring-offset-background",
    selected && config.ring,
  );

  if (onClick) {
    return (
      <button
        type="button"
        aria-pressed={selected}
        onClick={onClick}
        className={cn(
          classes,
          "min-h-11 cursor-pointer hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        )}
      >
        {content}
      </button>
    );
  }

  return (
    <Badge
      variant="outline"
      className={classes}
    >
      {content}
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
  const config =
    tag === "all" ? DEFAULT_CONFIG : TAG_CONFIG[tag] || DEFAULT_CONFIG;
  const Icon = tag === "all" ? null : config.icon;
  const isAll = tag === "all";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        selected
          ? isAll
            ? "border-transparent bg-foreground text-background"
            : cn(
                config.classes,
                config.ring,
                "ring-2 ring-offset-1 ring-offset-background",
              )
          : "border-border bg-card text-muted-foreground hover:border-foreground/25 hover:text-foreground",
      )}
    >
      {Icon && <Icon aria-hidden="true" className="h-3.5 w-3.5" />}
      {label}
      <span
        className={cn(
          "rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground",
          selected && isAll && "bg-background/20 text-background",
        )}
      >
        {count}
      </span>
    </button>
  );
}
