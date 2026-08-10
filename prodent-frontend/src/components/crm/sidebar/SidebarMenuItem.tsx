import { NavLink } from "@/components/NavLink";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface SidebarMenuItemProps {
  title: string;
  path: string;
  icon: LucideIcon;
  badge?: number;
  collapsed: boolean;
  onClick?: () => void;
}

export function SidebarMenuItem({
  title,
  path,
  icon: Icon,
  badge,
  collapsed,
  onClick,
}: SidebarMenuItemProps) {
  const content = (
    <NavLink
      to={path}
      onClick={onClick}
      className={cn(
        "group flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all duration-150",
        "text-sidebar-text/80 hover:bg-sidebar-hover hover:text-sidebar-text",
        collapsed && "justify-center px-2"
      )}
      activeClassName="bg-primary/10 text-primary font-medium"
    >
      <div className="relative shrink-0">
        <Icon className="w-[18px] h-[18px] transition-colors" />
        {badge && badge > 0 && collapsed && (
          <span className="absolute -top-1 -right-1 h-3.5 w-3.5 bg-destructive text-destructive-foreground text-xs font-bold rounded-full flex items-center justify-center">
            {badge > 9 ? "+" : badge}
          </span>
        )}
      </div>
      {!collapsed && (
        <>
          <span className="text-sm truncate">{title}</span>
          {badge && badge > 0 && (
            <Badge
              variant="destructive"
              className="ml-auto h-4 min-w-4 px-1 text-xs font-bold"
            >
              {badge > 99 ? "99+" : badge}
            </Badge>
          )}
        </>
      )}
    </NavLink>
  );

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="right" className="text-xs font-medium">
          {title}
          {badge && badge > 0 && (
            <Badge variant="destructive" className="ml-2 h-3.5 px-1 text-xs">
              {badge}
            </Badge>
          )}
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
}
