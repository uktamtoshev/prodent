import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { UserX } from "lucide-react";
import { cn } from "@/lib/utils";

interface GuestBadgeProps {
  size?: "sm" | "default";
  showIcon?: boolean;
  className?: string;
}

export function GuestBadge({ size = "default", showIcon = true, className }: GuestBadgeProps) {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn(
              "bg-muted text-muted-foreground",
              "border-border dark:border-border",
              "cursor-help transition-colors hover:bg-accent",
              size === "sm" && "text-xs px-1.5 py-0",
              className
            )}
          >
            {showIcon && <UserX className={cn("mr-1", size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3")} />}
            Гость
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>Пациент без регистрации</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Styling constants for guest patients
const GUEST_PATIENT_STYLE = {
  label: "Гость",
  sublabel: "Без регистрации",
  color: "text-muted-foreground dark:text-muted-foreground",
  bgColor: "bg-muted/50",
  borderColor: "border-border dark:border-border",
  badgeBg: "bg-muted",
  badgeText: "text-muted-foreground dark:text-muted-foreground",
  badgeBorder: "border-border dark:border-border",
};
