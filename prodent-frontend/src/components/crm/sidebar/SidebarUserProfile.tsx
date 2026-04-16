import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useProfile } from "@/hooks/useProfile";

interface SidebarUserProfileProps {
  collapsed: boolean;
  roleName: string;
}

export function SidebarUserProfile({ collapsed, roleName }: SidebarUserProfileProps) {
  const { displayName, avatarUrl, initials } = useProfile();
  
  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <Avatar className="h-9 w-9 border-2 border-primary/20 cursor-pointer hover:border-primary/40 transition-colors">
            <AvatarImage src={avatarUrl || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs">
          <p className="font-medium">{displayName}</p>
          <p className="text-muted-foreground">{roleName}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
      <Avatar className="h-9 w-9 border-2 border-primary/20 shrink-0">
        <AvatarImage src={avatarUrl || undefined} />
        <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{displayName}</p>
        <p className="text-xs text-muted-foreground">{roleName}</p>
      </div>
    </div>
  );
}
