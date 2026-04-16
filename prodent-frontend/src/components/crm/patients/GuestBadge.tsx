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
              "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400",
              "border-slate-300 dark:border-slate-600",
              "cursor-help transition-colors hover:bg-slate-200 dark:hover:bg-slate-700",
              size === "sm" && "text-[10px] px-1.5 py-0",
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
export const GUEST_PATIENT_STYLE = {
  label: "Гость",
  sublabel: "Без регистрации",
  color: "text-slate-600 dark:text-slate-400",
  bgColor: "bg-slate-50 dark:bg-slate-900/50",
  borderColor: "border-slate-300 dark:border-slate-700",
  badgeBg: "bg-slate-100 dark:bg-slate-800",
  badgeText: "text-slate-600 dark:text-slate-400",
  badgeBorder: "border-slate-300 dark:border-slate-600",
};
