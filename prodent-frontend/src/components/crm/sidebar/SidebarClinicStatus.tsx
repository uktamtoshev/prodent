import { useClinic } from "@/contexts/ClinicContext";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Building2 } from "lucide-react";

interface SidebarClinicStatusProps {
  collapsed: boolean;
}

export function SidebarClinicStatus({ collapsed }: SidebarClinicStatusProps) {
  const { currentClinic } = useClinic();

  if (!currentClinic) return null;

  const isOnline = true;
  const queueCount = 3;

  const content = (
    <div
      className={cn(
        "flex items-center gap-2 px-2.5 py-2 rounded-lg bg-primary/5 border border-primary/10",
        collapsed && "justify-center px-2"
      )}
    >
      <div className="relative shrink-0">
        <Building2 className="w-4 h-4 text-primary" />
        <span className={cn(
          "absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-background",
          isOnline ? "bg-green-500" : "bg-muted-foreground"
        )} />
      </div>
      {!collapsed && (
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">{currentClinic.name}</p>
          <p className="text-[10px] text-muted-foreground">
            {isOnline ? `${queueCount} в очереди` : "Офлайн"}
          </p>
        </div>
      )}
    </div>
  );

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right" className="text-xs">
          <p className="font-medium">{currentClinic.name}</p>
          <p className="text-muted-foreground">{queueCount} в очереди</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
}
