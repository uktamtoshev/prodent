import { useId, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { useSystemLabel } from "./system-labels";

export interface AppShellProps {
  header?: ReactNode;
  sidebar?: ReactNode;
  children: ReactNode;
  className?: string;
  mainClassName?: string;
  mainId?: string;
}

export function AppShell({ header, sidebar, children, className, mainClassName, mainId }: AppShellProps) {
  const label = useSystemLabel();
  const generatedMainId = `app-shell-main-${useId().replace(/:/g, "")}`;
  const resolvedMainId = mainId ?? generatedMainId;

  return (
    <div className={cn("min-h-screen bg-background text-foreground", className)}>
      <a href={`#${resolvedMainId}`} className="sr-only z-50 rounded-md bg-background p-3 focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        {label("skipToContent")}
      </a>
      {header ? <header className="sticky top-0 z-40 border-b border-border bg-background">{header}</header> : null}
      <div className="flex min-h-0">
        {sidebar ? <aside className="hidden shrink-0 border-r border-border bg-card md:block">{sidebar}</aside> : null}
        <main id={resolvedMainId} tabIndex={-1} className={cn("min-w-0 flex-1 p-4 sm:p-6", mainClassName)}>
          {children}
        </main>
      </div>
    </div>
  );
}
