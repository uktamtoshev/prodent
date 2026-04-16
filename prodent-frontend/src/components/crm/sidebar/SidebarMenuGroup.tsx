import { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface SidebarMenuGroupProps {
  title: string;
  children: ReactNode;
  collapsed: boolean;
  defaultOpen?: boolean;
}

export function SidebarMenuGroup({
  title,
  children,
  collapsed,
  defaultOpen = true,
}: SidebarMenuGroupProps) {
  if (collapsed) {
    return <div className="py-0.5">{children}</div>;
  }

  return (
    <Collapsible defaultOpen={defaultOpen} className="py-0.5">
      <CollapsibleTrigger className="flex items-center justify-between w-full px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 hover:text-muted-foreground transition-colors group">
        <span>{title}</span>
        <ChevronDown className="w-3 h-3 transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-0.5">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
